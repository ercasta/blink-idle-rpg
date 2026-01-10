const { BlinkGame } = require('@blink/engine');

async function run() {
  const game = BlinkGame.createSync();

  const ir = {
    version: '1.0',
    module: 'verify-integer',
    metadata: {},
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
            entity: { type: 'var', name: 'entity' },
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

  const before = game.getComponent(0, 'Counter').value;
  console.log('Before value:', before);

  game.scheduleEvent('Inc');
  game.step();

  const after = game.getComponent(0, 'Counter').value;
  console.log('After value:', after);

  if (!Number.isInteger(before) || !Number.isInteger(after)) {
    console.error('One of the values is not integer as expected');
    process.exit(2);
  }

  if (before !== 3 || after !== 4) {
    console.error('Integer behavior unexpected:', { before, after });
    process.exit(3);
  }

  console.log('Integer support verified: values are integers and arithmetic truncated to integer.');
}

run().catch(err => { console.error(err); process.exit(1); });
