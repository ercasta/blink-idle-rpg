/**
 * Test fixtures and utilities for common testing scenarios
 * 
 * Provides pre-built entity configurations and scenario templates
 * for common game testing patterns.
 */

import { EntityId, ComponentData } from '@blink/engine';
import { GameTest } from './GameTest.js';

export interface EntityFixture {
  id?: EntityId;
  components: Record<string, ComponentData>;
}

export interface CombatScenarioOptions {
  /** Player party configuration */
  party?: EntityFixture[];
  /** Enemy configuration */
  enemies?: EntityFixture[];
  /** Auto-schedule initial attack events */
  autoStart?: boolean;
  /** Time between attacks */
  attackInterval?: number;
}

export interface ProgressionScenarioOptions {
  /** Starting level */
  startLevel?: number;
  /** Starting experience */
  startExperience?: number;
  /** Experience required per level */
  experiencePerLevel?: number;
  /** Skills to start with */
  startingSkills?: string[];
}

/**
 * Create a test entity fixture
 */
export function createTestEntity(config: {
  id?: EntityId;
  name?: string;
  class?: string;
  health?: { current?: number; max?: number };
  attack?: { damage?: number; speed?: number };
  team?: { id?: string; isPlayer?: boolean };
  custom?: Record<string, ComponentData>;
}): EntityFixture {
  const components: Record<string, ComponentData> = {};
  
  // Character component
  if (config.name || config.class) {
    components['Character'] = {
      name: config.name ?? 'Unknown',
      class: config.class ?? 'Unknown',
      level: 1,
      experience: 0,
      experienceToLevel: 100,
    };
  }
  
  // Health component
  if (config.health) {
    components['Health'] = {
      current: config.health.current ?? 100,
      max: config.health.max ?? 100,
    };
  }
  
  // Combat/Attack component
  if (config.attack) {
    components['Combat'] = {
      damage: config.attack.damage ?? 10,
      defense: 0,
      attackSpeed: config.attack.speed ?? 1.0,
    };
    components['Attack'] = {
      damage: config.attack.damage ?? 10,
      speed: config.attack.speed ?? 1.0,
    };
  }
  
  // Team component
  if (config.team) {
    components['Team'] = {
      id: config.team.id ?? 'neutral',
      isPlayer: config.team.isPlayer ?? false,
    };
  }
  
  // Custom components
  if (config.custom) {
    for (const [name, data] of Object.entries(config.custom)) {
      components[name] = data;
    }
  }
  
  return {
    id: config.id,
    components,
  };
}

/**
 * Create multiple test entities at once
 */
export function createTestEntities(configs: Parameters<typeof createTestEntity>[0][]): EntityFixture[] {
  return configs.map(createTestEntity);
}

/**
 * Standard warrior fixture
 */
export function createWarriorFixture(options: {
  id?: EntityId;
  name?: string;
  level?: number;
  health?: number;
  damage?: number;
} = {}): EntityFixture {
  return {
    id: options.id,
    components: {
      Character: {
        name: options.name ?? 'Warrior',
        class: 'Warrior',
        level: options.level ?? 1,
        experience: 0,
        experienceToLevel: 100,
      },
      Health: {
        current: options.health ?? 100,
        max: options.health ?? 100,
      },
      Combat: {
        damage: options.damage ?? 20,
        defense: 10,
        attackSpeed: 1.0,
      },
      Attack: {
        damage: options.damage ?? 20,
        speed: 1.0,
      },
      Team: {
        id: 'player',
        isPlayer: true,
      },
      Skills: {
        skill1: 'power_strike',
        skill2: '',
        skillPoints: 0,
      },
      Buffs: {
        damageBonus: 0,
      },
    },
  };
}

/**
 * Standard mage fixture
 */
export function createMageFixture(options: {
  id?: EntityId;
  name?: string;
  level?: number;
  health?: number;
  damage?: number;
} = {}): EntityFixture {
  return {
    id: options.id,
    components: {
      Character: {
        name: options.name ?? 'Mage',
        class: 'Mage',
        level: options.level ?? 1,
        experience: 0,
        experienceToLevel: 100,
      },
      Health: {
        current: options.health ?? 70,
        max: options.health ?? 70,
      },
      Combat: {
        damage: options.damage ?? 25,
        defense: 4,
        attackSpeed: 0.8,
      },
      Attack: {
        damage: options.damage ?? 25,
        speed: 0.8,
      },
      Team: {
        id: 'player',
        isPlayer: true,
      },
      Skills: {
        skill1: 'fireball',
        skill2: '',
        skillPoints: 0,
      },
      Buffs: {
        damageBonus: 0,
      },
    },
  };
}

/**
 * Standard enemy fixture
 */
export function createEnemyFixture(options: {
  id?: EntityId;
  name?: string;
  tier?: number;
  isBoss?: boolean;
  health?: number;
  damage?: number;
} = {}): EntityFixture {
  const tier = options.tier ?? 1;
  const isBoss = options.isBoss ?? false;
  
  return {
    id: options.id,
    components: {
      Character: {
        name: options.name ?? (isBoss ? 'Boss' : 'Goblin'),
        class: 'Monster',
        level: tier,
        experience: 0,
        experienceToLevel: 999,
      },
      Health: {
        current: options.health ?? (isBoss ? 200 : 40 * tier),
        max: options.health ?? (isBoss ? 200 : 40 * tier),
      },
      Combat: {
        damage: options.damage ?? (isBoss ? 30 : 10 * tier),
        defense: 2 * tier,
        attackSpeed: 1.0,
      },
      Attack: {
        damage: options.damage ?? (isBoss ? 30 : 10 * tier),
        speed: 1.0,
      },
      Team: {
        id: 'enemy',
        isPlayer: false,
      },
      Enemy: {
        tier,
        isBoss,
        expReward: isBoss ? 100 : 25 * tier,
      },
      Buffs: {
        damageBonus: 0,
      },
    },
  };
}

/**
 * Create a combat scenario with player party vs enemies
 */
export function createCombatScenario(
  test: GameTest,
  options: CombatScenarioOptions = {}
): {
  partyIds: EntityId[];
  enemyIds: EntityId[];
  startCombat: () => void;
} {
  const partyFixtures = options.party ?? [
    createWarriorFixture({ id: 0 }),
    createMageFixture({ id: 1 }),
  ];
  
  const enemyFixtures = options.enemies ?? [
    createEnemyFixture({ id: 10 }),
  ];
  
  const partyIds: EntityId[] = [];
  const enemyIds: EntityId[] = [];
  
  // Create party entities
  for (const fixture of partyFixtures) {
    const id = fixture.id !== undefined 
      ? test.createEntity(fixture.id) 
      : test.createEntity();
    for (const [compName, compData] of Object.entries(fixture.components)) {
      test.addComponent(id, compName, compData);
    }
    partyIds.push(id);
  }
  
  // Create enemy entities
  for (const fixture of enemyFixtures) {
    const id = fixture.id !== undefined 
      ? test.createEntity(fixture.id) 
      : test.createEntity();
    for (const [compName, compData] of Object.entries(fixture.components)) {
      test.addComponent(id, compName, compData);
    }
    enemyIds.push(id);
  }
  
  // Set targets (party targets first enemy, enemies target first party member)
  for (const partyId of partyIds) {
    test.addComponent(partyId, 'Target', { entity: enemyIds[0] });
  }
  for (const enemyId of enemyIds) {
    test.addComponent(enemyId, 'Target', { entity: partyIds[0] });
  }
  
  const startCombat = () => {
    const interval = options.attackInterval ?? 0;
    let delay = 0;
    
    // Schedule attacks for all combatants
    for (const partyId of partyIds) {
      test.scheduleEvent('DoAttack', delay, { source: partyId });
      delay += interval;
    }
    for (const enemyId of enemyIds) {
      test.scheduleEvent('DoAttack', delay, { source: enemyId });
      delay += interval;
    }
  };
  
  if (options.autoStart) {
    startCombat();
  }
  
  return { partyIds, enemyIds, startCombat };
}

/**
 * Create a progression scenario for testing leveling mechanics
 */
export function createProgressionScenario(
  test: GameTest,
  options: ProgressionScenarioOptions = {}
): {
  characterId: EntityId;
  grantExperience: (amount: number) => void;
  triggerLevelUp: () => void;
} {
  const startLevel = options.startLevel ?? 1;
  const startExperience = options.startExperience ?? 0;
  const experiencePerLevel = options.experiencePerLevel ?? 100;
  
  const characterId = test.createEntity(0);
  
  test.addComponent(characterId, 'Character', {
    name: 'TestCharacter',
    class: 'Warrior',
    level: startLevel,
    experience: startExperience,
    experienceToLevel: experiencePerLevel,
  });
  
  test.addComponent(characterId, 'Health', {
    current: 100,
    max: 100,
  });
  
  test.addComponent(characterId, 'Skills', {
    skill1: options.startingSkills?.[0] ?? '',
    skill2: options.startingSkills?.[1] ?? '',
    skillPoints: 0,
  });
  
  test.addComponent(characterId, 'Team', {
    id: 'player',
    isPlayer: true,
  });
  
  const grantExperience = (amount: number) => {
    test.scheduleEvent('GainExperience', 0, {
      target: characterId,
      fields: { amount },
    });
  };
  
  const triggerLevelUp = () => {
    test.scheduleEvent('CheckLevelUp', 0, {
      fields: { character: characterId },
    });
  };
  
  return { characterId, grantExperience, triggerLevelUp };
}

/**
 * Create game state entity for tracking game progress
 */
export function createGameStateFixture(options: {
  id?: EntityId;
  currentWave?: number;
  enemiesDefeated?: number;
  bossDefeated?: boolean;
  gameOver?: boolean;
  victory?: boolean;
} = {}): EntityFixture {
  return {
    id: options.id ?? 99,
    components: {
      GameState: {
        currentWave: options.currentWave ?? 1,
        enemiesDefeated: options.enemiesDefeated ?? 0,
        bossDefeated: options.bossDefeated ?? false,
        gameOver: options.gameOver ?? false,
        victory: options.victory ?? false,
      },
    },
  };
}
