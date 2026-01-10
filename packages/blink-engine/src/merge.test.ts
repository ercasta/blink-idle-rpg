import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { BlinkGame } from './BlinkGame';

const baseIR = {
  version: '1.0',
  module: 'base',
  components: [
    {
      id: 0,
      name: 'Health',
      fields: [
        { name: 'current', type: 'integer', default: 100 },
        { name: 'max', type: 'integer', default: 100 },
      ],
    },
  ],
  rules: [
    {
      id: 0,
      name: 'noop',
      trigger: { type: 'event', event: 'Noop' },
      filter: {},
      actions: [],
    },
  ],
  functions: [],
  initial_state: {
    entities: [],
  },
};

describe('IR Merge (BlinkGame)', () => {
  let game: ReturnType<typeof BlinkGame.createSync>;

  beforeEach(() => {
    game = BlinkGame.createSync();
  });

  it('merges component defaults and field types', () => {
    game.loadRulesFromObject(baseIR);

    // Start and pause to satisfy merge precondition
    game.start();
    game.pause();

    const snippet = {
      version: '1.0',
      module: 'snippet_add_field',
      components: [
        {
          id: 1,
          name: 'Health',
          fields: [
            { name: 'regen', type: 'integer', default: 1 },
          ],
        },
      ],
      rules: [],
      functions: [],
    };

    game.mergeRulesFromObject(snippet, { mergeEntities: false, overrideOnConflict: true });

    // Create entity and add Health component with no explicit fields
    const eid = game.createEntity();
    game.addComponent(eid, 'Health', {});

    const h = game.getComponent(eid, 'Health');
    assert.ok(h);
    // Defaults must include newly merged field
    assert.strictEqual((h as any).regen, 1);
  });

  it('appends rules and functions on merge', () => {
    game.loadRulesFromObject(baseIR);
    game.start();
    game.pause();

    const snippet = {
      version: '1.0',
      module: 'snippet_rules',
      components: [],
      rules: [
        {
          id: 10,
          name: 'heal_rule',
          trigger: { type: 'event', event: 'Heal' },
          filter: {},
          actions: [],
        },
      ],
      functions: [
        {
          name: 'helper_fn',
          params: [],
          body: [],
        },
      ],
    };

    const beforeRules = game.getRules().length;
    game.mergeRulesFromObject(snippet, { mergeEntities: false, overrideOnConflict: true });
    const afterRules = game.getRules().length;

    assert.ok(afterRules > beforeRules, 'Rules should be appended after merge');
    const ir = game.getIR();
    const foundFn = (ir?.functions || []).some((f: any) => f.name === 'helper_fn');
    assert.ok(foundFn, 'Merged function must be present in IR');
  });

  it('throws on conflicting field types when merging', () => {
    game.loadRulesFromObject(baseIR);
    game.start();
    game.pause();

    const snippetConflict = {
      version: '1.0',
      module: 'conflict',
      components: [
        {
          id: 2,
          name: 'Health',
          fields: [
            { name: 'current', type: 'string', default: '100' }, // conflicting type
          ],
        },
      ],
      rules: [],
      functions: [],
    };

    let threw = false;
    try {
      game.mergeRulesFromObject(snippetConflict, { mergeEntities: false, overrideOnConflict: false });
    } catch (e) {
      threw = true;
    }

    assert.ok(threw, 'Merging conflicting field types should throw');
  });
});
