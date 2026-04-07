# Blink Idle RPG - Engine BRL Tests

This directory contains small standalone BRL programs used by the test harness
(`npm run test:harness`) to validate the BRL → Rust compilation pipeline.

They are **engine test programs**.  The actual game is in `game/brl/` and is
deployed as a React web app to GitHub Pages.

## Contents

- `brl/counter.brl`  - Minimal counter: verifies scheduling and component updates
- `brl/combat.brl`   - Two-entity fight: verifies targeting, damage, and conditionals
- `brl/functions.brl` - User-defined functions and builtins
- `ir/`              - Pre-compiled IR files (auto-generated, not committed)

## Running

```bash
npm run test:harness   # compile + run all engine BRL tests (requires Rust)
```

## How It Works

The test harness (`packages/blink-engine-wasm/tests/e2e-test.ts`) compiles each
BRL file to Rust, builds a native binary with `cargo build`, runs it, and checks
for a valid JSON result.  This validates the entire BRL → Rust → binary pipeline.

## Adding a New Test

1. Write your `.brl` file in `brl/` — include at least a `GameStart` rule.
2. Add an entry to the `main()` function in `e2e-test.ts`.
3. Run `npm run test:harness` to verify.
