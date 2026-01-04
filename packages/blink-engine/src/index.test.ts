/**
 * Basic tests for the Blink Engine
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { BlinkGame } from './BlinkGame';
import { Store } from './ecs/Store';
import { Timeline } from './timeline/Timeline';

// Simple Combat IR for testing
const simpleCombatIR = {
  version: "1.0",
  module: "test_combat",
  components: [
    {
      id: 0,
      name: "Health",
      fields: [
        { name: "current", type: "number", default: 100 },
        { name: "max", type: "number", default: 100 }
      ]
    },
    {
      id: 1,
      name: "Attack",
      fields: [
        { name: "damage", type: "number", default: 10 }
      ]
    }
  ],
  rules: [
    {
      id: 0,
      name: "attack_rule",
      trigger: {
        type: "event",
        event: "DoAttack",
        bindings: { attacker: "source" }
      },
      filter: { components: ["Attack"] },
      actions: [
        {
          type: "modify",
          entity: { type: "literal", value: 1 },
          component: "Health",
          field: "current",
          op: "subtract",
          value: { type: "field", entity: "attacker", component: "Attack", field: "damage" }
        }
      ]
    }
  ],
  functions: [],
  // trackers removed from IR sample
  initial_state: {
    entities: [
      {
        id: 0,
        components: {
          Health: { current: 100, max: 100 },
          Attack: { damage: 15 }
        }
      },
      {
        id: 1,
        components: {
          Health: { current: 50, max: 50 }
        }
      }
    ]
  }
};

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('should create entities with auto-incrementing IDs', () => {
    const id1 = store.createEntity();
    const id2 = store.createEntity();
    assert.strictEqual(id1, 0);
    assert.strictEqual(id2, 1);
  });

  it('should create entity with specific ID', () => {
    const id = store.createEntity(10);
    assert.strictEqual(id, 10);
    assert.ok(store.hasEntity(10));
  });

  it('should add and get components', () => {
    const id = store.createEntity();
    store.addComponent(id, 'Health', { current: 100, max: 100 });
    
    const health = store.getComponent(id, 'Health');
    assert.deepStrictEqual(health, { current: 100, max: 100 });
  });

  it('should set and get fields', () => {
    const id = store.createEntity();
    store.addComponent(id, 'Health', { current: 100, max: 100 });
    
    store.setField(id, 'Health', 'current', 50);
    assert.strictEqual(store.getField(id, 'Health', 'current'), 50);
  });

  it('should query entities by components', () => {
    const id1 = store.createEntity();
    const id2 = store.createEntity();
    const id3 = store.createEntity();
    
    store.addComponent(id1, 'Health', { current: 100 });
    store.addComponent(id1, 'Attack', { damage: 10 });
    store.addComponent(id2, 'Health', { current: 50 });
    store.addComponent(id3, 'Attack', { damage: 5 });
    
    const withHealth = store.query('Health');
    assert.deepStrictEqual(withHealth.sort(), [0, 1]);
    
    const withBoth = store.query('Health', 'Attack');
    assert.deepStrictEqual(withBoth, [0]);
  });

  it('should delete entities', () => {
    const id = store.createEntity();
    store.addComponent(id, 'Health', { current: 100 });
    
    assert.ok(store.hasEntity(id));
    store.deleteEntity(id);
    assert.ok(!store.hasEntity(id));
  });
});

describe('Timeline', () => {
  let timeline: Timeline;

  beforeEach(() => {
    timeline = new Timeline();
  });

  it('should schedule events in order', () => {
    timeline.schedule('EventA', 2);
    timeline.schedule('EventB', 1);
    timeline.schedule('EventC', 3);
    
    const events = timeline.getAllEvents();
    assert.strictEqual(events[0].eventType, 'EventB');
    assert.strictEqual(events[1].eventType, 'EventA');
    assert.strictEqual(events[2].eventType, 'EventC');
  });

  it('should pop events in order', () => {
    timeline.schedule('EventA', 2);
    timeline.schedule('EventB', 1);
    timeline.schedule('EventC', 3);
    
    const first = timeline.pop();
    assert.strictEqual(first?.eventType, 'EventB');
    assert.strictEqual(timeline.getTime(), 1);
    
    const second = timeline.pop();
    assert.strictEqual(second?.eventType, 'EventA');
    assert.strictEqual(timeline.getTime(), 2);
  });

  it('should schedule immediate events', () => {
    timeline.setTime(5);
    timeline.scheduleImmediate('Immediate');
    
    const event = timeline.peek();
    assert.strictEqual(event?.time, 5);
  });

  it('should cancel events', () => {
    const id = timeline.schedule('ToCancel', 10);
    assert.ok(timeline.hasEvents());
    
    timeline.cancel(id);
    assert.ok(!timeline.hasEvents());
  });
});

describe('BlinkGame', () => {
  it('should create game instance', () => {
    const game = BlinkGame.createSync();
    assert.ok(game);
    game.destroy();
  });

  it('should load IR and initialize state', () => {
    const game = BlinkGame.createSync();
    game.loadRulesFromObject(simpleCombatIR);
    
    const health0 = game.getComponent(0, 'Health');
    const health1 = game.getComponent(1, 'Health');
    
    assert.strictEqual(health0?.current, 100);
    assert.strictEqual(health1?.current, 50);
    
    game.destroy();
  });

  it('should execute rules when stepping', () => {
    const game = BlinkGame.createSync();
    game.loadRulesFromObject(simpleCombatIR);
    
    // Schedule an attack
    game.scheduleEvent('DoAttack', 0, { source: 0 });
    
    // Step once
    const result = game.step();
    
    assert.ok(result);
    assert.strictEqual(result!.event.eventType, 'DoAttack');
    
    // Check damage was applied
    const health1 = game.getComponent(1, 'Health');
    assert.strictEqual(health1?.current, 35); // 50 - 15 = 35
    
    game.destroy();
  });

  // Tracker runtime removed; tracker event tests omitted

  it('should run until complete', () => {
    const game = BlinkGame.createSync();
    game.loadRulesFromObject(simpleCombatIR);
    
    // Schedule just one event
    game.scheduleEvent('DoAttack', 0, { source: 0 });
    
    const results = game.runUntilComplete(10);
    
    assert.strictEqual(results.length, 1);
    assert.ok(!game.hasEvents());
    
    game.destroy();
  });

  it('should query entities', () => {
    const game = BlinkGame.createSync();
    game.loadRulesFromObject(simpleCombatIR);
    
    const withHealth = game.query('Health');
    assert.deepStrictEqual(withHealth.sort(), [0, 1]);
    
    const withAttack = game.query('Attack');
    assert.deepStrictEqual(withAttack, [0]);
    
    game.destroy();
  });

  it('should reset to initial state', () => {
    const game = BlinkGame.createSync();
    game.loadRulesFromObject(simpleCombatIR);
    
    // Make some changes
    game.scheduleEvent('DoAttack', 0, { source: 0 });
    game.step();
    
    const healthBefore = game.getComponent(1, 'Health');
    assert.strictEqual(healthBefore?.current, 35);
    
    // Reset
    game.reset();
    
    const healthAfter = game.getComponent(1, 'Health');
    assert.strictEqual(healthAfter?.current, 50);
    
    game.destroy();
  });
});
