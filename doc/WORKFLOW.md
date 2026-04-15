# Blink Idle RPG — Architecture & Workflow Guide

This document explains the end-to-end architecture, how data flows through the
system, and practical workflows for game developers and game designers.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        BUILD TIME (developer machine)                │
│                                                                      │
│   game/brl/*.brl                                                     │
│       │                                                              │
│       ▼                                                              │
│   @blink/compiler-ts  (TypeScript — lexer, parser, semantic, codegen)│
│       │                                                              │
│       ├──► scripts/compile-game-data.js                              │
│       │    Extracts entity data (enemies, heroes, scenarios, …)      │
│       │    → game/app/public/game-data/*.json                        │
│       │                                                              │
│       └──► 7 Rust source files:                                      │
│            components.rs   rules.rs   entities.rs   functions.rs     │
│            dispatch.rs     json_bridge.rs   lib.rs                   │
│                │                                                     │
│                ▼                                                     │
│   blink-runtime  (Rust library — ECS, Timeline, Events, RNG)        │
│       +  generated Rust code                                         │
│                │                                                     │
│                ├──► wasm-pack ──► .wasm binary + JS glue             │
│                │         (for the web app)                           │
│                │                                                     │
│                └──► cargo build ──► native binary                    │
│                          (for batch simulation / testing)            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                        RUN TIME                                      │
│                                                                      │
│   Web App (React + Vite)           Batch Simulator (Node.js CLI)     │
│   ─────────────────────            ────────────────────────────      │
│   Loads .wasm binary               Runs native binary                │
│   JS creates entities via          Reads game/data/*.json            │
│   BlinkWasmGame API                Pipes JSON config to binary       │
│   Reads snapshots between steps    Collects results, aggregates KPIs │
└──────────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Language | Purpose |
|---------|----------|---------|
| `packages/blink-runtime/` | Rust | Game engine library (ECS, timeline, events, RNG) |
| `packages/blink-compiler-ts/` | TypeScript | BRL → IR + Rust compiler |
| `packages/blink-engine-wasm-js/` | JS/Rust | Build pipeline: BRL → Rust → WASM binary |
| `packages/blink-engine-wasm/` | TypeScript | E2E test harness: BRL → Rust → native binary |
| `game/app/` | TypeScript/React | Web application |

---

## How Data Gets Into the Engine

The engine (Rust, compiled to WASM or native) has **no hardcoded game data**.
All data enters through exactly two channels:

### Channel 1: BRL Rules (compile-time)

**What**: Game logic — how combat works, how events chain, damage formulas,
spawn logic, level-up mechanics, victory conditions.

**Where**: `game/brl/*.brl`

**When**: At compile time. The BRL compiler translates rules into Rust code
that is baked into the WASM binary. Changing rules requires recompiling.

**Example**: "When a DoAttack event fires, calculate damage as
`attacker.Combat.damage - target.Combat.defense`, clamp to minimum 1,
subtract from target.Health.current."

### Channel 2: Entity Data (runtime)

**What**: All entity instances and their component values. This includes:

| Data | Entity IDs | Example fields |
|------|-----------|----------------|
| **Heroes** | 1..N | name, class, health, damage, skills, stats |
| **Enemy templates** | 100–108 | name, tier, HP, damage, speed, isBoss |
| **Game state** | 99 | currentWave, enemiesDefeated, tier tracking |
| **Spawn config** | 99 | bossEveryKills, healthScaleRate, initialEnemyCount |
| **Run stats** | 98 | simulationTime, retreatCount, penalties |
| **Flee config** | 97 | retreatTimePenalty, fleeCooldown |
| **Scoring rules** | 96 | pointsPerKill, pointsLostPerDeath, bonuses |
| **Score** | 96 | running totals for kills, waves, bosses |

**When**: At runtime, before the simulation starts. The caller (TypeScript in
the web app, or the batch tool) creates entities and attaches components via:

```
create_entity(id)
add_component(id, "ComponentName", json_fields)
```

**This is the key insight**: heroes are unknown until the player picks them.
Enemy stats, scoring rules, and spawn rates are tuneable parameters.  The
engine doesn't care where the data comes from — it just processes events
against whatever entities exist in the world.

### Data flow diagram

```
                   ┌─────────────────────────────┐
                   │  game/data/heroes.json       │ ← game designer edits
                   │  game/data/enemies.json      │
                   │  game/data/game-modes.json   │
                   │  game/data/parties.json      │
                   └──────────────┬──────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                                       ▼
    Web App (WasmSimEngine.ts)             Batch Tool (tools/simulate.js)
    Maps HeroDefinition → components       Reads JSON, maps to components
              │                                       │
              ▼                                       ▼
    BlinkWasmGame.create_entity()          Native binary reads JSON stdin
    BlinkWasmGame.add_component()          add_component_from_json()
              │                                       │
              ▼                                       ▼
    ┌─────────────────────────────────────────────────────┐
    │              Rust Engine (blink-runtime)             │
    │  World: entities + components                       │
    │  Timeline: scheduled events                         │
    │  Rules: compiled BRL logic                          │
    │                                                     │
    │  schedule_event("GameStart") → simulation runs      │
    └─────────────────────────────────────────────────────┘
```

---

## WASM State Model

WASM linear memory is **persistent** across calls. When JavaScript creates a
`BlinkWasmGame` object, it owns a Rust `Engine` struct that lives in WASM memory.

```typescript
const game = new BlinkWasmGame();   // Engine created in WASM memory
game.init_static();                 // Registers components, interns strings
game.create_entity(1);              // Entity 1 now exists in the world
game.add_component(1, "Health", JSON.stringify({ current: 100, max: 100 }));
game.step();                        // Pops one event, runs rules, mutates world
game.get_component(1, "Health");    // Returns CURRENT state: '{"current":85,"max":100}'
game.step();                        // Next event sees the mutated world
// ...
game.free();                        // Releases WASM memory
```

**JS can interleave reads and writes between steps.** This is how the web app
captures snapshots during the simulation — it runs batches of steps, reads
checkpoint data, then continues.

---

## Practical Workflows

### For Game Developers (writing code)

#### Initial setup

```bash
# Install Node.js dependencies
npm run setup

# Build the BRL compiler
npm run build:compiler:ts

# Build WASM (requires Rust + wasm-pack)
npm run build:wasm

# Copy WASM to web app
npm run install:wasm

# Start the web app
npm run dev:app
```

#### After changing BRL rules

BRL rules (`game/brl/*.brl`) define how the game works. After editing:

```bash
# Rebuild WASM (recompiles BRL → Rust → WASM)
npm run build:wasm
npm run install:wasm

# Test with E2E harness
npm run test:harness
```

#### After changing entity data

Entity data (enemies, hero classes, scenarios, world data, adventure templates,
skills) lives in BRL files in `game/brl/` and is compiled to JSON at build
time by `scripts/compile-game-data.js`:

```bash
npm run compile-game-data
npm run dev:app           # or build:app for production
```

The web app fetches the pre-compiled JSON files from `public/game-data/` at
runtime — it never parses BRL directly.

For the **batch tool**: Edit files in `game/data/`. No rebuild needed.

#### Full production build

```bash
npm run build    # compiler → WASM → install → web app
```

### For Game Designers (tuning balance)

Game designers work with JSON files in `game/data/` and the batch simulation
tool. No Rust or compiler knowledge needed.

#### 1. Edit game parameters

All tuneable parameters live in `game/data/`:

| File | What you can change |
|------|-------------------|
| `heroes.json` | Hero HP, damage, defense, speed, crit, skills per class |
| `enemies.json` | Enemy HP, damage, speed, tier, XP reward, boss flag |
| `game-modes.json` | Scoring (points per kill/death/boss), spawn rates, scaling |
| `parties.json` | Named party compositions for testing |

Example: Make Warriors tankier by editing `game/data/heroes.json`:
```json
"Warrior": {
  "health": 200,    ← was 160
  "defense": 12,    ← was 8
  ...
}
```

#### 2. Run batch simulations

```bash
# Run 20 games in normal mode with the balanced party
node tools/simulate.js --mode normal --runs 20

# Compare modes
node tools/simulate.js --mode normal,easy,hard --runs 50

# Test a specific party composition
node tools/simulate.js --mode normal --runs 30 --party glass_cannon

# Save results to JSON for further analysis
node tools/simulate.js --mode normal --runs 100 --output results.json

# List available parties
node tools/simulate.js --list-parties

# Use a custom data folder (e.g., experimental balance changes)
cp -r game/data game/data-experiment
# edit game/data-experiment/heroes.json
node tools/simulate.js --mode normal --runs 50 --data game/data-experiment
```

First run will compile BRL → Rust → native binary (takes ~1 minute).
Subsequent runs reuse the cached binary and are fast (~300ms per simulation).
Use `--rebuild` to force recompilation after BRL rule changes.

#### 3. Interpret results

```
── Running 20 simulations in "normal" mode ──
  run   1 seed=1: score=  3250 wave= 12 kills= 287 Victory
  run   2 seed=2: score=  2840 wave= 11 kills= 265 Victory
  ...

  ── KPIs for "normal" (20 runs) ──
  Win rate:     85.0%
  Mean score:   3045.5
  Median score: 3100
  p10/p90:      2400 / 3600
  Score stdev:  420.3
  Mean wave:    11.4
  Mean deaths:  2.35
  Mean time:    145.2s
```

**Target KPIs for balanced gameplay**:
- Normal mode win rate: 70-85%
- Mean deaths per run: 1-4
- Score spread (p10/p90 ratio): within 2x

#### 4. Iterate

1. Change a parameter in `game/data/`
2. Re-run: `node tools/simulate.js --mode normal --runs 50`
3. Compare KPIs
4. Repeat until balanced

**Note**: Changing `game/data/` only affects the batch tool. To see changes
in the web app, update the corresponding constants in
`game/app/src/engine/WasmSimEngine.ts`. A future improvement will have the
web app read from the same JSON files.

---

## Compilation Pipeline Detail

```
game/brl/classic-rpg.brl  ──┐
game/brl/heroes.brl        ──┤
                              ▼
                    @blink/compiler-ts
                    (codegen-rust.ts)
                              │
                    Generates 7 files:
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   components.rs         rules.rs           json_bridge.rs
   (struct defs)     (event handlers)    (JSON ↔ Rust serde)
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   blink-runtime       │
                  │   (Cargo dependency)  │
                  │   Engine, World,      │
                  │   Timeline, Events    │
                  └───────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼                               ▼
        wasm-pack build                 cargo build
        --target web                    (native)
              │                               │
              ▼                               ▼
        .wasm + .js                    simulate binary
        (browser)                      (batch testing)
```

### What each generated file does

| File | Contents |
|------|----------|
| `components.rs` | Rust structs for each BRL component (Health, Combat, etc.) |
| `entities.rs` | Entity initialization from BRL `entity` declarations |
| `rules.rs` | One Rust function per BRL `rule` — the game logic |
| `functions.rs` | User-defined BRL functions compiled to Rust |
| `dispatch.rs` | Event routing table: event type → matching rule functions |
| `json_bridge.rs` | `add_component_from_json()` and `get_component_json()` — how JS/native code sends and reads component data |
| `lib.rs` | Crate entry point: `init_game()`, `step()`, `run_steps()`, string interning constants |

---

## Entity ID Conventions

| Range | Purpose |
|-------|---------|
| 1–N | Player heroes (N = party size, typically 4-6) |
| 96 | Scoring rules + running score |
| 97 | Flee configuration |
| 98 | Run statistics |
| 99 | Game state + spawn config + progress tracker |
| 100–108 | Enemy templates (goblin through Lord Vexar) |
| 200+ | Spawned enemy instances (created dynamically by BRL rules) |
