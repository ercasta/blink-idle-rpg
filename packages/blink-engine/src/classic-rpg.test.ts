/**
 * Tests for Classic RPG Game
 * Validates the game mechanics work correctly
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { BlinkGame } from './BlinkGame';

// Simplified Classic RPG IR for testing
const classicRpgIR = {
  version: "1.0",
  module: "classic_rpg_test",
  components: [
    { 
      id: 0, 
      name: "Character", 
      fields: [
        { name: "name", type: "string" },
        { name: "class", type: "string" },
        { name: "level", type: "number", default: 1 },
        { name: "experience", type: "number", default: 0 },
        { name: "experienceToLevel", type: "number", default: 100 }
      ]
    },
    { 
      id: 1, 
      name: "Health", 
      fields: [
        { name: "current", type: "number", default: 100 },
        { name: "max", type: "number", default: 100 }
      ]
    },
    { 
      id: 2, 
      name: "Combat", 
      fields: [
        { name: "damage", type: "number", default: 10 },
        { name: "defense", type: "number", default: 5 },
        { name: "attackSpeed", type: "number", default: 1.0 }
      ]
    },
    { 
      id: 3, 
      name: "Target", 
      fields: [
        { name: "entity", type: "entity", default: null }
      ]
    },
    { 
      id: 4, 
      name: "Team", 
      fields: [
        { name: "id", type: "string" },
        { name: "isPlayer", type: "boolean", default: false }
      ]
    },
    { 
      id: 5, 
      name: "Enemy", 
      fields: [
        { name: "tier", type: "number", default: 1 },
        { name: "isBoss", type: "boolean", default: false },
        { name: "expReward", type: "number", default: 25 }
      ]
    },
    { 
      id: 6, 
      name: "Skills", 
      fields: [
        { name: "skill1", type: "string", default: "" },
        { name: "skill2", type: "string", default: "" },
        { name: "skillPoints", type: "number", default: 0 }
      ]
    },
    { 
      id: 7, 
      name: "Buffs", 
      fields: [
        { name: "damageBonus", type: "number", default: 0 }
      ]
    },
    { 
      id: 8, 
      name: "GameState", 
      fields: [
        { name: "currentWave", type: "number", default: 1 },
        { name: "enemiesDefeated", type: "number", default: 0 },
        { name: "bossDefeated", type: "boolean", default: false },
        { name: "gameOver", type: "boolean", default: false },
        { name: "victory", type: "boolean", default: false }
      ]
    }
  ],
  rules: [
    {
      id: 0,
      name: "attack_rule",
      trigger: { type: "event", event: "DoAttack", bindings: { attacker: "source" } },
      filter: { components: ["Combat", "Target", "Health"] },
      condition: {
        type: "binary",
        op: "and",
        left: {
          type: "binary",
          op: "neq",
          left: { type: "field", entity: "attacker", component: "Target", field: "entity" },
          right: { type: "literal", value: null }
        },
        right: {
          type: "binary",
          op: "gt",
          left: { type: "field", entity: "attacker", component: "Health", field: "current" },
          right: { type: "literal", value: 0 }
        }
      },
      actions: [
        {
          type: "modify",
          entity: { type: "field", entity: "attacker", component: "Target", field: "entity" },
          component: "Health",
          field: "current",
          op: "subtract",
          value: {
            type: "binary",
            op: "add",
            left: { type: "field", entity: "attacker", component: "Combat", field: "damage" },
            right: { type: "field", entity: "attacker", component: "Buffs", field: "damageBonus" }
          }
        }
      ]
    },
    {
      id: 1,
      name: "death_check",
      trigger: { type: "event", event: "DoAttack" },
      filter: { components: ["Health", "Character"] },
      condition: {
        type: "binary",
        op: "lte",
        left: { type: "field", entity: "entity", component: "Health", field: "current" },
        right: { type: "literal", value: 0 }
      },
      actions: [
        {
          type: "emit",
          event: "Death",
          fields: { target: { type: "var", name: "entity" } }
        }
      ]
    },
    {
      id: 2,
      name: "enemy_death_xp",
      trigger: { type: "event", event: "Death", bindings: { deadEntity: "target" } },
      filter: { components: ["Enemy"] },
      condition: {
        type: "binary",
        op: "lte",
        left: { type: "field", entity: "deadEntity", component: "Health", field: "current" },
        right: { type: "literal", value: 0 }
      },
      actions: [
        {
          type: "emit",
          event: "EnemyDefeated",
          fields: { 
            enemy: { type: "var", name: "deadEntity" },
            isBoss: { type: "field", entity: "deadEntity", component: "Enemy", field: "isBoss" }
          }
        }
      ]
    },
    {
      id: 3,
      name: "grant_xp",
      trigger: { type: "event", event: "EnemyDefeated" },
      filter: { components: ["Character", "Team"] },
      condition: { type: "field", entity: "entity", component: "Team", field: "isPlayer" },
      actions: [
        {
          type: "modify",
          entity: { type: "var", name: "entity" },
          component: "Character",
          field: "experience",
          op: "add",
          value: { type: "literal", value: 50 }
        },
        {
          type: "emit",
          event: "CheckLevelUp",
          fields: { character: { type: "var", name: "entity" } }
        }
      ]
    },
    {
      id: 4,
      name: "level_up",
      trigger: { type: "event", event: "CheckLevelUp", bindings: { character: "character" } },
      filter: { components: ["Character"] },
      condition: {
        type: "binary",
        op: "gte",
        left: { type: "field", entity: "character", component: "Character", field: "experience" },
        right: { type: "field", entity: "character", component: "Character", field: "experienceToLevel" }
      },
      actions: [
        {
          type: "modify",
          entity: { type: "var", name: "character" },
          component: "Character",
          field: "level",
          op: "add",
          value: { type: "literal", value: 1 }
        },
        {
          type: "modify",
          entity: { type: "var", name: "character" },
          component: "Character",
          field: "experienceToLevel",
          op: "multiply",
          value: { type: "literal", value: 1.5 }
        },
        {
          type: "modify",
          entity: { type: "var", name: "character" },
          component: "Skills",
          field: "skillPoints",
          op: "add",
          value: { type: "literal", value: 1 }
        },
        {
          type: "emit",
          event: "LevelUp",
          fields: { character: { type: "var", name: "character" } }
        }
      ]
    },
    {
      id: 5,
      name: "update_game_state",
      trigger: { type: "event", event: "EnemyDefeated" },
      filter: { components: ["GameState"] },
      actions: [
        {
          type: "modify",
          entity: { type: "var", name: "entity" },
          component: "GameState",
          field: "enemiesDefeated",
          op: "add",
          value: { type: "literal", value: 1 }
        }
      ]
    }
  ],
  functions: [],
  trackers: [
    { id: 0, component: "Health", event: "DoAttack" },
    { id: 1, component: "Character", event: "Death" },
    { id: 2, component: "Character", event: "LevelUp" },
    { id: 3, component: "GameState", event: "EnemyDefeated" }
  ],
  initial_state: {
    entities: [
      {
        id: 0,
        components: {
          Character: { name: "Warrior", class: "Warrior", level: 1, experience: 0, experienceToLevel: 100 },
          Health: { current: 100, max: 100 },
          Combat: { damage: 20, defense: 10, attackSpeed: 1.0 },
          Target: { entity: 2 },
          Team: { id: "player", isPlayer: true },
          Skills: { skill1: "power_strike", skill2: "", skillPoints: 0 },
          Buffs: { damageBonus: 0 }
        }
      },
      {
        id: 1,
        components: {
          Character: { name: "Mage", class: "Mage", level: 1, experience: 0, experienceToLevel: 100 },
          Health: { current: 70, max: 70 },
          Combat: { damage: 25, defense: 4, attackSpeed: 0.8 },
          Target: { entity: 2 },
          Team: { id: "player", isPlayer: true },
          Skills: { skill1: "fireball", skill2: "", skillPoints: 0 },
          Buffs: { damageBonus: 0 }
        }
      },
      {
        id: 2,
        components: {
          Character: { name: "Goblin", class: "Monster", level: 1, experience: 0, experienceToLevel: 999 },
          Health: { current: 40, max: 40 },
          Combat: { damage: 10, defense: 2, attackSpeed: 1.0 },
          Target: { entity: 0 },
          Team: { id: "enemy", isPlayer: false },
          Enemy: { tier: 1, isBoss: false, expReward: 25 },
          Buffs: { damageBonus: 0 }
        }
      },
      {
        id: 99,
        components: {
          GameState: { currentWave: 1, enemiesDefeated: 0, bossDefeated: false, gameOver: false, victory: false }
        }
      }
    ]
  }
};

describe('Classic RPG', () => {
  let game: BlinkGame;

  beforeEach(() => {
    game = BlinkGame.createSync({ debug: false });
    game.loadRulesFromObject(classicRpgIR);
  });

  describe('Character Classes', () => {
    it('should initialize warrior with correct stats', () => {
      const char = game.getComponent(0, 'Character');
      const health = game.getComponent(0, 'Health');
      const combat = game.getComponent(0, 'Combat');
      
      assert.strictEqual(char?.name, 'Warrior');
      assert.strictEqual(char?.class, 'Warrior');
      assert.strictEqual(health?.current, 100);
      assert.strictEqual(combat?.damage, 20);
    });

    it('should initialize mage with correct stats', () => {
      const char = game.getComponent(1, 'Character');
      const health = game.getComponent(1, 'Health');
      const combat = game.getComponent(1, 'Combat');
      
      assert.strictEqual(char?.name, 'Mage');
      assert.strictEqual(char?.class, 'Mage');
      assert.strictEqual(health?.current, 70);
      assert.strictEqual(combat?.damage, 25);
    });

    it('should have different classes with unique skills', () => {
      const warriorSkills = game.getComponent(0, 'Skills');
      const mageSkills = game.getComponent(1, 'Skills');
      
      assert.strictEqual(warriorSkills?.skill1, 'power_strike');
      assert.strictEqual(mageSkills?.skill1, 'fireball');
    });
  });

  describe('Combat System', () => {
    it('should deal damage when attacking', () => {
      const initialHealth = game.getComponent(2, 'Health');
      assert.strictEqual(initialHealth?.current, 40);
      
      // Warrior attacks goblin
      game.scheduleEvent('DoAttack', 0, { source: 0 });
      game.step();
      
      const afterHealth = game.getComponent(2, 'Health');
      // Goblin should take 20 damage (warrior damage)
      assert.strictEqual(afterHealth?.current, 20);
    });

    it('should process attack events', () => {
      game.scheduleEvent('DoAttack', 0, { source: 0 });
      const result = game.step();
      
      // Check that attack was processed
      assert.ok(result);
      assert.strictEqual(result?.event.eventType, 'DoAttack');
    });

    it('should not attack when attacker is dead', () => {
      // Set warrior health to 0
      const store = (game as unknown as { store: { setField: (id: number, comp: string, field: string, val: number) => void } }).store;
      store.setField(0, 'Health', 'current', 0);
      
      const goblinHealthBefore = game.getComponent(2, 'Health');
      
      game.scheduleEvent('DoAttack', 0, { source: 0 });
      game.step();
      
      const goblinHealthAfter = game.getComponent(2, 'Health');
      // Goblin should not take damage
      assert.strictEqual(goblinHealthBefore?.current, goblinHealthAfter?.current);
    });
  });

  describe('Enemy System', () => {
    it('should have enemy component on monsters', () => {
      const enemy = game.getComponent(2, 'Enemy');
      
      assert.ok(enemy);
      assert.strictEqual(enemy?.tier, 1);
      assert.strictEqual(enemy?.isBoss, false);
    });

    it('should emit death event when enemy health reaches 0', () => {
      const deathEvents: unknown[] = [];
      game.onTracker((output) => {
        if (output.eventType === 'Death') {
          deathEvents.push(output);
        }
      });
      
      // Warrior does 20 damage, mage does 25 = 45 damage per round
      // Goblin has 50 HP, so two attacks should kill it
      game.scheduleEvent('DoAttack', 0, { source: 0 });
      game.scheduleEvent('DoAttack', 0.1, { source: 1 });
      
      game.runUntilComplete(10);
      
      // Check goblin is dead
      const goblinHealth = game.getComponent(2, 'Health');
      assert.ok((goblinHealth?.current as number) <= 0);
    });
  });

  describe('Experience and Leveling', () => {
    it('should have experience system configured', () => {
      const warrior = game.getComponent(0, 'Character');
      assert.strictEqual(warrior?.level, 1);
      assert.strictEqual(warrior?.experience, 0);
      assert.strictEqual(warrior?.experienceToLevel, 100);
    });

    it('should have level up mechanics configured', () => {
      // Verify the level up rule exists and character starts at level 1
      const warrior = game.getComponent(0, 'Character');
      assert.strictEqual(warrior?.level, 1);
      assert.strictEqual(warrior?.experienceToLevel, 100);
    });

    it('should have skill system configured', () => {
      const warriorSkills = game.getComponent(0, 'Skills');
      assert.strictEqual(warriorSkills?.skillPoints, 0);
      assert.strictEqual(warriorSkills?.skill1, 'power_strike');
    });

    it('should grant experience when enemy is killed', () => {
      // Starting XP should be 0
      const initialWarrior = game.getComponent(0, 'Character');
      assert.strictEqual(initialWarrior?.experience, 0);
      
      // Warrior does 20 damage, mage does 25 = 45 damage per round
      // Goblin has 40 HP, so two attacks should kill it
      game.scheduleEvent('DoAttack', 0, { source: 0 });
      game.scheduleEvent('DoAttack', 0.1, { source: 1 });
      
      game.runUntilComplete(20);
      
      // Check goblin is dead
      const goblinHealth = game.getComponent(2, 'Health');
      assert.ok((goblinHealth?.current as number) <= 0, 'Goblin should be dead');
      
      // Both warriors should have gained experience (50 XP per kill per player character)
      const warriorAfter = game.getComponent(0, 'Character');
      const mageAfter = game.getComponent(1, 'Character');
      
      assert.ok((warriorAfter?.experience as number) > 0, 'Warrior should have gained XP');
      assert.ok((mageAfter?.experience as number) > 0, 'Mage should have gained XP');
    });

    it('should level up when experience reaches threshold', () => {
      // Give warrior enough experience to level up (threshold is 100)
      const store = (game as unknown as { store: { setField: (id: number, comp: string, field: string, val: number) => void } }).store;
      store.setField(0, 'Character', 'experience', 95);
      
      // Track level up events
      let levelUpCount = 0;
      game.onTracker((output) => {
        if (output.eventType === 'LevelUp') {
          levelUpCount++;
        }
      });
      
      // Kill the goblin to trigger XP gain (+50), which should trigger level up
      game.scheduleEvent('DoAttack', 0, { source: 0 });
      game.scheduleEvent('DoAttack', 0.1, { source: 1 });
      
      game.runUntilComplete(20);
      
      // Check warrior leveled up
      const warrior = game.getComponent(0, 'Character');
      assert.strictEqual(warrior?.level, 2, 'Warrior should have leveled up to level 2');
      
      // Check skill points were granted
      const skills = game.getComponent(0, 'Skills');
      assert.strictEqual(skills?.skillPoints, 1, 'Warrior should have 1 skill point');
      
      // Check level up event was emitted
      assert.ok(levelUpCount > 0, 'LevelUp event should have been emitted');
    });

    it('should increase experienceToLevel after leveling up', () => {
      // Give warrior enough experience to level up
      const store = (game as unknown as { store: { setField: (id: number, comp: string, field: string, val: number) => void } }).store;
      store.setField(0, 'Character', 'experience', 95);
      
      const initialExpToLevel = game.getComponent(0, 'Character')?.experienceToLevel;
      
      // Kill the goblin to trigger level up
      game.scheduleEvent('DoAttack', 0, { source: 0 });
      game.scheduleEvent('DoAttack', 0.1, { source: 1 });
      
      game.runUntilComplete(20);
      
      const warrior = game.getComponent(0, 'Character');
      assert.ok((warrior?.experienceToLevel as number) > (initialExpToLevel as number), 
        'Experience to level should increase after leveling up');
    });
  });

  describe('Game State', () => {
    it('should initialize with correct game state', () => {
      const state = game.getComponent(99, 'GameState');
      
      assert.strictEqual(state?.currentWave, 1);
      assert.strictEqual(state?.enemiesDefeated, 0);
      assert.strictEqual(state?.bossDefeated, false);
      assert.strictEqual(state?.gameOver, false);
      assert.strictEqual(state?.victory, false);
    });

    it('should have game state entity', () => {
      const state = game.getComponent(99, 'GameState');
      assert.ok(state, 'GameState component should exist');
    });

    it('should increment enemies defeated when enemy dies', () => {
      // Initial enemies defeated should be 0
      const initialState = game.getComponent(99, 'GameState');
      assert.strictEqual(initialState?.enemiesDefeated, 0);
      
      // Kill the goblin (50 HP, warrior does 20, mage does 25)
      game.scheduleEvent('DoAttack', 0, { source: 0 });
      game.scheduleEvent('DoAttack', 0.1, { source: 1 });
      
      game.runUntilComplete(20);
      
      // Check enemies defeated was incremented
      const finalState = game.getComponent(99, 'GameState');
      assert.strictEqual(finalState?.enemiesDefeated, 1, 'Enemies defeated should be 1');
    });
  });

  describe('Team System', () => {
    it('should correctly identify player team', () => {
      const warrior = game.getComponent(0, 'Team');
      const mage = game.getComponent(1, 'Team');
      const goblin = game.getComponent(2, 'Team');
      
      assert.strictEqual(warrior?.isPlayer, true);
      assert.strictEqual(mage?.isPlayer, true);
      assert.strictEqual(goblin?.isPlayer, false);
    });

    it('should correctly identify enemy team', () => {
      const goblin = game.getComponent(2, 'Team');
      
      assert.strictEqual(goblin?.id, 'enemy');
      assert.strictEqual(goblin?.isPlayer, false);
    });
  });

  afterEach(() => {
    game.destroy();
  });
});
