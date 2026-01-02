/**
 * Example: Combat Rules Testing
 * 
 * This file demonstrates how to test BRL combat rules using the @blink/test framework.
 * It shows various testing patterns and assertion styles.
 */

// Import the testing framework
// In your project, this would be: import { createTest, expect, ... } from '@blink/test';

/**
 * Example IR for a simple combat system
 * In a real project, you would load this from your compiled BRL files
 */
const combatIR = {
  version: "1.0",
  module: "combat_example",
  components: [
    {
      id: 0,
      name: "Character",
      fields: [
        { name: "name", type: "string", default: "" },
        { name: "class", type: "string", default: "" },
        { name: "level", type: "number", default: 1 }
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
      name: "Attack",
      fields: [
        { name: "damage", type: "number", default: 10 },
        { name: "speed", type: "number", default: 1.0 }
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
        { name: "id", type: "string", default: "" },
        { name: "isPlayer", type: "boolean", default: false }
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
      filter: { components: ["Attack", "Target"] },
      condition: {
        type: "binary",
        op: "neq",
        left: { type: "field", entity: "attacker", component: "Target", field: "entity" },
        right: { type: "literal", value: null }
      },
      actions: [
        {
          type: "modify",
          entity: { type: "field", entity: "attacker", component: "Target", field: "entity" },
          component: "Health",
          field: "current",
          op: "subtract",
          value: { type: "field", entity: "attacker", component: "Attack", field: "damage" }
        },
        {
          type: "schedule",
          event: "DoAttack",
          source: { type: "var", name: "attacker" },
          delay: {
            type: "binary",
            op: "divide",
            left: { type: "literal", value: 1000 },
            right: { type: "field", entity: "attacker", component: "Attack", field: "speed" }
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
    }
  ],
  functions: [],
  trackers: [
    { id: 0, component: "Health", event: "DoAttack" },
    { id: 1, component: "Character", event: "Death" }
  ],
  initial_state: {
    entities: [
      {
        id: 0,
        components: {
          Character: { name: "Warrior", class: "Warrior", level: 5 },
          Health: { current: 120, max: 120 },
          Attack: { damage: 25, speed: 1.0 },
          Target: { entity: 2 },
          Team: { id: "player", isPlayer: true }
        }
      },
      {
        id: 1,
        components: {
          Character: { name: "Mage", class: "Mage", level: 4 },
          Health: { current: 80, max: 80 },
          Attack: { damage: 35, speed: 0.8 },
          Target: { entity: 2 },
          Team: { id: "player", isPlayer: true }
        }
      },
      {
        id: 2,
        components: {
          Character: { name: "Goblin Chief", class: "Monster", level: 3 },
          Health: { current: 100, max: 100 },
          Attack: { damage: 15, speed: 1.2 },
          Target: { entity: 0 },
          Team: { id: "enemy", isPlayer: false }
        }
      }
    ]
  }
};

// ============================================================================
// Example 1: Basic Test Usage
// ============================================================================

console.log("=".repeat(60));
console.log("Example 1: Basic Test Usage");
console.log("=".repeat(60));

async function basicTestExample() {
  // Dynamic import for ESM compatibility
  const { createTest, expect } = await import('@blink/test');
  
  // Create a test instance and load rules
  const test = createTest({ verbose: false })
    .loadRules(combatIR);
  
  // Check initial state
  console.log("\n1. Checking initial state:");
  const warriorHealth = test.getComponent(0, 'Health');
  const goblinHealth = test.getComponent(2, 'Health');
  console.log(`   Warrior health: ${warriorHealth?.current}/${warriorHealth?.max}`);
  console.log(`   Goblin health: ${goblinHealth?.current}/${goblinHealth?.max}`);
  
  // Use fluent assertions
  expect(test.getGame())
    .entity(0)
    .component('Health')
    .toHaveField('current', 120);
  console.log("   ✓ Warrior has 120 health");
  
  expect(test.getGame())
    .entity(2)
    .component('Health')
    .toHaveField('current', 100);
  console.log("   ✓ Goblin has 100 health");
  
  // Schedule an attack
  console.log("\n2. Scheduling warrior attack...");
  test.scheduleEvent('DoAttack', 0, { source: 0 });
  
  // Step through the attack
  const result = test.step();
  console.log(`   Processed event: ${result?.event.eventType} at time ${result?.time}`);
  
  // Check damage was applied
  const goblinHealthAfter = test.getComponent(2, 'Health');
  console.log(`   Goblin health after attack: ${goblinHealthAfter?.current}`);
  
  expect(test.getGame())
    .entity(2)
    .component('Health')
    .toHaveField('current', 75); // 100 - 25 = 75
  console.log("   ✓ Goblin took 25 damage (now 75 health)");
  
  // Cleanup
  test.destroy();
  console.log("\n   Test completed successfully!\n");
}

// ============================================================================
// Example 2: Running Until Condition
// ============================================================================

async function conditionTestExample() {
  console.log("=".repeat(60));
  console.log("Example 2: Running Until Condition");
  console.log("=".repeat(60));
  
  const { createTest, expect } = await import('@blink/test');
  
  const test = createTest()
    .loadRules(combatIR);
  
  // Start combat with all fighters
  console.log("\n1. Starting combat (all fighters attack)...");
  test.scheduleEvent('DoAttack', 0, { source: 0 });    // Warrior attacks
  test.scheduleEvent('DoAttack', 0.1, { source: 1 });  // Mage attacks
  test.scheduleEvent('DoAttack', 0.2, { source: 2 });  // Goblin attacks
  
  // Run until goblin health drops below 50
  console.log("\n2. Running until goblin health < 50...");
  test.runUntil((game) => {
    const health = game.getComponent(2, 'Health');
    return (health?.current as number) < 50;
  }, { maxSteps: 100 });
  
  const goblinHealth = test.getComponent(2, 'Health');
  console.log(`   Goblin health: ${goblinHealth?.current}`);
  
  expect(test.getGame())
    .entity(2)
    .component('Health')
    .toHaveFieldLessThan('current', 50);
  console.log("   ✓ Goblin health is below 50");
  
  // Check how much time has passed
  console.log(`   Simulation time: ${test.getTime()}ms`);
  
  // Check event history
  const events = test.getEventHistory();
  const attackCount = events.filter(e => e.event.eventType === 'DoAttack').length;
  console.log(`   Attacks processed: ${attackCount}`);
  
  test.destroy();
  console.log("\n   Test completed successfully!\n");
}

// ============================================================================
// Example 3: Test Scenarios with DSL
// ============================================================================

async function scenarioTestExample() {
  console.log("=".repeat(60));
  console.log("Example 3: Test Scenarios with DSL");
  console.log("=".repeat(60));
  
  const { createTest, Scenario, ConsoleReporter } = await import('@blink/test');
  
  const test = createTest({ name: 'Combat Scenario Tests' })
    .loadRules(combatIR);
  
  // Build a scenario using the DSL
  const combatScenario = Scenario('Full Combat Encounter')
    .describe('Tests a complete combat encounter from start to finish')
    
    .step('Verify initial state')
      .do(() => {})
      .expect('Warrior should have full health', (game) =>
        game.getComponent(0, 'Health')?.current === 120
      )
      .expect('Goblin should have full health', (game) =>
        game.getComponent(2, 'Health')?.current === 100
      )
      .expectEntity(0).toHaveField('Character', 'level', 5)
    
    .step('Execute first round of attacks')
      .do(() => {
        test.scheduleEvent('DoAttack', 0, { source: 0 });
        test.scheduleEvent('DoAttack', 0.1, { source: 1 });
        test.runSteps(2);
      })
      .expect('Goblin should have taken damage', (game) =>
        (game.getComponent(2, 'Health')?.current as number) < 100
      )
      .expectEntity(2).toHaveFieldLessThan('Health', 'current', 100)
    
    .step('Continue until goblin is defeated')
      .do(() => {
        // Keep combat going
        test.scheduleEvent('DoAttack', 0, { source: 0 });
        test.scheduleEvent('DoAttack', 0.1, { source: 1 });
        test.runUntil((game) => {
          const health = game.getComponent(2, 'Health');
          return (health?.current as number) <= 0;
        }, { maxSteps: 100 });
      })
      .expect('Goblin should be defeated', (game) =>
        (game.getComponent(2, 'Health')?.current as number) <= 0
      )
    
    .build();
  
  // Add the scenario and run it
  test.scenario(combatScenario);
  
  console.log("\nRunning scenario...\n");
  const results = await test.runScenarios();
  
  // Report results
  const reporter = new ConsoleReporter({ colors: true, verbose: true });
  reporter.report(results);
  
  test.destroy();
}

// ============================================================================
// Example 4: Using Fixtures
// ============================================================================

async function fixtureTestExample() {
  console.log("=".repeat(60));
  console.log("Example 4: Using Fixtures");
  console.log("=".repeat(60));
  
  const { 
    createTest, 
    createWarriorFixture, 
    createEnemyFixture,
    createCombatScenario,
    expect 
  } = await import('@blink/test');
  
  const test = createTest()
    .loadRules(combatIR);
  
  console.log("\n1. Creating fixtures...");
  
  // Create custom fixtures
  const heroWarrior = createWarriorFixture({
    id: 100,
    name: 'Hero',
    level: 10,
    health: 200,
    damage: 50
  });
  
  const bossEnemy = createEnemyFixture({
    id: 200,
    name: 'Dragon',
    tier: 3,
    isBoss: true,
    health: 500,
    damage: 40
  });
  
  console.log(`   Created warrior: ${heroWarrior.components.Character.name}`);
  console.log(`   Created boss: ${bossEnemy.components.Character.name}`);
  
  // Create a combat scenario with custom fixtures
  console.log("\n2. Setting up combat scenario...");
  
  // Note: createCombatScenario uses the fixtures to set up entities
  // Since we're using pre-loaded IR, let's just log the fixture data
  console.log(`   Hero health: ${heroWarrior.components.Health.current}`);
  console.log(`   Boss health: ${bossEnemy.components.Health.current}`);
  console.log(`   Hero damage: ${heroWarrior.components.Combat.damage}`);
  console.log(`   Boss damage: ${bossEnemy.components.Combat.damage}`);
  
  // Demonstrate combat with the default IR entities
  test.scheduleEvent('DoAttack', 0, { source: 0 });
  test.step();
  
  console.log("\n3. After combat step:");
  console.log(`   Goblin health: ${test.getComponent(2, 'Health')?.current}`);
  
  test.destroy();
  console.log("\n   Test completed successfully!\n");
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  try {
    await basicTestExample();
    await conditionTestExample();
    await scenarioTestExample();
    await fixtureTestExample();
    
    console.log("=".repeat(60));
    console.log("All examples completed successfully!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("Error running examples:", error);
    process.exit(1);
  }
}

runAllExamples();
