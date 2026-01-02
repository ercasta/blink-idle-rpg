/**
 * Tests for the Watchdog Event System
 * 
 * These tests verify that the watchdog timer correctly detects and recovers from
 * situations where the event queue becomes empty during active combat.
 */

import { BlinkGame } from './BlinkGame';

// Simple Combat IR for testing watchdog
const combatIR = {
  version: "1.0",
  module: "watchdog_test",
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
        { name: "damage", type: "number", default: 10 },
        { name: "speed", type: "number", default: 1.0 }
      ]
    },
    {
      id: 2,
      name: "Target",
      fields: [
        { name: "entity", type: "entity", default: null }
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
        }
        // NOTE: Deliberately NOT scheduling next attack to simulate hang condition
      ]
    }
  ],
  functions: [],
  trackers: [],
  initial_state: {
    entities: [
      {
        id: 0,
        components: {
          Health: { current: 100, max: 100 },
          Attack: { damage: 10, speed: 1.0 },
          Target: { entity: 1 }
        }
      },
      {
        id: 1,
        components: {
          Health: { current: 100, max: 100 },
          Attack: { damage: 10, speed: 1.0 },
          Target: { entity: 0 }
        }
      }
    ]
  }
};

/**
 * Test 1: Verify watchdog is enabled by default
 */
async function testWatchdogEnabledByDefault() {
  console.log("\n=== Test 1: Watchdog Enabled By Default ===");
  
  const game = BlinkGame.createSync({ debug: true });
  game.loadRulesFromObject(combatIR);
  
  // Start the game - watchdog should be scheduled
  game.start();
  
  // Check that timeline has the watchdog event
  const events = (game as any).timeline.getAllEvents();
  const watchdogEvents = events.filter((e: any) => e.eventType === '__WATCHDOG__');
  
  console.log(`Watchdog events scheduled: ${watchdogEvents.length}`);
  console.assert(watchdogEvents.length > 0, "Watchdog should be scheduled by default");
  
  game.destroy();
  console.log("✓ Test 1 passed");
}

/**
 * Test 2: Verify watchdog can be disabled
 */
async function testWatchdogCanBeDisabled() {
  console.log("\n=== Test 2: Watchdog Can Be Disabled ===");
  
  const game = BlinkGame.createSync({ watchdogEnabled: false });
  game.loadRulesFromObject(combatIR);
  
  game.start();
  
  const events = (game as any).timeline.getAllEvents();
  const watchdogEvents = events.filter((e: any) => e.eventType === '__WATCHDOG__');
  
  console.log(`Watchdog events scheduled: ${watchdogEvents.length}`);
  console.assert(watchdogEvents.length === 0, "Watchdog should not be scheduled when disabled");
  
  game.destroy();
  console.log("✓ Test 2 passed");
}

/**
 * Test 3: Verify watchdog detects and recovers from hang
 */
async function testWatchdogRecovery() {
  console.log("\n=== Test 3: Watchdog Recovery from Hang ===");
  
  const game = BlinkGame.createSync({ 
    debug: true,
    watchdogEnabled: true,
    watchdogInterval: 2.0 // 2 seconds
  });
  game.loadRulesFromObject(combatIR);
  
  // Initial entity health
  console.log("Initial health:");
  console.log(`  Entity 0: ${game.getComponent(0, 'Health')?.current}`);
  console.log(`  Entity 1: ${game.getComponent(1, 'Health')?.current}`);
  
  // Start the game to enable watchdog
  game.start();
  
  // Trigger first attack - this will NOT schedule follow-up attack (simulating hang)
  game.scheduleEvent('DoAttack', 0, { source: 0 });
  
  // Process the attack
  game.step();
  
  console.log("\nAfter first attack:");
  console.log(`  Entity 0: ${game.getComponent(0, 'Health')?.current}`);
  console.log(`  Entity 1: ${game.getComponent(1, 'Health')?.current}`);
  
  // At this point, timeline should only have the watchdog event
  let events = (game as any).timeline.getAllEvents();
  let nonWatchdogEvents = events.filter((e: any) => e.eventType !== '__WATCHDOG__');
  console.log(`\nNon-watchdog events in timeline: ${nonWatchdogEvents.length}`);
  console.assert(nonWatchdogEvents.length === 0, "Should have no non-watchdog events (hang condition)");
  
  // Run until watchdog fires (process multiple steps)
  console.log("\nProcessing events until watchdog fires...");
  let stepsProcessed = 0;
  const maxSteps = 10;
  
  console.log(`Timeline has ${(game as any).timeline.getEventCount()} events`);
  const allEvents = (game as any).timeline.getAllEvents();
  console.log(`All events:`, allEvents.map((e: any) => `${e.eventType} at ${e.time}`));
  
  while (stepsProcessed < maxSteps && (game as any).timeline.hasEvents()) {
    console.log(`\n  Before step ${stepsProcessed + 1}, timeline has ${(game as any).timeline.getEventCount()} events`);
    const result = game.step();
    if (result) {
      stepsProcessed++;
      console.log(`  Step ${stepsProcessed}: ${result.event.eventType} at ${result.time}`);
    } else {
      console.log(`  Step returned null, but timeline still has ${(game as any).timeline.getEventCount()} events`);
      stepsProcessed++; // Count the step even if it returned null
    }
  }
  
  // Check if health changed (indicating watchdog generated recovery event)
  const finalHealth1 = game.getComponent(1, 'Health')?.current as number;
  console.log(`\nFinal health of Entity 1: ${finalHealth1}`);
  
  // Entity 1 should have taken additional damage from watchdog-generated attack
  console.assert(finalHealth1 < 90, "Watchdog should have generated recovery attack event");
  
  game.destroy();
  console.log("✓ Test 3 passed");
}

/**
 * Test 4: Verify watchdog reschedules itself
 */
async function testWatchdogRescheduling() {
  console.log("\n=== Test 4: Watchdog Rescheduling ===");
  
  const game = BlinkGame.createSync({ 
    debug: true,
    watchdogEnabled: true,
    watchdogInterval: 1.0
  });
  game.loadRulesFromObject(combatIR);
  
  game.start();
  game.scheduleEvent('DoAttack', 0, { source: 0 });
  
  // Process events - watchdog should fire multiple times and generate recovery events
  let attacksProcessed = 0;
  for (let i = 0; i < 6; i++) {
    const result = game.step();
    if (result && result.event.eventType === 'DoAttack') {
      attacksProcessed++;
    }
  }
  
  // We should have processed multiple attack events generated by watchdog
  console.log(`Attack events processed: ${attacksProcessed}`);
  console.assert(attacksProcessed >= 3, "Watchdog should have generated recovery attack events");
  
  game.destroy();
  console.log("✓ Test 4 passed");
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("=".repeat(60));
  console.log("Watchdog Event System Tests");
  console.log("=".repeat(60));
  
  try {
    await testWatchdogEnabledByDefault();
    await testWatchdogCanBeDisabled();
    await testWatchdogRecovery();
    await testWatchdogRescheduling();
    
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
