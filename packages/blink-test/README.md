# @blink/test - Testing Framework for BRL and BCL

An integrated testing framework that allows developers and players to test game rules (BRL) and player choices (BCL).

## Features

- **GameTest** - Main test harness for step-by-step game execution
- **Fluent Assertions** - Readable assertion API for game state
- **Scenario Builder** - DSL for defining complex test scenarios
- **Fixtures** - Pre-built entity configurations for common patterns
- **Reporters** - Multiple output formats (Console, JSON, TAP)

## Installation

```bash
npm install @blink/test
```

## Quick Start

```typescript
import { createTest, expect, Scenario } from '@blink/test';

// Load your game rules (IR)
const test = createTest()
  .loadRules(myGameIR);

// Schedule events and step through
test.scheduleEvent('DoAttack', 0, { source: 0 });
test.step();

// Assert game state
expect(test.getGame())
  .entity(1)
  .component('Health')
  .toHaveFieldLessThan('current', 100);

// Cleanup
test.destroy();
```

## GameTest API

### Creating a Test

```typescript
import { createTest } from '@blink/test';

const test = createTest({
  name: 'Combat Tests',
  verbose: true,
  maxSteps: 1000,
  maxTime: 60,
});
```

### Loading Rules

```typescript
// From IR object
test.loadRules(irObject);

// From JSON string
test.loadRulesFromString(jsonString);
```

### Executing the Game

```typescript
// Single step
const result = test.step();

// Run until complete
const results = test.runUntilComplete(maxSteps);

// Run specific number of steps
const results = test.runSteps(10);

// Run until condition
test.runUntil((game) => game.getComponent(0, 'Health')?.current <= 0);

// Run until specific event
test.runUntilEvent('Death');
```

### Querying State

```typescript
// Get component
const health = test.getComponent(entityId, 'Health');

// Get specific field
const currentHealth = test.getField(entityId, 'Health', 'current');

// Query entities
const enemies = test.query('Enemy', 'Health');

// Get time
const time = test.getTime();

// Get history
const events = test.getEventHistory();
const trackers = test.getTrackerHistory();
```

## Assertions

### Entity Assertions

```typescript
import { expect } from '@blink/test';

// Check entity exists
expect(game).entity(0).toExist();

// Check entity has component
expect(game).entity(0).toHaveComponent('Health');

// Negate with .not
expect(game).entity(0).not.toHaveComponent('Poisoned');
```

### Component Assertions

```typescript
// Exact field value
expect(game)
  .entity(0)
  .component('Health')
  .toHaveField('current', 100);

// Comparison assertions
expect(game)
  .entity(0)
  .component('Health')
  .toHaveFieldGreaterThan('current', 50)
  .toHaveFieldLessThan('current', 150)
  .toHaveFieldBetween('current', 50, 150);

// Match multiple fields
expect(game)
  .entity(0)
  .component('Health')
  .toMatchFields({ current: 100, max: 100 });
```

### Timeline Assertions

```typescript
// Check events pending
expect(game).timeline().toHaveEvents();
expect(game).timeline().toBeEmpty();
```

### Event History Assertions

```typescript
import { ExpectEvents } from '@blink/test';

const events = new ExpectEvents(test.getEventHistory());

events.toContainEvent('DoAttack');
events.toHaveEventCount('DoAttack', 3);
events.toHaveCount(5);
```

## Scenario Builder

Define complex test scenarios with a fluent DSL:

```typescript
import { Scenario } from '@blink/test';

const combatScenario = Scenario('Combat System')
  .describe('Tests the combat damage calculation')
  
  .step('Initial state')
    .do(() => {
      // Setup code
    })
    .expectEntity(0).toHaveField('Health', 'current', 100)
    .expect('Attacker should be level 1', (game) => 
      game.getComponent(0, 'Character')?.level === 1
    )
  
  .step('Execute attack')
    .do((game) => {
      test.scheduleEvent('DoAttack', 0, { source: 0 });
      test.step();
    })
    .expectEntity(1).toHaveFieldLessThan('Health', 'current', 50)
  
  .step('Verify damage applied')
    .do(() => {})
    .expect('Target took damage', (game) =>
      game.getComponent(1, 'Health')?.current < 50
    )
    
  .build();

// Run the scenario
test.scenario(combatScenario);
const results = await test.runScenarios();
```

## Fixtures

Pre-built entity configurations for common testing patterns:

```typescript
import { 
  createWarriorFixture, 
  createMageFixture, 
  createEnemyFixture,
  createCombatScenario,
} from '@blink/test';

// Create standard fixtures
const warrior = createWarriorFixture({ 
  name: 'Hero', 
  level: 5,
  health: 150,
  damage: 25 
});

const boss = createEnemyFixture({ 
  tier: 3, 
  isBoss: true 
});

// Create a full combat scenario
const scenario = createCombatScenario(test, {
  party: [warrior, createMageFixture()],
  enemies: [boss],
  autoStart: true,
  attackInterval: 0.1,
});

// Access entity IDs
console.log('Party:', scenario.partyIds);
console.log('Enemies:', scenario.enemyIds);

// Start combat manually if autoStart is false
scenario.startCombat();
```

## Reporters

### Console Reporter

```typescript
import { ConsoleReporter } from '@blink/test';

const reporter = new ConsoleReporter({
  colors: true,
  verbose: true,
  showTiming: true,
});

const results = await test.runScenarios();
reporter.report(results);
```

### JSON Reporter

```typescript
import { JSONReporter } from '@blink/test';

const reporter = new JSONReporter();
reporter.report(results);
// Output is valid JSON for CI/CD integration
```

### TAP Reporter

```typescript
import { TAPReporter } from '@blink/test';

const reporter = new TAPReporter();
reporter.report(results);
// Output follows Test Anything Protocol
```

## Example: Complete Test Suite

```typescript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { createTest, expect, Scenario, ConsoleReporter } from '@blink/test';
import gameIR from './my-game.ir.json';

describe('My Game Tests', () => {
  let test;

  beforeEach(() => {
    test = createTest({ verbose: false }).loadRules(gameIR);
  });

  afterEach(() => {
    test.destroy();
  });

  it('should initialize with correct state', () => {
    expect(test.getGame())
      .entity(0)
      .component('Health')
      .toHaveField('current', 100);
  });

  it('should apply damage correctly', () => {
    test.scheduleEvent('DoAttack', 0, { source: 0 });
    test.step();
    
    expect(test.getGame())
      .entity(1)
      .component('Health')
      .toHaveFieldLessThan('current', 100);
  });

  it('should run complete combat scenario', async () => {
    test.scenario(Scenario('Full Combat')
      .step('Setup')
        .do(() => {
          test.scheduleEvent('DoAttack', 0, { source: 0 });
        })
      .step('Execute')
        .do(() => test.runSteps(10))
        .expect('Combat resolved', () => !test.hasEvents())
      .build()
    );

    const results = await test.runScenarios();
    assert.ok(results.every(r => r.passed));
  });
});
```

## Integration with CI/CD

The framework outputs can be easily integrated with CI systems:

```bash
# Run tests with TAP output for CI
node --test --test-reporter tap dist/*.test.js

# Or use the built-in JSON reporter for structured output
```

## API Reference

### GameTest

| Method | Description |
|--------|-------------|
| `loadRules(ir)` | Load game rules from IR object |
| `loadRulesFromString(json)` | Load rules from JSON string |
| `scheduleEvent(type, delay, options)` | Schedule a game event |
| `step()` | Execute single event |
| `runUntilComplete(maxSteps)` | Run until no more events |
| `runSteps(count)` | Run specific number of steps |
| `runUntil(condition)` | Run until condition is true |
| `runUntilEvent(type)` | Run until event type occurs |
| `getComponent(id, name)` | Get entity component |
| `getField(id, comp, field)` | Get component field |
| `query(...components)` | Query entities |
| `getTime()` | Get simulation time |
| `getEventHistory()` | Get processed events |
| `getTrackerHistory()` | Get tracker outputs |
| `reset()` | Reset to initial state |
| `destroy()` | Cleanup resources |

### Assertion Methods

| Method | Description |
|--------|-------------|
| `toExist()` | Assert entity exists |
| `toHaveComponent(name)` | Assert has component |
| `toHaveField(field, value)` | Assert field equals value |
| `toHaveFieldGreaterThan(field, value)` | Assert field > value |
| `toHaveFieldLessThan(field, value)` | Assert field < value |
| `toHaveFieldBetween(field, min, max)` | Assert field in range |
| `toMatchFields(expected)` | Assert multiple fields |
| `not` | Negate next assertion |

## License

MIT
