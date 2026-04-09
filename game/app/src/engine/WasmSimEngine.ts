/**
 * WASM engine — sole simulation entry point for the Blink RPG.
 *
 * Uses the pre-compiled WASM module produced by `npm run build:wasm`.
 *
 * The simulation:
 *   • Produces exactly 30 checkpoints (one per 100 kills up to 3000)
 *   • Does not require an IR file — game rules are baked into the binary
 *   • Accepts runtime data (heroes, enemies, config) via create_entity/add_component
 */

import type { GameSnapshot, HeroDefinition, GameMode, HeroPath, CustomModeSettings, EnvironmentSettings, DamageCategory, Element } from '../types';
import { DEFAULT_ENVIRONMENT_SETTINGS } from '../types';
import { simulateHeroPath, getSkillName, deriveDamageCategory, deriveDamageElement, deriveResistances } from '../data/traits';

// ── Hero stats per class ────────────────────────────────────────────────────

const CLASS_BASE_HP: Record<string, number> = {
  Warrior: 250, Mage: 150, Ranger: 140, Paladin: 220, Rogue: 130, Cleric: 180,
};

const CLASS_BASE_DAMAGE: Record<string, number> = {
  Warrior: 28, Mage: 35, Ranger: 22, Paladin: 20, Rogue: 24, Cleric: 16,
};

const CLASS_BASE_DEFENSE: Record<string, number> = {
  Warrior: 12, Mage: 5, Ranger: 7, Paladin: 14, Rogue: 6, Cleric: 8,
};

const CLASS_SKILLS: Record<string, [string, string, string, string]> = {
  Warrior: ['power_strike', 'shield_bash', 'defensive_stance', 'execute'],
  Mage:    ['fireball', 'frost_bolt', 'arcane_blast', 'mana_shield'],
  Ranger:  ['arrow_shot', 'multi_shot', 'evade', 'trap'],
  Paladin: ['holy_strike', 'divine_shield', 'consecrate', 'lay_on_hands'],
  Rogue:   ['backstab', 'smoke_bomb', 'poison_blade', 'shadowstep'],
  Cleric:  ['heal', 'smite', 'divine_favor', 'holy_word'],
};

const CLASS_ATTACK_SPEED: Record<string, number> = {
  Warrior: 0.9, Mage: 0.6, Ranger: 1.1, Paladin: 0.7, Rogue: 1.3, Cleric: 0.6,
};

// ── Game mode spawn configs ─────────────────────────────────────────────────

const MODE_CONFIGS: Record<Exclude<GameMode, 'custom'>, {
  bossEveryKills: number; tierProgressionKills: number;
  healthScaleRate: number; damageScaleRate: number; initialEnemyCount: number;
  retreatTimePenalty: number; deathTimePenaltyMultiplier: number; fleeCooldown: number;
  pointsPerKill: number; pointsPerWave: number; pointsPerBoss: number;
  pointsLostPerDeath: number; pointsLostPerRetreat: number; pointsLostPerPenaltySecond: number;
  timeBonusPoints: number; timeBonusInterval: number;
}> = {
  normal: {
    bossEveryKills: 100, tierProgressionKills: 500,
    healthScaleRate: 200, damageScaleRate: 300, initialEnemyCount: 5,
    retreatTimePenalty: 10.0, deathTimePenaltyMultiplier: 5.0, fleeCooldown: 5.0,
    pointsPerKill: 10, pointsPerWave: 50, pointsPerBoss: 500,
    pointsLostPerDeath: 100, pointsLostPerRetreat: 50, pointsLostPerPenaltySecond: 2,
    timeBonusPoints: 1000, timeBonusInterval: 10.0,
  },
  // Easy = all numeric parameters × 0.5 vs Normal (less intense experience overall)
  easy: {
    bossEveryKills: 150, tierProgressionKills: 750,
    healthScaleRate: 100, damageScaleRate: 150, initialEnemyCount: 3,
    retreatTimePenalty: 5.0, deathTimePenaltyMultiplier: 2.5, fleeCooldown: 5.0,
    pointsPerKill: 5, pointsPerWave: 25, pointsPerBoss: 250,
    pointsLostPerDeath: 50, pointsLostPerRetreat: 25, pointsLostPerPenaltySecond: 1,
    timeBonusPoints: 500, timeBonusInterval: 15.0,
  },
  // Hard = all numeric parameters × 1.5 vs Normal (higher stakes, bigger rewards and penalties)
  hard: {
    bossEveryKills: 75, tierProgressionKills: 400,
    healthScaleRate: 300, damageScaleRate: 450, initialEnemyCount: 7,
    retreatTimePenalty: 15.0, deathTimePenaltyMultiplier: 7.5, fleeCooldown: 5.0,
    pointsPerKill: 15, pointsPerWave: 75, pointsPerBoss: 750,
    pointsLostPerDeath: 150, pointsLostPerRetreat: 75, pointsLostPerPenaltySecond: 3,
    timeBonusPoints: 1500, timeBonusInterval: 5.0,
  },
};

// ── Enemy template data ─────────────────────────────────────────────────────

const ENEMY_TEMPLATES = [
  { id: 100, tier: 1, name: 'Goblin Scout',      hp: 60,  dmg: 8,  spd: 1.0, exp: 25,  boss: false },
  { id: 101, tier: 2, name: 'Orc Raider',        hp: 90,  dmg: 12, spd: 0.8, exp: 35,  boss: false },
  { id: 102, tier: 2, name: 'Dark Wolf',         hp: 75,  dmg: 14, spd: 1.2, exp: 40,  boss: false },
  { id: 103, tier: 3, name: 'Skeleton Warrior',  hp: 110, dmg: 16, spd: 0.7, exp: 50,  boss: false },
  { id: 104, tier: 3, name: 'Dark Mage',         hp: 80,  dmg: 22, spd: 0.5, exp: 75,  boss: false },
  { id: 105, tier: 4, name: 'Troll Berserker',   hp: 180, dmg: 22, spd: 0.6, exp: 80,  boss: false },
  { id: 106, tier: 5, name: 'Demon Knight',      hp: 250, dmg: 30, spd: 0.7, exp: 150, boss: false },
  { id: 107, tier: 6, name: 'Ancient Dragon',    hp: 400, dmg: 40, spd: 0.8, exp: 300, boss: false },
  { id: 108, tier: 6, name: 'Dragon Lord Vexar', hp: 500, dmg: 40, spd: 0.8, exp: 500, boss: true  },
];

// ── WASM module loader ──────────────────────────────────────────────────────

/** Minimal interface of the wasm-bindgen generated BlinkWasmGame class */
interface BlinkWasmGame {
  init_static(): void;
  create_entity(id: number): void;
  add_component(entityId: number, componentName: string, fieldsJson: string): boolean;
  get_component(entityId: number, componentName: string): string;
  schedule_event(eventType: string, delay: number): void;
  step(): boolean;
  run_steps(maxSteps: number): number;
  has_events(): boolean;
  get_time(): number;
  free(): void;
}

interface WasmModule {
  default: (input?: RequestInfo | URL) => Promise<unknown>;
  BlinkWasmGame: (new () => BlinkWasmGame) & {
    /** Create an engine with an explicit seed (for reproducibility or testing). */
    with_seed(seed: bigint): BlinkWasmGame;
  };
}

let cachedModule: WasmModule | null | 'loading' | 'unavailable' = null;

/**
 * Try to load the wasm-pack generated module from the public/wasm/ directory.
 * Returns the module on success, or null if not available.
 *
 * The result is cached after the first call.
 */
async function loadWasmModule(): Promise<WasmModule | null> {
  if (cachedModule === 'unavailable') return null;
  if (cachedModule && cachedModule !== 'loading') return cachedModule;

  cachedModule = 'loading';

  const base = import.meta.env?.BASE_URL ?? '/';
  const jsUrl = `${base}wasm/blink_rpg_wasm.js`.replace('//', '/');
  const wasmUrl = `${base}wasm/blink_rpg_wasm_bg.wasm`.replace('//', '/');

  try {
    // Probe: is the WASM available?
    const probe = await fetch(jsUrl, { method: 'HEAD' });
    if (!probe.ok) {
      cachedModule = 'unavailable';
      return null;
    }

    // Dynamic import — @vite-ignore tells Vite not to try to bundle this path.
    // The file is served from public/ and loaded at runtime.
    const mod = await import(/* @vite-ignore */ jsUrl) as WasmModule;

    // Initialise the WASM binary (pass explicit URL so it works regardless of
    // where import.meta.url points inside the dynamic module).
    await mod.default(wasmUrl);

    cachedModule = mod;
    return mod;
  } catch {
    cachedModule = 'unavailable';
    return null;
  }
}

// ── Custom-mode config builder ───────────────────────────────────────────────

/**
 * Derives a custom mode configuration from the normal-mode baseline by
 * applying percentage offsets supplied via the slider settings.
 */
function buildCustomConfig(settings: CustomModeSettings) {
  const base = MODE_CONFIGS.normal;
  const hpMult   = 1 + settings.heroPenaltyPct       / 100;
  const wpMult   = 1 + settings.wipeoutPenaltyPct    / 100;
  const diffMult = 1 + settings.encounterDifficultyPct / 100;

  return {
    ...base,
    // Death-penalty group (hero penalty slider)
    pointsLostPerDeath: Math.round(base.pointsLostPerDeath * hpMult),
    // Wipeout/respawn-time penalty group (wipeout slider)
    deathTimePenaltyMultiplier: base.deathTimePenaltyMultiplier * wpMult,
    retreatTimePenalty: base.retreatTimePenalty * wpMult,
    pointsLostPerRetreat: Math.round(base.pointsLostPerRetreat * wpMult),
    // Encounter difficulty group
    healthScaleRate: Math.round(base.healthScaleRate * diffMult),
    damageScaleRate: Math.round(base.damageScaleRate * diffMult),
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the simulation using the WASM engine.
 *
 * Loads the pre-built WASM binary, creates all entities (heroes, enemies,
 * config), runs the full simulation, and returns an array of GameSnapshots
 * plus hero progression paths.
 *
 * Throws if the WASM module is not available.
 * Build it with: npm run build:wasm && npm run install:wasm
 */
export async function runSimulation(
  selectedHeroes: HeroDefinition[],
  mode: GameMode,
  customSettings?: CustomModeSettings,
  environmentSettings?: EnvironmentSettings,
): Promise<{ snapshots: GameSnapshot[]; heroPaths: HeroPath[] }> {
  const mod = await loadWasmModule();
  if (!mod) {
    throw new Error(
      'WASM engine is not available. ' +
      'Run `npm run build:wasm && npm run install:wasm` to build and install it.'
    );
  }

  // Use a cryptographically random seed so each run produces different outcomes.
  const seedBytes = new Uint32Array(2);
  crypto.getRandomValues(seedBytes);
  const seed = (BigInt(seedBytes[0]) << 32n) | BigInt(seedBytes[1]);
  const game = mod.BlinkWasmGame.with_seed(seed);
  try {
    const snapshots = _runWithWasm(game, selectedHeroes, mode, customSettings, environmentSettings);

    // Simulate hero progression paths using the trait system
    const heroPaths: HeroPath[] = selectedHeroes.map(hero => {
      const maxLevel = snapshots.length > 0
        ? (snapshots[snapshots.length - 1].heroLevels[hero.name] ?? 10)
        : 10;
      const entries = simulateHeroPath(hero.heroClass, hero.traits, Math.max(maxLevel, 5));

      // Compute final stats (base + cumulative gains)
      const finalStats = { str: hero.stats.strength, dex: hero.stats.dexterity, int: hero.stats.intelligence, con: hero.stats.constitution, wis: hero.stats.wisdom };
      for (const entry of entries) {
        finalStats.str += entry.statsGained.str;
        finalStats.dex += entry.statsGained.dex;
        finalStats.int += entry.statsGained.int;
        finalStats.con += entry.statsGained.con;
        finalStats.wis += entry.statsGained.wis;
      }

      // Annotate skill names for display
      for (const entry of entries) {
        if (entry.skillChosen) {
          entry.skillChosen = `${entry.skillChosen} (${getSkillName(entry.skillChosen, hero.heroClass)})`;
        }
      }

      return {
        heroName: hero.name,
        heroClass: hero.heroClass,
        entries,
        finalStats,
      };
    });

    return { snapshots, heroPaths };
  } finally {
    game.free();
  }
}

// ── Internal simulation runner ──────────────────────────────────────────────

function _runWithWasm(
  game: BlinkWasmGame,
  selectedHeroes: HeroDefinition[],
  mode: GameMode,
  customSettings?: CustomModeSettings,
  environmentSettings?: EnvironmentSettings,
): GameSnapshot[] {
  // 1. Register components + intern strings (no static entities in RPG BRL)
  game.init_static();

  const cfg = mode === 'custom'
    ? buildCustomConfig(customSettings ?? { heroPenaltyPct: 0, wipeoutPenaltyPct: 0, expMultiplierPct: 0, encounterDifficultyPct: 0 })
    : (MODE_CONFIGS[mode] ?? MODE_CONFIGS.normal);

  // Exp multiplier for custom mode (applies to all enemy expReward values)
  const expMult = mode === 'custom' && customSettings
    ? 1 + customSettings.expMultiplierPct / 100
    : 1;

  const env = environmentSettings ?? DEFAULT_ENVIRONMENT_SETTINGS;

  // 2. Create hero entities (IDs 1..N)
  selectedHeroes.forEach((hero, i) => {
    const heroId = i + 1;
    const heroClass = hero.heroClass;
    const skills = CLASS_SKILLS[heroClass] ?? ['basic_attack', '', '', ''];
    const baseHp  = CLASS_BASE_HP[heroClass]    ?? 100;
    const baseDmg = CLASS_BASE_DAMAGE[heroClass] ?? 15;
    const baseDef = CLASS_BASE_DEFENSE[heroClass] ?? 5;
    const baseSpd = CLASS_ATTACK_SPEED[heroClass] ?? 1.0;

    const conBonus = Math.floor((hero.stats.constitution - 10) * 5);
    const intBonus = Math.floor((hero.stats.intelligence - 10) * 3);
    const strBonus = Math.floor((hero.stats.strength - 10) * 2);
    const dexBonus = (hero.stats.dexterity - 10) * 0.05;
    const wisBonus = Math.floor((hero.stats.wisdom - 10) * 5);

    const maxHp      = Math.max(50,  baseHp  + conBonus);
    const damage     = Math.max(5,   baseDmg + strBonus + intBonus);
    const defense    = Math.max(0,   baseDef + Math.floor(hero.stats.constitution - 10));
    const attackSpeed = Math.max(0.3, baseSpd + dexBonus);
    const maxMana    = Math.max(50,  100 + wisBonus);
    const critChance = Math.min(0.5, 0.05 + hero.stats.dexterity * 0.01);

    // Derive damage type and resistances from hero traits
    const dmgCategory = deriveDamageCategory(hero.traits);
    const dmgElement  = deriveDamageElement(hero.traits);
    const resistances = deriveResistances(hero.traits);

    game.create_entity(heroId);
    game.add_component(heroId, 'Character', JSON.stringify({
      name: hero.name, class: hero.heroClass, level: 1, experience: 0, experienceToLevel: 100,
    }));
    game.add_component(heroId, 'Health', JSON.stringify({ current: maxHp,   max: maxHp }));
    game.add_component(heroId, 'Mana',   JSON.stringify({ current: maxMana, max: maxMana }));
    game.add_component(heroId, 'Stats', JSON.stringify({
      strength: hero.stats.strength, dexterity: hero.stats.dexterity,
      intelligence: hero.stats.intelligence, constitution: hero.stats.constitution,
      wisdom: hero.stats.wisdom,
    }));
    game.add_component(heroId, 'Combat', JSON.stringify({
      damage, defense, attackSpeed, critChance, critMultiplier: 1.5,
    }));
    game.add_component(heroId, 'DamageType', JSON.stringify({
      category: dmgCategory, element: dmgElement,
    }));
    game.add_component(heroId, 'Resistance', JSON.stringify(resistances));
    game.add_component(heroId, 'Target', JSON.stringify({ entity: 0 }));
    game.add_component(heroId, 'Team',   JSON.stringify({ id: 'player', isPlayer: true }));
    game.add_component(heroId, 'Skills', JSON.stringify({
      skill1: skills[0], skill2: skills[1], skill3: skills[2], skill4: skills[3], skillPoints: 0,
    }));
    game.add_component(heroId, 'Buffs', JSON.stringify({
      damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0,
    }));
    game.add_component(heroId, 'SkillCooldown', JSON.stringify({
      skill1Cooldown: 0.0, skill2Cooldown: 0.0, skill3Cooldown: 0.0, skill4Cooldown: 0.0,
    }));
  });

  // 3. Create enemy templates (IDs 100–108)
  // Assign damage types and resistances based on adventure environment settings.
  // Each unified slider controls BOTH the chance of dealing that damage type
  // AND the chance of resisting that damage type.
  for (let ti = 0; ti < ENEMY_TEMPLATES.length; ti++) {
    const tmpl = ENEMY_TEMPLATES[ti];
    // Derive enemy damage category from environment chances
    const enemyCategory: DamageCategory =
      _pseudoRoll(ti, 0) < env.magicalPct / 100 ? 'magical' : 'physical';
    const enemyElement = _pickEnemyElement(env, ti);

    // Derive enemy resistances — same unified sliders drive resistance chance
    const enemyResist = {
      physical:  _pseudoRoll(ti, 10) < env.physicalPct  / 100 ? 75 : 0,
      magical:   _pseudoRoll(ti, 11) < env.magicalPct   / 100 ? 75 : 0,
      fire:      _pseudoRoll(ti, 12) < env.firePct      / 100 ? 75 : 0,
      water:     _pseudoRoll(ti, 13) < env.waterPct     / 100 ? 75 : 0,
      wind:      _pseudoRoll(ti, 14) < env.windPct      / 100 ? 75 : 0,
      earth:     _pseudoRoll(ti, 15) < env.earthPct     / 100 ? 75 : 0,
      light:     _pseudoRoll(ti, 16) < env.lightPct     / 100 ? 75 : 0,
      darkness:  _pseudoRoll(ti, 17) < env.darknessPct  / 100 ? 75 : 0,
    };

    game.create_entity(tmpl.id);
    game.add_component(tmpl.id, 'Character', JSON.stringify({
      name: tmpl.name, class: tmpl.boss ? 'Boss' : 'Monster',
      level: tmpl.tier, experience: 0, experienceToLevel: 999,
    }));
    game.add_component(tmpl.id, 'Health', JSON.stringify({ current: tmpl.hp, max: tmpl.hp }));
    game.add_component(tmpl.id, 'Mana',   JSON.stringify({ current: 0, max: 0 }));
    game.add_component(tmpl.id, 'Stats',  JSON.stringify({
      strength: 8, dexterity: 8, intelligence: 4, constitution: 8, wisdom: 4,
    }));
    game.add_component(tmpl.id, 'Combat', JSON.stringify({
      damage: tmpl.dmg, defense: Math.floor(tmpl.tier * 2),
      attackSpeed: tmpl.spd, critChance: 0.05, critMultiplier: 1.5,
    }));
    game.add_component(tmpl.id, 'DamageType', JSON.stringify({
      category: enemyCategory, element: enemyElement,
    }));
    game.add_component(tmpl.id, 'Resistance', JSON.stringify(enemyResist));
    game.add_component(tmpl.id, 'Target', JSON.stringify({ entity: 0 }));
    game.add_component(tmpl.id, 'Team',   JSON.stringify({ id: 'enemy', isPlayer: false }));
    game.add_component(tmpl.id, 'Enemy',  JSON.stringify({
      tier: tmpl.tier, isBoss: tmpl.boss, expReward: Math.round(tmpl.exp * expMult), wave: tmpl.tier, name: tmpl.name,
    }));
    game.add_component(tmpl.id, 'EnemyTemplate', JSON.stringify({ isTemplate: true }));
    game.add_component(tmpl.id, 'Buffs', JSON.stringify({
      damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0,
    }));
    if (tmpl.boss) {
      game.add_component(tmpl.id, 'FinalBoss', JSON.stringify({ isFinalBoss: true }));
    }
  }

  // 4. Game state entity (ID 99)
  game.create_entity(99);
  game.add_component(99, 'GameState', JSON.stringify({
    currentWave: 1, enemiesDefeated: 0, playerDeaths: 0,
    bossDefeated: false, gameOver: false, victory: false,
    retargetingActive: false, currentTier: 1, waveInTier: 1, bossSpawned: false,
    encounterCount: 0, enemiesAlive: 0, nextBossThreshold: 0,
  }));
  game.add_component(99, 'SpawnConfig', JSON.stringify({
    bossEveryKills: cfg.bossEveryKills,
    tierProgressionKills: cfg.tierProgressionKills,
    maxTier: 6, wavesPerTier: 3,
    healthScaleRate: cfg.healthScaleRate,
    damageScaleRate: cfg.damageScaleRate,
    initialEnemyCount: cfg.initialEnemyCount,
  }));
  // N=30 checkpoints, one per 100 kills (3000 total encounters).
  // The WASM engine is fast enough to run the full 3000-kill simulation
  // in one synchronous call.
  game.add_component(99, 'ProgressTracker', JSON.stringify({
    checkpointInterval: 100,
    checkpointsReached: 0,
    totalCheckpoints: 30,
  }));

  // 5. Run stats entity (ID 98)
  game.create_entity(98);
  game.add_component(98, 'RunStats', JSON.stringify({
    simulationTime: 0.0, retreatCount: 0, retreatPenalty: 0.0,
    deathPenalty: 0.0, totalTime: 0.0, canFlee: true, lastFleeTime: -999.0,
  }));

  // 6. Flee config entity (ID 97)
  game.create_entity(97);
  game.add_component(97, 'FleeConfig', JSON.stringify({
    retreatTimePenalty: cfg.retreatTimePenalty,
    deathTimePenaltyMultiplier: cfg.deathTimePenaltyMultiplier,
    fleeCooldown: cfg.fleeCooldown,
  }));

  // 7. Score + ScoringRules entity (ID 96)
  game.create_entity(96);
  game.add_component(96, 'ScoringRules', JSON.stringify({
    pointsPerKill: cfg.pointsPerKill,
    pointsPerWave: cfg.pointsPerWave,
    pointsPerBoss: cfg.pointsPerBoss,
    pointsLostPerDeath: cfg.pointsLostPerDeath,
    pointsLostPerRetreat: cfg.pointsLostPerRetreat,
    pointsLostPerPenaltySecond: cfg.pointsLostPerPenaltySecond,
    timeBonusPoints: cfg.timeBonusPoints,
    timeBonusInterval: cfg.timeBonusInterval,
  }));
  game.add_component(96, 'Score', JSON.stringify({
    total: 0, killScore: 0, waveScore: 0, bossScore: 0, speedBonus: 0,
    deathPenaltyTotal: 0, retreatPenaltyTotal: 0, timePenaltyTotal: 0,
    bossesDefeated: 0, wavesCompleted: 0,
  }));

  // 8. Environment settings entity (ID 95) — stores adventure damage/resistance chances
  game.create_entity(95);
  game.add_component(95, 'EnvironmentConfig', JSON.stringify(env));

  // 9. Run simulation — capture a snapshot at every ProgressCheckpoint
  game.schedule_event('GameStart', 0.0);

  const snapshots: GameSnapshot[] = [];
  let prevCheckpoints = 0;
  const MAX_STEPS = 2_000_000;
  let totalSteps = 0;

  while (game.has_events() && totalSteps < MAX_STEPS) {
    // Run in batches of 500 to keep the check overhead manageable
    const batch = Math.min(500, MAX_STEPS - totalSteps);
    game.run_steps(batch);
    totalSteps += batch;

    // Detect ProgressCheckpoint by watching checkpointsReached
    const tracker = JSON.parse(game.get_component(99, 'ProgressTracker')) as {
      checkpointsReached: number;
      totalCheckpoints: number;
    };
    if (tracker.checkpointsReached > prevCheckpoints) {
      for (let i = prevCheckpoints; i < tracker.checkpointsReached; i++) {
        snapshots.push(_captureSnapshot(game, snapshots.length + 1, selectedHeroes));
      }
      prevCheckpoints = tracker.checkpointsReached;
    }

    // Stop only when gameOver is set (after 3000 encounters).
    // Do NOT stop on victory alone — victory marks Lord Vexar's defeat
    // but the game must continue until all 3000 encounters are complete.
    const gs = JSON.parse(game.get_component(99, 'GameState')) as {
      gameOver: boolean; victory: boolean;
    };
    if (gs.gameOver) break;
  }

  // Final snapshot (captures end state)
  snapshots.push(_captureSnapshot(game, snapshots.length + 1, selectedHeroes));

  return snapshots;
}

// ── Snapshot helper ─────────────────────────────────────────────────────────

function _captureSnapshot(
  game: BlinkWasmGame,
  step: number,
  heroes: HeroDefinition[],
): GameSnapshot {
  const gs  = JSON.parse(game.get_component(99, 'GameState'))  as Record<string, unknown>;
  const rs  = JSON.parse(game.get_component(98, 'RunStats'))   as Record<string, unknown>;
  const sc  = JSON.parse(game.get_component(96, 'Score'))      as Record<string, unknown>;

  const heroLevels: Record<string, number> = {};
  heroes.forEach((hero, i) => {
    const ch = JSON.parse(game.get_component(i + 1, 'Character')) as Record<string, unknown>;
    if (ch && Object.keys(ch).length > 0) {
      heroLevels[hero.name] = (ch['level'] as number) ?? 1;
    }
  });

  return {
    step,
    simulationTime:  (rs?.['simulationTime']  as number)  ?? 0,
    enemiesDefeated: (gs?.['enemiesDefeated'] as number)  ?? 0,
    score:           (sc?.['total']           as number)  ?? 0,
    currentTier:     (gs?.['currentTier']     as number)  ?? 1,
    currentWave:     (gs?.['currentWave']     as number)  ?? 1,
    heroLevels,
    bossesDefeated:  (sc?.['bossesDefeated']  as number)  ?? 0,
    playerDeaths:    (gs?.['playerDeaths']    as number)  ?? 0,
    isGameOver:      (gs?.['gameOver']        as boolean) ?? false,
    victory:         (gs?.['victory']         as boolean) ?? false,
  };
}

// ── Damage-type helpers for enemy template setup ────────────────────────────

/**
 * Simple deterministic pseudo-random number in [0, 1) for enemy template setup.
 * Uses a hash of (templateIndex, slot) so each roll is independent and reproducible.
 */
function _pseudoRoll(templateIndex: number, slot: number): number {
  // Simple hash: Murmur-inspired mixing
  let h = (templateIndex * 2654435761 + slot * 2246822519) >>> 0;
  h = ((h ^ (h >> 16)) * 2246822507) >>> 0;
  h = ((h ^ (h >> 13)) * 3266489909) >>> 0;
  h = (h ^ (h >> 16)) >>> 0;
  return (h & 0x7fffffff) / 0x80000000;
}

/**
 * Pick an enemy element based on environment chances.
 * Rolls independently for each element; if multiple match, picks deterministically.
 */
function _pickEnemyElement(env: EnvironmentSettings, templateIndex: number): Element {
  const candidates: Element[] = [];
  const elementChances: [Element, number][] = [
    ['fire',     env.firePct],
    ['water',    env.waterPct],
    ['wind',     env.windPct],
    ['earth',    env.earthPct],
    ['light',    env.lightPct],
    ['darkness', env.darknessPct],
  ];
  for (let i = 0; i < elementChances.length; i++) {
    const [elem, chancePct] = elementChances[i];
    if (_pseudoRoll(templateIndex, i + 1) < chancePct / 100) {
      candidates.push(elem);
    }
  }
  if (candidates.length === 0) return 'neutral';
  // Deterministic pick from candidates
  const pickIdx = Math.floor(_pseudoRoll(templateIndex, 7) * candidates.length);
  return candidates[pickIdx];
}
