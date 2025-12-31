/**
 * Tests for the @blink/test framework
 * Validates the testing framework itself works correctly
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { 
  createTest, 
  expect,
  Scenario,
  createWarriorFixture,
  createEnemyFixture,
  createCombatScenario,
  ConsoleReporter,
  ExpectEvents,
} from './index.js';

// Test IR for framework validation
const testIR = {
  version: "1.0",
  module: "test_framework",
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
    },
    {
      id: 2,
      name: "Character",
      fields: [
        { name: "name", type: "string", default: "" },
        { name: "level", type: "number", default: 1 }
      ]
    }
  ],
  rules: [
    {
      id: 0,
      name: "damage_rule",
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
  trackers: [
    { id: 0, component: "Health", event: "DoAttack" }
  ],
  initial_state: {
    entities: [
      {
        id: 0,
        components: {
          Health: { current: 100, max: 100 },
          Attack: { damage: 15 },
          Character: { name: "Attacker", level: 1 }
        }
      },
      {
        id: 1,
        components: {
          Health: { current: 50, max: 50 },
          Character: { name: "Target", level: 1 }
        }
      }
    ]
  }
};

describe('GameTest', () => {
  it('should create a test instance', () => {
    const test = createTest();
    assert.ok(test);
    test.destroy();
  });

  it('should load rules from object', () => {
    const test = createTest()
      .loadRules(testIR);
    
    const health = test.getComponent(0, 'Health');
    assert.strictEqual(health?.current, 100);
    
    test.destroy();
  });

  it('should execute a single step', () => {
    const test = createTest()
      .loadRules(testIR)
      .scheduleEvent('DoAttack', 0, { source: 0 });
    
    const result = test.step();
    assert.ok(result);
    assert.strictEqual(result?.event.eventType, 'DoAttack');
    
    test.destroy();
  });

  it('should apply damage on attack', () => {
    const test = createTest()
      .loadRules(testIR)
      .scheduleEvent('DoAttack', 0, { source: 0 });
    
    test.step();
    
    const targetHealth = test.getComponent(1, 'Health');
    assert.strictEqual(targetHealth?.current, 35); // 50 - 15
    
    test.destroy();
  });

  it('should run until complete', () => {
    const test = createTest()
      .loadRules(testIR)
      .scheduleEvent('DoAttack', 0, { source: 0 });
    
    const results = test.runUntilComplete();
    assert.strictEqual(results.length, 1);
    assert.ok(!test.hasEvents());
    
    test.destroy();
  });

  it('should track event history', () => {
    const test = createTest()
      .loadRules(testIR)
      .scheduleEvent('DoAttack', 0, { source: 0 })
      .scheduleEvent('DoAttack', 0.1, { source: 0 });
    
    test.runUntilComplete();
    
    const history = test.getEventHistory();
    assert.strictEqual(history.length, 2);
    
    test.destroy();
  });

  it('should track tracker output', () => {
    const test = createTest()
      .loadRules(testIR)
      .scheduleEvent('DoAttack', 0, { source: 0 });
    
    test.step();
    
    const trackerHistory = test.getTrackerHistory();
    assert.ok(trackerHistory.length > 0);
    
    test.destroy();
  });

  it('should reset to initial state', () => {
    const test = createTest()
      .loadRules(testIR)
      .scheduleEvent('DoAttack', 0, { source: 0 });
    
    test.step();
    assert.strictEqual(test.getComponent(1, 'Health')?.current, 35);
    
    test.reset();
    assert.strictEqual(test.getComponent(1, 'Health')?.current, 50);
    
    test.destroy();
  });

  it('should run until condition is met', () => {
    const test = createTest()
      .loadRules(testIR)
      .scheduleEvent('DoAttack', 0, { source: 0 })
      .scheduleEvent('DoAttack', 0.1, { source: 0 })
      .scheduleEvent('DoAttack', 0.2, { source: 0 });
    
    // Run until health drops below 30
    test.runUntil((game) => {
      const health = game.getComponent(1, 'Health');
      return (health?.current as number) < 30;
    });
    
    const health = test.getComponent(1, 'Health');
    assert.ok((health?.current as number) < 30);
    
    test.destroy();
  });
});

describe('Assertions', () => {
  it('should assert entity component value', () => {
    const test = createTest().loadRules(testIR);
    
    // Should not throw
    expect(test.getGame())
      .entity(0)
      .component('Health')
      .toHaveField('current', 100);
    
    test.destroy();
  });

  it('should assert entity has component', () => {
    const test = createTest().loadRules(testIR);
    
    // Should not throw
    expect(test.getGame())
      .entity(0)
      .toHaveComponent('Health');
    
    test.destroy();
  });

  it('should assert field greater than', () => {
    const test = createTest().loadRules(testIR);
    
    // Should not throw
    expect(test.getGame())
      .entity(0)
      .component('Health')
      .toHaveFieldGreaterThan('current', 50);
    
    test.destroy();
  });

  it('should fail assertion on wrong value', () => {
    const test = createTest().loadRules(testIR);
    
    assert.throws(() => {
      expect(test.getGame())
        .entity(0)
        .component('Health')
        .toHaveField('current', 999);
    }, /Expected entity 0\.Health\.current to equal 999/);
    
    test.destroy();
  });

  it('should negate assertions with not', () => {
    const test = createTest().loadRules(testIR);
    
    // Should not throw
    expect(test.getGame())
      .entity(0)
      .component('Health')
      .not.toHaveField('current', 999);
    
    test.destroy();
  });

  it('should assert timeline state', () => {
    const test = createTest()
      .loadRules(testIR)
      .scheduleEvent('DoAttack', 0, { source: 0 });
    
    expect(test.getGame()).timeline().toHaveEvents();
    
    test.step();
    
    expect(test.getGame()).timeline().toBeEmpty();
    
    test.destroy();
  });

  it('should assert events occurred', () => {
    const test = createTest()
      .loadRules(testIR)
      .scheduleEvent('DoAttack', 0, { source: 0 });
    
    test.step();
    
    const events = new ExpectEvents(test.getEventHistory());
    events.toContainEvent('DoAttack');
    
    test.destroy();
  });
});

describe('Fixtures', () => {
  it('should create warrior fixture', () => {
    const fixture = createWarriorFixture({ name: 'TestWarrior', damage: 25 });
    
    assert.strictEqual(fixture.components.Character.name, 'TestWarrior');
    assert.strictEqual(fixture.components.Combat.damage, 25);
  });

  it('should create enemy fixture', () => {
    const fixture = createEnemyFixture({ tier: 2, isBoss: true });
    
    assert.strictEqual(fixture.components.Enemy.tier, 2);
    assert.strictEqual(fixture.components.Enemy.isBoss, true);
  });

  it('should create combat scenario', () => {
    const test = createTest().loadRules(testIR);
    
    const scenario = createCombatScenario(test, {
      autoStart: false,
    });
    
    assert.ok(scenario.partyIds.length > 0);
    assert.ok(scenario.enemyIds.length > 0);
    
    test.destroy();
  });
});

describe('ScenarioBuilder', () => {
  it('should build a scenario', () => {
    const scenario = Scenario('Test Scenario')
      .describe('A test scenario')
      .step('Initial state')
        .do(() => {})
        .expect('should pass', () => true)
      .build();
    
    assert.strictEqual(scenario.name, 'Test Scenario');
    assert.strictEqual(scenario.description, 'A test scenario');
    assert.strictEqual(scenario.steps.length, 1);
  });

  it('should chain multiple steps', () => {
    const scenario = Scenario('Multi-step')
      .step('Step 1')
        .do(() => {})
      .step('Step 2')
        .do(() => {})
      .step('Step 3')
        .do(() => {})
      .build();
    
    assert.strictEqual(scenario.steps.length, 3);
  });

  it('should add entity assertions', () => {
    const scenario = Scenario('With assertions')
      .step('Check entity')
        .do(() => {})
        .expectEntity(0)
          .toHaveField('Health', 'current', 100)
      .build();
    
    assert.strictEqual(scenario.steps[0].assertions?.length, 1);
  });
});

describe('TestReporter', () => {
  it('should generate summary', () => {
    const reporter = new ConsoleReporter({ colors: false });
    
    const results = [{
      scenarioName: 'Test Scenario',
      passed: true,
      results: [
        {
          stepName: 'Step 1',
          passed: true,
          assertions: [
            { passed: true, description: 'assertion 1' }
          ],
          stepResults: [],
          duration: 10,
        }
      ],
      duration: 100,
    }];
    
    const summary = reporter.getSummary(results);
    
    assert.strictEqual(summary.totalScenarios, 1);
    assert.strictEqual(summary.passedScenarios, 1);
    assert.strictEqual(summary.totalSteps, 1);
    assert.strictEqual(summary.passedSteps, 1);
    assert.strictEqual(summary.totalAssertions, 1);
    assert.strictEqual(summary.passedAssertions, 1);
  });
});

describe('Integration', () => {
  it('should run a complete scenario', async () => {
    const test = createTest({ verbose: false })
      .loadRules(testIR);
    
    test.scenario({
      name: 'Combat Integration Test',
      steps: [
        {
          name: 'Initial state check',
          action: () => {},
          assertions: [
            {
              description: 'Attacker should have 100 health',
              check: (game) => game.getComponent(0, 'Health')?.current === 100,
            },
            {
              description: 'Target should have 50 health',
              check: (game) => game.getComponent(1, 'Health')?.current === 50,
            },
          ],
        },
        {
          name: 'Execute attack',
          action: (game) => {
            const wrapper = test; // Access test wrapper
            wrapper.scheduleEvent('DoAttack', 0, { source: 0 });
            wrapper.step();
          },
          assertions: [
            {
              description: 'Target health should decrease by 15',
              check: (game) => game.getComponent(1, 'Health')?.current === 35,
            },
          ],
        },
      ],
    });
    
    const results = await test.runScenarios();
    
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].passed, true);
    
    test.destroy();
  });

  it('should detect failing assertions', async () => {
    const test = createTest({ verbose: false })
      .loadRules(testIR);
    
    test.scenario({
      name: 'Failing Test',
      steps: [
        {
          name: 'Wrong assertion',
          action: () => {},
          assertions: [
            {
              description: 'This should fail',
              check: () => false,
            },
          ],
        },
      ],
    });
    
    const results = await test.runScenarios();
    
    assert.strictEqual(results[0].passed, false);
    
    test.destroy();
  });
});
