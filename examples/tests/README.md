# Example Tests for Blink Idle RPG

This directory contains example tests demonstrating how to use the `@blink/test` testing framework.

## Files

- `combat-rules.test.ts` - Example tests for combat rules
- `progression-rules.test.ts` - Example tests for leveling and progression

## Running Examples

First, build the test framework and engine:

```bash
cd packages/blink-engine && npm install && npm run build
cd packages/blink-test && npm install && npm run build
```

Then run the example tests:

```bash
cd examples/tests
npx ts-node combat-rules.test.ts
```

Or compile and run:

```bash
npx tsc *.ts
node combat-rules.test.js
```

## Writing Your Own Tests

See `combat-rules.test.ts` for a complete example of:

1. Loading game rules (IR)
2. Setting up test entities
3. Scheduling events
4. Running the simulation
5. Asserting game state
6. Using the fluent assertion API
7. Building test scenarios with the DSL
