/**
 * WASM engine adapter for the Blink RPG simulation.
 *
 * Uses the pre-compiled WASM module produced by `make build-wasm`.
 * The module is served from `public/wasm/blink_rpg_wasm.js` and the
 * associated `.wasm` binary.
 *
 * Compared to the JS engine (SimEngine.ts), the WASM engine:
 *   • Runs the full simulation in a single synchronous call (~300 ms)
 *   • Produces exactly 30 checkpoints (one per 10 kills up to 300)
 *   • Does not require an IR file — game rules are baked into the binary
 *
 * Entity IDs used here match SimEngine.ts so the two implementations are
 * interchangeable.
 */

import type { GameSnapshot, HeroDefinition, GameMode } from '../types';

// ── Hero stats per class ────────────────────────────────────────────────────

const CLASS_BASE_HP: Record<string, number> = {
  Warrior: 160, Mage: 90, Ranger: 110, Paladin: 140, Rogue: 105, Cleric: 120,
};

const CLASS_BASE_DAMAGE: Record<string, number> = {
  Warrior: 22, Mage: 30, Ranger: 18, Paladin: 16, Rogue: 20, Cleric: 13,
};

const CLASS_BASE_DEFENSE: Record<string, number> = {
  Warrior: 8, Mage: 2, Ranger: 5, Paladin: 9, Rogue: 4, Cleric: 6,
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

const MODE_CONFIGS: Record<GameMode, {
  bossEveryKills: number; tierProgressionKills: number;
  healthScaleRate: number; damageScaleRate: number; initialEnemyCount: number;
  retreatTimePenalty: number; deathTimePenaltyMultiplier: number; fleeCooldown: number;
  pointsPerKill: number; pointsPerWave: number; pointsPerBoss: number;
  pointsLostPerDeath: number; pointsLostPerRetreat: number; pointsLostPerPenaltySecond: number;
  timeBonusPoints: number; timeBonusInterval: number;
}> = {
  normal: {
    bossEveryKills: 100, tierProgressionKills: 50,
    healthScaleRate: 200, damageScaleRate: 300, initialEnemyCount: 5,
    retreatTimePenalty: 10.0, deathTimePenaltyMultiplier: 5.0, fleeCooldown: 5.0,
    pointsPerKill: 10, pointsPerWave: 50, pointsPerBoss: 500,
    pointsLostPerDeath: 100, pointsLostPerRetreat: 50, pointsLostPerPenaltySecond: 2,
    timeBonusPoints: 1000, timeBonusInterval: 10.0,
  },
  easy: {
    bossEveryKills: 150, tierProgressionKills: 75,
    healthScaleRate: 100, damageScaleRate: 150, initialEnemyCount: 3,
    retreatTimePenalty: 5.0, deathTimePenaltyMultiplier: 3.0, fleeCooldown: 5.0,
    pointsPerKill: 5, pointsPerWave: 25, pointsPerBoss: 250,
    pointsLostPerDeath: 50, pointsLostPerRetreat: 25, pointsLostPerPenaltySecond: 1,
    timeBonusPoints: 500, timeBonusInterval: 15.0,
  },
  hard: {
    bossEveryKills: 75, tierProgressionKills: 40,
    healthScaleRate: 300, damageScaleRate: 450, initialEnemyCount: 7,
    retreatTimePenalty: 15.0, deathTimePenaltyMultiplier: 7.0, fleeCooldown: 5.0,
    pointsPerKill: 15, pointsPerWave: 75, pointsPerBoss: 1000,
    pointsLostPerDeath: 200, pointsLostPerRetreat: 100, pointsLostPerPenaltySecond: 5,
    timeBonusPoints: 2000, timeBonusInterval: 5.0,
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
  BlinkWasmGame: new () => BlinkWasmGame;
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

// ── Public API ──────────────────────────────────────────────────────────────

/** True if the WASM module has been loaded (call after a runSimulationWasm attempt). */
export function isWasmAvailable(): boolean {
  return cachedModule !== null && cachedModule !== 'loading' && cachedModule !== 'unavailable';
}

/**
 * Run the simulation using the WASM engine.
 *
 * Returns `null` if the WASM module could not be loaded (caller should fall
 * back to the JS engine).  On success returns an array of GameSnapshots
 * captured at every ProgressCheckpoint event.
 */
export async function runSimulationWasm(
  selectedHeroes: HeroDefinition[],
  mode: GameMode,
): Promise<GameSnapshot[] | null> {
  const mod = await loadWasmModule();
  if (!mod) return null;

  const game = new mod.BlinkWasmGame();
  try {
    return _runWithWasm(game, selectedHeroes, mode);
  } finally {
    game.free();
  }
}

// ── Internal simulation runner ──────────────────────────────────────────────

function _runWithWasm(
  game: BlinkWasmGame,
  selectedHeroes: HeroDefinition[],
  mode: GameMode,
): GameSnapshot[] {
  // 1. Register components + intern strings (no static entities in RPG BRL)
  game.init_static();

  const cfg = MODE_CONFIGS[mode] ?? MODE_CONFIGS.normal;

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
  for (const tmpl of ENEMY_TEMPLATES) {
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
    game.add_component(tmpl.id, 'Target', JSON.stringify({ entity: 0 }));
    game.add_component(tmpl.id, 'Team',   JSON.stringify({ id: 'enemy', isPlayer: false }));
    game.add_component(tmpl.id, 'Enemy',  JSON.stringify({
      tier: tmpl.tier, isBoss: tmpl.boss, expReward: tmpl.exp, wave: tmpl.tier, name: tmpl.name,
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
  }));
  game.add_component(99, 'SpawnConfig', JSON.stringify({
    bossEveryKills: cfg.bossEveryKills,
    tierProgressionKills: cfg.tierProgressionKills,
    maxTier: 6, wavesPerTier: 3,
    healthScaleRate: cfg.healthScaleRate,
    damageScaleRate: cfg.damageScaleRate,
    initialEnemyCount: cfg.initialEnemyCount,
  }));
  // N=30 checkpoints, one per 10 kills.  The WASM engine is fast enough to
  // run the full 300-kill simulation in one synchronous call, so we set the
  // interval to 10 (unlike the JS engine which uses 1 to maximise the number
  // of snapshots within its 5-second wall-clock budget).
  game.add_component(99, 'ProgressTracker', JSON.stringify({
    checkpointInterval: 10,
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

  // 8. Run simulation — capture a snapshot at every ProgressCheckpoint
  game.schedule_event('GameStart', 0.0);

  const snapshots: GameSnapshot[] = [];
  let prevCheckpoints = 0;
  const MAX_STEPS = 500_000;
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

    // Stop if game is over
    const gs = JSON.parse(game.get_component(99, 'GameState')) as {
      gameOver: boolean; victory: boolean;
    };
    if (gs.gameOver || gs.victory) break;
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
