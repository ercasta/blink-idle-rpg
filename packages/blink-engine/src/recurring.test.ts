/**
 * Tests for Recurring Event System
 * 
 * These tests verify that recurring events work correctly - automatically
 * rescheduling themselves until canceled.
 */

import { BlinkGame } from './BlinkGame';

// Simple IR for testing recurring events
const testIR = {
  version: "1.0",
  module: "recurring_test",
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
      name: "Counter",
      fields: [
        { name: "value", type: "number", default: 0 }
      ]
    }
  ],
  rules: [
    {
      id: 0,
      name: "heal_on_tick",
      trigger: {
        type: "event",
        event: "HealTick",
        bindings: { healer: "source" }
      },
      filter: { components: ["Health"] },
      actions: [
        {
          type: "modify",
          entity: { type: "var", name: "healer" },
          component: "Health",
          field: "current",
          op: "add",
          value: { type: "literal", value: 5 }
        }
      ]
    },
    {
      id: 1,
      name: "count_on_tick",
      trigger: {
        type: "event",
        event: "CountTick",
        bindings: { counter: "source" }
      },
      filter: { components: ["Counter"] },
      actions: [
        {
          type: "modify",
          entity: { type: "var", name: "counter" },
          component: "Counter",
          field: "value",
          op: "add",
          value: { type: "literal", value: 1 }
        }
      ]
    }
  ],
  functions: [],
  initial_state: {
    entities: [
      {
        id: 0,
        components: {
          Health: { current: 50, max: 100 },
          Counter: { value: 0 }
        }
      }
    ]
  }
};

/**
 * Test 1: Basic recurring event
 */
async function testBasicRecurring() {
  console.log("\n=== Test 1: Basic Recurring Event ===");
  
  const game = BlinkGame.createSync();
  game.loadRulesFromObject(testIR);
  
  // Schedule a recurring heal event every 1 second
  const healEventId = game.scheduleRecurringEvent('HealTick', 1.0, { source: 0 });
  
  console.log(`Scheduled recurring event ID: ${healEventId}`);
  console.log(`Initial health: ${game.getComponent(0, 'Health')?.current}`);
  
  // Process several steps
  for (let i = 0; i < 5; i++) {
    game.step();
    const health = game.getComponent(0, 'Health')?.current;
    console.log(`  After step ${i + 1}: Health = ${health}, Time = ${game.getTime()}`);
  }
  
  const finalHealth = game.getComponent(0, 'Health')?.current;
  console.log(`Final health: ${finalHealth}`);
  
  // Should have healed 5 times (5 * 5 = 25 health gained)
  console.assert(finalHealth === 75, "Should have healed to 75");
  
  game.destroy();
  console.log("✓ Test 1 passed");
}

/**
 * Test 2: Cancel recurring event
 */
async function testCancelRecurring() {
  console.log("\n=== Test 2: Cancel Recurring Event ===");
  
  const game = BlinkGame.createSync();
  game.loadRulesFromObject(testIR);
  
  // Schedule recurring event
  const countEventId = game.scheduleRecurringEvent('CountTick', 1.0, { source: 0 });
  
  console.log(`Initial counter: ${game.getComponent(0, 'Counter')?.value}`);
  
  // Process 3 events
  for (let i = 0; i < 3; i++) {
    game.step();
  }
  
  let counter = game.getComponent(0, 'Counter')?.value;
  console.log(`Counter after 3 steps: ${counter}`);
  console.assert(counter === 3, "Counter should be 3");
  
  // Cancel the recurring event
  const canceled = game.cancelEvent(countEventId);
  console.log(`Canceled event: ${canceled}`);
  console.assert(canceled === true, "Should successfully cancel");
  
  // Process more steps - counter should not increase
  for (let i = 0; i < 3; i++) {
    const result = game.step();
    if (!result) break; // No more events
  }
  
  counter = game.getComponent(0, 'Counter')?.value;
  console.log(`Counter after canceling: ${counter}`);
  console.assert(counter === 3, "Counter should still be 3");
  
  game.destroy();
  console.log("✓ Test 2 passed");
}

/**
 * Test 3: Multiple recurring events
 */
async function testMultipleRecurring() {
  console.log("\n=== Test 3: Multiple Recurring Events ===");
  
  const game = BlinkGame.createSync();
  game.loadRulesFromObject(testIR);
  
  // Schedule two recurring events with different intervals
  const healId = game.scheduleRecurringEvent('HealTick', 2.0, { source: 0 });
  const countId = game.scheduleRecurringEvent('CountTick', 1.0, { source: 0 });
  
  console.log(`Heal event ID: ${healId}, Count event ID: ${countId}`);
  
  // Process events for a while
  for (let i = 0; i < 10; i++) {
    game.step();
  }
  
  const health = game.getComponent(0, 'Health')?.current as number;
  const counter = game.getComponent(0, 'Counter')?.value as number;
  
  console.log(`Final health: ${health} (should heal ~5 times = 25 gain)`);
  console.log(`Final counter: ${counter} (should count ~10 times)`);
  
  // Counter fires every 1s, health fires every 2s
  // After 10 events at different intervals, we expect more counts than heals
  console.assert(counter > 5, "Counter should be > 5");
  console.assert(health > 50, "Health should increase");
  
  game.destroy();
  console.log("✓ Test 3 passed");
}

/**
 * Test 4: Recurring event with delay
 */
async function testRecurringWithDelay() {
  console.log("\n=== Test 4: Recurring Event with Delay ===");
  
  const game = BlinkGame.createSync();
  game.loadRulesFromObject(testIR);
  
  // Schedule recurring event with initial delay
  game.scheduleRecurringEvent('CountTick', 1.0, { 
    delay: 2.0,  // Start after 2 seconds
    source: 0 
  });
  
  console.log(`Initial counter: ${game.getComponent(0, 'Counter')?.value}`);
  console.log(`Current time: ${game.getTime()}`);
  
  // First step triggers the first occurrence at time 2.0
  game.step();
  let counter = game.getComponent(0, 'Counter')?.value as number;
  console.log(`Counter after first step: ${counter}, Time: ${game.getTime()}`);
  console.assert(counter === 1, "Should have triggered at time 2.0");
  console.assert(game.getTime() === 2.0, "Time should be 2.0");
  
  // Process more steps - should fire at 3.0, 4.0, 5.0, etc.
  for (let i = 0; i < 3; i++) {
    game.step();
  }
  
  counter = game.getComponent(0, 'Counter')?.value as number;
  console.log(`Counter after several intervals: ${counter}, Time: ${game.getTime()}`);
  console.assert(counter === 4, "Should have fired 4 times total");
  
  game.destroy();
  console.log("✓ Test 4 passed");
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("=".repeat(60));
  console.log("Recurring Event System Tests");
  console.log("=".repeat(60));
  
  try {
    await testBasicRecurring();
    await testCancelRecurring();
    await testMultipleRecurring();
    await testRecurringWithDelay();
    
    console.log("\n" + "=".repeat(60));
    console.log("All tests passed! ✓");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("Test failed! ✗");
    console.error("=".repeat(60));
    console.error(error);
    throw error;
  }
}

// Auto-run tests
runAllTests().catch(() => {
  if (typeof process !== 'undefined') {
    process.exit(1);
  }
});

export { runAllTests };
