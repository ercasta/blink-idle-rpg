/**
 * Core game types for the Blink Idle RPG web app.
 *
 * A GameSnapshot captures the key KPIs at a progress checkpoint.
 * The UI replays snapshots at 1 per second to animate the battle.
 */

export interface GameSnapshot {
  step: number;             // checkpoint number 1..N
  simulationTime: number;   // in-game seconds at this checkpoint
  enemiesDefeated: number;
  score: number;
  currentTier: number;
  currentWave: number;
  heroLevels: Record<string, number>;  // hero name → level
  bossesDefeated: number;
  playerDeaths: number;
  isGameOver: boolean;
  victory: boolean;
}

export interface RunResult {
  snapshots: GameSnapshot[];
  finalScore: number;
  victory: boolean;
  enemiesDefeated: number;
  playerDeaths: number;
  bossesDefeated: number;
  totalTime: number;        // in-game seconds
  deepestTier: number;
  deepestWave: number;
  heroPaths: HeroPath[];
  /** Persistence metadata – present once the run has been saved or loaded */
  id?: string;
  timestamp?: number;
  favorited?: boolean;
  heroes?: HeroDefinition[];
  mode?: GameMode;
  customSettings?: CustomModeSettings;
  adventure?: AdventureDefinition;
}

export type HeroClass = 'Warrior' | 'Mage' | 'Ranger' | 'Paladin' | 'Rogue' | 'Cleric';

/**
 * 12 character traits, each in [−16, 15].
 * See doc/game-design/character-traits.md for axis definitions.
 */
export interface HeroTraits {
  pm: number;   // physical ↔ magical
  od: number;   // offensive ↔ defensive
  sa: number;   // supportive ↔ attacker
  rc: number;   // risky ↔ cautious
  fw: number;   // fire ↔ water
  we: number;   // wind ↔ earth
  ld: number;   // light ↔ darkness
  co: number;   // chaos ↔ order
  sh: number;   // sly ↔ honorable
  rm: number;   // range ↔ melee
  ai: number;   // absorb ↔ inflict
  af: number;   // area ↔ focus
}

export interface HeroDefinition {
  id: string;
  name: string;
  heroClass: HeroClass;
  description: string;
  role: string;
  emoji: string;
  stats: {
    strength: number;
    dexterity: number;
    intelligence: number;
    constitution: number;
    wisdom: number;
  };
  traits: HeroTraits;
}

/** A single entry in a hero's progression path log. */
export interface HeroPathEntry {
  level: number;
  statsGained: { str: number; dex: number; int: number; con: number; wis: number };
  skillChosen: string | null;
}

/** Full progression path for one hero across the run. */
export interface HeroPath {
  heroName: string;
  heroClass: HeroClass;
  entries: HeroPathEntry[];
  finalStats: { str: number; dex: number; int: number; con: number; wis: number };
}

export type GameMode = 'normal' | 'easy' | 'hard' | 'custom';

/**
 * Custom-mode slider settings.
 * Each value is a percentage offset from the normal-mode baseline: -50 to +50.
 * A value of 0 means "same as normal mode", -50 means half, +50 means 1.5×.
 */
export interface CustomModeSettings {
  /** Hero-death score penalty offset in % (−50…+50) */
  heroPenaltyPct: number;
  /** Party-wipeout respawn-time penalty offset in % (−50…+50) */
  wipeoutPenaltyPct: number;
  /** Experience-gain multiplier offset in % (−50…+50) */
  expMultiplierPct: number;
  /** Encounter-difficulty (enemy health/damage scaling) offset in % (−50…+50) */
  encounterDifficultyPct: number;
}

export const DEFAULT_CUSTOM_SETTINGS: CustomModeSettings = {
  heroPenaltyPct: 0,
  wipeoutPenaltyPct: 0,
  expMultiplierPct: 0,
  encounterDifficultyPct: 0,
};

export interface AdventureDefinition {
  id: string;
  name: string;
  /** Auto-generated prose description based on the adventure's settings */
  description: string;
  mode: GameMode;
  customSettings?: CustomModeSettings;
  /** Exact number of heroes the party must have (1–6, default 4) */
  requiredHeroCount: number;
  /** Classes permitted in the party (default: all 6) */
  allowedClasses: HeroClass[];
}

export interface GameModeDefinition {
  id: GameMode;
  name: string;
  description: string;
  difficulty: string;
}

export interface RunConfig {
  mode: GameMode;
  selectedHeroes: HeroDefinition[];
  customSettings?: CustomModeSettings;
}

export type AppScreen =
  | 'home'
  | 'roster'
  | 'mode-select'
  | 'adventure-select'
  | 'adventure-manager'
  | 'party-select'
  | 'battle'
  | 'results'
  | 'run-history';
