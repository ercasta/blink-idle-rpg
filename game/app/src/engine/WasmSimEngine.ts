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

import type { GameSnapshot, HeroDefinition, GameMode, HeroPath, CustomModeSettings, EnvironmentSettings, DamageCategory, Element, RunType, StoryKpis, NarrativeEntry, StoryStep, StoryStepType } from '../types';
import { DEFAULT_ENVIRONMENT_SETTINGS } from '../types';
import { simulateHeroPath, getSkillName, deriveDamageCategory, deriveDamageElement, deriveResistances, computeLinePreferenceScore } from '../data/traits';
import { computeAdventureSeed, simulateQuestProgress, generateQuestNarrative, QUEST_EARLY_COMPLETION_POINTS_PER_DAY, QUEST_HERO_ENCOUNTER_BONUS, initAdventureData } from '../data/adventureQuest';
import type { AdventureDefinition } from '../types';
import { initWorldData } from '../data/worldData';
import { loadEnemyTemplates } from '../data/enemyData';
import type { EnemyTemplate } from '../data/enemyData';
import { loadScenarioConfigs } from '../data/scenarioData';
import type { ModeConfig } from '../data/scenarioData';
import { loadHeroClassData } from '../data/heroClassData';
import type { HeroClassData } from '../data/heroClassData';

// ── Hero stats per class ────────────────────────────────────────────────────
// Hero class combat stats, skills, and growth vectors are loaded from BRL
// hero-classes.brl at runtime via loadHeroClassData() in heroClassData.ts.
// BRL is the single source of truth — there are no hardcoded fallbacks.

// ── Helper to resolve class data from BRL-loaded data ────────────────

function _getClassBaseHp(heroClass: string, classData: Record<string, HeroClassData>): number {
  const cd = classData[heroClass];
  if (!cd) throw new Error(`Hero class data for "${heroClass}" not loaded from BRL.`);
  return cd.combat.baseHp;
}

function _getClassBaseDamage(heroClass: string, classData: Record<string, HeroClassData>): number {
  const cd = classData[heroClass];
  if (!cd) throw new Error(`Hero class data for "${heroClass}" not loaded from BRL.`);
  return cd.combat.baseDamage;
}

function _getClassBaseDefense(heroClass: string, classData: Record<string, HeroClassData>): number {
  const cd = classData[heroClass];
  if (!cd) throw new Error(`Hero class data for "${heroClass}" not loaded from BRL.`);
  return cd.combat.baseDefense;
}

function _getClassAttackSpeed(heroClass: string, classData: Record<string, HeroClassData>): number {
  const cd = classData[heroClass];
  if (!cd) throw new Error(`Hero class data for "${heroClass}" not loaded from BRL.`);
  return cd.combat.baseAttackSpeed;
}

function _getClassSkills(heroClass: string, classData: Record<string, HeroClassData>): [string, string, string, string] {
  const cd = classData[heroClass];
  if (!cd) throw new Error(`Hero class data for "${heroClass}" not loaded from BRL.`);
  // skill1 defaults to 'basic_attack' — a hero must always have at least one attack.
  // skill2–4 default to '' (empty = no skill in that slot).
  return [cd.skills.skill1 || 'basic_attack', cd.skills.skill2 || '', cd.skills.skill3 || '', cd.skills.skill4 || ''];
}

// ── Game mode spawn configs ─────────────────────────────────────────────────
// Mode configs are loaded from BRL scenario files at runtime via
// loadScenarioConfigs() in scenarioData.ts.  BRL is the single source
// of truth — there are no hardcoded fallbacks.

// ── Enemy template data ─────────────────────────────────────────────────────
// Enemy templates are loaded from BRL enemies.brl at runtime via
// loadEnemyTemplates() in enemyData.ts.  BRL is the single source of
// truth — there are no hardcoded fallbacks.

// ── WASM module loader ──────────────────────────────────────────────────────

/** Minimal interface of the wasm-bindgen generated BlinkWasmGame class */
interface BlinkWasmGame {
  init_static(): void;
  create_entity(id: number): void;
  add_component(entityId: number, componentName: string, fieldsJson: string): boolean;
  get_component(entityId: number, componentName: string): string;
  get_entities_having(componentName: string): string;
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
function buildCustomConfig(settings: CustomModeSettings, normalConfig: ModeConfig) {
  const base = normalConfig;
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
 * For story mode, the same combat engine is used but with fewer encounters
 * (30 days × ~2-4 encounters/day ≈ 60-120 total) and an experience multiplier.
 *
 * Throws if the WASM module is not available.
 * Build it with: npm run build:wasm && npm run install:wasm
 */
export async function runSimulation(
  selectedHeroes: HeroDefinition[],
  mode: GameMode,
  customSettings?: CustomModeSettings,
  environmentSettings?: EnvironmentSettings,
  runType: RunType = 'fight',
  adventure?: AdventureDefinition,
): Promise<{ snapshots: GameSnapshot[]; heroPaths: HeroPath[]; storyKpis?: StoryKpis; narrativeLog?: NarrativeEntry[]; storySteps?: StoryStep[] }> {
  // Load WASM module and BRL game data in parallel
  const [mod, enemyTemplates, scenarioConfigs, heroClassResult] = await Promise.all([
    loadWasmModule(),
    loadEnemyTemplates(),
    loadScenarioConfigs(),
    loadHeroClassData(),
    initWorldData(),       // Populates world data from BRL (returns void)
    initAdventureData(),   // Populates adventure template data from BRL (returns void)
  ]) as [Awaited<ReturnType<typeof loadWasmModule>>, Awaited<ReturnType<typeof loadEnemyTemplates>>, Awaited<ReturnType<typeof loadScenarioConfigs>>, Awaited<ReturnType<typeof loadHeroClassData>>, void, void];

  if (!mod) {
    throw new Error(
      'WASM engine is not available. ' +
      'Run `npm run build:wasm && npm run install:wasm` to build and install it.'
    );
  }

  // BRL is the single source of truth — data must be loaded successfully
  if (enemyTemplates.length === 0) {
    throw new Error('Enemy templates not loaded from BRL. Ensure enemies.brl is available.');
  }
  if (Object.keys(scenarioConfigs).length === 0) {
    throw new Error('Scenario configs not loaded from BRL. Ensure scenario-*.brl files are available.');
  }
  const enemies = enemyTemplates;
  const modeConfigs = scenarioConfigs;
  const normalConfig = modeConfigs['normal'];
  if (!normalConfig) {
    throw new Error('Normal mode config not found in BRL scenario configs.');
  }
  const classData = heroClassResult.classes;

  // Use a cryptographically random seed so each run produces different outcomes.
  const seedBytes = new Uint32Array(2);
  crypto.getRandomValues(seedBytes);
  const seed = (BigInt(seedBytes[0]) << 32n) | BigInt(seedBytes[1]);
  const game = mod.BlinkWasmGame.with_seed(seed);
  try {
    if (runType === 'story') {
      const result = _runStoryMode(game, selectedHeroes, mode, enemies, modeConfigs, normalConfig, customSettings, environmentSettings, seed, adventure, classData);

      const heroPaths: HeroPath[] = selectedHeroes.map(hero => {
        const maxLevel = result.snapshots.length > 0
          ? (result.snapshots[result.snapshots.length - 1].heroLevels[hero.name] ?? 10)
          : 10;
        const entries = simulateHeroPath(hero.heroClass, hero.traits, Math.max(maxLevel, 5));
        const finalStats = { str: hero.stats.strength, dex: hero.stats.dexterity, int: hero.stats.intelligence, con: hero.stats.constitution, wis: hero.stats.wisdom };
        for (const entry of entries) {
          finalStats.str += entry.statsGained.str;
          finalStats.dex += entry.statsGained.dex;
          finalStats.int += entry.statsGained.int;
          finalStats.con += entry.statsGained.con;
          finalStats.wis += entry.statsGained.wis;
        }
        for (const entry of entries) {
          if (entry.skillChosen) {
            entry.skillChosen = `${entry.skillChosen} (${getSkillName(entry.skillChosen, hero.heroClass)})`;
          }
        }
        return { heroName: hero.name, heroClass: hero.heroClass, entries, finalStats };
      });

      return { snapshots: result.snapshots, heroPaths, storyKpis: result.storyKpis, narrativeLog: result.narrativeLog, storySteps: result.storySteps };
    }

    // Fight mode (original)
    const snapshots = _runWithWasm(game, selectedHeroes, mode, enemies, modeConfigs, normalConfig, customSettings, environmentSettings, classData);

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
  enemyTemplates: EnemyTemplate[],
  modeConfigs: Record<string, ModeConfig>,
  normalConfig: ModeConfig,
  customSettings?: CustomModeSettings,
  environmentSettings?: EnvironmentSettings,
  classData: Record<string, HeroClassData> = {},
): GameSnapshot[] {
  // 1. Register components + intern strings (no static entities in RPG BRL)
  game.init_static();

  const cfg = mode === 'custom'
    ? buildCustomConfig(customSettings ?? { heroPenaltyPct: 0, wipeoutPenaltyPct: 0, expMultiplierPct: 0, encounterDifficultyPct: 0 }, normalConfig)
    : (modeConfigs[mode] ?? normalConfig);

  // Exp multiplier for custom mode (applies to all enemy expReward values)
  const expMult = mode === 'custom' && customSettings
    ? 1 + customSettings.expMultiplierPct / 100
    : 1;

  const env = environmentSettings ?? DEFAULT_ENVIRONMENT_SETTINGS;

  // 2a. Assign heroes to front/back line based on trait preference scores
  const heroScores = selectedHeroes.map((h, i) => ({
    index: i,
    score: computeLinePreferenceScore(h.traits),
  }));
  heroScores.sort((a, b) => b.score - a.score);
  const frontCount = Math.ceil(selectedHeroes.length / 2);
  const heroLines: ('front' | 'back')[] = new Array(selectedHeroes.length);
  heroScores.forEach((hs, rank) => {
    heroLines[hs.index] = rank < frontCount ? 'front' : 'back';
  });

  // 2b. Create hero entities (IDs 1..N)
  selectedHeroes.forEach((hero, i) => {
    const heroId = i + 1;
    const heroClass = hero.heroClass;
    const skills = _getClassSkills(heroClass, classData);
    const baseHp  = _getClassBaseHp(heroClass, classData);
    const baseDmg = _getClassBaseDamage(heroClass, classData);
    const baseDef = _getClassBaseDefense(heroClass, classData);
    const baseSpd = _getClassAttackSpeed(heroClass, classData);

    const conBonus = Math.floor((hero.stats.constitution - 10) * 5);
    const intBonus = Math.floor((hero.stats.intelligence - 10) * 3);
    const strBonus = Math.floor((hero.stats.strength - 10) * 2);
    const dexBonus = (hero.stats.dexterity - 10) * 0.05;
    const wisBonus = Math.floor((hero.stats.wisdom - 10) * 5);

    const maxHp      = Math.max(50,  baseHp  + conBonus);
    let   damage     = Math.max(5,   baseDmg + strBonus + intBonus);
    let   defense    = Math.max(0,   baseDef + Math.floor(hero.stats.constitution - 10));
    const attackSpeed = Math.max(0.3, baseSpd + dexBonus);
    const maxMana    = Math.max(50,  100 + wisBonus);
    const critChance = Math.min(0.5, 0.05 + hero.stats.dexterity * 0.01);

    // Apply front/back line buffs: front → +25% damage, back → +25% defense
    if (heroLines[i] === 'front') {
      damage = Math.round(damage * 1.25);
    } else {
      defense = Math.round(defense * 1.25);
    }

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
  for (let ti = 0; ti < enemyTemplates.length; ti++) {
    const tmpl = enemyTemplates[ti];
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

    // Apply front/back line buff to enemies: even-index → front (+25% dmg), odd-index → back (+25% def)
    const enemyLine = ti % 2 === 0 || tmpl.boss ? 'front' : 'back';
    const enemyDmg = enemyLine === 'front' ? Math.round(tmpl.dmg * 1.25) : tmpl.dmg;
    const enemyDef = enemyLine === 'back' ? Math.round(tmpl.def * 1.25) : tmpl.def;

    game.create_entity(tmpl.id);
    game.add_component(tmpl.id, 'Character', JSON.stringify({
      name: tmpl.name, class: tmpl.boss ? 'Boss' : 'Monster',
      level: tmpl.tier, experience: 0, experienceToLevel: 999,
    }));
    game.add_component(tmpl.id, 'Health', JSON.stringify({ current: tmpl.hp, max: tmpl.hp }));
    game.add_component(tmpl.id, 'Mana',   JSON.stringify({ current: tmpl.mana, max: tmpl.mana }));
    game.add_component(tmpl.id, 'Stats',  JSON.stringify(tmpl.stats));
    game.add_component(tmpl.id, 'Combat', JSON.stringify({
      damage: enemyDmg, defense: enemyDef,
      attackSpeed: tmpl.spd, critChance: tmpl.critChance, critMultiplier: tmpl.critMultiplier,
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
    if (tmpl.finalBoss) {
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

// ── Story mode simulation ───────────────────────────────────────────────────

/**
 * Story mode experience multiplier.
 * Story mode has ~60-120 encounters (30 days × 2-4 encounters/day via
 * STORY_CHECKPOINT_KILLS) vs fight mode's 3000. To keep hero progression
 * meaningful, XP rewards are boosted by this factor.
 */
const STORY_EXP_MULTIPLIER = 25;

/** Number of days in a story mode journey. Each day produces one snapshot. */
const STORY_TOTAL_DAYS = 30;

/**
 * Checkpoint interval for story mode: record a snapshot every N kills.
 * With STORY_TOTAL_DAYS = 30, this produces ~30 snapshots from ~60-120
 * total encounters (30 checkpoints × 4 kills/checkpoint = 120 max).
 */
const STORY_CHECKPOINT_KILLS = 4;

// ── Story mode scoring constants ────────────────────────────────────────────

/** Map has 12 + (seed % LOCATION_VARIETY) locations, i.e. 12-18. */
const STORY_MIN_LOCATIONS = 12;
const STORY_LOCATION_VARIETY = 7;

/** Points awarded for each unique location visited. */
const STORY_POINTS_PER_LOCATION = 50;

/** Fraction of encounters that translate into one location visit. */
const STORY_ENCOUNTERS_PER_LOCATION = 8;

/** Minimum locations visited regardless of encounters. */
const STORY_MIN_VISITED = 3;

/** Fraction of visited locations that are towns (for rest bonus). */
const STORY_TOWN_REST_RATIO = 0.35;

/** One ambush survived per this many encounters. */
const STORY_ENCOUNTERS_PER_AMBUSH = 20;

/** Threshold: if locationsVisited / totalLocations ≥ this, award completion bonus. */
const STORY_EXPLORATION_THRESHOLD = 0.8;

/** Bonus points for visiting ≥ 80% of the map. */
const STORY_EXPLORATION_COMPLETION_BONUS = 200;

/** Points per town rest. */
const STORY_POINTS_PER_TOWN_REST = 25;

/** Points per ambush survived without hero deaths. */
const STORY_POINTS_PER_AMBUSH = 100;

/** Bonus for reaching the final destination. */
const STORY_FINAL_DESTINATION_BONUS = 500;

/**
 * Run a story-mode simulation.
 *
 * Reuses the fight-mode WASM combat engine but wraps it in a 30-day
 * journey structure. Each day, the party travels and may encounter enemies.
 * The number of encounters is much lower (~60-120) but XP is multiplied
 * to keep hero progression meaningful.
 *
 * Produces 30 snapshots (one per day) for consistent battle screen playback.
 */
function _runStoryMode(
  game: BlinkWasmGame,
  selectedHeroes: HeroDefinition[],
  mode: GameMode,
  enemyTemplates: EnemyTemplate[],
  modeConfigs: Record<string, ModeConfig>,
  normalConfig: ModeConfig,
  customSettings?: CustomModeSettings,
  environmentSettings?: EnvironmentSettings,
  seed?: bigint,
  adventure?: AdventureDefinition,
  classData: Record<string, HeroClassData> = {},
): { snapshots: GameSnapshot[]; storyKpis: StoryKpis; narrativeLog: NarrativeEntry[]; storySteps: StoryStep[] } {
  // Use the same entity setup as fight mode, but with story-specific config
  game.init_static();

  const cfg = mode === 'custom'
    ? buildCustomConfig(customSettings ?? { heroPenaltyPct: 0, wipeoutPenaltyPct: 0, expMultiplierPct: 0, encounterDifficultyPct: 0 }, normalConfig)
    : (modeConfigs[mode] ?? normalConfig);

  // Story mode applies a higher exp multiplier to compensate for fewer encounters
  const baseExpMult = mode === 'custom' && customSettings
    ? 1 + customSettings.expMultiplierPct / 100
    : 1;
  const expMult = baseExpMult * STORY_EXP_MULTIPLIER;

  const env = environmentSettings ?? DEFAULT_ENVIRONMENT_SETTINGS;

  // Assign heroes to front/back line (same as fight mode)
  const heroScores = selectedHeroes.map((h, i) => ({
    index: i,
    score: computeLinePreferenceScore(h.traits),
  }));
  heroScores.sort((a, b) => b.score - a.score);
  const frontCount = Math.ceil(selectedHeroes.length / 2);
  const heroLines: ('front' | 'back')[] = new Array(selectedHeroes.length);
  heroScores.forEach((hs, rank) => {
    heroLines[hs.index] = rank < frontCount ? 'front' : 'back';
  });

  // Create hero entities (same as fight mode)
  selectedHeroes.forEach((hero, i) => {
    const heroId = i + 1;
    const heroClass = hero.heroClass;
    const skills = _getClassSkills(heroClass, classData);
    const baseHp  = _getClassBaseHp(heroClass, classData);
    const baseDmg = _getClassBaseDamage(heroClass, classData);
    const baseDef = _getClassBaseDefense(heroClass, classData);
    const baseSpd = _getClassAttackSpeed(heroClass, classData);

    const conBonus = Math.floor((hero.stats.constitution - 10) * 5);
    const intBonus = Math.floor((hero.stats.intelligence - 10) * 3);
    const strBonus = Math.floor((hero.stats.strength - 10) * 2);
    const dexBonus = (hero.stats.dexterity - 10) * 0.05;
    const wisBonus = Math.floor((hero.stats.wisdom - 10) * 5);

    const maxHp      = Math.max(50,  baseHp  + conBonus);
    let   damage     = Math.max(5,   baseDmg + strBonus + intBonus);
    let   defense    = Math.max(0,   baseDef + Math.floor(hero.stats.constitution - 10));
    const attackSpeed = Math.max(0.3, baseSpd + dexBonus);
    const maxMana    = Math.max(50,  100 + wisBonus);
    const critChance = Math.min(0.5, 0.05 + hero.stats.dexterity * 0.01);

    if (heroLines[i] === 'front') {
      damage = Math.round(damage * 1.25);
    } else {
      defense = Math.round(defense * 1.25);
    }

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

  // Create enemy templates with story exp multiplier
  for (let ti = 0; ti < enemyTemplates.length; ti++) {
    const tmpl = enemyTemplates[ti];
    const enemyCategory: DamageCategory =
      _pseudoRoll(ti, 0) < env.magicalPct / 100 ? 'magical' : 'physical';
    const enemyElement = _pickEnemyElement(env, ti);
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
    const enemyLine = ti % 2 === 0 || tmpl.boss ? 'front' : 'back';
    const enemyDmg = enemyLine === 'front' ? Math.round(tmpl.dmg * 1.25) : tmpl.dmg;
    const enemyDef = enemyLine === 'back' ? Math.round(tmpl.def * 1.25) : tmpl.def;

    game.create_entity(tmpl.id);
    game.add_component(tmpl.id, 'Character', JSON.stringify({
      name: tmpl.name, class: tmpl.boss ? 'Boss' : 'Monster',
      level: tmpl.tier, experience: 0, experienceToLevel: 999,
    }));
    game.add_component(tmpl.id, 'Health', JSON.stringify({ current: tmpl.hp, max: tmpl.hp }));
    game.add_component(tmpl.id, 'Mana',   JSON.stringify({ current: tmpl.mana, max: tmpl.mana }));
    game.add_component(tmpl.id, 'Stats',  JSON.stringify(tmpl.stats));
    game.add_component(tmpl.id, 'Combat', JSON.stringify({
      damage: enemyDmg, defense: enemyDef,
      attackSpeed: tmpl.spd, critChance: tmpl.critChance, critMultiplier: tmpl.critMultiplier,
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
    if (tmpl.finalBoss) {
      game.add_component(tmpl.id, 'FinalBoss', JSON.stringify({ isFinalBoss: true }));
    }
  }

  // Game state entity — use fewer encounters per checkpoint for story mode
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
  // Story mode checkpoints: target ~30 snapshots from ~60-120 encounters
  game.add_component(99, 'ProgressTracker', JSON.stringify({
    checkpointInterval: STORY_CHECKPOINT_KILLS,
    checkpointsReached: 0,
    totalCheckpoints: STORY_TOTAL_DAYS,
  }));

  // Run stats
  game.create_entity(98);
  game.add_component(98, 'RunStats', JSON.stringify({
    simulationTime: 0.0, retreatCount: 0, retreatPenalty: 0.0,
    deathPenalty: 0.0, totalTime: 0.0, canFlee: true, lastFleeTime: -999.0,
  }));

  // Flee config
  game.create_entity(97);
  game.add_component(97, 'FleeConfig', JSON.stringify({
    retreatTimePenalty: cfg.retreatTimePenalty,
    deathTimePenaltyMultiplier: cfg.deathTimePenaltyMultiplier,
    fleeCooldown: cfg.fleeCooldown,
  }));

  // Score + ScoringRules
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

  // Environment config
  game.create_entity(95);
  game.add_component(95, 'EnvironmentConfig', JSON.stringify(env));

  // Run the simulation (same engine as fight mode)
  game.schedule_event('GameStart', 0.0);

  const snapshots: GameSnapshot[] = [];
  let prevCheckpoints = 0;
  const MAX_STEPS = 2_000_000;
  let totalSteps = 0;

  while (game.has_events() && totalSteps < MAX_STEPS) {
    const batch = Math.min(500, MAX_STEPS - totalSteps);
    game.run_steps(batch);
    totalSteps += batch;

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

    const gs = JSON.parse(game.get_component(99, 'GameState')) as {
      gameOver: boolean; victory: boolean;
    };
    if (gs.gameOver) break;
  }

  // Final snapshot
  snapshots.push(_captureSnapshot(game, snapshots.length + 1, selectedHeroes));

  // Compute story KPIs from final game state
  const finalGs = JSON.parse(game.get_component(99, 'GameState')) as Record<string, unknown>;
  const totalEncounters = (finalGs['enemiesDefeated'] as number) ?? 0;
  const gameOver = (finalGs['gameOver'] as boolean) ?? false;
  const victoryFromEngine = (finalGs['victory'] as boolean) ?? false;

  // Generate deterministic story KPIs based on seed and game outcome
  const seedNum = seed ? Number(seed & 0xFFFFFFFFn) : 0;
  const totalLocations = STORY_MIN_LOCATIONS + (seedNum % STORY_LOCATION_VARIETY);
  const locationsVisited = Math.min(totalLocations,
    Math.max(STORY_MIN_VISITED, Math.floor(totalEncounters / STORY_ENCOUNTERS_PER_LOCATION) + STORY_MIN_VISITED));
  const townsRested = Math.max(1, Math.floor(locationsVisited * STORY_TOWN_REST_RATIO));
  const ambushesSurvived = Math.max(0, Math.floor(totalEncounters / STORY_ENCOUNTERS_PER_AMBUSH));

  // ── Adventure quest integration ───────────────────────────────────────
  // Compute quest result before finalising finalDestinationReached so that
  // quest completion can contribute to that flag.
  let questScore = 0;
  let questObjectiveCompleted = false;
  let objectiveCompletionDay = STORY_TOTAL_DAYS;
  // Defer narrative generation until completionDay is known (see below).
  let pendingQuestResult: ReturnType<typeof simulateQuestProgress> | null = null;

  if (adventure) {
    const adventureSeed = computeAdventureSeed(adventure);
    pendingQuestResult = simulateQuestProgress(
      adventureSeed, totalEncounters, locationsVisited, selectedHeroes,
    );
    questScore = pendingQuestResult.totalQuestScore;
    questObjectiveCompleted = pendingQuestResult.objectiveCompleted;
    if (pendingQuestResult.objectiveCompletionDay !== undefined) {
      objectiveCompletionDay = pendingQuestResult.objectiveCompletionDay;
    }
  }

  // "Final destination reached": quest objective completed, engine victory,
  // OR party survived the full run having explored enough of the map.
  const finalDestinationReached =
    questObjectiveCompleted ||
    victoryFromEngine ||
    (!gameOver && locationsVisited / totalLocations >= STORY_EXPLORATION_THRESHOLD);

  const explorationBonus =
    locationsVisited * STORY_POINTS_PER_LOCATION +
    (locationsVisited / totalLocations >= STORY_EXPLORATION_THRESHOLD ? STORY_EXPLORATION_COMPLETION_BONUS : 0) +
    townsRested * STORY_POINTS_PER_TOWN_REST +
    ambushesSurvived * STORY_POINTS_PER_AMBUSH +
    (finalDestinationReached ? STORY_FINAL_DESTINATION_BONUS : 0);

  // ── Early completion ──────────────────────────────────────────────────
  // If the quest objective was completed before day 30, truncate the run to
  // the completion day and award a proportional time bonus.
  let completionDay = STORY_TOTAL_DAYS;
  let earlyCompletionBonus = 0;

  if (questObjectiveCompleted && objectiveCompletionDay < STORY_TOTAL_DAYS) {
    completionDay = objectiveCompletionDay;
    const daysRemaining = STORY_TOTAL_DAYS - completionDay;
    earlyCompletionBonus = daysRemaining * QUEST_EARLY_COMPLETION_POINTS_PER_DAY;
  }

  // Now that completionDay is known, generate quest narrative capped to that day.
  const questNarrative: NarrativeEntry[] = pendingQuestResult
    ? generateQuestNarrative(pendingQuestResult, completionDay)
    : [];

  // Pad to exactly completionDay snapshots (one per day) if we have fewer
  while (snapshots.length < completionDay) {
    const last = snapshots[snapshots.length - 1];
    snapshots.push({ ...last, step: snapshots.length + 1 });
  }
  // Truncate any excess snapshots beyond the completion day
  snapshots.splice(completionDay);

  // Apply all bonuses to the final score
  const lastSnapshot = snapshots[snapshots.length - 1];
  lastSnapshot.score += explorationBonus + questScore + earlyCompletionBonus;

  const storyKpis: StoryKpis = {
    currentDay: completionDay,
    locationsVisited,
    totalLocations,
    townsRested,
    ambushesSurvived,
    finalDestinationReached,
    explorationBonus: explorationBonus + questScore,
    ...(earlyCompletionBonus > 0 ? { earlyCompletionBonus } : {}),
  };

  // ── BRL narrative generation ──────────────────────────────────────────────
  // Set up entities for BRL story rules, schedule StoryGenerate, and read results.

  // Assign entity IDs for story generation (well above combat entity range)
  const STORY_ENTITY_BASE = 2000;
  let storyEntityId = STORY_ENTITY_BASE;

  // Create StoryHeroInfo entities for each hero
  selectedHeroes.forEach((hero, i) => {
    const heroSkills = _getClassSkills(hero.heroClass, classData);
    const skillNames = heroSkills.map(sk => getSkillName(sk, hero.heroClass));
    storyEntityId++;
    game.create_entity(storyEntityId);
    game.add_component(storyEntityId, 'StoryHeroInfo', JSON.stringify({
      heroName: hero.name,
      heroClass: hero.heroClass,
      traitRc: hero.traits.rc ?? 0,
      traitOd: hero.traits.od ?? 0,
      skill1: skillNames[0] ?? 'Attack',
      skill2: skillNames[1] ?? 'Defend',
      skill3: skillNames[2] ?? 'Heal',
      skill4: skillNames[3] ?? 'Special',
      heroIndex: i,
    }));
  });

  // Create StoryEnemyInfo entities for narrative encounter names
  enemyTemplates.forEach((tmpl, i) => {
    storyEntityId++;
    game.create_entity(storyEntityId);
    game.add_component(storyEntityId, 'StoryEnemyInfo', JSON.stringify({
      enemyName: tmpl.name,
      enemyExp: tmpl.exp,
      enemyIndex: i,
    }));
  });

  // Build quest info for step metadata
  const questInfoForSteps = pendingQuestResult ? {
    objectiveTitle: pendingQuestResult.quest.objectiveTitle,
    milestones: pendingQuestResult.quest.milestones.map(m => ({
      title: m.title,
      isCompleted: m.isCompleted,
      isActive: m.isActive,
    })),
  } : undefined;

  const questObjectiveStr = questInfoForSteps?.objectiveTitle ?? '';
  const activeMilestoneStr = questInfoForSteps?.milestones?.find(m => m.isActive)?.title ?? '';
  const completedMilestonesStr = questInfoForSteps?.milestones
    ?.filter(m => m.isCompleted)
    .map(m => m.title)
    .join(',') ?? '';

  // Create StoryGenerateConfig entity
  storyEntityId++;
  const configEntityId = storyEntityId;
  game.create_entity(configEntityId);
  game.add_component(configEntityId, 'StoryGenerateConfig', JSON.stringify({
    seed: seedNum,
    totalEncounters,
    locationsVisited,
    totalLocations,
    townsRested,
    ambushesSurvived,
    finalDestinationReached,
    completionDay,
    questObjective: questObjectiveStr,
    activeMilestone: activeMilestoneStr,
    completedMilestones: completedMilestonesStr,
    heroCount: selectedHeroes.length,
    enemyCount: enemyTemplates.length,
  }));

  // Create StoryHeroEncounter entities so BRL can integrate hero-specific
  // encounters into the timeline: completed encounters become blocking_encounter
  // steps (the party does not travel on those days), and unreached encounters
  // get "not reached" narrative during story_finalize.
  if (pendingQuestResult) {
    for (const heroEnc of pendingQuestResult.quest.heroEncounters) {
      if (heroEnc.triggerDay > 0) {
        storyEntityId++;
        game.create_entity(storyEntityId);
        game.add_component(storyEntityId, 'StoryHeroEncounter', JSON.stringify({
          triggerDay: heroEnc.triggerDay,
          title: heroEnc.title,
          heroName: heroEnc.heroName,
          description: heroEnc.description,
          matchReason: heroEnc.matchReason,
          narrativeOnMatch: heroEnc.narrativeOnMatch,
          narrativeOnComplete: heroEnc.narrativeOnComplete,
          buffType: heroEnc.buffType,
          buffAmount: heroEnc.buffAmount,
          bonusPoints: QUEST_HERO_ENCOUNTER_BONUS,
          isCompleted: heroEnc.isCompleted,
        }));
      }
    }
  }

  // Schedule StoryGenerate event and run BRL story rules
  game.schedule_event('StoryGenerate', 0.0);
  game.run_steps(500_000); // Process all story days (one event per day + sub-events)

  // Read NarrativeEntry entities produced by BRL rules
  const narrativeEntityIds: number[] = JSON.parse(game.get_entities_having('NarrativeEntry'));
  const brlNarrativeLog: NarrativeEntry[] = narrativeEntityIds.map(id => {
    const data = JSON.parse(game.get_component(id, 'NarrativeEntry'));
    return {
      day: data.day,
      hour: data.hour,
      level: data.level,
      text: data.text,
    };
  });

  // Read StoryStepData entities produced by BRL rules
  const stepEntityIds: number[] = JSON.parse(game.get_entities_having('StoryStepData'));
  const brlStorySteps: StoryStep[] = stepEntityIds.map(id => {
    const data = JSON.parse(game.get_component(id, 'StoryStepData'));
    return {
      index: data.stepIndex,
      day: data.day,
      hour: data.hour,
      type: data.stepType as StoryStepType,
      locationName: data.locationName,
      locationId: data.locationId,
      destinationName: data.destinationName || undefined,
      encounterName: data.encounterName || undefined,
      isBlocking: data.isBlocking || undefined,
      pathDescription: data.pathDescription || undefined,
      score: data.score,
      narrativeEntries: [],
      questObjective: data.questObjective || undefined,
      activeMilestone: data.activeMilestone || undefined,
      completedMilestones: data.completedMilestones
        ? data.completedMilestones.split(',').filter((s: string) => s)
        : undefined,
    };
  });

  // Sort steps by index and associate narrative entries with steps
  brlStorySteps.sort((a, b) => a.index - b.index);
  brlNarrativeLog.sort((a, b) => a.day - b.day || a.hour - b.hour);

  // Assign narrative entries to their corresponding steps.
  // Build a day -> sorted-steps map (steps are already sorted by index).
  const stepsByDay = new Map<number, StoryStep[]>();
  for (const step of brlStorySteps) {
    if (!stepsByDay.has(step.day)) stepsByDay.set(step.day, []);
    stepsByDay.get(step.day)!.push(step);
  }
  // Each entry goes to the first step whose hour >= entry.hour on the same day.
  // If no such step exists, it falls back to the last step of that day.
  function assignEntriesToSteps(entries: NarrativeEntry[]) {
    for (const entry of entries) {
      const daySteps = stepsByDay.get(entry.day) ?? [];
      const targetStep =
        daySteps.find(s => s.hour >= entry.hour) ?? daySteps[daySteps.length - 1];
      if (targetStep) {
        targetStep.narrativeEntries.push(entry);
      }
    }
  }
  assignEntriesToSteps(brlNarrativeLog);
  // Also distribute quest narrative entries (hero challenges, milestone events)
  // so they appear in the run page steps, not only in the results page log.
  assignEntriesToSteps(questNarrative);

  // Per-step milestone state: override BRL's static milestone strings with
  // day-accurate state derived from the quest simulation. This ensures early
  // steps do not show milestones that only appeared later in the run.
  if (pendingQuestResult) {
    const questMilestones = pendingQuestResult.quest.milestones;

    // Compute the day on which a milestone was effectively completed.
    const getMilestoneCompletionDay = (m: (typeof questMilestones)[number]): number => {
      if (!m.isCompleted) return Infinity;
      if (m.completedViaBailout) return m.activationDay + m.bailoutDay;
      const keyDays = m.events
        .filter(e => e.isKeyEvent && e.completedDay > 0)
        .map(e => e.completedDay);
      return keyDays.length > 0 ? keyDays.reduce((max, day) => Math.max(max, day), 0) : m.activationDay + 1;
    };

    for (const step of brlStorySteps) {
      const day = step.day;
      // Only milestones that have been activated by this step's day
      const appeared = questMilestones.filter(
        m => m.activationDay > 0 && m.activationDay <= day,
      );
      const completedTitles = appeared
        .filter(m => m.isCompleted && getMilestoneCompletionDay(m) <= day)
        .map(m => m.title);
      const activeMilestone = appeared.find(
        m => m.isActive && !(m.isCompleted && getMilestoneCompletionDay(m) <= day),
      )?.title;

      step.completedMilestones = completedTitles.length > 0 ? completedTitles : undefined;
      step.activeMilestone = activeMilestone;
    }
  }

  // Merge quest narrative entries into the base log, sorted by day/hour
  const narrativeLog = [...brlNarrativeLog, ...questNarrative]
    .sort((a, b) => a.day - b.day || a.hour - b.hour);

  // Distribute score across story steps proportionally
  const storySteps = brlStorySteps;
  const finalScore = lastSnapshot.score;
  if (storySteps.length > 0) {
    for (let i = 0; i < storySteps.length; i++) {
      // Linear interpolation of score across steps
      storySteps[i].score = Math.round(finalScore * (i + 1) / storySteps.length);
    }
  }

  return { snapshots, storyKpis, narrativeLog, storySteps };
}

// ── Story mode narrative log generation ─────────────────────────────────────
// Party traveling, voting, and narrative generation are now in BRL
// (game/brl/story-rules.brl). The functions _narrativeHash, _pickOne,
// _selectWorldLocations, and _generateNarrativeLog have been removed.
// TypeScript sets up StoryHeroInfo/StoryEnemyInfo/StoryGenerateConfig entities,
// schedules StoryGenerate, and reads back NarrativeEntry + StoryStepData entities.
