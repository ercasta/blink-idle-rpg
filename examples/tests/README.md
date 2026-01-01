# Example Tests for Blink Idle RPG

This directory contains example tests demonstrating how to use the `@blink/test` testing framework and test game rules.

## Files

- `combat-rules.test.ts` - Example tests demonstrating the testing framework usage patterns
- `classic-rpg.test.ts` - Tests for the classic RPG game mechanics
- `boss-spawn.test.ts` - Tests for boss spawn requirements (currently needs IR with init_entities)

## Running Examples

Use the Makefile from the project root:

```bash
# Run all example tests
make test-examples

# Or build and test manually
cd examples/tests
npm install
npm test
```

## Known Issues

- `boss-spawn.test.ts`: Currently failing because the classic-rpg.ir.json doesn't include init_entities. This test was originally written with access to internal engine state and needs to be refactored to work with the public API.

## Writing Your Own Tests

See `combat-rules.test.ts` for a complete example of:

1. Loading game rules (IR)
2. Setting up test entities
3. Scheduling events
4. Running the simulation
5. Asserting game state
6. Using the fluent assertion API
7. Building test scenarios with the DSL

