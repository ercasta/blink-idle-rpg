# Blink Idle RPG — Introduction

Blink Idle RPG is an idle RPG where you define a party and decision rules, then the
entire game runs autonomously. Designers author game rules in BRL (Blink Rule
Language) and provide content (heroes, enemies, scenarios). The engine executes
the rules on a timeline-based simulation and captures progress snapshots for a
short animated replay.

Key points:
- Game type: Wave-based idle RPG with tiers and a final boss.
- Workflow: write BRL → compile to IR → (optionally) generate Rust → build WASM
- Runtime: Rust `blink-runtime` compiled to WASM; entity data injected at runtime
- Designer tools: `tools/simulate.js` for batch runs; `game/data/*.json` for
  runtime content

See the BRL reference and user guide in the `brl/` folder, game design details in
`game-design/`, and engine architecture in `architecture/`.
