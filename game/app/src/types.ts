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
  /** Story mode KPIs (only present for story runs) */
  storyKpis?: StoryKpis;
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

/** Front line (melee, offensive) or back line (ranged, defensive). */
export type LinePreference = 'front' | 'back';

/** Combat role computed from traits. */
export type HeroRole = 'Tank' | 'DPS' | 'Support' | 'Healer' | 'Controller' | 'Skirmisher';

export const ALL_LINE_PREFERENCES: LinePreference[] = ['front', 'back'];
export const ALL_ROLES: HeroRole[] = ['Tank', 'DPS', 'Support', 'Healer', 'Controller', 'Skirmisher'];

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
  /** Computed front/back line preference based on traits */
  linePreference?: LinePreference;
  /** Whether the player has starred this hero as a favourite */
  favourite?: boolean;
  /** Total number of adventures this hero has participated in */
  adventuresPlayed?: number;
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

/** Run type: fight mode (classic 3000-encounter) or story mode (30-day journey). */
export type RunType = 'fight' | 'story';

// ── Damage types & resistances ──────────────────────────────────────────────

/** Physical or magical damage source category. */
export type DamageCategory = 'physical' | 'magical';

/** Elemental affinity — `neutral` means no elemental modifier. */
export type Element = 'neutral' | 'fire' | 'water' | 'wind' | 'earth' | 'light' | 'darkness';

/** All non-neutral elements (neutral has no associated slider or resistance). */
export const ALL_ELEMENTS: Element[] = ['fire', 'water', 'wind', 'earth', 'light', 'darkness'];

/**
 * Adventure environment settings — probability sliders that control the
 * chance of encountering enemies with specific damage types and resistances.
 *
 * Each slider is **unified**: a high "fire" value means enemies are more likely
 * to BOTH deal fire damage AND resist fire attacks.  Sliders are independent
 * across elements — an adventure can have both high fire and water chances.
 *
 * Each value is a percentage 0–100.
 */
export interface EnvironmentSettings {
  physicalPct: number;
  magicalPct: number;
  firePct: number;
  waterPct: number;
  windPct: number;
  earthPct: number;
  lightPct: number;
  darknessPct: number;
}

export const DEFAULT_ENVIRONMENT_SETTINGS: EnvironmentSettings = {
  physicalPct: 50,
  magicalPct: 30,
  firePct: 15,
  waterPct: 15,
  windPct: 10,
  earthPct: 10,
  lightPct: 10,
  darknessPct: 10,
};

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
  /** Environment sliders controlling enemy damage types and resistances */
  environmentSettings?: EnvironmentSettings;
  /** Run type: 'fight' (classic 3000-encounter) or 'story' (30-day journey). Defaults to 'fight'. */
  runType?: RunType;
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

/** A single entry in an adventure leaderboard. */
export interface LeaderboardEntry {
  /** The ID of the run this entry belongs to. */
  runId: string;
  /** Final score for this run. */
  score: number;
  /** Unix timestamp (ms) when the run completed. */
  timestamp: number;
  /** Display names of the heroes used in this run. */
  heroNames: string[];
  /** Whether the run ended in victory. */
  victory: boolean;
  /** Run type: fight or story. Defaults to 'fight' for legacy entries. */
  runType?: RunType;
}

/** Per-adventure leaderboard (top 10 runs by score). */
export interface AdventureLeaderboard {
  /** The ID of the adventure this leaderboard belongs to. */
  adventureId: string;
  /** Ordered list of best runs, sorted by score descending (max 10 entries). */
  entries: LeaderboardEntry[];
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

// ── Story mode types ────────────────────────────────────────────────────────

/** Verbosity level for narrative log entries in story mode. */
export type NarrativeLevel = 1 | 2 | 3;

/** A single entry in the story mode narrative log. */
export interface NarrativeEntry {
  /** Day the message was generated (1-based). */
  day: number;
  /** Hour within the day (0-based). */
  hour: number;
  /** Verbosity level: 1=Headlines, 2=Standard, 3=Detailed. */
  level: NarrativeLevel;
  /** The narrative message text. */
  text: string;
}

/** Story mode KPIs — tracked during a story run. */
export interface StoryKpis {
  /** Current day (1-based, max 30) */
  currentDay: number;
  /** Total unique locations visited */
  locationsVisited: number;
  /** Total locations in the map */
  totalLocations: number;
  /** Number of town rests */
  townsRested: number;
  /** Night ambushes survived without hero deaths */
  ambushesSurvived: number;
  /** Whether the party reached the final destination */
  finalDestinationReached: boolean;
  /** Total exploration bonus points */
  explorationBonus: number;
}
