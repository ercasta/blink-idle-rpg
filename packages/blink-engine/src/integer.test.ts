import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BlinkGame } from './BlinkGame';

describe('Integer field semantics', () => {
  it('should truncate defaults and arithmetic to integers', () => {
    const game = BlinkGame.createSync();

    const ir = {
      version: '1.0',
      module: 'test_integer',
      components: [
        {
          id: 0,
          name: 'Counter',
          fields: [ { name: 'value', type: { type: 'integer' }, default: 0 } ]
        }
      ],
      rules: [
        {
          id: 0,
          name: 'inc_rule',
          trigger: { type: 'event', event: 'Inc' },
          filter: { components: ['Counter'] },
          actions: [
            {
              type: 'modify',
              entity: { type: 'literal', value: 0 },
              component: 'Counter',
              field: 'value',
              op: 'add',
              value: { type: 'literal', value: 1.5 }
            }
          ]
        }
      ],
      functions: [],
      initial_state: {
        entities: [ { id: 0, components: { Counter: { value: 3.14 } } } ]
      }
    };

    game.loadRulesFromObject(ir);

    const compBefore = game.getComponent(0, 'Counter');
    if (!compBefore) throw new Error('Counter component missing on entity 0');
    const before = compBefore.value;
    assert.strictEqual(Number.isInteger(before), true, 'before should be integer');
    assert.strictEqual(before, 3);

    game.scheduleEvent('Inc');
    game.step();

    const compAfter = game.getComponent(0, 'Counter');
    if (!compAfter) throw new Error('Counter component missing on entity 0 after step');
    const after = compAfter.value;
    assert.strictEqual(Number.isInteger(after), true, 'after should be integer');
    assert.strictEqual(after, 4);

    game.destroy();
  });
});
