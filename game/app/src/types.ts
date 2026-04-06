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
}

export type HeroClass = 'Warrior' | 'Mage' | 'Ranger' | 'Paladin' | 'Rogue' | 'Cleric';

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
}

export type GameMode = 'normal' | 'easy' | 'hard';

export interface GameModeDefinition {
  id: GameMode;
  name: string;
  description: string;
  difficulty: string;
}

export interface RunConfig {
  mode: GameMode;
  selectedHeroes: HeroDefinition[];
}

export type AppScreen =
  | 'home'
  | 'mode-select'
  | 'party-select'
  | 'battle'
  | 'results';
