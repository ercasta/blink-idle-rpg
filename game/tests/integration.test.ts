/**
 * End-to-End Integration Tests
 * Tests the complete pipeline from BRL source to engine execution
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { BlinkGame } from '@blink/engine';
import { compileString, CompileResult } from '@blink/compiler-ts';

/**
 * Helper to compile BRL and create a game instance
 */
function compileAndCreateGame(source: string): BlinkGame {
  const result = compileString(source, 'brl');
  if (result.errors.length > 0) {
    console.error('Compilation errors:', result.errors);
    throw new Error(`Compilation failed: ${result.errors.map(e => e.message).join(', ')}`);
  }
  
  const game = BlinkGame.createSync({ debug: false });
  game.loadRulesFromObject(result.ir);
  return game;
}

describe('Level 1: Components and Entities', () => {
  let game: BlinkGame;

  afterEach(() => {
    if (game) game.destroy();
  });

  it('should create entity with simple component', () => {
    game = compileAndCreateGame(`
      component Counter {
        value: integer
      }
      entity {
        Counter { value: 42 }
      }
    `);
    
    const entities = game.query('Counter');
    assert.strictEqual(entities.length, 1);
    
    const counter = game.getComponent(entities[0], 'Counter');
    assert.strictEqual(counter?.value, 42);
  });

  it('should create entity with multiple components', () => {
    game = compileAndCreateGame(`
      component Health {
        current: integer
        max: integer
      }
      component Position {
        x: float
        y: float
      }
      entity {
        Health { current: 100 max: 100 }
        Position { x: 5.5 y: 10.0 }
      }
    `);
    
    const entities = game.query('Health', 'Position');
    assert.strictEqual(entities.length, 1);
    
    const health = game.getComponent(entities[0], 'Health');
    assert.strictEqual(health?.current, 100);
    assert.strictEqual(health?.max, 100);
    
    const pos = game.getComponent(entities[0], 'Position');
    assert.strictEqual(pos?.x, 5.5);
    assert.strictEqual(pos?.y, 10.0);
  });

  it('should create named entities', () => {
    game = compileAndCreateGame(`
      component Marker {
        id: string
      }
      hero = new entity {
        Marker { id: "hero" }
      }
    `);
    
    const entities = game.query('Marker');
    assert.strictEqual(entities.length, 1);
    const marker = game.getComponent(entities[0], 'Marker');
    assert.strictEqual(marker?.id, 'hero');
  });
});

describe('Level 2: Basic Rules', () => {
  let game: BlinkGame;

  afterEach(() => {
    if (game) game.destroy();
  });

  it('should execute rule that modifies field', () => {
    game = compileAndCreateGame(`
      component Counter {
        value: integer
      }
      rule increment on Increment {
        entity.Counter.value += 10
      }
      entity {
        Counter { value: 0 }
      }
    `);
    
    const entities = game.query('Counter');
    assert.strictEqual(entities.length, 1);
    
    // Trigger the event
    game.scheduleEvent('Increment', 0);
    game.step();
    
    const counter = game.getComponent(entities[0], 'Counter');
    assert.strictEqual(counter?.value, 10);
  });

  it('should execute rule with schedule', () => {
    game = compileAndCreateGame(`
      component Counter {
        value: integer
      }
      rule start on Start {
        schedule [delay: 1.0] Increment { }
      }
      rule increment on Increment {
        entity.Counter.value += 1
      }
      entity {
        Counter { value: 0 }
      }
    `);
    
    game.scheduleEvent('Start', 0);
    game.runUntilComplete(10);
    
    const entities = game.query('Counter');
    const counter = game.getComponent(entities[0], 'Counter');
    assert.strictEqual(counter?.value, 1);
  });

  it('should process multiple events in sequence', () => {
    game = compileAndCreateGame(`
      component Counter {
        value: integer
      }
      rule increment on Increment {
        entity.Counter.value += 1
      }
      entity {
        Counter { value: 0 }
      }
    `);
    
    // Schedule multiple events
    game.scheduleEvent('Increment', 0);
    game.scheduleEvent('Increment', 0.1);
    game.scheduleEvent('Increment', 0.2);
    
    game.runUntilComplete(10);
    
    const entities = game.query('Counter');
    const counter = game.getComponent(entities[0], 'Counter');
    assert.strictEqual(counter?.value, 3);
  });
});

describe('Level 3: Control Flow', () => {
  let game: BlinkGame;

  afterEach(() => {
    if (game) game.destroy();
  });

  it('should execute if condition', () => {
    game = compileAndCreateGame(`
      component Health {
        current: integer
        max: integer
      }
      rule heal_low_health on Heal {
        if entity.Health.current < 50 {
          entity.Health.current += 20
        }
      }
      entity {
        Health { current: 30 max: 100 }
      }
      entity {
        Health { current: 80 max: 100 }
      }
    `);
    
    game.scheduleEvent('Heal', 0);
    game.runUntilComplete(10);
    
    const entities = game.query('Health');
    // Sort by current health to make test deterministic
    entities.sort((a, b) => {
      const ha = game.getComponent(a, 'Health')?.current as number;
      const hb = game.getComponent(b, 'Health')?.current as number;
      return ha - hb;
    });
    
    const health1 = game.getComponent(entities[0], 'Health');
    const health2 = game.getComponent(entities[1], 'Health');
    
    // The entity with 30 health should now have 50
    assert.strictEqual(health1?.current, 50);
    // The entity with 80 health should be unchanged
    assert.strictEqual(health2?.current, 80);
  });

  it('should execute for loop', () => {
    game = compileAndCreateGame(`
      component Counter {
        value: integer
      }
      component GameState {
        initialized: boolean
      }
      rule spawn_multiple on SpawnMultiple {
        if entity has GameState {
          let indices = [0, 1, 2]
          for i in indices {
            schedule [delay: 0.1 * i] Increment { }
          }
        }
      }
      rule increment on Increment {
        entity.Counter.value += 1
      }
      entity {
        Counter { value: 0 }
      }
      entity {
        GameState { initialized: false }
      }
    `);
    
    game.scheduleEvent('SpawnMultiple', 0);
    game.runUntilComplete(20);
    
    const entities = game.query('Counter');
    const counter = game.getComponent(entities[0], 'Counter');
    // Should have incremented 3 times
    assert.strictEqual(counter?.value, 3);
  });

  it('should execute nested conditionals', () => {
    game = compileAndCreateGame(`
      component Health {
        current: integer
        max: integer
      }
      rule cap_health on CheckHealth {
        if entity.Health.current > 0 {
          if entity.Health.current > entity.Health.max {
            entity.Health.current = entity.Health.max
          }
        }
      }
      entity {
        Health { current: 150 max: 100 }
      }
    `);
    
    game.scheduleEvent('CheckHealth', 0);
    game.runUntilComplete(10);
    
    const entities = game.query('Health');
    const health = game.getComponent(entities[0], 'Health');
    assert.strictEqual(health?.current, 100);
  });
});

describe('Level 4: Functions', () => {
  let game: BlinkGame;

  afterEach(() => {
    if (game) game.destroy();
  });

  it('should use built-in min function', () => {
    game = compileAndCreateGame(`
      component Health {
        current: integer
        max: integer
      }
      rule heal on Heal {
        let newHealth = entity.Health.current + 50
        let capped = min(newHealth, entity.Health.max)
        entity.Health.current = capped
      }
      entity {
        Health { current: 80 max: 100 }
      }
    `);
    
    game.scheduleEvent('Heal', 0);
    game.runUntilComplete(10);
    
    const entities = game.query('Health');
    const health = game.getComponent(entities[0], 'Health');
    assert.strictEqual(health?.current, 100);
  });

  it('should use built-in max function', () => {
    game = compileAndCreateGame(`
      component Health {
        current: integer
      }
      rule damage on Damage {
        let newHealth = entity.Health.current - 50
        entity.Health.current = max(newHealth, 0)
      }
      entity {
        Health { current: 30 }
      }
    `);
    
    game.scheduleEvent('Damage', 0);
    game.runUntilComplete(10);
    
    const entities = game.query('Health');
    const health = game.getComponent(entities[0], 'Health');
    assert.strictEqual(health?.current, 0);
  });

  it('should use len function', () => {
    game = compileAndCreateGame(`
      component Counter {
        value: integer
      }
      component GameState {
        entityCount: integer
      }
      rule count on Count {
        if entity has GameState {
          let counters = entities having Counter
          entity.GameState.entityCount = len(counters)
        }
      }
      entity {
        Counter { value: 1 }
      }
      entity {
        Counter { value: 2 }
      }
      entity {
        Counter { value: 3 }
      }
      entity {
        GameState { entityCount: 0 }
      }
    `);
    
    game.scheduleEvent('Count', 0);
    game.runUntilComplete(10);
    
    const entities = game.query('GameState');
    const state = game.getComponent(entities[0], 'GameState');
    assert.strictEqual(state?.entityCount, 3);
  });

  it('should use user-defined function', () => {
    game = compileAndCreateGame(`
      component Value {
        result: integer
      }
      fn double(x: number): number {
        return x * 2
      }
      rule calculate on Calculate {
        let input = 21
        let output = double(input)
        entity.Value.result = output
      }
      entity {
        Value { result: 0 }
      }
    `);
    
    game.scheduleEvent('Calculate', 0);
    game.runUntilComplete(10);
    
    const entities = game.query('Value');
    const value = game.getComponent(entities[0], 'Value');
    assert.strictEqual(value?.result, 42);
  });
});

describe('Level 5: Complex Game Logic', () => {
  let game: BlinkGame;

  afterEach(() => {
    if (game) game.destroy();
  });

  it('should handle entity cloning', () => {
    game = compileAndCreateGame(`
      component Health {
        current: integer
        max: integer
      }
      component Template {
        isTemplate: boolean
      }
      component GameState {
        active: boolean
      }
      rule spawn on Spawn {
        if entity has GameState {
          let templates = entities having Template
          if len(templates) > 0 {
            let template = templates[0]
            let newEntity = clone template {
              Template { isTemplate: false }
              Health { current: 50 }
            }
          }
        }
      }
      entity {
        Health { current: 100 max: 100 }
        Template { isTemplate: true }
      }
      entity {
        GameState { active: true }
      }
    `);
    
    game.scheduleEvent('Spawn', 0);
    game.runUntilComplete(10);
    
    // Should now have 2 entities with Health
    const healthEntities = game.query('Health');
    assert.strictEqual(healthEntities.length, 2);
    
    // Find the cloned entity (isTemplate: false)
    const templates = game.query('Template');
    const nonTemplates = templates.filter(id => {
      const t = game.getComponent(id, 'Template');
      return t?.isTemplate === false;
    });
    
    assert.strictEqual(nonTemplates.length, 1);
    
    // Check the cloned entity has correct health
    const clonedHealth = game.getComponent(nonTemplates[0], 'Health');
    assert.strictEqual(clonedHealth?.current, 50);
  });

  it('should handle entities having query', () => {
    game = compileAndCreateGame(`
      component Enemy {
        name: string
      }
      component Health {
        current: integer
      }
      component GameState {
        enemyCount: integer
      }
      rule count_enemies on CountEnemies {
        if entity has GameState {
          let enemies = entities having Enemy
          entity.GameState.enemyCount = len(enemies)
        }
      }
      entity {
        Enemy { name: "Goblin" }
        Health { current: 30 }
      }
      entity {
        Enemy { name: "Orc" }
        Health { current: 50 }
      }
      entity {
        Enemy { name: "Dragon" }
        Health { current: 200 }
      }
      entity {
        GameState { enemyCount: 0 }
      }
    `);
    
    game.scheduleEvent('CountEnemies', 0);
    game.runUntilComplete(10);
    
    const states = game.query('GameState');
    const state = game.getComponent(states[0], 'GameState');
    assert.strictEqual(state?.enemyCount, 3);
  });

  it('should handle has component check', () => {
    game = compileAndCreateGame(`
      component Health {
        current: integer
      }
      component Armor {
        value: integer
      }
      component Result {
        hasArmor: boolean
      }
      rule check on Check {
        if entity has Result {
          if entity has Armor {
            entity.Result.hasArmor = true
          } else {
            entity.Result.hasArmor = false
          }
        }
      }
      entity {
        Health { current: 100 }
        Armor { value: 10 }
        Result { hasArmor: false }
      }
      entity {
        Health { current: 50 }
        Result { hasArmor: false }
      }
    `);
    
    game.scheduleEvent('Check', 0);
    game.runUntilComplete(10);
    
    const results = game.query('Result');
    
    // Find entity with Armor
    const withArmor = results.find(id => game.getComponent(id, 'Armor') !== undefined);
    const withoutArmor = results.find(id => game.getComponent(id, 'Armor') === undefined);
    
    assert.ok(withArmor !== undefined);
    assert.ok(withoutArmor !== undefined);
    
    const resultWithArmor = game.getComponent(withArmor!, 'Result');
    const resultWithoutArmor = game.getComponent(withoutArmor!, 'Result');
    
    assert.strictEqual(resultWithArmor?.hasArmor, true);
    assert.strictEqual(resultWithoutArmor?.hasArmor, false);
  });

  it('should handle combat damage calculation', () => {
    game = compileAndCreateGame(`
      component Health {
        current: integer
        max: integer
      }
      component Combat {
        damage: integer
        defense: integer
      }
      component Target {
        entity: id?
      }
      rule attack on DoAttack {
        if entity.Target.entity != null {
          let target = entity.Target.entity
          let damage = entity.Combat.damage
          let defense = target.Combat.defense
          let finalDamage = damage - defense / 2
          if finalDamage < 1 {
            finalDamage = 1
          }
          target.Health.current -= finalDamage
        }
      }
      attacker = new entity {
        Health { current: 100 max: 100 }
        Combat { damage: 20 defense: 10 }
        Target { entity: null }
      }
      defender = new entity {
        Health { current: 100 max: 100 }
        Combat { damage: 10 defense: 8 }
        Target { entity: null }
      }
    `);
    
    // Get entity IDs
    const entities = game.query('Combat');
    const attacker = entities.find(id => {
      const combat = game.getComponent(id, 'Combat');
      return combat?.damage === 20;
    })!;
    const defender = entities.find(id => {
      const combat = game.getComponent(id, 'Combat');
      return combat?.damage === 10;
    })!;
    
    // Set attacker's target to defender
    game.setComponentField(attacker, 'Target', 'entity', defender);
    
    // Trigger attack
    game.scheduleEvent('DoAttack', 0, { source: attacker });
    game.runUntilComplete(10);
    
    // Defender should have taken damage: 20 - 8/2 = 16
    const defenderHealth = game.getComponent(defender, 'Health');
    assert.strictEqual(defenderHealth?.current, 84);
  });
});

describe('Integration Tests - Event Chain', () => {
  let game: BlinkGame;

  afterEach(() => {
    if (game) game.destroy();
  });

  it('should handle event chains correctly', () => {
    game = compileAndCreateGame(`
      component Counter {
        a: integer
        b: integer
        c: integer
      }
      rule step_a on StepA {
        entity.Counter.a += 1
        schedule StepB { }
      }
      rule step_b on StepB {
        entity.Counter.b += 10
        schedule StepC { }
      }
      rule step_c on StepC {
        entity.Counter.c += 100
      }
      entity {
        Counter { a: 0 b: 0 c: 0 }
      }
    `);
    
    game.scheduleEvent('StepA', 0);
    game.runUntilComplete(20);
    
    const entities = game.query('Counter');
    const counter = game.getComponent(entities[0], 'Counter');
    
    assert.strictEqual(counter?.a, 1);
    assert.strictEqual(counter?.b, 10);
    assert.strictEqual(counter?.c, 100);
  });

  it('should handle delayed event chains', () => {
    game = compileAndCreateGame(`
      component Counter {
        value: integer
      }
      rule start on Start {
        schedule [delay: 1.0] Tick { }
      }
      rule tick on Tick {
        entity.Counter.value += 1
        if entity.Counter.value < 3 {
          schedule [delay: 1.0] Tick { }
        }
      }
      entity {
        Counter { value: 0 }
      }
    `);
    
    game.scheduleEvent('Start', 0);
    game.runUntilComplete(50);
    
    const entities = game.query('Counter');
    const counter = game.getComponent(entities[0], 'Counter');
    
    // Should have ticked 3 times then stopped
    assert.strictEqual(counter?.value, 3);
  });
});
