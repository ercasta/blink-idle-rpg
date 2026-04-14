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

import type { GameSnapshot, HeroDefinition, GameMode, HeroPath, CustomModeSettings, EnvironmentSettings, DamageCategory, Element, RunType, StoryKpis, NarrativeEntry, NarrativeLevel } from '../types';
import { DEFAULT_ENVIRONMENT_SETTINGS } from '../types';
import { simulateHeroPath, getSkillName, deriveDamageCategory, deriveDamageElement, deriveResistances, computeLinePreferenceScore } from '../data/traits';
import { computeAdventureSeed, simulateQuestProgress, generateQuestNarrative, QUEST_EARLY_COMPLETION_POINTS_PER_DAY } from '../data/adventureQuest';
import type { AdventureDefinition } from '../types';
import { selectWorldMap, findPath, selectArrivalComments, findBlockingEncounters, PATH_TYPE_DESCRIPTIONS, initWorldData } from '../data/worldData';
import type { WorldLocation, WorldPath } from '../data/worldData';
import { loadEnemyTemplates } from '../data/enemyData';
import type { EnemyTemplate } from '../data/enemyData';
import { loadScenarioConfigs } from '../data/scenarioData';
import type { ModeConfig } from '../data/scenarioData';
import { loadHeroClassData } from '../data/heroClassData';
import type { HeroClassData } from '../data/heroClassData';

// ── Hero stats per class ────────────────────────────────────────────────────
// Hero class combat stats, skills, and growth vectors are now loaded from BRL
// hero-classes.brl at runtime via loadHeroClassData() in heroClassData.ts.
// The hardcoded fallbacks below are used only when BRL files are unavailable
// (e.g. unit tests).

const FALLBACK_CLASS_BASE_HP: Record<string, number> = {
  Warrior: 250, Mage: 150, Ranger: 140, Paladin: 220, Rogue: 130, Cleric: 180,
};

const FALLBACK_CLASS_BASE_DAMAGE: Record<string, number> = {
  Warrior: 28, Mage: 35, Ranger: 22, Paladin: 20, Rogue: 24, Cleric: 16,
};

const FALLBACK_CLASS_BASE_DEFENSE: Record<string, number> = {
  Warrior: 12, Mage: 5, Ranger: 7, Paladin: 14, Rogue: 6, Cleric: 8,
};

const FALLBACK_CLASS_SKILLS: Record<string, [string, string, string, string]> = {
  Warrior: ['power_strike', 'shield_bash', 'defensive_stance', 'execute'],
  Mage:    ['fireball', 'frost_bolt', 'arcane_blast', 'mana_shield'],
  Ranger:  ['arrow_shot', 'multi_shot', 'evade', 'trap'],
  Paladin: ['holy_strike', 'divine_shield', 'consecrate', 'lay_on_hands'],
  Rogue:   ['backstab', 'smoke_bomb', 'poison_blade', 'shadowstep'],
  Cleric:  ['heal', 'smite', 'divine_favor', 'holy_word'],
};

const FALLBACK_CLASS_ATTACK_SPEED: Record<string, number> = {
  Warrior: 0.9, Mage: 0.6, Ranger: 1.1, Paladin: 0.7, Rogue: 1.3, Cleric: 0.6,
};

// ── Helper to resolve class data from BRL-loaded or fallback ────────────────

function _getClassBaseHp(heroClass: string, classData: Record<string, HeroClassData>): number {
  return classData[heroClass]?.combat.baseHp ?? FALLBACK_CLASS_BASE_HP[heroClass] ?? 100;
}

function _getClassBaseDamage(heroClass: string, classData: Record<string, HeroClassData>): number {
  return classData[heroClass]?.combat.baseDamage ?? FALLBACK_CLASS_BASE_DAMAGE[heroClass] ?? 15;
}

function _getClassBaseDefense(heroClass: string, classData: Record<string, HeroClassData>): number {
  return classData[heroClass]?.combat.baseDefense ?? FALLBACK_CLASS_BASE_DEFENSE[heroClass] ?? 5;
}

function _getClassAttackSpeed(heroClass: string, classData: Record<string, HeroClassData>): number {
  return classData[heroClass]?.combat.baseAttackSpeed ?? FALLBACK_CLASS_ATTACK_SPEED[heroClass] ?? 1.0;
}

function _getClassSkills(heroClass: string, classData: Record<string, HeroClassData>): [string, string, string, string] {
  const cd = classData[heroClass];
  if (cd) {
    return [cd.skills.skill1 || 'basic_attack', cd.skills.skill2 || '', cd.skills.skill3 || '', cd.skills.skill4 || ''];
  }
  return FALLBACK_CLASS_SKILLS[heroClass] ?? ['basic_attack', '', '', ''];
}

// ── Game mode spawn configs ─────────────────────────────────────────────────
// Mode configs are now loaded from BRL scenario files at runtime via
// loadScenarioConfigs() in scenarioData.ts.  The hardcoded fallback below
// is used only when BRL files are unavailable (e.g. unit tests).

const FALLBACK_NORMAL_CONFIG: ModeConfig = {
  bossEveryKills: 100, tierProgressionKills: 500,
  healthScaleRate: 80, damageScaleRate: 60, initialEnemyCount: 5,
  retreatTimePenalty: 10.0, deathTimePenaltyMultiplier: 2.0, fleeCooldown: 5.0,
  pointsPerKill: 10, pointsPerWave: 50, pointsPerBoss: 500,
  pointsLostPerDeath: 30, pointsLostPerRetreat: 50, pointsLostPerPenaltySecond: 2,
  timeBonusPoints: 1000, timeBonusInterval: 10.0,
};

// ── Enemy template data ─────────────────────────────────────────────────────
// Enemy templates are now loaded from BRL enemies.brl at runtime via
// loadEnemyTemplates() in enemyData.ts.  The hardcoded fallback below
// is used only when BRL files are unavailable (e.g. unit tests).

const FALLBACK_ENEMY_TEMPLATES: EnemyTemplate[] = [
  { id: 100, tier: 1, name: 'Goblin Scout',      hp: 45,  dmg: 6,  def: 2,  spd: 0.8, exp: 25,  boss: false, finalBoss: false, stats: { strength: 6, dexterity: 10, intelligence: 3, constitution: 6, wisdom: 3 }, mana: 0, critChance: 0.05, critMultiplier: 1.5 },
  { id: 101, tier: 2, name: 'Orc Raider',        hp: 70,  dmg: 10, def: 3,  spd: 0.7, exp: 35,  boss: false, finalBoss: false, stats: { strength: 10, dexterity: 7, intelligence: 3, constitution: 10, wisdom: 3 }, mana: 0, critChance: 0.05, critMultiplier: 1.5 },
  { id: 102, tier: 2, name: 'Dark Wolf',         hp: 55,  dmg: 11, def: 2,  spd: 1.0, exp: 40,  boss: false, finalBoss: false, stats: { strength: 8, dexterity: 14, intelligence: 3, constitution: 6, wisdom: 4 }, mana: 0, critChance: 0.08, critMultiplier: 1.5 },
  { id: 103, tier: 3, name: 'Skeleton Warrior',  hp: 85,  dmg: 13, def: 5,  spd: 0.6, exp: 50,  boss: false, finalBoss: false, stats: { strength: 12, dexterity: 8, intelligence: 3, constitution: 10, wisdom: 3 }, mana: 0, critChance: 0.08, critMultiplier: 1.5 },
  { id: 104, tier: 3, name: 'Dark Mage',         hp: 60,  dmg: 18, def: 3,  spd: 0.5, exp: 75,  boss: false, finalBoss: false, stats: { strength: 5, dexterity: 8, intelligence: 14, constitution: 6, wisdom: 10 }, mana: 100, critChance: 0.12, critMultiplier: 1.8 },
  { id: 105, tier: 4, name: 'Troll Berserker',   hp: 140, dmg: 18, def: 6,  spd: 0.5, exp: 80,  boss: false, finalBoss: false, stats: { strength: 15, dexterity: 6, intelligence: 3, constitution: 15, wisdom: 3 }, mana: 0, critChance: 0.10, critMultiplier: 1.5 },
  { id: 106, tier: 5, name: 'Demon Knight',      hp: 200, dmg: 24, def: 8,  spd: 0.6, exp: 150, boss: false, finalBoss: false, stats: { strength: 15, dexterity: 10, intelligence: 8, constitution: 14, wisdom: 6 }, mana: 50, critChance: 0.12, critMultiplier: 1.8 },
  { id: 107, tier: 6, name: 'Ancient Dragon',    hp: 300, dmg: 30, def: 10, spd: 0.7, exp: 300, boss: true,  finalBoss: false, stats: { strength: 18, dexterity: 12, intelligence: 14, constitution: 18, wisdom: 12 }, mana: 150, critChance: 0.15, critMultiplier: 1.8 },
  { id: 108, tier: 6, name: 'Dragon Lord Vexar', hp: 400, dmg: 35, def: 12, spd: 0.7, exp: 500, boss: true,  finalBoss: true,  stats: { strength: 20, dexterity: 12, intelligence: 16, constitution: 20, wisdom: 12 }, mana: 200, critChance: 0.15, critMultiplier: 2.0 },
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
): Promise<{ snapshots: GameSnapshot[]; heroPaths: HeroPath[]; storyKpis?: StoryKpis; narrativeLog?: NarrativeEntry[] }> {
  // Load WASM module and BRL game data in parallel
  const [mod, enemyTemplates, scenarioConfigs, heroClassResult] = await Promise.all([
    loadWasmModule(),
    loadEnemyTemplates(),
    loadScenarioConfigs(),
    loadHeroClassData(),
    initWorldData(),  // Populates world data from BRL (returns void)
  ]) as [Awaited<ReturnType<typeof loadWasmModule>>, Awaited<ReturnType<typeof loadEnemyTemplates>>, Awaited<ReturnType<typeof loadScenarioConfigs>>, Awaited<ReturnType<typeof loadHeroClassData>>, void];

  if (!mod) {
    throw new Error(
      'WASM engine is not available. ' +
      'Run `npm run build:wasm && npm run install:wasm` to build and install it.'
    );
  }

  // Use BRL-loaded data, falling back to hardcoded defaults if BRL load failed
  const enemies = enemyTemplates.length > 0 ? enemyTemplates : FALLBACK_ENEMY_TEMPLATES;
  const modeConfigs = Object.keys(scenarioConfigs).length > 0 ? scenarioConfigs : { normal: FALLBACK_NORMAL_CONFIG };
  const normalConfig = modeConfigs['normal'] ?? FALLBACK_NORMAL_CONFIG;
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

      return { snapshots: result.snapshots, heroPaths, storyKpis: result.storyKpis, narrativeLog: result.narrativeLog };
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
): { snapshots: GameSnapshot[]; storyKpis: StoryKpis; narrativeLog: NarrativeEntry[] } {
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

  // Generate narrative log — deterministic from seed + heroes + game outcome
  const baseNarrativeLog = _generateNarrativeLog(
    selectedHeroes, seedNum, totalEncounters,
    locationsVisited, totalLocations, townsRested, ambushesSurvived,
    finalDestinationReached, env, enemyTemplates, completionDay, classData,
  );

  // Merge quest narrative entries into the base log, sorted by day/hour
  const narrativeLog = [...baseNarrativeLog, ...questNarrative]
    .sort((a, b) => a.day - b.day || a.hour - b.hour);

  return { snapshots, storyKpis, narrativeLog };
}

// ── Story mode narrative log generation ─────────────────────────────────────

/** Deterministic hash for narrative seeding. */
function _narrativeHash(a: number, b: number, c: number): number {
  let h = (a * 2654435761 + b * 2246822519 + c * 3266489909) >>> 0;
  h = ((h ^ (h >> 16)) * 2246822507) >>> 0;
  h = ((h ^ (h >> 13)) * 3266489909) >>> 0;
  return (h ^ (h >> 16)) >>> 0;
}

/** Pick one item from an array using a deterministic hash. */
function _pickOne<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/**
 * Select world locations for a story map using the persistent world data.
 *
 * Replaces the procedural _generateLocationNames() with world-based map
 * selection per doc/game-design/world-design.md "Map Selection".
 */
function _selectWorldLocations(seedNum: number, count: number): {
  locations: WorldLocation[];
  paths: WorldPath[];
  locationNames: string[];
} {
  const { locations, paths } = selectWorldMap(seedNum, count);
  return {
    locations,
    paths,
    locationNames: locations.map(l => l.name),
  };
}

/**
 * Generate a complete narrative log for a story mode run.
 *
 * Uses the persistent world data (locations, paths, NPCs, hero arrival
 * comments, blocking encounters) to generate narratively rich text.
 * Location descriptions are shown at level 3, hero arrival comments at
 * level 3, and path descriptions at level 3.
 *
 * All text is generated deterministically from the seed, hero names, and game
 * outcome — no PRNG state is needed beyond what can be reconstructed from
 * these inputs.
 */
function _generateNarrativeLog(
  heroes: HeroDefinition[],
  seedNum: number,
  totalEncounters: number,
  locationsVisited: number,
  totalLocations: number,
  townsRested: number,
  ambushesSurvived: number,
  finalDestinationReached: boolean,
  _env: EnvironmentSettings,
  enemyPool: EnemyTemplate[],
  completionDay: number = STORY_TOTAL_DAYS,
  classData: Record<string, HeroClassData> = {},
): NarrativeEntry[] {
  const log: NarrativeEntry[] = [];
  const heroNames = heroes.map(h => h.name);

  // Select world locations for this adventure's map
  const worldMap = _selectWorldLocations(seedNum, totalLocations);
  const locationNames = worldMap.locationNames;
  const worldLocations = worldMap.locations;
  const startLocation = locationNames[0];
  const finalLocation = locationNames[locationNames.length - 1];

  function emit(day: number, hour: number, level: NarrativeLevel, text: string) {
    log.push({ day, hour, level, text });
  }

  // ── Day 1 opening ─────────────────────────────────────────────────────
  emit(1, 0, 1, `The adventure begins at ${startLocation}. The party prepares for a 30-day journey.`);
  emit(1, 0, 2, `The party gathers at the ${startLocation} tavern. Their destination: ${finalLocation}.`);
  emit(1, 0, 3, `${heroNames.join(', ')} check their equipment and study the map. The road ahead is long.`);

  // Show starting location description at level 3
  if (worldLocations[0]) {
    emit(1, 0, 3, worldLocations[0].description);
  }

  // Track which locations have been visited, encounters per day, etc.
  let encountersRemaining = totalEncounters;
  let locationsLeft = locationsVisited - 1; // -1 for start
  let townsLeft = townsRested;
  let ambushesLeft = ambushesSurvived;
  let currentLocationIdx = 0;

  for (let day = 1; day <= completionDay; day++) {
    const dayHash = _narrativeHash(seedNum, day, 0);

    // Day start (skip day 1, already emitted)
    if (day > 1) {
      emit(day, 0, 1, `Day ${day} begins.`);
    }

    // ── Decision / Voting ───────────────────────────────────────────────
    // Pick next destination based on deterministic hash
    const shouldTravel = locationsLeft > 0 && day < STORY_TOTAL_DAYS;
    if (shouldTravel) {
      const nextLocIdx = Math.min(currentLocationIdx + 1, locationNames.length - 1);
      const nextLocation = locationNames[nextLocIdx];
      const nextWorldLoc = worldLocations[nextLocIdx];
      const prevWorldLoc = worldLocations[currentLocationIdx];

      // Find the world path between current and next location
      const travelPath = prevWorldLoc && nextWorldLoc
        ? findPath(prevWorldLoc.locationId, nextWorldLoc.locationId)
        : undefined;
      const terrainDesc = travelPath
        ? (PATH_TYPE_DESCRIPTIONS[travelPath.pathType] ?? travelPath.pathType)
        : 'the road ahead';

      // Each hero proposes a destination based on traits
      const heroProposals: string[] = [];
      for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi];
        const h = _narrativeHash(seedNum, day, hi + 100);
        // Cautious heroes (high rc) propose towns/safe routes
        // Risky heroes (low rc) propose dangerous wilderness
        const isCautious = hero.traits.rc > 0;
        const isOffensive = hero.traits.od < 0;

        if (isCautious && townsLeft > 0 && h % 3 === 0) {
          // Propose a safe town — look for a town in the selected locations
          const townIdx = _narrativeHash(seedNum, day, hi + 200) % locationNames.length;
          const townName = locationNames[townIdx];
          heroProposals.push(`${hero.name} proposes to retreat to ${townName} and heal`);
        } else if (isOffensive) {
          heroProposals.push(`${hero.name} proposes to push toward ${nextLocation} through ${terrainDesc}`);
        } else {
          heroProposals.push(`${hero.name} proposes to head for ${nextLocation}`);
        }
      }

      // Level 2: Show each hero's preference
      for (const proposal of heroProposals) {
        emit(day, 0, 2, proposal);
      }

      // Party decision
      emit(day, 1, 2, `The party decides to travel toward ${nextLocation}.`);
      if (travelPath) {
        emit(day, 1, 3, `The path leads through ${terrainDesc}. Travel will take approximately ${travelPath.travelHours} hours.`);
      } else {
        emit(day, 1, 3, `The path leads through ${terrainDesc}. Travel will take several hours.`);
      }

      const prevLocation = locationNames[currentLocationIdx];
      currentLocationIdx = nextLocIdx;
      locationsLeft--;

      // ── Travel & Encounters ─────────────────────────────────────────
      const travelHours = travelPath ? travelPath.travelHours : (2 + (dayHash % 5));
      const encountersToday = Math.min(encountersRemaining,
        Math.max(0, 1 + (dayHash % 4))); // 1-4 encounters

      emit(day, 1, 2, `The party sets out from ${prevLocation} toward ${nextLocation}, following ${terrainDesc}.`);
      // Show path description at level 3
      if (travelPath) {
        emit(day, 1, 3, travelPath.description);
      } else {
        emit(day, 1, 3, `The route will take approximately ${travelHours} hours.`);
      }

      // ── Blocking encounter check ────────────────────────────────────
      if (travelPath) {
        const blockingEncs = findBlockingEncounters(
          travelPath.pathType, travelPath.pathId,
          nextWorldLoc?.locationId,
        );
        if (blockingEncs.length > 0) {
          const blockHash = _narrativeHash(seedNum, day, 900);
          const blocking = blockingEncs[blockHash % blockingEncs.length];
          if ((blockHash % 100) / 100 < blocking.triggerChance) {
            emit(day, 2, 2, `⚠️ ${blocking.description}`);
            emit(day, 2, 3, blocking.narrativeOnBlock);
            emit(day, 2, 3, blocking.narrativeOnResolve);
          }
        }
      }

      let hour = 2;
      for (let enc = 0; enc < encountersToday && encountersRemaining > 0; enc++) {
        const encHash = _narrativeHash(seedNum, day, enc + 300);
        const enemyIdx = encHash % enemyPool.length;
        const enemy = enemyPool[enemyIdx];
        const enemyCount = Math.max(1, heroes.length + (encHash % 3) - 1);

        // Encounter notification
        emit(day, hour, 2, `The party encounters ${enemyCount} ${enemy.name}${enemyCount > 1 ? 's' : ''}!`);

        // Combat details — hero actions
        for (let hi = 0; hi < heroes.length; hi++) {
          const hero = heroes[hi];
          const actionHash = _narrativeHash(seedNum, day * 100 + enc, hi + 400);
          const skills = _getClassSkills(hero.heroClass, classData);
          const skillIdx = actionHash % skills.length;
          const skillKey = skills[skillIdx];
          const skillName = getSkillName(skillKey, hero.heroClass);

          emit(day, hour, 3, `${hero.name} uses ${skillName}.`);

          // Effect descriptions
          const effectHash = _narrativeHash(seedNum, day * 100 + enc, hi + 500);
          const effects = [
            `The enemy staggers from the blow.`,
            `The attack lands with devastating force.`,
            `A critical hit!`,
            `The enemy is weakened.`,
            `The enemy is knocked back.`,
          ];
          if (effectHash % 3 === 0) {
            emit(day, hour, 3, _pickOne(effects, effectHash));
          }
        }

        // Combat outcome
        const xp = enemy.exp * enemyCount;
        emit(day, hour, 3, `The party defeats the ${enemy.name}${enemyCount > 1 ? 's' : ''}. ${enemyCount} enem${enemyCount > 1 ? 'ies' : 'y'} slain, ${xp} XP earned.`);

        encountersRemaining -= enemyCount;
        hour++;
      }

      // Arrival
      emit(day, hour, 1, `Day ${day} — The party arrives at ${nextLocation}.`);

      // Show location description at level 3
      if (nextWorldLoc) {
        emit(day, hour, 3, nextWorldLoc.description);
      }

      // ── Hero arrival comments (level 3, ~60% trigger rate) ──────────
      if (nextWorldLoc) {
        const commentHash = _narrativeHash(seedNum, day, 850);
        if (commentHash % 100 < 60) { // 60% trigger rate
          // Pick the best-matching hero for a comment
          const heroIdx = commentHash % heroes.length;
          const hero = heroes[heroIdx];
          const traitMap: Record<string, number> = {};
          for (const key of Object.keys(hero.traits)) {
            traitMap[key] = hero.traits[key as keyof typeof hero.traits];
          }
          const comments = selectArrivalComments(hero.heroClass, traitMap, nextWorldLoc);
          if (comments.length > 0) {
            const selectedComment = comments[0];
            const commentText = selectedComment.comment.replace('{hero_name}', hero.name);
            emit(day, hour, 3, commentText);
          }
        }
      }

      // Town rest or camp
      const isTown = townsLeft > 0 && (nextWorldLoc?.locationType === 'town' || dayHash % 3 === 0);
      if (isTown) {
        townsLeft--;
        emit(day, hour + 1, 2, `The party rests at the ${nextLocation} tavern. All wounds are healed.`);
        emit(day, hour + 1, 3, `A warm meal and a soft bed restore the party to full strength.`);
      } else {
        emit(day, hour + 1, 2, `The party sets up camp as night falls.`);

        // Night ambush chance
        if (ambushesLeft > 0 && dayHash % 5 === 0) {
          ambushesLeft--;
          const ambushHash = _narrativeHash(seedNum, day, 600);
          const ambushEnemy = enemyPool[ambushHash % enemyPool.length];
          const ambushCount = Math.max(1, heroes.length - 1);

          emit(day, hour + 2, 2, `The night watch spots movement! ${ambushCount} ${ambushEnemy.name}${ambushCount > 1 ? 's' : ''} attack the camp.`);

          for (let hi = 0; hi < heroes.length; hi++) {
            const hero = heroes[hi];
            const skills = _getClassSkills(hero.heroClass, classData);
            const sh = _narrativeHash(seedNum, day, hi + 700);
            const skillName = getSkillName(skills[sh % skills.length], hero.heroClass);
            emit(day, hour + 2, 3, `${hero.name} scrambles awake and uses ${skillName}.`);
          }

          emit(day, hour + 2, 3, `The party fends off the ambush. +100 bonus points.`);
        } else {
          const watchHero = heroes[dayHash % heroes.length];
          emit(day, hour + 1, 3, `${watchHero.name} volunteers for first watch. The night passes without incident.`);
        }
      }
    } else {
      // Rest day or final day
      if (day === completionDay) {
        emit(day, 0, 2, `The final day of the journey.`);
      } else {
        emit(day, 0, 2, `The party rests and recuperates.`);
      }
    }

    // Day summary
    const dayEncounters = Math.max(0, Math.min(4, _narrativeHash(seedNum, day, 800) % 5));
    emit(day, 11, 1, `Day ${day} ends. ${dayEncounters > 0 ? `${dayEncounters} encounters fought.` : 'A quiet day.'}`);
  }

  // ── Journey end ───────────────────────────────────────────────────────
  const isEarlyCompletion = completionDay < STORY_TOTAL_DAYS;
  if (finalDestinationReached && isEarlyCompletion) {
    const daysRemaining = STORY_TOTAL_DAYS - completionDay;
    emit(completionDay, 11, 1, `🏆 Mission complete! The party has achieved their goal with ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} to spare!`);
    emit(completionDay, 11, 2, `${heroNames.join(', ')} have accomplished the mission ahead of schedule.`);
    emit(completionDay, 11, 3, `${locationsVisited} locations explored, ${totalEncounters} enemies defeated. An exceptional performance.`);
  } else if (finalDestinationReached) {
    emit(completionDay, 11, 1, `The party reaches ${finalLocation}! The journey ends in triumph.`);
    emit(completionDay, 11, 2, `After ${completionDay} day${completionDay !== 1 ? 's' : ''} of travel, the heroes stand victorious at ${finalLocation}.`);
    emit(completionDay, 11, 3, `${heroNames.join(', ')} raise their weapons in celebration. ${locationsVisited} locations explored, ${totalEncounters} enemies defeated.`);
  } else {
    emit(completionDay, 11, 1, `The journey ends. The party did not reach ${finalLocation}.`);
    emit(completionDay, 11, 2, `After ${completionDay} day${completionDay !== 1 ? 's' : ''}, the heroes' strength was not enough to complete the journey.`);
  }

  return log;
}
