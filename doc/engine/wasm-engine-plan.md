# WebAssembly Engine Implementation Plan

**Version**: 0.1.0-draft  
**Status**: Draft — Open for review  
**Last Updated**: 2026-04-05  
**Track**: New Track (alongside Track 3: Rust Engine and Track 4: JS Engine)

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Approach Analysis](#2-approach-analysis)
3. [Recommended Architecture](#3-recommended-architecture)
4. [JS ↔ WASM Interface Design](#4-js--wasm-interface-design)
5. [Memory Layout](#5-memory-layout)
6. [Implementation Phases](#6-implementation-phases)
7. [Testing Strategy](#7-testing-strategy)
8. [Potential Issues & Open Points](#8-potential-issues--open-points)
9. [Decision Log](#9-decision-log)

---

## 1. Motivation

The current JS engine (Track 4) interprets the IR at runtime using JavaScript Maps, recursive expression evaluation, and dynamic dispatch. While this works well for development and debugging, mobile performance is a concern for production:

- **JavaScript overhead**: Map lookups, garbage collection pauses, and dynamic dispatch add per-event overhead that compounds over thousands of events.
- **Idle game catch-up**: When a player returns after hours away, the engine must simulate potentially thousands of events rapidly ("catch-up" mode). This is where performance matters most.
- **Mobile constraints**: Lower CPU clocks, thermal throttling, and battery concerns make raw throughput important.

The WASM engine should run alongside the existing JS engine — not replace it. The JS engine remains the primary tool for development, debugging, and prototyping. The WASM engine is the **production runtime** for mobile deployment.

---

## 2. Approach Analysis

Three possible approaches were evaluated:

### Approach A: WASM Interpreter — Rust runtime that interprets IR

Write the full engine (ECS Store, Timeline, Rule Executor) in Rust, compile to WASM. At startup, load the IR JSON, parse it into Rust data structures, and interpret it — essentially doing what the JS engine does, but in WASM.

| Aspect | Assessment |
|--------|------------|
| Performance gain | **Moderate** (2–5× over JS). Main gains from typed memory, no GC, efficient data layout. The interpretation overhead (tree-walking expressions, dynamic dispatch on action types) remains. |
| Implementation complexity | **Moderate**. Well-understood problem — port the existing JS engine logic to Rust. |
| Maintenance burden | **Moderate**. Every IR feature change requires updating both JS and Rust engines. |
| Risk | **Low**. Proven pattern (many WASM interpreters exist). |

### Approach B: IR → WASM Compiler — Compile rules to native WASM functions

Add a new compiler pass that takes IR and generates WASM bytecode directly. Each rule becomes a native WASM function. Expressions become WASM instructions. No interpretation at runtime.

| Aspect | Assessment |
|--------|------------|
| Performance gain | **High** (5–20× over JS). No interpretation overhead at all. Expressions compile to native WASM arithmetic. |
| Implementation complexity | **Very High**. Requires building a WASM code generator that handles all expression types, entity access patterns, string operations, dynamic entity queries, and function calls. |
| Maintenance burden | **High**. The WASM codegen must be updated for every new IR feature. Debugging generated WASM is harder. |
| Risk | **High**. String handling, dynamic entity queries (`entities_having`), and dynamic field access are inherently hard to compile to static WASM. These would likely still need runtime support functions, reducing the benefit. |

### Approach C: Hybrid — Rust runtime with AOT-compiled hot paths (Recommended)

Write the core runtime (ECS, Timeline, event dispatch) in Rust/WASM. For rule execution, use an **efficient bytecode interpreter** rather than tree-walking. The IR is compiled to a flat bytecode format (a lower-level IR) at load time in Rust, then executed by a tight Rust bytecode interpreter.

| Aspect | Assessment |
|--------|------------|
| Performance gain | **High** (5–10× over JS). Flat bytecode is much faster than tree-walking. Rust runtime avoids GC and uses cache-friendly data layouts. |
| Implementation complexity | **Moderate-High**. Bytecode design and interpreter are well-understood patterns. The Rust runtime is the same as Approach A but with bytecode execution instead of tree-walking. |
| Maintenance burden | **Moderate**. IR → bytecode compilation is a straightforward transform. Bytecode is internal — not a public contract. |
| Risk | **Low-Moderate**. Bytecode interpreters are proven (Lua, Python, etc.). |

### Why not pure IR → WASM compilation (Approach B)?

The original proposal suggested compiling BRL code directly so it's "not interpreted." While the intent is correct (minimize interpretation overhead), full WASM compilation faces fundamental challenges with the Blink runtime model:

1. **Dynamic entity queries**: `entities_having("Character")` requires runtime iteration over all entities. This cannot be statically compiled — it needs a runtime data structure.
2. **String-keyed components**: Component access is by string name (`entity.Health.current`). In WASM, we'd need string interning and lookup tables regardless.
3. **Dynamic entity creation/destruction**: `spawn` and `despawn` actions create and destroy entities at runtime. The WASM code can't know ahead of time which entities exist.
4. **Event-driven execution**: Rules fire in response to runtime events. The dispatch logic needs a runtime scheduler.

These runtime requirements mean ~60% of the execution time would still be spent in runtime support functions, not in the compiled rule code itself. **Approach C captures most of the performance benefit at significantly lower complexity.**

### Recommendation

**Approach C (Hybrid)** — Rust WASM runtime with bytecode-compiled rules.

This achieves the "compiled, not interpreted" goal for the parts that benefit from it (expression evaluation, action dispatch), while keeping the necessary runtime infrastructure (ECS, timeline, event dispatch) in efficient Rust. The bytecode is not "interpretation" in the tree-walking sense — it's a flat, cache-friendly instruction stream executed by a tight loop.

---

## 3. Recommended Architecture

### 3.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER ENVIRONMENT                          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   GAME CLIENT (React App)                    │   │
│  │                                                              │   │
│  │   UI reads state ◄───────── JS API Layer ──────── UI events │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
│                                 │                                   │
│                                 ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              @blink/engine-wasm (TypeScript Wrapper)          │   │
│  │                                                              │   │
│  │  • Same public API as @blink/engine (BlinkGame interface)    │   │
│  │  • Manages WASM module lifecycle                             │   │
│  │  • Marshals IR JSON → binary format for WASM                 │   │
│  │  • Reads state snapshots from WASM shared memory             │   │
│  │  • Provides simulation callbacks to React                     │   │
│  └──────────────────────────────┬───────────────────────────────┘   │
│                                 │                                   │
│                    ┌────────────┼────────────┐                      │
│                    │  JS ↔ WASM boundary     │                      │
│                    │  (minimize crossings)    │                      │
│                    └────────────┼────────────┘                      │
│                                 │                                   │
│                                 ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              blink-engine-wasm (Rust → WASM)                  │   │
│  │                                                              │   │
│  │  ┌─────────────────┐  ┌──────────────────┐                  │   │
│  │  │  IR Loader       │  │  IR → Bytecode   │                  │   │
│  │  │  (binary format) │  │  Compiler        │                  │   │
│  │  └────────┬─────────┘  └────────┬─────────┘                  │   │
│  │           │                     │                            │   │
│  │           ▼                     ▼                            │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │                  Runtime Core                        │    │   │
│  │  │                                                     │    │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │   │
│  │  │  │ ECS Store │  │ Timeline │  │ Bytecode VM      │  │    │   │
│  │  │  │ (SoA)    │  │ (heap)   │  │ (register-based) │  │    │   │
│  │  │  └──────────┘  └──────────┘  └──────────────────┘  │    │   │
│  │  │                                                     │    │   │
│  │  │  ┌──────────────────┐  ┌────────────────────────┐  │    │   │
│  │  │  │ String Intern    │  │ Built-in Functions     │  │    │   │
│  │  │  │ Table            │  │ (min, max, random...) │  │    │   │
│  │  │  └──────────────────┘  └────────────────────────┘  │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  State Export Buffer (shared memory for JS reads)    │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Roles

| Component | Language | Role |
|-----------|----------|------|
| `@blink/engine-wasm` (npm) | TypeScript | JS wrapper with the same BlinkGame API. Manages WASM lifecycle, marshals data. |
| `blink-engine-wasm` (crate) | Rust | Core runtime compiled to WASM. Contains ECS, Timeline, bytecode VM, IR loader. |
| IR → Bytecode compiler | Rust | Converts IR JSON rules/expressions into flat bytecode at load time. Runs inside WASM. |
| State Export Buffer | Shared | WASM linear memory region that the JS wrapper reads to build state snapshots. |

### 3.3 Interaction with Existing JS Engine

The WASM engine is a **drop-in alternative** to the JS engine. Both implement the same `BlinkGame` public API:

```typescript
// Game client code — engine is swappable
import { BlinkGame } from '@blink/engine';       // JS engine
import { BlinkGame } from '@blink/engine-wasm';   // WASM engine

// Same API:
const game = await BlinkGame.create({ msPerFrame: 100 });
game.loadRulesFromObject(ir);
game.start();
game.onSimulation(event => { /* update UI */ });
const state = game.getState();
```

The game client can choose which engine to use (e.g., via a config flag or build-time selection). Both engines produce identical simulation results for the same IR input (validated by conformance tests).

---

## 4. JS ↔ WASM Interface Design

### 4.1 Design Principle: Minimize Boundary Crossings

Every JS ↔ WASM call has overhead (~100ns). For a game processing thousands of events per second, this matters. The interface is designed around **batch operations**:

- **`runSteps(n)`**: Process N events entirely within WASM. Return only the count of events processed and the new simulation time.
- **`getState()`**: Read a full snapshot from WASM memory. Done once per UI frame (60fps = every 16ms).
- **`loadIR(binary)`**: One-time bulk transfer of IR data into WASM.

### 4.2 Exported WASM Functions

```rust
// Core lifecycle
#[wasm_bindgen]
pub fn create_engine(config_json: &str) -> EngineHandle;

#[wasm_bindgen]
pub fn destroy_engine(handle: EngineHandle);

// IR loading
#[wasm_bindgen]
pub fn load_ir(handle: EngineHandle, ir_json: &str) -> bool;

// Simulation control
#[wasm_bindgen]
pub fn step(handle: EngineHandle) -> bool;  // Returns false when no events

#[wasm_bindgen]
pub fn run_steps(handle: EngineHandle, max_steps: u32) -> u32;  // Returns events processed

#[wasm_bindgen]
pub fn run_until_time(handle: EngineHandle, target_time: f64) -> u32;

#[wasm_bindgen]
pub fn get_time(handle: EngineHandle) -> f64;

#[wasm_bindgen]
pub fn has_events(handle: EngineHandle) -> bool;

// State queries (returns JSON — simple but not fastest)
#[wasm_bindgen]
pub fn get_state_json(handle: EngineHandle) -> String;

// State queries (returns binary — fastest, read from shared buffer)
#[wasm_bindgen]
pub fn get_state_binary(handle: EngineHandle, buffer_ptr: *mut u8, buffer_len: u32) -> u32;

// Entity queries
#[wasm_bindgen]
pub fn query_entities(handle: EngineHandle, component_names_json: &str) -> String;

#[wasm_bindgen]
pub fn get_component_json(handle: EngineHandle, entity_id: u32, component_name: &str) -> String;

// Event management
#[wasm_bindgen]
pub fn schedule_event(handle: EngineHandle, event_json: &str) -> u32;

#[wasm_bindgen]
pub fn cancel_event(handle: EngineHandle, event_id: u32) -> bool;

// Reset
#[wasm_bindgen]
pub fn reset(handle: EngineHandle);
```

### 4.3 TypeScript Wrapper API

The TypeScript wrapper presents the familiar `BlinkGame` API:

```typescript
export class BlinkGame {
  private wasmEngine: WasmEngineBindings;
  private handle: number;

  static async create(options?: GameOptions): Promise<BlinkGame> {
    const wasm = await loadWasmModule();
    const handle = wasm.create_engine(JSON.stringify(options));
    return new BlinkGame(wasm, handle);
  }

  loadRulesFromObject(ir: IRModule): void {
    this.wasmEngine.load_ir(this.handle, JSON.stringify(ir));
  }

  // Run simulation in batches, yielding to UI between batches
  async start(): Promise<void> {
    this.isRunning = true;
    const tick = () => {
      if (!this.isRunning) return;
      const eventsProcessed = this.wasmEngine.run_steps(this.handle, this.maxEventsPerFrame);
      this.emitSimulationEvent({ type: 'step', eventsProcessed });
      if (this.wasmEngine.has_events(this.handle)) {
        requestAnimationFrame(tick);
      } else {
        this.emitSimulationEvent({ type: 'completed' });
      }
    };
    requestAnimationFrame(tick);
  }

  getState(): GameStateSnapshot {
    const json = this.wasmEngine.get_state_json(this.handle);
    return JSON.parse(json);
  }

  getTime(): number {
    return this.wasmEngine.get_time(this.handle);
  }

  // ... other methods delegate to WASM
}
```

### 4.4 State Snapshot Transfer

Two strategies, to be chosen based on profiling:

**Strategy 1: JSON serialization (simpler, good enough for most cases)**
- WASM serializes state to JSON string in Rust (`serde_json`).
- JS parses the JSON string.
- ~1ms for 100 entities, ~10ms for 1000 entities. Acceptable for 60fps UI updates.

**Strategy 2: Binary protocol via SharedArrayBuffer (maximum performance)**
- WASM writes entity state into a pre-allocated binary buffer in linear memory.
- JS reads the buffer directly using `DataView` — no serialization/deserialization.
- Requires a defined binary layout (see [Memory Layout](#5-memory-layout)).
- ~0.1ms for 1000 entities. Needed only if JSON becomes a bottleneck.

**Recommendation**: Start with JSON (Strategy 1). Profile on target mobile devices. Switch to binary only if needed. The simulation speed (WASM core) matters far more than the snapshot transfer speed.

### 4.5 Callback System

The JS engine has three callback types: `onSimulation`, `onDebug`, `onTrace`. For the WASM engine:

- **`onSimulation`**: Emitted from the TypeScript wrapper, not from WASM. The wrapper emits events at natural boundaries (after `run_steps`, on start/pause/stop).
- **`onDebug` / `onTrace`**: **Not supported** in the WASM engine. These are development features, and the JS engine should be used for debugging. This avoids the massive overhead of crossing the JS/WASM boundary for every rule/action execution.
  - **Open point**: If trace support is needed in production, consider a WASM-side trace buffer that JS can read periodically (see [Open Points](#8-potential-issues--open-points)).

---

## 5. Memory Layout

### 5.1 ECS Store: Struct-of-Arrays (SoA)

The JS engine uses a Map-of-Maps (entity → component → field → value). In WASM, we use **Struct-of-Arrays** for cache locality:

```
Component "Health" storage:
  ┌──────────────────────────────────────────────────────┐
  │  entity_ids:  [  0,    1,    5,    8   ]             │  (u32 array)
  │  current:     [ 100,  85,   50,  120  ]              │  (f64 array)
  │  max:         [ 100, 100,  100,  120  ]              │  (f64 array)
  └──────────────────────────────────────────────────────┘

Component "Character" storage:
  ┌──────────────────────────────────────────────────────┐
  │  entity_ids:  [  0,    1,    5,    8   ]             │  (u32 array)
  │  name:        [ s3,   s7,   s12,  s15 ]              │  (string IDs)
  │  class:       [ s1,   s2,   s1,   s4  ]              │  (string IDs)
  │  level:       [  5,    3,    1,    7  ]              │  (i32 array)
  │  experience:  [ 450,  120,   0,  800  ]              │  (i32 array)
  └──────────────────────────────────────────────────────┘
```

**Benefits:**
- Iterating all `Health.current` values is a linear memory scan (cache-friendly).
- Numeric fields stored as typed arrays — no boxing, no GC.
- Entity queries ("all entities with Health") scan one `entity_ids` array per component.

### 5.2 String Interning

All strings (component names, event types, field names, string field values) are assigned integer IDs at IR load time:

```
String Intern Table:
  0: "Health"
  1: "Warrior"
  2: "Mage"
  3: "Sir Braveheart"
  4: "Cleric"
  ...
```

At runtime, all string operations use integer comparisons. The intern table is only used for JS ↔ WASM marshaling (converting string IDs back to strings for JSON export).

### 5.3 Timeline (Binary Heap)

```rust
struct Timeline {
    events: Vec<ScheduledEvent>,   // Binary heap
    current_time: f64,
    next_sequence: u64,
}

struct ScheduledEvent {
    time: f64,             // 8 bytes
    sequence: u64,         // 8 bytes — deterministic ordering
    event_type: u32,       // 4 bytes — interned string ID
    source: u32,           // 4 bytes — entity ID (0 = none)
    target: u32,           // 4 bytes — entity ID (0 = none)
    fields_offset: u32,    // 4 bytes — offset into fields buffer
    fields_count: u16,     // 2 bytes — number of fields
    recurring: bool,       // 1 byte
    interval: f64,         // 8 bytes (only if recurring)
}
// Total: ~43 bytes per event (vs ~200+ bytes for the JS Map-based event)
```

### 5.4 Bytecode Format

Rules and expressions are compiled from the IR tree format to a flat bytecode:

```
Opcode format: u8 opcode + variable-length operands

Opcodes:
  // Stack operations
  0x01  LOAD_CONST    <const_idx: u16>       — Push constant onto stack
  0x02  LOAD_LOCAL    <local_idx: u8>        — Push local variable
  0x03  STORE_LOCAL   <local_idx: u8>        — Pop and store in local
  0x04  LOAD_FIELD    <entity_reg: u8> <component_id: u16> <field_id: u16>
  0x05  STORE_FIELD   <entity_reg: u8> <component_id: u16> <field_id: u16>

  // Arithmetic (pop 2, push 1)
  0x10  ADD
  0x11  SUB
  0x12  MUL
  0x13  DIV
  0x14  MOD

  // Comparison (pop 2, push 1 boolean)
  0x20  EQ
  0x21  NEQ
  0x22  LT
  0x23  LTE
  0x24  GT
  0x25  GTE

  // Logic
  0x30  AND
  0x31  OR
  0x32  NOT

  // Control flow
  0x40  JUMP          <offset: i16>
  0x41  JUMP_IF_FALSE <offset: i16>
  0x42  CALL          <func_id: u16> <arg_count: u8>
  0x43  RETURN

  // Entity operations
  0x50  SPAWN         <template_id: u16>
  0x51  DESPAWN       <entity_reg: u8>
  0x52  HAS_COMPONENT <entity_reg: u8> <component_id: u16>
  0x53  CLONE_ENTITY  <source_reg: u8>

  // Event operations
  0x60  SCHEDULE      <event_type_id: u16>     — delay on stack
  0x61  EMIT          <event_type_id: u16>     — immediate schedule
  0x62  CANCEL_EVENT  <event_id_reg: u8>

  // Entity query
  0x70  QUERY_ENTITIES <component_count: u8>   — component IDs on stack

  // Modify operations (optimized for the most common action)
  0x80  MODIFY_ADD    <entity_reg: u8> <component_id: u16> <field_id: u16>
  0x81  MODIFY_SUB    <entity_reg: u8> <component_id: u16> <field_id: u16>
  0x82  MODIFY_SET    <entity_reg: u8> <component_id: u16> <field_id: u16>
  0x83  MODIFY_MUL    <entity_reg: u8> <component_id: u16> <field_id: u16>
  0x84  MODIFY_DIV    <entity_reg: u8> <component_id: u16> <field_id: u16>

  // Built-in functions
  0x90  BUILTIN_MIN
  0x91  BUILTIN_MAX
  0x92  BUILTIN_FLOOR
  0x93  BUILTIN_CEIL
  0x94  BUILTIN_ROUND
  0x95  BUILTIN_ABS
  0x96  BUILTIN_RANDOM
  0x97  BUILTIN_RANDOM_RANGE
  0x98  BUILTIN_LEN
```

Each IR rule is compiled to a bytecode chunk. The bytecode VM executes chunks in a tight loop:

```rust
fn execute_bytecode(&mut self, chunk: &[u8]) {
    let mut ip = 0;
    loop {
        match chunk[ip] {
            0x01 => { /* LOAD_CONST */ }
            0x10 => { /* ADD */ }
            0x40 => { /* JUMP */ }
            // ...
            _ => break,
        }
    }
}
```

This is dramatically faster than the JS engine's recursive `evaluateExpression()` which creates closures, branches on string-typed IR nodes, and triggers GC on every temporary value.

---

## 6. Implementation Phases

### Phase 1: Foundation — Rust project scaffold and core data structures

**Duration**: ~2 weeks  
**Deliverables**:
- Rust crate `packages/blink-engine-wasm/` with `wasm-pack` build configuration
- String interning table
- SoA ECS Store (create, delete, add/remove/get/set component, query)
- Timeline (binary heap with schedule, pop, cancel, recurring events)
- IR JSON parser in Rust (read `IRModule` from JSON)
- Basic `wasm-bindgen` exports: `create_engine`, `load_ir`, `step`, `get_time`, `has_events`
- Unit tests in Rust for ECS and Timeline

**Build integration**:
- Add Makefile targets: `build-wasm`, `test-wasm`
- Require `wasm-pack` (or `wasm-bindgen-cli`) as a dev dependency
- Output: `packages/blink-engine-wasm/pkg/` with `.wasm` + JS glue

### Phase 2: Rule execution — Bytecode compiler and VM

**Duration**: ~3 weeks  
**Deliverables**:
- IR → bytecode compiler (runs in Rust at IR load time)
  - Expression compilation (literal, field, var, param, binary, unary, call, if)
  - Action compilation (modify, schedule, emit, despawn, conditional, loop, let, while)
- Register-based or stack-based bytecode VM
- Rule matching (event type → matching rules)
- Entity filtering (component-based filters)
- Condition evaluation
- Built-in functions (min, max, floor, ceil, round, abs, random, random_range, len, entities_having, list, get)
- Initial state loading (entity definitions from IR)
- End-to-end test: load IR, run simulation, verify state matches JS engine

### Phase 3: JS wrapper and integration

**Duration**: ~2 weeks  
**Deliverables**:
- `packages/blink-engine-wasm-js/` — TypeScript wrapper package (npm)
- `BlinkGame` API matching the JS engine's public API
- State snapshot export (JSON-based initially)
- Simulation lifecycle (start, pause, resume, stop, step, runSteps)
- Entity query API
- Event scheduling API from JS
- `game/demos/rpg-demo-wasm.html` — demo page using WASM engine
- Bundle build script outputting `blink-engine-wasm.bundle.js`

### Phase 4: Conformance testing and optimization

**Duration**: ~2 weeks  
**Deliverables**:
- Conformance test suite: run same IR on both JS and WASM engines, compare state after N steps
- Edge case tests: empty rules, zero entities, recursive events, max iterations on while loops
- Performance benchmarks: JS vs WASM on real game IR (classic-rpg scenario)
- Profile on mobile devices (Chrome Android, Safari iOS)
- Optimization based on profiling results (binary state export if needed, component query indices, etc.)

### Phase 5: Production readiness

**Duration**: ~1 week  
**Deliverables**:
- Error handling and recovery (WASM panics → JS error callbacks)
- WASM module size optimization (wasm-opt, LTO)
- React app integration (engine selection in game settings)
- Documentation updates
- CI/CD pipeline for Rust + WASM builds

### Total estimated duration: ~10 weeks

---

## 7. Testing Strategy

### 7.1 Conformance Tests (Critical)

The WASM engine MUST produce identical simulation results to the JS engine for the same IR input. This is validated by **conformance tests**:

```
For each test case:
  1. Load the same IR into both JS and WASM engines
  2. Run N steps on both
  3. Compare entity state (component values) after each step
  4. Compare timeline state (pending events)
  5. Assert equality
```

**Test fixtures**: Use existing game BRL files compiled to IR:
- `game/ir/` — compiled IR files from real game scenarios
- `game/tests/brl/` — test BRL files

**Determinism requirement**: Both engines must use the same PRNG seed for `random()` / `random_range()` to produce identical results. This means:
- The PRNG algorithm must be specified (e.g., xoshiro256** or PCG) and identical in both engines
- The seed must be configurable via the engine API

### 7.2 Unit Tests (Rust)

Standard Rust unit tests for each subsystem:
- ECS: entity CRUD, component operations, queries
- Timeline: scheduling, ordering, recurring, cancellation
- Bytecode compiler: IR → bytecode conversion correctness
- Bytecode VM: instruction execution
- String interning: intern/resolve roundtrip

### 7.3 Integration Tests

End-to-end tests using `wasm-pack test --headless`:
- Load real game IR, run full simulation, verify expected outcomes
- Test JS wrapper API matches expected behavior
- Test error handling (invalid IR, WASM traps)

### 7.4 Performance Tests

Benchmarks comparing JS and WASM engines:
- Events per second (throughput)
- Time to simulate 10,000 events (latency)
- Memory usage
- Startup time (IR loading + compilation)

---

## 8. Potential Issues & Open Points

### 8.1 Issues with Known Mitigations

| Issue | Impact | Mitigation |
|-------|--------|------------|
| **WASM module size** | Larger download on mobile | Use `wasm-opt -Oz`, enable LTO, strip debug info. Target: <200KB gzipped. |
| **WASM startup time** | Delay before game can start | Use `WebAssembly.compileStreaming()` for parallel download+compile. Cache compiled module in IndexedDB. |
| **String handling in WASM** | Strings are not native to WASM; every string operation needs intern table lookups | All strings interned at IR load time. Runtime uses integer IDs exclusively. String operations are rare in the hot path. |
| **Random number determinism** | JS `Math.random()` and Rust `rand` use different algorithms | Implement the same PRNG in both engines (e.g., xoshiro256** with configurable seed). |
| **Bound choice functions** | These are called from JS (UI) to get entity-specific behavior | Evaluate bound functions inside WASM via a dedicated export (`evaluate_bound_function(handle, entity_id, func_name, args_json) -> String`). The bytecode VM already compiles function bodies — bound functions use the same mechanism. The JS wrapper calls this export on demand when the UI requests a choice. |
| **`list` and `map` field types** | Variable-size data doesn't fit neatly in SoA layout | Use indirection: SoA stores an offset+length into a separate heap for variable-size data. |
| **While loop iteration limit** | JS engine has 10,000 iteration guard | Implement same guard in WASM bytecode VM. |

### 8.2 Open Points Requiring Decisions

#### OP-1: Rust toolchain in CI/CD

Adding Rust to the build pipeline introduces a new toolchain requirement. Developers who only work on the JS engine or compiler shouldn't need Rust installed.

**Options**:
- (a) Separate CI job for WASM builds (recommended)
- (b) Pre-built WASM binary checked into repo (violates the no-generated-code policy)
- (c) Docker-based build for WASM

**Recommendation**: Option (a). Rust builds are isolated to `packages/blink-engine-wasm/`. The Makefile conditionally skips WASM targets if `wasm-pack` is not installed.

#### OP-2: WASM engine feature parity

Should the WASM engine support ALL features of the JS engine?

**Proposed policy**: The WASM engine supports the **runtime simulation features** (IR execution, events, entities). It does NOT need to support:
- `onDebug` / `onTrace` callbacks (use JS engine for debugging)
- `devMode` (step-by-step debugging)
- Dynamic rule merging (`mergeRulesFromIR`) — this is a development feature
- Source maps

**Open question**: Should `setMsPerFrame()` be supported? The WASM engine could operate in "run N steps" mode only, with the JS wrapper controlling timing via `requestAnimationFrame`.

#### OP-3: Entity ID mapping

The JS engine uses auto-incrementing integer entity IDs. The WASM engine should use the same scheme, but entity IDs must be consistent between JS wrapper and WASM internals.

**Proposed approach**: Entity IDs are `u32` in WASM. The JS wrapper maps them 1:1 (no translation). This limits entities to ~4 billion, which is more than sufficient.

#### OP-4: Callback granularity

The JS engine emits simulation events after every single event step. The WASM engine processes events in batches. What granularity of callbacks does the UI need?

**Proposed approach**: The WASM wrapper emits a single `step` callback after each `run_steps(n)` batch, with the count of events processed and the new simulation time. The UI polls state when it needs to render (on `requestAnimationFrame`).

**Open question**: Does the game UI need per-event callbacks (e.g., "this specific attack happened") for animations/logs? If so, we need an event log buffer in WASM that JS can read.

#### OP-5: Hot-swap between JS and WASM engines

Can the game switch engines mid-session (e.g., use WASM for normal play, switch to JS for debugging)?

**Proposed approach**: Not supported in v1. Switching engines requires restarting the simulation. State serialization/deserialization could enable this in the future.

#### OP-6: Web Worker integration

Should the WASM engine run in a Web Worker to avoid blocking the main thread?

**Proposed approach**: Start on the main thread (simpler). The `run_steps(n)` pattern naturally yields to the UI between batches. Move to a Web Worker only if profiling shows UI jank on mobile. The WASM wrapper's async `start()` method already supports this pattern.

#### OP-7: Implementation language alternatives

Rust is the recommended language for the WASM core, but alternatives exist:

| Language | Pros | Cons |
|----------|------|------|
| **Rust** | Mature WASM tooling (wasm-pack, wasm-bindgen), no GC, excellent performance, large ecosystem | Steep learning curve, longer compile times |
| **C/C++** | Also compiles to WASM (via Emscripten), familiar to many devs | Manual memory management, less safe, weaker WASM tooling |
| **AssemblyScript** | TypeScript-like syntax, easy for JS devs | Less mature, limited performance gains over JS, GC in WASM |
| **Go** | Good WASM support since 1.21 (wasip1) | Large WASM binary size (~2MB+), GC overhead |
| **Zig** | Excellent WASM support, no hidden allocations | Small ecosystem, less mature |

**Recommendation**: Rust. Best combination of performance, safety, WASM tooling maturity, and ecosystem. The `wasm-bindgen` and `wasm-pack` tools provide excellent JS interop.

#### OP-8: Event log buffer for UI

The current JS engine lets the UI subscribe to trace events to build a combat log. The WASM engine batches events. How does the UI get event details for the combat log?

**Proposed approach**: The WASM engine maintains a ring buffer of "notable events" (combat actions, deaths, level-ups). After each `run_steps()` batch, the JS wrapper reads this buffer and dispatches to UI callbacks. The buffer format is defined by the game's needs, not the engine — the engine provides a generic "event log" mechanism.

**This is one of the most important design decisions to get right.** It determines how responsive and detailed the UI can be.

**Implementation alternatives**:

| Alternative | How it works | Pros | Cons |
|-------------|-------------|------|------|
| **(a) WASM ring buffer** (recommended) | WASM writes structured events to a fixed-size ring buffer in linear memory. JS reads the buffer after each `run_steps()` call via `drain_event_log(handle) -> String` (JSON array). | Single WASM→JS call per frame. Buffer size is bounded. Events are batched. | Requires defining a binary event format. Buffer overflow must be handled (oldest events dropped). |
| **(b) Callback per event** | WASM calls a JS callback function for each notable event during execution. | Most compatible with current JS engine model. Fine-grained. | Extremely expensive — each callback crosses the JS/WASM boundary (~100ns). For 1000 events/frame, this adds ~100μs of pure overhead. |
| **(c) Post-hoc state diff** | JS compares state snapshots before and after `run_steps()` to infer what happened. | No WASM changes needed. | Cannot reconstruct event ordering or details (e.g., "who attacked whom"). Lossy. |
| **(d) Structured event log export** | WASM accumulates events into a growable Vec. JS calls `get_event_log_json(handle) -> String` to drain it. | Simple API. Full fidelity. | Unbounded memory growth if not drained. JSON serialization cost per frame. |

**Recommendation**: Start with **(d) Structured event log export** — simplest to implement, full fidelity, easy to drain each frame. If memory or serialization becomes an issue, migrate to **(a) ring buffer** with binary encoding. Option **(b)** should be avoided due to boundary crossing overhead.

---

## 9. Decision Log

| ID | Decision | Rationale | Status |
|----|----------|-----------|--------|
| D-1 | Approach C: Hybrid WASM runtime with bytecode VM | Best performance/complexity tradeoff. Pure compilation (Approach B) adds massive complexity for marginal gain. Pure interpretation in WASM (Approach A) leaves performance on the table. | **Proposed** |
| D-2 | Rust as implementation language | Best WASM tooling, no GC, excellent performance. | **Proposed** |
| D-3 | SoA memory layout for ECS | Cache-friendly iteration, typed arrays, minimal overhead. | **Proposed** |
| D-4 | JSON for initial state transfer, binary as optimization | Start simple. Optimize only when profiling shows need. | **Proposed** |
| D-5 | No debug/trace support in WASM engine | These are dev features; use JS engine for debugging. Avoids JS/WASM boundary overhead. | **Proposed** |
| D-6 | Same public API as JS engine | Drop-in replacement. Game client code doesn't change. | **Proposed** |
| D-7 | Conformance tests as primary validation | Engines must produce identical results. This is the most important quality gate. | **Proposed** |

---

## Appendix A: File Structure

```
packages/
├── blink-engine/                 # Existing JS engine (unchanged)
├── blink-engine-wasm/            # NEW: Rust WASM engine core
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs               # wasm-bindgen entry point
│   │   ├── engine.rs            # Engine orchestrator
│   │   ├── ecs/
│   │   │   ├── mod.rs
│   │   │   ├── store.rs         # SoA entity-component storage
│   │   │   └── query.rs         # Component queries
│   │   ├── timeline/
│   │   │   ├── mod.rs
│   │   │   └── heap.rs          # Binary heap priority queue
│   │   ├── vm/
│   │   │   ├── mod.rs
│   │   │   ├── bytecode.rs      # Bytecode definitions
│   │   │   ├── compiler.rs      # IR → bytecode compiler
│   │   │   └── executor.rs      # Bytecode VM
│   │   ├── ir/
│   │   │   ├── mod.rs
│   │   │   ├── types.rs         # IR type definitions
│   │   │   └── loader.rs        # JSON → Rust IR structs
│   │   ├── interning.rs         # String intern table
│   │   └── builtins.rs          # Built-in functions
│   ├── tests/                   # Rust unit tests
│   └── pkg/                     # wasm-pack output (generated, not committed)
├── blink-engine-wasm-js/         # NEW: TypeScript wrapper
│   ├── package.json
│   ├── src/
│   │   ├── index.ts             # Main exports
│   │   ├── BlinkGame.ts         # BlinkGame API wrapper
│   │   └── WasmLoader.ts        # WASM module loading
│   ├── scripts/
│   │   └── build-bundle.js      # Bundle build script
│   └── dist/                    # Compiled output (generated, not committed)
```

## Appendix B: Benchmark Targets

Based on analysis of the existing JS engine and typical mobile device capabilities:

| Metric | JS Engine (current) | WASM Target | Notes |
|--------|--------------------|----|-------|
| Events/second | ~50,000 | ~250,000+ | 5× improvement minimum |
| 10K event simulation | ~200ms | ~40ms | Important for catch-up scenarios |
| State snapshot (100 entities) | ~0.5ms | ~1ms (JSON) / ~0.1ms (binary) | JSON slightly slower due to serialization |
| IR load time | ~5ms | ~15ms (includes bytecode compilation) | One-time cost, acceptable |
| WASM module size | N/A | <200KB gzipped | Download budget for mobile |
| Memory usage (1000 entities) | ~2MB | ~0.5MB | SoA is more compact |

## Appendix C: Migration Path

```
Phase 1-2: Build WASM engine standalone, test in isolation
     ↓
Phase 3: Add JS wrapper, verify API compatibility
     ↓
Phase 4: Conformance tests pass → WASM engine is "correct"
     ↓
Phase 5: Integrate into React app as optional engine
     ↓
Future: Make WASM the default engine for production builds
        Keep JS engine for development/debugging
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-04-05 | Initial draft |
