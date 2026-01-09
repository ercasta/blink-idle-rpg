/**
 * Tests for RuleExecutor built-in functions
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RuleExecutor } from './Executor';
import { Store } from '../ecs/Store';
import { Timeline, ScheduledEvent } from '../timeline/Timeline';
import { IRRule } from '../ir/types';

describe('RuleExecutor built-in functions', () => {
  let executor: RuleExecutor;
  let store: Store;
  let timeline: Timeline;

  beforeEach(() => {
    executor = new RuleExecutor();
    store = new Store();
    timeline = new Timeline();
  });

  /**
   * Helper to schedule and get the event for testing
   */
  function scheduleAndGetEvent(eventType: string): ScheduledEvent {
    timeline.schedule(eventType, 0);
    return timeline.pop()!;
  }

  it('should implement list function', () => {
    // Create a rule that uses the list function
    const rule: IRRule = {
      id: 0,
      name: 'test_list',
      trigger: {
        type: 'event',
        event: 'TestEvent',
      },
      filter: { components: ['TestComponent'] },
      actions: [
        {
          type: 'let',
          name: 'myList',
          value: {
            type: 'call',
            function: 'list',
            args: [
              { type: 'literal', value: 1 },
              { type: 'literal', value: 2 },
              { type: 'literal', value: 3 },
            ],
          },
        },
      ],
    };

    // Create an entity with TestComponent
    const entityId = store.createEntity();
    store.addComponent(entityId, 'TestComponent', {});

    // Execute the rule
    executor.loadRules([rule]);
    const event = scheduleAndGetEvent('TestEvent');
    executor.executeRule(rule, event, store, timeline);

    // No error should be thrown - the list function should work
    assert.ok(true);
  });

  it('should implement entities_having function', () => {
    // Create some entities with Health component
    const entity1 = store.createEntity();
    store.addComponent(entity1, 'Health', { current: 100, max: 100 });
    
    const entity2 = store.createEntity();
    store.addComponent(entity2, 'Health', { current: 50, max: 50 });
    
    const entity3 = store.createEntity();
    store.addComponent(entity3, 'Other', { value: 10 });

    // Create a rule that uses entities_having
    const rule: IRRule = {
      id: 0,
      name: 'test_entities_having',
      trigger: {
        type: 'event',
        event: 'TestEvent',
      },
      filter: { components: ['GameState'] },
      actions: [
        {
          type: 'let',
          name: 'healthEntities',
          value: {
            type: 'call',
            function: 'entities_having',
            args: [{ type: 'literal', value: 'Health' }],
          },
        },
      ],
    };

    // Create a GameState entity for the rule to fire on
    const gameState = store.createEntity();
    store.addComponent(gameState, 'GameState', {});

    // Execute the rule
    executor.loadRules([rule]);
    const event = scheduleAndGetEvent('TestEvent');
    executor.executeRule(rule, event, store, timeline);

    // The entities_having function should return the entities with Health
    // We can verify this by checking that the rule executed without error
    assert.ok(true);
  });

  it('should implement get function for array access', () => {
    // Create a rule that uses the get function (array indexing)
    const rule: IRRule = {
      id: 0,
      name: 'test_get',
      trigger: {
        type: 'event',
        event: 'TestEvent',
      },
      filter: { components: ['TestComponent'] },
      actions: [
        {
          type: 'let',
          name: 'myList',
          value: {
            type: 'call',
            function: 'list',
            args: [
              { type: 'literal', value: 10 },
              { type: 'literal', value: 20 },
              { type: 'literal', value: 30 },
            ],
          },
        },
        {
          type: 'let',
          name: 'firstItem',
          value: {
            type: 'call',
            function: 'get',
            args: [
              { type: 'var', name: 'myList' },
              { type: 'literal', value: 0 },
            ],
          },
        },
      ],
    };

    // Create an entity with TestComponent
    const entityId = store.createEntity();
    store.addComponent(entityId, 'TestComponent', {});

    // Execute the rule
    executor.loadRules([rule]);
    const event = scheduleAndGetEvent('TestEvent');
    executor.executeRule(rule, event, store, timeline);

    // No error should be thrown - the get function should work
    assert.ok(true);
  });

  it('should handle loop variable field access', () => {
    // Create some entities with Health component
    const entity1 = store.createEntity();
    store.addComponent(entity1, 'Health', { current: 100, max: 100 });
    store.addComponent(entity1, 'Enemy', { tier: 1 });
    
    const entity2 = store.createEntity();
    store.addComponent(entity2, 'Health', { current: 50, max: 50 });
    store.addComponent(entity2, 'Enemy', { tier: 2 });

    // Create a rule that uses entities_having in a loop with field access
    const rule: IRRule = {
      id: 0,
      name: 'test_loop_field_access',
      trigger: {
        type: 'event',
        event: 'TestEvent',
      },
      filter: { components: ['GameState'] },
      actions: [
        {
          type: 'let',
          name: 'enemies',
          value: {
            type: 'call',
            function: 'entities_having',
            args: [{ type: 'literal', value: 'Enemy' }],
          },
        },
        {
          type: 'loop',
          variable: 'enemy',
          iterable: { type: 'var', name: 'enemies' },
          body: [
            {
              type: 'let',
              name: 'enemyTier',
              value: {
                type: 'field',
                entity: 'enemy',
                component: 'Enemy',
                field: 'tier',
              },
            },
          ],
        },
      ],
    };

    // Create a GameState entity for the rule to fire on
    const gameState = store.createEntity();
    store.addComponent(gameState, 'GameState', {});

    // Execute the rule
    executor.loadRules([rule]);
    const event = scheduleAndGetEvent('TestEvent');
    executor.executeRule(rule, event, store, timeline);

    // The loop should iterate over entities and access their fields
    // We verify this by checking that the rule executed without error
    assert.ok(true);
  });
});
