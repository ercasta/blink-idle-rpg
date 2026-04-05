# WASM Engine Completion & Web Integration Design

**Version**: 0.1.0  
**Status**: Draft  
**Last Updated**: 2026-04-05  
**Supersedes / extends**: `doc/engine/wasm-engine-plan.md`, `doc/web-interface-design.md` (sections 6, 4.7)

---

## Table of Contents

1. [What This Document Covers](#1-what-this-document-covers)
2. [WASM Engine Completion: Gap Analysis](#2-wasm-engine-completion-gap-analysis)
3. [Hero Data Integration (QR → Engine)](#3-hero-data-integration-qr--engine)
4. [Stepping Strategy: Simulation vs UI Updates](#4-stepping-strategy-simulation-vs-ui-updates)
5. [Web Interface Integration Architecture](#5-web-interface-integration-architecture)
6. [Package Structure Changes](#6-package-structure-changes)
7. [Implementation Sequence](#7-implementation-sequence)
8. [Open Points](#8-open-points)
9. [Decision Log](#9-decision-log)

---

## 1. What This Document Covers

`doc/engine/wasm-engine-plan.md` (v0.2.0) defined the high-level WASM architecture (Approach D: BRL → Rust → WASM) and planned the four implementation phases. The plan is sound and the first half of Phase 1 is done. However, three concrete design gaps emerged when trying to connect the WASM engine to the web interface defined in `doc/web-interface-design.md`:

1. **WASM completion** — The `blink-runtime` crate and the BRL → Rust codegen exist but do not yet produce a WASM-callable module; the wasm-bindgen layer is entirely absent.
2. **Data integration** — The web interface design assumes hero data (loaded from a QR code) can be injected into the engine at runtime, but the current engine design has no mechanism for this.
3. **Stepping** — The simulation is event-driven and may complete in milliseconds, yet the UI must display approximately 30 meaningful progress updates to the player, one per second. The design has not yet specified how these two time scales are reconciled.

This document fills those gaps with concrete design decisions.

---

## 2. WASM Engine Completion: Gap Analysis

### 2.1 What Is Already Done

| Component | Status | Location |
|---|---|---|
| `blink-runtime` Rust crate — ECS World | ✅ Done | `packages/blink-runtime/src/world.rs` |
| `blink-runtime` — Timeline (binary heap) | ✅ Done | `packages/blink-runtime/src/timeline.rs` |
| `blink-runtime` — Event struct | ✅ Done | `packages/blink-runtime/src/event.rs` |
| `blink-runtime` — Value enum | ✅ Done | `packages/blink-runtime/src/value.rs` |
| `blink-runtime` — String interning | ✅ Done | `packages/blink-runtime/src/interning.rs` |
| `blink-runtime` — Built-in functions (min, max, floor, random…) | ✅ Done | `packages/blink-runtime/src/builtins.rs` |
| `blink-runtime` — Engine struct (orchestrates World + Timeline) | ✅ Done | `packages/blink-runtime/src/lib.rs` |
| BRL → Rust codegen — components, entities, rules, functions, dispatch | ✅ Done | `packages/blink-compiler-ts/src/codegen-rust.ts` |
| BRL → Rust codegen — `init_game`, `step`, `run_steps` native functions | ✅ Done | `packages/blink-compiler-ts/src/codegen-rust.ts` |
| End-to-end test harness (BRL → Rust → native binary → run) | ✅ Done | `packages/blink-engine-wasm/tests/e2e-test.ts` |
| Makefile targets (`build-runtime`, `test-runtime`, `test-wasm`) | ✅ Done | `Makefile` |

### 2.2 What Is Missing

#### 2.2.1 wasm-bindgen Layer (blocker for browser usage)

The current `blink-runtime` `Cargo.toml` declares `crate-type = ["rlib"]`. This compiles as a Rust library dependency only — it cannot be loaded by a browser. WASM browser loading requires `crate-type = ["cdylib", "rlib"]` plus `wasm-bindgen`.

**Missing pieces:**

- `[dependencies]` in `blink-runtime/Cargo.toml` does not include `wasm-bindgen`.
- No `exports.rs` file exists in `packages/blink-runtime/src/`. The plan mentions this file but it was never created.
- The generated `lib.rs` from `codegen-rust.ts` exposes `init_game`, `step`, and `run_steps` as plain Rust functions — correct for native/test builds, but they are not annotated with `#[wasm_bindgen]` and therefore not callable from JavaScript.

**What needs to be added:**

A new `packages/blink-runtime/src/exports.rs` module that wraps the engine behind a `#[wasm_bindgen]` API. The API surface defined in `wasm-engine-plan.md` §4.2 remains the right design; it just needs to be built. See §3 and §4 below for additions to that API to support hero injection and snapshot stepping.

The generated crate's `lib.rs` should additionally include `#[cfg(target_arch = "wasm32")]` conditional compilation to re-export the wasm-bindgen handle when targeting WASM and the plain `Engine` when targeting native.

#### 2.2.2 `blink-engine-wasm-js` TypeScript Wrapper Package (blocker for web app)

The plan describes `packages/blink-engine-wasm-js/` but this package does not yet exist. Without it:

- The React app has no typed API to load the WASM module.
- No Web Worker integration exists.
- The `IBlinkEngine` abstraction interface referenced in `web-interface-design.md` §6.1 is not defined anywhere.

#### 2.2.3 wasm-pack Build Pipeline

There is no `wasm-pack build` step in the Makefile. The `test-wasm` target currently tests native builds only. A `build-wasm` target is needed that:

1. Runs the BRL → Rust codegen for the game BRL files.
2. Runs `cargo build --target wasm32-unknown-unknown --release` in the generated crate.
3. Runs `wasm-pack build --target web` to produce the JS glue and `.wasm` file.
4. Copies the output to `game/demos/` or a location Vite can serve.

#### 2.2.4 Hero Entity Injection API (data integration — see §3)

The `Engine` struct has no method to inject runtime data (hero stats, behaviour bytes, skills). Everything is initialised from the compiled BRL `init_game` function. This is insufficient — the web app must load hero data from QR codes at runtime. A runtime entity injection API is needed.

#### 2.2.5 Snapshot Stepping API (UI sync — see §4)

The `Engine` can call `run_steps(n)` to process N events, and `get_state_json()` to export state, but neither function is aware of "game progress". The UI needs to know when the simulation has reached a meaningful progress checkpoint (a wave completion, a level-up, etc.) so it can display a snapshot. This needs a progress-tracking mechanism.

### 2.3 Gap Summary Table

| Gap | Impact | Effort | Where Addressed |
|---|---|---|---|
| wasm-bindgen missing from runtime | Browser cannot load engine | Medium | §2.2.1, §6 |
| No `exports.rs` WASM API | No JS ↔ WASM boundary | Medium | §2.2.1, §5 |
| Generated `lib.rs` not WASM-annotated | Generated code not callable from JS | Low | §2.2.1 |
| `blink-engine-wasm-js` package absent | React app has no engine API | Medium | §5 |
| `IBlinkEngine` interface absent | No engine abstraction | Low | §5.1 |
| No hero injection API | Cannot load QR heroes into engine | High | §3 |
| No snapshot stepping API | UI sync undefined | High | §4 |
| No `build-wasm` Makefile target | Cannot produce `.wasm` for browser | Medium | §6 |

---

## 3. Hero Data Integration (QR → Engine)

### 3.1 The Problem

`web-interface-design.md` §6.4 originally proposed merging hero data into the IR JSON before loading the engine. This was subsequently rejected: "at runtime we're not going to work with the IR. The Engine must expose an interface allowing to set entities / components, that's how we'll load the initial state."

The `blink_runtime` `Engine` struct currently has no such interface. The only way to create entities is via the BRL-compiled `init_game` function, which is baked into the WASM binary.

### 3.2 Design: Compile-Time Templates, Runtime Instantiation

The game BRL defines **template entities** for heroes and enemies (marked with, e.g., `HeroTemplate { isTemplate: true }`). Generated code already supports entity cloning (the `clone` BRL statement). The missing piece is a way to **set specific component field values on a cloned entity from outside the simulation**.

We define a two-phase initialisation protocol:

```
Phase A (compile time, in BRL):
  Define hero template entities with default values.
  Rules reference HeroTemplate entities for class mechanics.

Phase B (runtime, via new API):
  The JS wrapper clones a hero template entity and patches its component
  fields with the player's QR-encoded values (name, stats, skills, behaviour bytes).
  The modified entity replaces the template before GameStart is fired.
```

This keeps all game logic in BRL while allowing runtime personalisation.

### 3.3 New Engine API: `set_component_field`

The WASM exports module (`exports.rs`) will expose a JSON-based field-setting API:

```rust
/// Apply a JSON patch to an entity's components.
/// JSON format: { "ComponentName": { "fieldName": value, ... }, ... }
/// Creates the component (with default values) if not already present.
/// The entity must exist (spawned by init_game or clone_entity).
#[wasm_bindgen]
pub fn patch_entity(handle: u32, entity_id: u32, patch_json: &str) -> Result<(), JsValue>;

/// Clone an existing entity (by variable name from BRL source) and return the new entity ID.
/// Use this to instantiate a hero from the template entity.
#[wasm_bindgen]
pub fn clone_named_entity(handle: u32, variable_name: &str) -> u32;

/// Get the entity ID for a named entity (from BRL variable name).
#[wasm_bindgen]
pub fn get_named_entity(handle: u32, variable_name: &str) -> u32;
```

The existing generated code already tracks entity variable names in `World.entity_variables` (added via `spawn_named`). `clone_named_entity` looks up the entity by variable name, clones it (copying all components), and returns the new ID. `patch_entity` then applies the hero's QR data onto the cloned entity.

**The `patch_entity` function requires type-erased component field mutation.** The generated `components.rs` file will include a companion registry that maps `(component_name, field_name) → setter_closure`. This is generated once per game BRL and registered at `init_game` time:

```rust
// Generated in components.rs alongside each component struct:
pub fn register_field_setters(registry: &mut FieldSetterRegistry) {
    registry.register("Health", "current",
        |world: &mut World, id: EntityId, val: &serde_json::Value| {
            world.get_mut::<Health>(id).current = val.as_i64().unwrap_or(0);
        }
    );
    registry.register("Health", "max",
        |world: &mut World, id: EntityId, val: &serde_json::Value| {
            world.get_mut::<Health>(id).max = val.as_i64().unwrap_or(0);
        }
    );
    // ... one entry per field of each component
}
```

The `FieldSetterRegistry` is a `HashMap<(String, String), Box<dyn Fn(&mut World, EntityId, &serde_json::Value)>>` stored on the `Engine`. `init_game` calls all `register_field_setters` functions generated per module.

This mechanism is entirely generated — no manual updates are needed when BRL component definitions change. The `codegen-rust.ts` must be extended to emit `register_field_setters` alongside the component structs.

### 3.4 Hero Injection Flow (JavaScript side)

```typescript
// In the Web Worker, after WASM is loaded and engine is initialised:

// 1. init_game() already ran — template hero entity exists (e.g., BRL variable "hero_template")
// 2. Clone the template to get a fresh hero entity
const heroEntityId = wasmEngine.clone_named_entity(handle, "hero_template");

// 3. Build the patch JSON from the QR hero data
const patch = buildHeroPatch(qrHero);  // see §3.5

// 4. Apply the patch to set stats, skills, behaviour bytes
wasmEngine.patch_entity(handle, heroEntityId, JSON.stringify(patch));

// 5. Remove the template flag so rules treat this as a real hero
wasmEngine.patch_entity(handle, heroEntityId, JSON.stringify({
  HeroTemplate: { isTemplate: false }
}));

// 6. Repeat for each hero in the party (up to 6)
// 7. Now fire GameStart — simulation begins
wasmEngine.schedule_event(handle, JSON.stringify({ type: "GameStart" }));
```

### 3.5 QR Hero → Component Field Mapping

The `blink-qr` package's `QRHero` struct maps to component fields as follows. This mapping is the contract between the QR encoding and the engine; it must be kept in sync with the BRL component definitions.

| QR Field | Component | Field | Notes |
|---|---|---|---|
| `qrHero.name` | `Character` | `name` (interned string) | Max 24 ASCII chars |
| `qrHero.classId` | `Character` | `class` (interned string) | 0=Warrior,…,5=Cleric; must match BRL class names |
| `qrHero.baseStats.str` | `Stats` | `strength` | 0–15 (4 bits) |
| `qrHero.baseStats.dex` | `Stats` | `dexterity` | 0–15 |
| `qrHero.baseStats.int` | `Stats` | `intelligence` | 0–15 |
| `qrHero.baseStats.con` | `Stats` | `constitution` | 0–15 |
| `qrHero.baseStats.wis` | `Stats` | `wisdom` | 0–15 |
| `qrHero.growthRates.str` | `Stats` | `strength_growth` | 0–7 (3 bits) |
| … (same pattern for all 5 stats) | | | |
| `qrHero.skills[0..9]` | `Skills` | `unlock_order` (list<integer>) | Skill IDs in unlock order |
| `qrHero.earlyBehaviour.bytes[0..11]` | `DecisionValues` | `values[0..11]` (list<integer>) | 12 decision values for early game |
| `qrHero.earlyBehaviour.primarySkillId` | `BehaviourSlots` | `early_primary` | Skill ID |
| `qrHero.earlyBehaviour.secondarySkillId` | `BehaviourSlots` | `early_secondary` | Skill ID |
| `qrHero.earlyBehaviour.passiveSkillId` | `BehaviourSlots` | `early_passive` | Skill ID |
| `qrHero.midBehaviour.*` | `DecisionValues`, `BehaviourSlots` | `mid_*` fields | Same pattern |
| `qrHero.midLevelTrigger` | `BehaviourPhase` | `mid_trigger_level` | Level 2–48 |
| `qrHero.endBehaviour.*` | `DecisionValues`, `BehaviourSlots` | `end_*` fields | Same pattern |
| `qrHero.endLevelTrigger` | `BehaviourPhase` | `end_trigger_level` | Level 3–49 |

> **Note**: Behaviour bytes 12–23 (as stored in QR) are reserved and not mapped to any component field in the initial implementation. Bytes 0–11 map directly to the 12 named decision values. The QR format already stores 24 bytes per phase for future extensibility.

The `buildHeroPatch(qrHero: QRHero): Record<string, Record<string, unknown>>` function lives in `packages/blink-engine-wasm-js/src/hero-patch-builder.ts`. It is the single authoritative location for this mapping.

### 3.6 Non-Hero Initial State (Enemies, Game Config)

Enemy stats, level definitions, game configuration, and the game-mode parameters are **not** loaded from QR codes. They come from the BRL source files and are compiled into the WASM binary by `init_game`. This means:

- Changing enemy stats requires recompiling the BRL → Rust → WASM pipeline.
- The game mode (Casual, Normal, etc.) is communicated to the engine via a `schedule_event` call with a `GameMode` field, not via entity injection. The mode parameters must be defined in BRL and the engine reacts to the mode event field.

This is intentional: non-hero data is game design data, not player data. It should be controlled by the game author (via BRL), not player-configurable.

---

## 4. Stepping Strategy: Simulation vs UI Updates

### 4.1 The Problem

The Blink simulation is event-driven. A complete run (e.g., ~30 waves of combat) may contain tens of thousands of events and may execute in under 100 milliseconds of real time in the WASM engine. However, the UI must show the player approximately 30 meaningful progress updates, displayed at roughly one update per second.

These two time scales — WASM simulation time and player-perceived UI time — are entirely independent and must be deliberately decoupled.

### 4.2 The Two-Phase Model

**Phase 1 — Full simulation (background, fast)**

When the player starts a run, the WASM engine in the Web Worker runs the full simulation to completion as fast as possible. The engine records **progress snapshots** at defined milestones (see §4.3). This phase takes less than a second on any modern device. The Worker posts a single message to the main thread when simulation is complete: `{ type: 'simulation_complete', snapshots: [...] }`.

**Phase 2 — Playback (foreground, timed)**

The main thread (React) receives the array of progress snapshots and plays them back to the player at one snapshot per second using `setInterval` (or `requestAnimationFrame` with a frame counter). Each snapshot replaces the previous rendered state. No further WASM calls are needed during playback.

This fully decouples the simulation from the UI. The UI simply animates through a pre-computed array.

```
[WORKER]                           [MAIN THREAD / REACT]
init engine
inject heroes
schedule GameStart
run full simulation
  → record 30 snapshots
post { type: 'complete', snapshots }
                                    receive snapshots array
                                    setInterval(1000ms):
                                      render snapshots[i++]
                                    show results screen when done
```

### 4.3 Progress Snapshots: What and When

A **progress snapshot** captures the full visible game state at a defined moment in the simulation. The UI renders one snapshot per second.

**When to snapshot**: The BRL game logic defines "wave complete" and "level up" events. The generated code registers a **snapshot hook** that fires after each such event. Specifically, the engine records a snapshot when the `WaveComplete` event is processed.

The target number of snapshots is approximately 30 (to fill ~30 seconds of playback at 1/sec). This is a game-design parameter: if the game has 20 waves, there are 20 wave-complete snapshots plus any intermediate snapshots for boss encounters, hero deaths, etc. The exact count depends on game design.

**Snapshot content**:

```typescript
// packages/blink-engine-wasm-js/src/types.ts
export interface ProgressSnapshot {
  // Simulation metadata
  simulationTime: number;          // Engine time at this checkpoint
  progressIndex: number;           // Sequential snapshot index (0..N-1)
  checkpointType: 'wave_complete' | 'boss_killed' | 'hero_died' | 'game_over';

  // Score / progress
  wave: number;
  tier: number;
  score: number;
  enemiesDefeated: number;

  // Hero states (one per hero in the party)
  heroes: HeroState[];

  // Notable events since the previous snapshot (for combat log display)
  log: LogEntry[];
}

export interface HeroState {
  entityId: number;
  name: string;
  class: string;
  level: number;
  hp: number;
  maxHp: number;
  isAlive: boolean;
}

export interface LogEntry {
  type: 'attack' | 'death' | 'levelup' | 'skill' | 'wave_complete';
  actorName: string;
  targetName?: string;
  value?: number;    // damage, heal amount, new level, etc.
  skillName?: string;
}
```

**How the engine records log entries**: The BRL rule for `DoAttack`, `HeroDeath`, etc. will call a built-in function `log_event(type, actor, target, value)`. This is a new built-in that writes to the engine's log buffer. The WASM export `drain_log_json(handle)` returns all log entries since the last drain as a JSON array. The Worker calls `drain_log_json` after each wave to populate `ProgressSnapshot.log`.

Alternatively (simpler), the generated dispatch function calls a Rust function `maybe_record_snapshot(engine)` after each event that checks whether the event type is a snapshot trigger. This avoids adding a new BRL built-in and keeps all snapshot logic in the runtime.

> **Decision OI-4-S (snapshot trigger mechanism)**: Use the second approach — post-event hook in the generated dispatch function. Simpler and requires no BRL changes.

### 4.4 Snapshot Recording in the Engine

The `Engine` struct gains two new fields:

```rust
pub struct Engine {
    pub world: World,
    pub timeline: Timeline,
    pub interner: StringInterner,
    pub rng: Rng,
    max_while_iterations: u32,

    // ── NEW ──
    /// Accumulated log entries since the last drain.
    pub log_buffer: Vec<LogRecord>,
    /// Snapshot trigger event names (interned at init time).
    pub snapshot_triggers: Vec<InternedString>,
}
```

A `LogRecord` is a small Rust struct (event type, entity IDs, optional values) that is serialised to JSON only when the Worker calls `drain_log_json`.

`snapshot_triggers` is populated at init time with the interned strings of events that should cause a snapshot: `"WaveComplete"`, `"BossKilled"`, `"GameOver"`. Generated code calls `engine.record_log_if_applicable(&event)` at the end of each dispatch call.

The Worker's simulation loop:

```typescript
// In the Web Worker
const MAX_STEPS_PER_BATCH = 10_000;
const snapshots: ProgressSnapshot[] = [];

while (wasmEngine.has_events(handle)) {
  wasmEngine.run_steps(handle, MAX_STEPS_PER_BATCH);

  // Drain any new snapshots that fired during this batch
  const newSnapshots: ProgressSnapshot[] = JSON.parse(
    wasmEngine.drain_snapshots_json(handle)
  );
  snapshots.push(...newSnapshots);
}

// Simulation complete — send all snapshots to main thread
postMessage({ type: 'simulation_complete', snapshots });
```

`drain_snapshots_json` is a new WASM export that serialises any accumulated snapshots and clears the snapshot buffer.

### 4.5 Event Log: What the Player Sees

The battle screen decision (from `web-interface-design.md` §4.7) is:

> "the interface must be much simpler. Consider the game with progress by steps of... 10 encounters? So I'd just show the player levels, and some aggregated metrics, such as an overall score, a progress indicator."

This simplifies the log requirement significantly. The `ProgressSnapshot.log` needs only:
- Number of enemies killed this wave
- Hero HP at end of wave
- Hero level-ups (if any)
- Whether any hero died

The full per-event combat log (every attack, every skill activation) is **not needed** for the player-facing UI. It may be useful in a future "Studio" debug view. The log buffer is therefore small (bounded by game design events, not simulation events).

### 4.6 Speed / Real-Time Mode

The design above does not support real-time speed controls (1× / 2× / 5× etc.) because the simulation runs fully ahead. This is intentional:

- Real-time mode requires the simulation to be coupled to the wall clock, which adds complexity and is not needed for an idle game.
- The "playback at 1/sec" model provides a clear, understandable progress view without any wall-clock dependency on the simulation.

A future "real-time" option (where the player watches the simulation as it happens) would require a fundamentally different architecture (Worker posting state updates as the simulation runs, rather than after). Defer to v2.

---

## 5. Web Interface Integration Architecture

### 5.1 `IBlinkEngine` Interface

The battle screen and game context only interact with an abstract `IBlinkEngine` interface. This exists in `packages/blink-engine-wasm-js/src/types.ts` (same package as the WASM wrapper, since the WASM engine is now the sole production engine):

```typescript
// packages/blink-engine-wasm-js/src/types.ts

export interface QRHero {
  // Hero data decoded from the QR format
  // (full definition in packages/blink-qr/src/hero-types.ts)
  name: string;
  classId: number;
  baseStats: { str: number; dex: number; int: number; con: number; wis: number };
  growthRates: { str: number; dex: number; int: number; con: number; wis: number };
  skills: number[];   // skill IDs in unlock order
  earlyBehaviour: BehaviourPhase;
  midBehaviour?: BehaviourPhase;
  midLevelTrigger?: number;
  endBehaviour?: BehaviourPhase;
  endLevelTrigger?: number;
}

export interface BehaviourPhase {
  bytes: number[];          // 12 decision values (indices 0–11)
  primarySkillId: number;
  secondarySkillId: number;
  passiveSkillId: number;
}

export interface RunConfig {
  heroes: QRHero[];           // 1–6 heroes from the roster
  gameMode: string;           // 'casual' | 'normal' | 'hardcore' | 'speedrun' | 'endless'
}

export interface IBlinkEngine {
  /** Start a full run. Returns a promise that resolves when the simulation is complete.
   *  The returned array contains one snapshot per progress checkpoint. */
  run(config: RunConfig): Promise<ProgressSnapshot[]>;

  /** Cancel a running simulation (if any). */
  cancel(): void;

  /** Release WASM resources. */
  destroy(): void;
}
```

The interface is intentionally minimal. The game is not interactive during simulation — there is no `scheduleEvent` from the UI during a run (a "Retreat" would cancel the run and show partial results). This simplification is consistent with the idle game design.

### 5.2 Web Worker Architecture

The WASM engine always runs in a Web Worker. The TypeScript wrapper creates the Worker lazily when `run()` is called and terminates it when `cancel()` or `destroy()` is called.

```
[Main Thread]                         [Worker (blink-engine.worker.ts)]
                                      (lazy: only created on first run())

BlinkEngineWrapper.run(config)
  → create Worker if not existing
  → postMessage({ type: 'run', config })
                                      onmessage({ type: 'run', config }):
                                        loadWasm()  [once, cached]
                                        init_game()
                                        injectHeroes(config.heroes)
                                        schedule_event('GameStart', { mode: config.gameMode })
                                        runUntilComplete() → collect snapshots
                                        postMessage({ type: 'complete', snapshots })

  ← receive { type: 'complete', snapshots }
  → resolve promise with snapshots

  UI plays back snapshots at 1/sec
```

The Worker file (`blink-engine.worker.ts`) is bundled separately by Vite using the `?worker` import syntax:

```typescript
// In game/app/src/context/RunContext.tsx
import EngineWorker from '../workers/blink-engine.worker?worker';
```

**Worker message protocol**:

```typescript
// Main → Worker messages
type MainToWorkerMessage =
  | { type: 'run'; config: RunConfig }
  | { type: 'cancel' };

// Worker → Main messages
type WorkerToMainMessage =
  | { type: 'complete'; snapshots: ProgressSnapshot[] }
  | { type: 'error'; message: string; detail?: string };
```

No progress messages are sent during simulation (the simulation is fast enough that intermediate progress is not needed). If future UX requires a loading indicator, a single `{ type: 'progress'; percent: number }` message could be added after each batch.

### 5.3 WASM Module Loading

The Worker loads the WASM module using `WebAssembly.instantiateStreaming()` on first use. The compiled `.wasm` file is served as a static asset by Vite from `game/demos/` (or a dedicated `game/wasm/` directory).

The WASM module is cached in the Worker's scope (module-level variable) across multiple `run()` calls in the same session, so the per-run overhead is only the engine `init_game()` and hero injection — not re-instantiation.

WASM module caching across sessions (IndexedDB via `WebAssembly.compileStreaming`) is deferred to v2; it adds complexity for a modest startup benefit.

### 5.4 React Integration

The battle screen communicates with the engine via a `RunContext`:

```typescript
// game/app/src/context/RunContext.tsx
export interface RunContextValue {
  isRunning: boolean;
  snapshots: ProgressSnapshot[];
  currentSnapshotIndex: number;
  startRun(config: RunConfig): void;
  cancelRun(): void;
}
```

`startRun` creates a `BlinkEngineWrapper`, calls `run(config)`, and when the promise resolves, stores the snapshots array in context state. The battle screen then animates through snapshots using a `useEffect` + `setInterval`.

---

## 6. Package Structure Changes

### 6.1 Changes to Existing Packages

**`packages/blink-runtime/Cargo.toml`** — changes:
```toml
[lib]
# rlib for test/native builds; cdylib for wasm-pack
crate-type = ["cdylib", "rlib"]

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
wasm-bindgen = { version = "0.2", optional = true }
serde-wasm-bindgen = { version = "0.6", optional = true }

[features]
wasm = ["wasm-bindgen", "serde-wasm-bindgen"]
```

Building for native (tests): `cargo build` (no feature flags).  
Building for WASM: `wasm-pack build --features wasm`.

**`packages/blink-runtime/src/`** — new file:

- `exports.rs` — `#[wasm_bindgen]` annotated functions (`create_engine`, `step`, `run_steps`, `get_state_json`, `clone_named_entity`, `patch_entity`, `drain_snapshots_json`, `drain_log_json`, `schedule_event`, `has_events`, `get_time`, `destroy_engine`, `reset`).
- `field_registry.rs` — `FieldSetterRegistry` struct used by `patch_entity`.

**`packages/blink-compiler-ts/src/codegen-rust.ts`** — additions:

- Emit `register_field_setters(registry: &mut FieldSetterRegistry)` in `components.rs` for every field of every component.
- Call `register_field_setters` in the generated `init_game` function.
- Add `maybe_record_snapshot(engine, &event)` call at the end of each `dispatch_event` arm.

### 6.2 New Package: `packages/blink-engine-wasm-js`

```
packages/blink-engine-wasm-js/
├── package.json                 # name: @blink/engine-wasm, main: dist/index.js
├── tsconfig.json
├── src/
│   ├── index.ts                 # Re-exports BlinkEngineWrapper and types
│   ├── types.ts                 # QRHero, RunConfig, ProgressSnapshot, IBlinkEngine
│   ├── BlinkEngineWrapper.ts    # IBlinkEngine implementation; manages the Worker
│   ├── hero-patch-builder.ts    # buildHeroPatch(qrHero) → component patch JSON
│   └── worker/
│       └── blink-engine.worker.ts  # Web Worker: loads WASM, runs simulation
└── tests/
    └── hero-patch-builder.test.ts  # Unit tests for the QR → patch mapping
```

### 6.3 Makefile Additions

```makefile
# Build WASM module from game BRL files (requires cargo + wasm-pack)
build-wasm: build-compiler-ts
    @command -v wasm-pack >/dev/null 2>&1 || (echo "wasm-pack not installed"; exit 1)
    @echo "Generating Rust from BRL..."
    cd packages/blink-compiler-ts && node dist/index.js compile \
        --target rust \
        --input ../../game/brl/*.brl \
        --output ../../packages/blink-engine-wasm/generated/src/
    @echo "Building WASM module..."
    cd packages/blink-engine-wasm/generated && \
        wasm-pack build --release --target web --features wasm \
        --out-dir ../../../../game/wasm/
    @echo "WASM build complete → game/wasm/"
```

---

## 7. Implementation Sequence

The following order minimises blocking dependencies and allows the web app to work before the full WASM pipeline is complete.

### Step 1: `IBlinkEngine` interface + `ProgressSnapshot` types (no WASM needed)

Define the TypeScript types in `packages/blink-engine-wasm-js/src/types.ts`. No Rust work required. This unblocks the React battle screen and `RunContext` implementation.

**Deliverable**: The battle screen can be built and tested with a stub engine that returns hardcoded snapshots.

### Step 2: `FieldSetterRegistry` + `patch_entity` (Rust)

Add `field_registry.rs` to `blink-runtime`. Extend `codegen-rust.ts` to emit `register_field_setters`. Build and test natively (no WASM needed yet). Validate by running `test-wasm` (native builds).

**Deliverable**: The engine can accept runtime hero data. Validate in the existing e2e test by injecting a test hero after `init_game`.

### Step 3: Snapshot recording (Rust)

Add `log_buffer` and `snapshot_triggers` to `Engine`. Implement `maybe_record_snapshot`. Implement `drain_snapshots_json`. Add snapshot trigger calls to the generated dispatch. Test natively.

**Deliverable**: The e2e test can verify that snapshots are recorded at the correct moments.

### Step 4: `wasm-bindgen` layer (WASM exports)

Add `wasm-bindgen` dependency. Create `exports.rs`. Add `build-wasm` Makefile target. Verify that `wasm-pack build` succeeds and the resulting JS glue is correct.

**Deliverable**: A `.wasm` file that can be loaded in a browser and responds to `create_engine`, `init_game`, `run_steps`, etc.

### Step 5: `blink-engine-wasm-js` package + Web Worker

Create the `BlinkEngineWrapper` and Worker. Wire the Worker to call Steps 2–4. Test in a standalone HTML page (`game/demos/rpg-demo-wasm.html`).

**Deliverable**: A demo page that runs a complete simulation and dumps snapshots to the console.

### Step 6: React integration

Implement `RunContext`, wire `BattleScreen` to play back snapshots, implement the 1/sec `setInterval` animation.

**Deliverable**: The battle screen shows meaningful progress during a run.

### Step 7: Hero injection in the UI flow

Implement `hero-patch-builder.ts`. Wire `RunContext.startRun` to inject all party heroes before firing `GameStart`. Test with real QR-decoded hero data.

**Deliverable**: A complete end-to-end flow: scan QR → add to roster → start run → watch progress.

---

## 8. Open Points

### OP-1: Snapshot trigger events from BRL

The design assumes `WaveComplete`, `BossKilled`, and `GameOver` are the snapshot trigger events. These event names must be agreed between the BRL game author and the engine. If BRL uses different event names, the runtime snapshot trigger list must match.

**Resolution path**: Define the canonical event names in a shared document (or BRL constant). The `snapshot_triggers` list in `Engine` should be configurable at `init_game` time, not hardcoded.

### OP-2: Minimum / maximum snapshot count

If the game ends before generating any `WaveComplete` events (e.g., the entire party dies on wave 1), the snapshot array may have zero or one entry. The UI should handle this gracefully (show the single snapshot immediately, skip to results).

If the game generates more than ~60 snapshots (very long run), the UI playback at 1/sec becomes too slow. A soft maximum should be enforced: if more than 60 snapshots are recorded, the Worker sub-samples (keeps every N-th snapshot) before sending to the main thread.

### OP-3: Cancellation during simulation

If the player navigates away from the battle screen while the Worker is running, `cancel()` is called. Since the simulation runs to completion in one batch, cancellation may arrive after the simulation is already done. The Worker should check the cancellation flag before posting the `complete` message.

### OP-4: `wasm-pack` vs manual `cargo build --target wasm32`

`wasm-pack` is the recommended tool (wraps `wasm-bindgen-cli` and produces optimised JS glue). However, some CI environments may not have `wasm-pack` installed. The Makefile should check for both and provide a clear install message.

### OP-5: SharedArrayBuffer for future optimisation

The current design uses JSON for WASM → JS state transfer (inside the Worker). SharedArrayBuffer is not needed for correctness — the simulation result is a completed array of snapshots, not a streaming state. Leave this open for v2.

### OP-6: Multi-hero cloning

The design assumes a single hero template entity (`hero_template`) in BRL. If the game supports different class templates (each class has its own template entity with class-specific default skills and stats), `clone_named_entity` should accept a variable name like `hero_template_warrior`, `hero_template_mage`, etc. BRL must define one template per class. Coordinate this with the game design BRL files.

---

## 9. Decision Log

| ID | Decision | Rationale | Status |
|---|---|---|---|
| D-1 | WASM engine is the sole production engine (no JS engine in the player app) | See `web-interface-design.md` "DECISION: WASM Engine. Let's first fix that" | **Decided** |
| D-2 | Simulation runs fully before UI playback (not real-time) | Simplicity; idle game does not require real-time simulation coupling; correct behaviour even if simulation completes in < 1s | **Decided** |
| D-3 | Hero data injected via `clone_named_entity` + `patch_entity` (not via IR) | See `web-interface-design.md` §6.4 "The Engine must expose an interface allowing to set entities / components" | **Decided** |
| D-4 | Snapshots captured on `WaveComplete` / `BossKilled` / `GameOver` events | Captures meaningful progress milestones; small and bounded snapshot count | **Proposed** |
| D-5 | UI plays back snapshots at 1 per second | Provides ~30 seconds of visible progress; matches "roughly 30 updates to the user" from `web-interface-design.md` §4.7 | **Decided** |
| D-6 | WASM always runs in a Web Worker | Prevents main thread blocking; consistent with `web-interface-design.md` §6.3 decision | **Decided** |
| D-7 | No real-time mode in v1 | Simplicity; decoupled simulation and playback are sufficient for idle games | **Proposed** |
| D-8 | `FieldSetterRegistry` generated per game from BRL component definitions | Enables runtime hero injection without breaking the type-safe generated code | **Proposed** |
| D-9 | `blink-engine-wasm-js` package owns the `IBlinkEngine` interface | Single package for all WASM-related TS code; avoids separate `blink-engine-interface` package | **Proposed** |
| D-10 | Snapshot sub-sampling if > 60 checkpoints | Prevents UI playback from exceeding 60 seconds | **Proposed** |

---

## Revision History

| Version | Date | Changes |
|---|---|---|
| 0.1.0 | 2026-04-05 | Initial draft — gap analysis, hero injection design, stepping strategy, integration architecture |

## Next Steps

This project now has a clear implementation plan (see §7). The immediate next engineering tasks to make the WASM engine production-ready are listed below in priority order. Each item is written as a discrete, testable deliverable that can be picked up by a single PR.

1. Implement `FieldSetterRegistry` and `patch_entity` (Rust).
  - Add `packages/blink-runtime/src/field_registry.rs` and wire it into `Engine`.
  - Extend `packages/blink-compiler-ts/src/codegen-rust.ts` to emit `register_field_setters` for all components.
  - Unit test: native `init_game` + `clone_named_entity` + `patch_entity` modifies a cloned hero's fields as expected.

2. Add snapshot recording and `drain_snapshots_json` (Rust).
  - Add `log_buffer` and `snapshot_triggers` fields to `Engine`.
  - Emit snapshots on `WaveComplete`, `BossKilled`, and `GameOver` events.
  - Integration test: a short BRL scenario that triggers 3 wave-complete snapshots; verify `drain_snapshots_json` returns them.

3. Add `exports.rs` WASM bindings and `wasm-pack` Makefile target.
  - Annotate the necessary functions with `#[wasm_bindgen]` and provide JSON-friendly signatures (`patch_entity`, `clone_named_entity`, `drain_snapshots_json`, `drain_log_json`, etc.).
  - Add `build-wasm` to the Makefile that runs codegen → `wasm-pack build` → copies output to `game/wasm/`.
  - CI: add an optional WASM build job (can be gated behind an env flag) to validate the pipeline.

4. Create `packages/blink-engine-wasm-js` (TS wrapper + Worker).
  - Implement `IBlinkEngine` and `BlinkEngineWrapper` running the Worker lifecycle.
  - Implement `hero-patch-builder.ts` and unit tests for the QR→patch mapping.
  - Demo: `game/demos/rpg-demo-wasm.html` that loads the Worker and logs snapshots.

5. React integration and UX polish.
  - Implement `RunContext.startRun` to call the wrapper, receive snapshots, and play them back at 1/sec.
  - Update the battle screen to show `currentStep`, `encountersRemaining`, and `overall progress` according to the fixed-run structure (see `doc/game-design/encounters.md`).
  - UX: handle zero-snapshot runs, snapshot sub-sampling (>60), and cancellation.

6. BRL + scenario updates.
  - Add canonical snapshot trigger event names (documented in BRL constants) and ensure BRL rules fire them consistently.
  - Add `stepsPerRun`, `encountersPerStep`, and `wipeoutPenalty` fields to relevant scenario BRL files (`game/brl/game-config.brl` or scenario-specific BRL).

7. Tests & Conformance.
  - Add conformance tests that run the same BRL scenario on the JS engine and the WASM engine and compare snapshots/state after each step (reusing the existing e2e harness where possible).
  - Add unit tests for `patch_entity` field setters to protect regressions when component schemas change.

If you'd like, I can start implementing these in order. Tell me which item to pick first (Rust field registry, snapshot recording, WASM exports, TS wrapper, or React integration) and I'll create a focused TODO plan and begin editing files.
