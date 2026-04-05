# WebAssembly Engine Implementation Plan

**Version**: 0.2.0-draft  
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

Four possible approaches were evaluated:

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

### Approach C: Hybrid — Rust runtime with bytecode VM

Write the core runtime (ECS, Timeline, event dispatch) in Rust/WASM. For rule execution, use an **efficient bytecode interpreter** rather than tree-walking. The IR is compiled to a flat bytecode format (a lower-level IR) at load time in Rust, then executed by a tight Rust bytecode interpreter.

| Aspect | Assessment |
|--------|------------|
| Performance gain | **High** (5–10× over JS). Flat bytecode is much faster than tree-walking. Rust runtime avoids GC and uses cache-friendly data layouts. |
| Implementation complexity | **Moderate-High**. Bytecode design and interpreter are well-understood patterns. The Rust runtime is the same as Approach A but with bytecode execution instead of tree-walking. |
| Maintenance burden | **Moderate**. IR → bytecode compilation is a straightforward transform. Bytecode is internal — not a public contract. |
| Risk | **Low-Moderate**. Bytecode interpreters are proven (Lua, Python, etc.). |

### Approach D: BRL → Rust → WASM (Recommended)

Compile BRL source code directly to Rust source code. Then compile the generated Rust code (plus a small runtime library) to WASM using standard Rust/WASM tooling. At runtime, everything is native WASM — no interpretation, no bytecode, no IR parsing.

The key insight: **everything in BRL is known at compile time**. The set of component types, their fields and types, the set of rules and their triggers, the set of functions — all are defined in BRL source files and fully resolved by the compiler. The generated Rust code can use concrete structs, direct field access, and statically-dispatched function calls.

| Aspect | Assessment |
|--------|------------|
| Performance gain | **Maximum** (10–50× over JS). Zero interpretation overhead. Component field access compiles to direct struct field reads. Arithmetic compiles to native WASM instructions. Entity queries compile to typed iteration. |
| Implementation complexity | **Moderate**. The BRL → Rust codegen is a straightforward AST-to-source transform (similar to the existing BRL → IR codegen). The Rust runtime library is small. |
| Maintenance burden | **Low**. The codegen lives in the existing TypeScript compiler. The Rust runtime library is stable. New BRL features only require updating the codegen — not a separate engine. |
| Risk | **Low-Moderate**. Some BRL features need small language adjustments to be fully static (see [Section 2.1](#21-brl-language-analysis-for-static-compilation)). |

**How it works:**

```
BRL source files
      │
      ▼
┌─────────────────┐
│ BRL Compiler     │  (existing TypeScript compiler, extended with Rust codegen)
│ (blink-compiler) │
└────────┬────────┘
         │ generates
         ▼
┌─────────────────┐
│ Generated Rust   │  game_components.rs, game_rules.rs, game_entities.rs
│ source code      │
└────────┬────────┘
         │ + links with
         ▼
┌─────────────────┐
│ Runtime library  │  blink_runtime (small Rust crate: ECS, Timeline, event dispatch)
│ (Rust crate)     │
└────────┬────────┘
         │ cargo build --target wasm32-unknown-unknown
         ▼
┌─────────────────┐
│ game.wasm        │  Single WASM binary, all game logic compiled to native code
└─────────────────┘
```

**Example of what the generated Rust looks like:**

```rust
// ── Generated from component definitions ──────────────────────────
// (BRL: component Health { current: integer, max: integer })

#[derive(Clone, Default)]
pub struct Health {
    pub current: i64,
    pub max: i64,
}

#[derive(Clone, Default)]
pub struct Combat {
    pub damage: f64,
    pub attack_speed: f64,
}

// ── Generated from entity definitions ─────────────────────────────
// (BRL: goblin = new entity { Character {...} Health {...} })

pub fn create_initial_entities(world: &mut World) {
    let goblin = world.spawn();
    world.insert(goblin, Character { name: intern("Goblin Scout"), class: intern("Enemy"), level: 1, .. });
    world.insert(goblin, Health { current: 30, max: 30 });
    world.insert(goblin, Combat { damage: 5.0, attack_speed: 1.0 });
    world.insert(goblin, EnemyTemplate { is_template: true });
    // ...
}

// ── Generated from rules ──────────────────────────────────────────
// (BRL: rule attack_rule on DoAttack(da: id) { ... })

pub fn rule_attack_rule(event: &Event, world: &mut World, timeline: &mut Timeline) {
    let da_source = event.source;
    // Iterate entities matching the rule's implicit filter
    for entity_id in world.query_component::<GameState>() {
        let attacker = da_source;
        if world.get::<Target>(attacker).entity != EntityId::NONE
            && world.get::<Health>(attacker).current > 0
        {
            let target = world.get::<Target>(attacker).entity;
            if world.get::<Health>(target).current > 0 {
                let damage = world.get::<Combat>(attacker).damage
                    + world.get::<Buffs>(attacker).damage_bonus;
                world.get_mut::<Health>(target).current -= damage as i64;

                timeline.schedule(Event::new(intern("AfterAttack"))
                    .with_field("attacker", Value::Entity(attacker))
                    .with_field("target", Value::Entity(target)));
            }
            let speed = world.get::<Combat>(attacker).attack_speed
                + world.get::<Buffs>(attacker).haste_bonus;
            let delay = 1.0 / if speed <= 0.0 { 0.1 } else { speed };
            timeline.schedule_delay(delay, Event::new(intern("DoAttack")).with_source(attacker));
        }
    }
}

// ── Generated from functions ──────────────────────────────────────
// (BRL: fn calculate_damage(base: float, bonus: float): float { ... })

#[inline]
pub fn calculate_damage(base: f64, bonus: f64) -> f64 {
    base + bonus
}

// ── Generated event dispatch ──────────────────────────────────────

pub fn dispatch_event(event: &Event, world: &mut World, timeline: &mut Timeline) {
    match event.event_type {
        e if e == intern("DoAttack") => rule_attack_rule(event, world, timeline),
        e if e == intern("AfterAttack") => {
            rule_death_check(event, world, timeline);
        }
        e if e == intern("GameStart") => {
            rule_initialize_hero_attacks(event, world, timeline);
            rule_start_retargeting_system(event, world, timeline);
            rule_spawn_initial_enemies(event, world, timeline);
        }
        // ... all event types known at compile time
        _ => {}
    }
}
```

**Why this is feasible — analysis of the actual BRL codebase:**

We audited every BRL file in the game. The findings support static compilation:

| Feature | Occurrences | Static? | Notes |
|---------|------------|---------|-------|
| Component definitions | ~25 types | ✅ All known at compile time | Become Rust structs |
| Entity creation (`new entity`) | ~40 entities | ✅ All in top-level definitions | Become `world.spawn()` + `world.insert()` |
| `entities having X` queries | ~17 calls | ✅ Component name is **always** a literal | Become `world.query_component::<X>()` |
| `clone` entity | 2 calls | ⚠️ Source is runtime-determined | Needs runtime clone (see below) |
| Component field access | ~100+ sites | ✅ Component and field always literals | Become `world.get::<C>(id).field` |
| User-defined functions | ~8 functions | ✅ All signatures known | Become Rust functions |
| Built-in functions | ~12 types | ✅ Fixed set | Become inline Rust |
| `for` loops | ~15 loops | ✅ Over literals or query results | Become Rust `for` loops |
| Event scheduling | ~25 sites | ✅ Event names are literals | Become `timeline.schedule()` |
| List type usage | ~10 sites | ⚠️ Unparameterized `list` | Needs typed lists (see below) |

### 2.1 BRL Language Analysis for Static Compilation

A detailed audit of every BRL file in the game reveals that BRL is **already very close to being statically compilable**. The vast majority of language features map directly to static Rust code. A few features need small adjustments:

#### Features that compile directly (no changes needed)

1. **Component definitions** → Rust structs
2. **Top-level entity creation** → `world.spawn()` + `world.insert()`
3. **User-defined functions** → Rust functions with explicit signatures
4. **Built-in functions** (`min`, `max`, `floor`, `random`, etc.) → Inline Rust
5. **Binary/unary operations** → Native Rust operators
6. **Conditional actions** (`if/else`) → Rust `if/else`
7. **Event scheduling** (`schedule`, `emit`) → `timeline.schedule()`/`timeline.schedule_immediate()`
8. **Component field reads** (`entity.Health.current`) → `world.get::<Health>(entity).current`
9. **Component field writes** (`entity.Health.current -= 10`) → `world.get_mut::<Health>(entity).current -= 10`
10. **`has` component checks** (`entity has GameState`) → `world.has::<GameState>(entity)`
11. **`entities having X`** → `world.query_component::<X>()` (component name is always a literal in all game BRL)
12. **`while` loops** → Rust `while` with iteration guard

#### Features that need minor BRL language adjustments

##### 2.1.1 `clone` with runtime-determined source

**Current BRL:**
```brl
let templates: list = entities having EnemyTemplate
let templateId: id = templates[0]
for t in templates {
    if t.EnemyTemplate.isTemplate && t.Enemy.tier == se.tier {
        templateId = t
    }
}
let newEnemy: id = clone templateId { EnemyTemplate { isTemplate: false } }
```

**Problem**: The clone source (`templateId`) is determined at runtime. In Rust, `clone` needs to know the exact set of components to copy. Since `templateId` comes from a query, the compiler doesn't statically know which entity is being cloned.

**However** — the clone source always has a known component archetype. All entities returned by `entities having EnemyTemplate` have the same component set (Character, Health, Mana, Stats, Combat, Target, Team, Enemy, EnemyTemplate, Buffs). This is an archetype — and it's known at compile time from the entity definitions.

**Proposed solution — archetype-aware clone**:

The compiler can analyze entity definitions and determine that all entities with `EnemyTemplate` share the same archetype. The generated Rust `clone` function copies exactly those components:

```rust
// Generated: clone for EnemyTemplate archetype
fn clone_enemy_template_archetype(world: &mut World, source: EntityId) -> EntityId {
    let new_id = world.spawn();
    world.insert(new_id, world.get::<Character>(source).clone());
    world.insert(new_id, world.get::<Health>(source).clone());
    world.insert(new_id, world.get::<Combat>(source).clone());
    // ... all components in the archetype
    new_id
}
```

**BRL language suggestion**: No change required if we assume entities from the same query share an archetype. Document this as a constraint: **entities returned by `entities having X` must have the same component set** (archetype homogeneity). This is already true in practice — all enemy templates have identical component sets.

If we want to be explicit, we could add an optional archetype annotation:

```brl
// Optional: explicit archetype declaration
archetype EnemyArchetype = [Character, Health, Mana, Stats, Combat, Target, Team, Enemy, EnemyTemplate, Buffs]

let newEnemy: EnemyArchetype = clone templateId { EnemyTemplate { isTemplate: false } }
```

##### 2.1.2 Unparameterized `list` type

**Current BRL:**
```brl
let heroes: list = entities having Team
let indices: list = [0, 1, 2, 3, 4]
```

**Problem**: `list` has no element type. Rust needs `Vec<EntityId>` vs `Vec<i64>`.

**Proposed solution**: The compiler can infer the element type from the right-hand side:
- `entities having X` → `Vec<EntityId>` (always)
- `[0, 1, 2, 3, 4]` → `Vec<i64>` (from literal types)
- Function return types provide element types

**BRL language suggestion**: Make list type inference explicit in the compiler. No syntax change required — the existing type annotations (`let heroes: list`) are sufficient because the compiler can infer `list<id>` from the `entities having` expression. Optionally, allow explicit parameterization:

```brl
let heroes: list<id> = entities having Team
let indices: list<integer> = [0, 1, 2, 3, 4]
```

##### 2.1.3 Implicit `entity` binding in rules

**Current BRL:**
```brl
rule on GameStart(gs: id) {
    if entity has GameState {
        entity.GameState.currentWave = 1
    }
}
```

**How it works**: The engine iterates ALL entities (or those matching a filter). For each entity, it binds the implicit `entity` variable and executes the rule body. So the rule above runs once per entity, and the `if entity has GameState` check filters at runtime.

**For Rust compilation**: This maps directly to a `for` loop over queried entities:

```rust
pub fn rule_spawn_initial_enemies(event: &Event, world: &mut World, timeline: &mut Timeline) {
    for entity_id in world.query_component::<GameState>() {
        // rule body with `entity` = entity_id
        world.get_mut::<GameState>(entity_id).current_wave = 1;
    }
}
```

**No BRL change needed.** The compiler can analyze the `if entity has X` pattern and convert it to a typed query. When a rule body starts with `if entity has GameState`, the generated code iterates `world.query_component::<GameState>()` instead of all entities.

##### 2.1.4 Dynamic component access on arbitrary entities

**Current BRL:**
```brl
// 'attacker' comes from event field, not from a typed query
let attacker: id = da.source
let damage: id = attacker.Combat.damage  // accessing Combat on an entity we only have an ID for
```

**For Rust compilation**: The component name (`Combat`) and field name (`damage`) are compile-time literals. The only dynamic part is the entity ID. This compiles to:

```rust
let attacker = event.source;
let damage = world.get::<Combat>(attacker).damage;
```

This is safe as long as the entity actually has the `Combat` component. The generated code should include a runtime check (or the game design guarantees it).

**No BRL change needed.** The generated Rust uses direct struct access.

##### 2.1.5 Runtime component addition

**Current BRL** (in `classic-rpg.brl`):
```brl
entity.LordVexarDefeated.defeatedAt = entity.RunStats.simulationTime
```

**Problem**: `LordVexarDefeated` component may not be pre-initialized on the GameState entity.

**BRL language suggestion**: Require all components to be declared at entity creation. If a rule writes to a component, the entity must have that component initialized (possibly with default values). This is already good practice — add it as a compiler warning or error:

```brl
// In game-config.brl: pre-initialize the component with defaults
game_state = new entity {
    GameState { ... }
    LordVexarDefeated { defeatedAt: 0.0, defeatedByHeroCount: 0 }
}
```

#### Summary of suggested BRL adjustments

| Adjustment | Impact on existing BRL | Difficulty |
|-----------|------------------------|------------|
| Archetype-homogeneous queries (document constraint) | None — already true in practice | Trivial |
| List type inference in compiler | None — no syntax change | Easy (compiler work) |
| Pre-initialize all components on entities | Add default-valued components to entity defs | Easy (BRL file edits) |
| Optional: explicit list parameterization `list<id>` | Backward-compatible addition | Easy |
| Optional: explicit archetype declarations | Backward-compatible addition | Moderate |

**None of these require breaking changes to the BRL language.** The first three are constraints that are already satisfied by the existing game code; they just need to be formalized.

### Approach comparison

| Aspect | A: Interpret | B: IR→WASM | C: Bytecode VM | **D: BRL→Rust→WASM** |
|--------|-------------|-----------|----------------|---------------------|
| Performance | 2–5× | 5–20× | 5–10× | **10–50×** |
| Interpretation overhead | Full tree-walk | None | Flat bytecode | **None** |
| Runtime data structures | Maps, dynamic | Dynamic dispatch | Typed arrays | **Native Rust structs** |
| Component access | String lookup | String lookup | Integer lookup | **Direct struct field** |
| Entity queries | O(n) scan | O(n) scan | O(n) scan | **Typed O(n) scan, no dispatch** |
| Codegen complexity | None | Very High | Moderate | **Moderate** (AST→Rust source) |
| Maintenance | Dual engine | Dual engine | Dual engine | **Single compiler, Rust runtime lib** |
| Debugging | Full support | Hard | Moderate | **Rust debug tools + source maps** |
| BRL changes needed | None | None | None | **Minor (formalize existing constraints)** |

### Recommendation

**Approach D (BRL → Rust → WASM)** is recommended.

It provides maximum performance with moderate implementation complexity. The BRL language is already almost entirely statically compilable — the few dynamic features (entity queries, clone) map cleanly to typed Rust code because component names and field names are always compile-time literals in practice.

Key advantages over the other approaches:
- **No runtime engine to maintain**: The runtime library is small and stable (ECS store, timeline, event dispatch). Game-specific logic is generated code.
- **Native performance**: Component field access is a direct struct field read — no maps, no string lookups, no dispatch tables.
- **Existing compiler infrastructure**: The codegen is an addition to the existing TypeScript compiler, similar to the existing IR codegen.
- **Standard tooling**: `cargo build --target wasm32-unknown-unknown` and `wasm-pack` are mature, well-documented tools.

Approach C (bytecode VM) remains a valid fallback if Approach D proves more complex than estimated.

---

## 3. Recommended Architecture

### 3.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BUILD TIME (offline)                          │
│                                                                     │
│  ┌──────────────┐     ┌───────────────────┐    ┌────────────────┐  │
│  │ BRL source   │────►│ BRL Compiler      │───►│ Generated Rust │  │
│  │ (.brl files) │     │ (TypeScript)      │    │ source code    │  │
│  └──────────────┘     │                   │    │                │  │
│                       │ Existing compiler │    │ components.rs  │  │
│                       │ + new Rust codegen│    │ rules.rs       │  │
│                       └───────────────────┘    │ entities.rs    │  │
│                                                │ functions.rs   │  │
│                                                │ dispatch.rs    │  │
│                                                └───────┬────────┘  │
│                                                        │           │
│                                                        ▼           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  cargo build --target wasm32-unknown-unknown                 │  │
│  │                                                              │  │
│  │  Generated game code + blink_runtime crate → game.wasm       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (runtime)                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   GAME CLIENT (React App)                    │  │
│  │   UI reads state ◄───────── JS API Layer ──────── UI events │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
│                                 │                                   │
│                                 ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              @blink/engine-wasm (TypeScript Wrapper)          │  │
│  │                                                              │  │
│  │  • Same public API as @blink/engine (BlinkGame interface)    │  │
│  │  • Loads game.wasm                                           │  │
│  │  • Translates getState() into JS objects                     │  │
│  │  • Provides simulation callbacks to React                     │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
│                                 │                                   │
│                    ┌────────────┼────────────┐                      │
│                    │  JS ↔ WASM boundary     │                      │
│                    │  (minimize crossings)    │                      │
│                    └────────────┼────────────┘                      │
│                                 │                                   │
│                                 ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      game.wasm                                │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐    │  │
│  │  │  blink_runtime (Rust crate)                          │    │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │  │
│  │  │  │ ECS World │  │ Timeline │  │ String Intern    │  │    │  │
│  │  │  │ (typed)   │  │ (heap)   │  │ Table            │  │    │  │
│  │  │  └──────────┘  └──────────┘  └──────────────────┘  │    │  │
│  │  └─────────────────────────────────────────────────────┘    │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐    │  │
│  │  │  Generated game code (compiled from BRL)             │    │  │
│  │  │  • Component structs (Health, Combat, ...)          │    │  │
│  │  │  • Rule functions (rule_attack, rule_death, ...)    │    │  │
│  │  │  • User functions (calculate_damage, ...)           │    │  │
│  │  │  • Entity init (create_initial_entities)            │    │  │
│  │  │  • Event dispatch table                             │    │  │
│  │  └─────────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Roles

| Component | Language | Role |
|-----------|----------|------|
| BRL Compiler (Rust codegen) | TypeScript | New codegen pass in the existing compiler. Reads BRL AST, writes `.rs` files. |
| `blink_runtime` (crate) | Rust | Small, stable runtime library: typed ECS world, timeline (binary heap), event dispatch loop, string interning, built-in functions. |
| Generated game code | Rust (generated) | Component structs, rule functions, entity initializers, dispatch table. All compiled from BRL source. |
| `game.wasm` | WASM | Single binary containing runtime + generated code. All game logic is native WASM. |
| `@blink/engine-wasm` (npm) | TypeScript | JS wrapper with the same `BlinkGame` API. Loads `game.wasm`, manages lifecycle, reads state. |

### 3.3 The `blink_runtime` Crate

The runtime library is small and game-agnostic. It provides:

```rust
// ── ECS World ─────────────────────────────────────────────────────
pub struct World { /* typed component storage, entity management */ }

impl World {
    pub fn spawn(&mut self) -> EntityId;
    pub fn despawn(&mut self, id: EntityId);
    pub fn insert<C: Component>(&mut self, id: EntityId, component: C);
    pub fn get<C: Component>(&self, id: EntityId) -> &C;
    pub fn get_mut<C: Component>(&mut self, id: EntityId) -> &mut C;
    pub fn has<C: Component>(&self, id: EntityId) -> bool;
    pub fn query_component<C: Component>(&self) -> Vec<EntityId>;
    pub fn clone_entity(&mut self, source: EntityId) -> EntityId;
    pub fn get_all_entities(&self) -> Vec<EntityId>;
    pub fn get_state_json(&self) -> String;  // For JS state export
}

// ── Timeline ──────────────────────────────────────────────────────
pub struct Timeline { /* binary heap priority queue */ }

impl Timeline {
    pub fn schedule(&mut self, event: Event);
    pub fn schedule_delay(&mut self, delay: f64, event: Event);
    pub fn schedule_immediate(&mut self, event: Event);
    pub fn pop(&mut self) -> Option<Event>;
    pub fn has_events(&self) -> bool;
    pub fn get_time(&self) -> f64;
    pub fn cancel(&mut self, event_id: EventId);
}

// ── Event ─────────────────────────────────────────────────────────
pub struct Event {
    pub event_type: InternedString,
    pub source: Option<EntityId>,
    pub target: Option<EntityId>,
    pub fields: HashMap<InternedString, Value>,
}

// ── Value (for event fields and dynamic contexts) ─────────────────
pub enum Value {
    Integer(i64),
    Number(f64),
    String(InternedString),
    Boolean(bool),
    Entity(EntityId),
    List(Vec<Value>),
    None,
}
```

The `World` uses a component storage strategy based on `HashMap<EntityId, C>` per component type. Each component type `C` gets its own storage map. This gives O(1) component access by entity ID and O(n) iteration for queries.

### 3.4 Interaction with Existing JS Engine

The WASM engine is a **drop-in alternative** to the JS engine. Both implement the same `BlinkGame` public API:

```typescript
// Game client code — engine is swappable
import { BlinkGame } from '@blink/engine';       // JS engine
import { BlinkGame } from '@blink/engine-wasm';   // WASM engine

// Same API:
const game = await BlinkGame.create({ msPerFrame: 100 });
game.start();
game.onSimulation(event => { /* update UI */ });
const state = game.getState();
```

**Key difference**: The WASM engine does NOT load IR at runtime. The game rules are compiled into the WASM binary at build time. The `BlinkGame.create()` call initializes the pre-compiled game directly.

Both engines produce identical simulation results for the same BRL input (validated by conformance tests).

---

## 4. JS ↔ WASM Interface Design

### 4.1 Design Principle: Minimize Boundary Crossings

Every JS ↔ WASM call has overhead (~100ns). For a game processing thousands of events per second, this matters. The interface is designed around **batch operations**:

- **`run_steps(n)`**: Process N events entirely within WASM. Return only the count of events processed and the new simulation time.
- **`get_state_json()`**: Read a full snapshot from WASM memory. Done once per UI frame (60fps = every 16ms).
- No IR loading at runtime — game rules are compiled into the WASM binary.

### 4.2 Exported WASM Functions

```rust
// Core lifecycle — game is pre-compiled into WASM, no IR loading needed
#[wasm_bindgen]
pub fn create_engine(config_json: &str) -> EngineHandle;

#[wasm_bindgen]
pub fn destroy_engine(handle: EngineHandle);

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

// State queries (returns JSON)
#[wasm_bindgen]
pub fn get_state_json(handle: EngineHandle) -> String;

// Entity queries
#[wasm_bindgen]
pub fn query_entities(handle: EngineHandle, component_names_json: &str) -> String;

#[wasm_bindgen]
pub fn get_component_json(handle: EngineHandle, entity_id: u32, component_name: &str) -> String;

// Event management (for external triggers, e.g., player actions from UI)
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

  // No loadRulesFromObject() — game rules are pre-compiled into the WASM binary.

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

### 5.1 ECS: Typed Component Storage

With BRL → Rust compilation, the ECS uses **native Rust structs** instead of generic maps:

```rust
// Each component type gets its own storage (generated from BRL component definitions)
pub struct ComponentStorage {
    pub health: HashMap<EntityId, Health>,
    pub combat: HashMap<EntityId, Combat>,
    pub character: HashMap<EntityId, Character>,
    pub target: HashMap<EntityId, Target>,
    pub game_state: HashMap<EntityId, GameState>,
    // ... one HashMap per component type, all generated from BRL
}
```

**Component access is a direct struct field read:**

```rust
// JS engine: store.getField(entityId, "Health", "current") — 3 string lookups
// WASM engine: world.get::<Health>(entity_id).current       — 1 HashMap lookup + direct field
```

Benefits over the JS engine's Map-of-Maps:
- No string-keyed lookups for component names or field names
- No boxing/unboxing of values — fields are natively typed (`i64`, `f64`, `bool`)
- No garbage collection — all data in WASM linear memory
- Entity queries (`world.query_component::<Health>()`) iterate one HashMap's keys

### 5.2 String Interning

String fields in components (e.g., `Character.name`, `Character.class`) are interned at compile time. The generated code uses integer IDs for comparisons:

```rust
// Generated from BRL: if character.Character.class == "Warrior"
if world.get::<Character>(entity_id).class == intern("Warrior")
// Both sides are InternedString (u32) — integer comparison, not string comparison
```

The intern table maps IDs to strings only for JSON export to JS.

### 5.3 Timeline (Binary Heap)

Same as the JS engine's timeline, but in Rust with typed events:

```rust
struct Timeline {
    events: Vec<ScheduledEvent>,   // Binary heap
    current_time: f64,
    next_sequence: u64,
}

struct ScheduledEvent {
    time: f64,                                     // When to fire
    sequence: u64,                                 // Deterministic same-time ordering
    event_type: InternedString,                    // Event name (interned)
    source: Option<EntityId>,                      // Source entity
    target: Option<EntityId>,                      // Target entity
    fields: SmallVec<[(InternedString, Value); 4]>, // Event fields (stack-allocated for ≤4)
    recurring: bool,
    interval: f64,
}
```

---

## 6. Implementation Phases

### Phase 1: Runtime library — `blink_runtime` Rust crate

**Duration**: ~2 weeks  
**Deliverables**:
- Rust crate `packages/blink-runtime/` — game-agnostic runtime library
- Typed ECS World (spawn, despawn, insert/get/get_mut/has/query_component, clone_entity)
- Timeline (binary heap with schedule, pop, cancel, recurring events)
- String interning (intern, resolve, compare)
- Event struct with typed fields
- Value enum for dynamic event fields
- Built-in functions (min, max, floor, ceil, round, abs, random, random_range, len)
- `wasm-bindgen` exports for JS interop (create_engine, step, run_steps, get_state_json, etc.)
- Unit tests for all runtime components

**Build integration**:
- Add Makefile targets: `build-runtime`, `test-runtime`
- Output: Rust crate usable as a dependency by generated game code

### Phase 2: Rust codegen — BRL → Rust source generation

**Duration**: ~3 weeks  
**Deliverables**:
- New codegen pass in `packages/blink-compiler-ts/`
  - Component definitions → Rust struct definitions
  - Entity definitions → `create_initial_entities()` function
  - User-defined functions → Rust functions
  - Rules → Rust rule functions (one per rule)
  - Event dispatch → `dispatch_event()` match table
  - `if entity has X` pattern → `world.query_component::<X>()` iteration
  - `entities having X` → `world.query_component::<X>()`
  - `clone` → archetype-specific clone functions
  - `modify` → direct struct field mutations
  - `schedule` / `emit` → `timeline.schedule()` / `timeline.schedule_immediate()`
- CLI command: `blink-compiler compile --target rust -i game.brl -o generated/`
- Generated code compiles with `cargo build` against `blink_runtime`
- End-to-end test: BRL → Rust → cargo build → run → verify state matches JS engine

### Phase 3: WASM build pipeline and JS wrapper

**Duration**: ~2 weeks  
**Deliverables**:
- `packages/blink-engine-wasm-js/` — TypeScript wrapper package (npm)
- Build pipeline: `blink-compiler compile --target rust` → `cargo build --target wasm32` → `wasm-pack`
- `BlinkGame` API matching the JS engine's public API
- State snapshot export (JSON-based)
- Simulation lifecycle (start, pause, resume, stop, step, runSteps)
- Entity query and event scheduling from JS
- Makefile targets: `build-wasm`, `test-wasm`
- `game/demos/rpg-demo-wasm.html` — demo page using WASM engine

### Phase 4: Conformance testing and optimization

**Duration**: ~2 weeks  
**Deliverables**:
- Conformance test suite: run same BRL on both JS and WASM engines, compare state after N steps
- Edge case tests: empty rules, zero entities, recursive events, max iterations on while loops
- Performance benchmarks: JS vs WASM on real game BRL (classic-rpg scenario)
- Profile on mobile devices (Chrome Android, Safari iOS)
- Optimization based on profiling results

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

The WASM engine MUST produce identical simulation results to the JS engine for the same BRL input. This is validated by **conformance tests**:

```
For each test case:
  1. Compile the same BRL files to both:
     a. IR JSON → load into JS engine
     b. Rust source → cargo build → WASM
  2. Run N steps on both engines
  3. Compare entity state (component values) after each step
  4. Compare timeline state (pending events)
  5. Assert equality
```

**Test fixtures**: Use existing game BRL files:
- `game/brl/` — real game BRL files (classic-rpg, heroes, enemies, scenarios)
- `game/tests/brl/` — test BRL files

**Determinism requirement**: Both engines must use the same PRNG seed for `random()` / `random_range()` to produce identical results. This means:
- The PRNG algorithm must be specified (e.g., xoshiro256** or PCG) and identical in both engines
- The seed must be configurable via the engine API

### 7.2 Unit Tests (Rust)

Standard Rust unit tests for the runtime library:
- ECS: entity CRUD, component operations, queries
- Timeline: scheduling, ordering, recurring, cancellation
- String interning: intern/resolve roundtrip
- Built-in functions: correctness

### 7.3 Codegen Tests

Tests for the BRL → Rust codegen:
- Compile test BRL files to Rust, verify the generated Rust compiles
- Verify generated component structs match BRL definitions
- Verify generated rule functions match expected logic
- Verify dispatch table includes all event types

### 7.4 Integration Tests

End-to-end tests:
- Compile real game BRL → Rust → WASM, run full simulation, verify expected outcomes
- Test JS wrapper API matches expected behavior
- Test error handling (WASM traps → JS error callbacks)

### 7.5 Performance Tests

Benchmarks comparing JS and WASM engines:
- Events per second (throughput)
- Time to simulate 10,000 events (latency)
- Memory usage
- Startup time (WASM instantiation vs JS IR loading)

---

## 8. Potential Issues & Open Points

### 8.1 Issues with Known Mitigations

| Issue | Impact | Mitigation |
|-------|--------|------------|
| **WASM module size** | Larger download on mobile | Use `wasm-opt -Oz`, enable LTO, strip debug info. Target: <200KB gzipped. Each game compiles to its own WASM — the runtime lib is small. |
| **WASM startup time** | Delay before game can start | Use `WebAssembly.compileStreaming()` for parallel download+compile. Cache compiled module in IndexedDB. |
| **String handling in WASM** | Strings are not native to WASM | All string literals interned at compile time. Runtime uses integer IDs. String intern table only used for JSON export to JS. |
| **Random number determinism** | JS `Math.random()` and Rust `rand` use different algorithms | Implement the same PRNG in both engines (e.g., xoshiro256** with configurable seed). |
| **Bound choice functions** | Called from JS (UI) to get entity-specific behavior | Compile bound functions into WASM alongside rules. Export `evaluate_bound_function(handle, entity_id, func_name, args_json) -> String`. The JS wrapper calls this on demand. |
| **`list` and `map` field types** | Variable-size data in Rust | Use `Vec<Value>` for list fields, `HashMap<InternedString, Value>` for maps. The runtime `Value` enum handles this. |
| **While loop iteration limit** | JS engine has 10,000 iteration guard | Generate the same guard in compiled Rust rule code. |
| **Rebuild required for BRL changes** | BRL changes require re-running the Rust compilation pipeline | The JS engine remains available for rapid prototyping. Use WASM build only for testing and production. |

### 8.2 Open Points Requiring Decisions

#### OP-1: Rust toolchain in CI/CD

Adding Rust to the build pipeline introduces a new toolchain requirement. Developers who only work on the JS engine or compiler shouldn't need Rust installed.

**Options**:
- (a) Separate CI job for WASM builds (recommended)
- (b) Pre-built WASM binary checked into repo (violates the no-generated-code policy)
- (c) Docker-based build for WASM

**Recommendation**: Option (a). Rust builds are isolated to `packages/blink-runtime/` and the generated game code. The Makefile conditionally skips WASM targets if `cargo` is not installed.

#### OP-2: WASM engine feature parity

Should the WASM engine support ALL features of the JS engine?

**Proposed policy**: The WASM engine supports the **runtime simulation features** (rule execution, events, entities). It does NOT need to support:
- `onDebug` / `onTrace` callbacks (use JS engine for debugging)
- `devMode` (step-by-step debugging)
- Dynamic rule loading / merging — rules are compiled into the WASM binary
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
| D-1 | Approach D: BRL → Rust → WASM | Maximum performance — everything compiles to native code. No interpretation overhead. BRL is already >90% statically compilable. | **Proposed** |
| D-2 | Rust as implementation language | Best WASM tooling, no GC, excellent performance. BRL compiles to readable Rust. | **Proposed** |
| D-3 | Typed component storage (HashMap per component type) | Direct struct field access, no string lookups, no boxing. | **Proposed** |
| D-4 | JSON for state transfer to JS | Start simple. Optimize only when profiling shows need. | **Proposed** |
| D-5 | No debug/trace support in WASM engine | These are dev features; use JS engine for debugging. | **Proposed** |
| D-6 | Same public API as JS engine | Drop-in replacement. Game client code doesn't change. | **Proposed** |
| D-7 | Conformance tests as primary validation | Engines must produce identical results. This is the most important quality gate. | **Proposed** |
| D-8 | Rust codegen lives in existing TypeScript compiler | Leverages existing parser and AST. Single compiler with multiple backends (IR JSON, Rust). | **Proposed** |
| D-9 | Minor BRL language constraints for static compilation | Pre-initialize all components, archetype-homogeneous queries. Already satisfied in practice. | **Proposed** |

---

## Appendix A: File Structure

```
packages/
├── blink-engine/                 # Existing JS engine (unchanged)
├── blink-compiler-ts/            # Existing compiler (extended)
│   └── src/
│       ├── codegen.ts            # Existing IR codegen
│       └── codegen-rust.ts       # NEW: Rust codegen (BRL AST → .rs files)
├── blink-runtime/                # NEW: Rust runtime library
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs               # Public API
│   │   ├── world.rs             # Typed ECS world
│   │   ├── timeline.rs          # Binary heap event scheduler
│   │   ├── event.rs             # Event struct
│   │   ├── value.rs             # Value enum for dynamic fields
│   │   ├── interning.rs         # String intern table
│   │   ├── builtins.rs          # Built-in functions (min, max, random, etc.)
│   │   └── exports.rs           # wasm-bindgen exports
│   └── tests/                   # Rust unit tests
├── blink-engine-wasm-js/         # NEW: TypeScript wrapper
│   ├── package.json
│   ├── src/
│   │   ├── index.ts             # Main exports
│   │   ├── BlinkGame.ts         # BlinkGame API wrapper
│   │   └── WasmLoader.ts        # WASM module loading
│   ├── scripts/
│   │   └── build-bundle.js      # Bundle build script
│   └── dist/                    # Compiled output (generated, not committed)
│
│   # Generated per game (not committed):
├── generated/                    # Output of `blink-compiler --target rust`
│   ├── Cargo.toml               # Links to blink-runtime
│   ├── src/
│   │   ├── lib.rs               # Entry point + wasm-bindgen exports
│   │   ├── components.rs        # Generated component structs
│   │   ├── entities.rs          # Generated entity initializers
│   │   ├── rules.rs             # Generated rule functions
│   │   ├── functions.rs         # Generated user-defined functions
│   │   └── dispatch.rs          # Generated event dispatch table
│   └── pkg/                     # wasm-pack output (game.wasm + JS glue)
```

## Appendix B: Benchmark Targets

Based on analysis of the existing JS engine and typical mobile device capabilities:

| Metric | JS Engine (current) | WASM Target | Notes |
|--------|--------------------|----|-------|
| Events/second | ~50,000 | ~500,000+ | 10× improvement target (native code, no interpretation) |
| 10K event simulation | ~200ms | ~20ms | Important for catch-up scenarios |
| State snapshot (100 entities) | ~0.5ms | ~1ms (JSON) | JSON serialization overhead, acceptable |
| Startup time | ~5ms (IR load) | ~20ms (WASM instantiate) | One-time cost, acceptable |
| WASM module size | N/A | <200KB gzipped | Download budget for mobile |
| Memory usage (1000 entities) | ~2MB | ~0.5MB | Native structs are more compact |

## Appendix C: Build Pipeline

```
Developer writes BRL
      │
      ▼
blink-compiler compile --target rust -i game/brl/*.brl -o generated/
      │
      ▼
cd generated && cargo build --target wasm32-unknown-unknown --release
      │
      ▼
wasm-pack build --target web
      │
      ▼
game.wasm + JS glue → loaded by @blink/engine-wasm wrapper
      │
      ▼
React app loads WASM, starts simulation, reads state for UI
```

For development: use JS engine (no Rust/WASM needed, instant BRL changes).
For production: compile BRL → Rust → WASM for maximum performance.

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-04-05 | Initial draft — Approaches A/B/C, recommended bytecode VM (Approach C) |
| 0.2.0 | 2026-04-05 | Added Approach D (BRL → Rust → WASM). Changed recommendation to Approach D. Added BRL language analysis for static compilation. Updated architecture, phases, and file structure. |
