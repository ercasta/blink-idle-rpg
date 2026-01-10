// Game types for the Blink Idle RPG

export interface Scenario {
  id: string;
  name: string;
  difficulty: 'Easy' | 'Normal' | 'Hard';
  irFile: string;
  bdlFile: string;
  cssClass: string;
  description?: string;
}

export interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  description: string;
  role: string;
  difficulty: string;
  baseHealth: number;
  baseMana: number;
  baseDamage: number;
  baseDefense: number;
  health: {
    current: number;
    max: number;
  };
  mana: {
    current: number;
    max: number;
  };
  stats: {
    strength: number;
    dexterity: number;
    intelligence: number;
    constitution: number;
    wisdom: number;
  };
  combat: {
    damage: number;
    defense: number;
    attackSpeed: number;
    critChance: number;
    critMultiplier: number;
  };
}

export interface GameState {
  wave: number;
  enemiesDefeated: number;
  playerDeaths: number;
  victory: boolean;
  gameOver: boolean;
}

export interface RunState {
  runId: string;
  startTime: number;
  simulationTime: number;
  totalTime: number;
  retreatCount: number;
  retreatPenalty: number;
  deathPenalty: number;
  lastFleeTime: number;
  canFlee: boolean;
}

export interface ChoicePoint {
  id: string;
  name: string;
  signature: string;
  docstring: string;
  category: string;
  applicableClasses: string[] | null;
  sourceFile?: string;
  defaultBehavior: string;
}

export interface BCLFile {
  name: string;
  content: string;
}

export interface LeaderboardRun {
  runId: string;
  timestamp: number;
  completionTime: number;
  simulationTime: number;
  partyComposition: {
    characters: string[];
    characterIds: string[];
    bclFiles: string[];
  };
  statistics: {
    enemiesDefeated: number;
    playerDeaths: number;
    retreats: number;
    retreatPenalty: number;
    deathPenalty: number;
    totalPenalties: number;
  };
  victory: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IRData = any; // IR JSON structure is complex, keeping as any for now
