# Drop language-level "tracker" feature — 2026-01-04

Original goal
- Remove the language-level `tracker` feature from the compiler/IR and drop the runtime tracker subsystem from the TypeScript engine and demos.

What I did so far
- Removed runtime `TrackerSystem` usage and `onTracker` API from the TypeScript engine sources.
- Edited demos (`game/demos/combat-demo.html`, `game/demos/rpg-demo.html`) to remove `onTracker` subscriptions and `handleTrackerOutput` logic; replaced with simulation/component polling updates.
- Updated `packages/blink-engine` exports and types to stop exposing tracker APIs.
- Removed tracker examples from `packages/blink-engine/README.md` and engine docs.
- Updated `hielements.hie` and related docs to remove language/spec references to trackers.
- Updated/cleaned tests that depended on tracker runtime where practical.

Current blocker / observed issues
- Attempted to rebuild the Rust compiler and regenerate IR for demos, but the compiler failed to compile due to errors in `src/compiler/src/analyzer/mod.rs` (leftover `trackers` initializers and misplaced/duplicate `#[derive(...)]` annotations). Because the compiler didn't build, IR artifacts in `game/ir/` and `game/demos/data/` still contain `trackers` arrays and source_map BRL lines referencing `tracker` declarations.

Remaining TODO (tracked)
1. Fix compiler analyzer (`src/compiler/src/analyzer/mod.rs`) — in-progress
2. Rebuild compiler and regenerate IR for `simple-clicker`, `simple-combat`, and `classic-rpg` — not-started
3. Clean or regenerate existing IR JSON artifacts so they no longer include `trackers` — not-started
4. Rebuild the TypeScript engine and demo bundles (replace `blink-engine.bundle.js`) — not-started
5. Run unit tests for compiler and engine and fix fallout — not-started
6. Remove leftover tracker implementation files and exports (if any remain) — not-started
7. Final verification, update changelogs, and commit changes — not-started

Notes / next steps
- I'll continue by fixing the compiler analyzer source to remove leftover tracker references and correct the derives, then re-run `cargo build`/`cargo run` to regenerate IR. If you prefer a temporary manual scrub of IR JSON files rather than fixing the compiler immediately, say so and I can apply that as a stopgap (but regeneration is preferred).

File references
- Agent changelog: [agent-changelog/2026-01-04-drop-tracker-feature.md](agent-changelog/2026-01-04-drop-tracker-feature.md)
- Compiler analyzer: `src/compiler/src/analyzer/mod.rs`
- IR artifacts: `game/ir/` and `game/demos/data/`
- Engine entry: `packages/blink-engine/src/BlinkGame.ts`

Recorded by: agent (summarized actions from current workspace)
