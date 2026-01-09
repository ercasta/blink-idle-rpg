# Blink Engine Architecture

**Version**: 0.1.0-draft  

## 7. Tracker System

The tracker system has been removed from the language and engine design. Previously, trackers automatically captured component data for UI feedback; this functionality should now be implemented explicitly from rules or by emitting UI events from rule actions.

Engines may still encounter legacy IR containing an optional `trackers` field; such entries should be treated as deprecated and ignored.
      │         └── Event B
      └── Event A
```

---

## 3. Timeline System

### 3.1 Overview

The timeline manages future events ordered by their scheduled time.

### 3.2 Data Structure

```rust
// Conceptual structure (not actual implementation)
struct Timeline {
    /// Priority queue of future events, ordered by time
    events: BinaryHeap<ScheduledEvent>,
    
    /// Current simulation time
    current_time: Decimal,
    
    /// Recurring event definitions
    recurring: HashMap<RecurringId, RecurringEvent>,
}

struct ScheduledEvent {
    /// When the event should trigger
    time: Decimal,
    
    /// The event entity
    event_id: EntityId,
    
    /// Ordering for same-time events
    sequence: u64,
}
```

### 3.3 Operations

| Operation | Complexity | Description |
|-----------|------------|-------------|
| `schedule(event, delay)` | O(log n) | Add event at current_time + delay |
| `schedule_at(event, time)` | O(log n) | Add event at absolute time |
| `pop_next()` | O(log n) | Remove and return next event |
| `peek()` | O(1) | View next event without removing |
| `cancel(id)` | O(n) | Remove event by ID |

### 3.4 Recurring Events

```rust
struct RecurringEvent {
    /// Interval between occurrences
    interval: Decimal,
    
    /// Template for generating events
    template: EventTemplate,
    
    /// Next scheduled occurrence
    next_time: Decimal,
}
```

### 3.5 Immediate Event Stack

Events can trigger other events immediately. These go on a stack:

```
Timeline Queue          Immediate Stack
   (future)               (now)
┌───────────┐          ┌───────────┐
│ Event @1.0│          │ Effect C  │ ← Process first
│ Event @2.0│          │ Effect B  │
│ Event @3.0│          │ Effect A  │
└───────────┘          └───────────┘
```

---

## 4. Entity-Component System

### 4.1 Overview

The ECS stores all game state as entities with attached components.

### 4.2 Entity

An entity is simply a unique identifier:

```rust
struct EntityId(u64);
```

### 4.3 Component Storage

Components are stored in typed containers:

```rust
// Conceptual structure
struct ComponentStore<T: Component> {
    /// Map from entity to component(s)
    data: HashMap<EntityId, Vec<T>>,
}

struct World {
    /// All component stores, keyed by component type
    stores: HashMap<TypeId, Box<dyn AnyComponentStore>>,
    
    /// Entity metadata
    entities: HashMap<EntityId, EntityMeta>,
    
    /// Next entity ID
    next_id: u64,
}
```

### 4.4 Operations

| Operation | Description |
|-----------|-------------|
| `create_entity()` | Create new entity, return ID |
| `delete_entity(id)` | Remove entity and all components |
| `add_component(entity, component)` | Attach component to entity |
| `remove_component<T>(entity)` | Remove component(s) of type |
| `get_component<T>(entity)` | Get component reference |
| `get_components<T>(entity)` | Get all components of type |
| `has_component<T>(entity)` | Check if entity has component |
| `query<T, U, ...>()` | Find entities with components |

### 4.5 Component Lists

When an entity has multiple components of the same type:

```rust
// Entity with multiple Buff components
entity.add_component(Buff { name: "strength", duration: 10.0 });
entity.add_component(Buff { name: "haste", duration: 5.0 });

// Access as list
let buffs = entity.get_components::<Buff>();
for buff in buffs {
    // Process each buff
}
```

---

## 5. Event System

### 5.1 Events as Entities

Events are entities with special components:

```rust
component EventMeta {
    /// Event type identifier
    event_type: string
    
    /// Source entity (if applicable)
    source: id?
    
    /// Target entity (if applicable)
    target: id?
}
```

### 5.2 Event Lifecycle

```
┌──────────────┐
│   Created    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Scheduled  │──────► Timeline or Stack
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Triggered  │──────► Rules execute
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Consumed   │──────► Event entity deleted
└──────────────┘
```

### 5.3 Event Types

```brl
// Combat events
component DamageEvent { source: id, target: id, amount: integer, type: string }
component HealEvent { source: id, target: id, amount: integer }
component DeathEvent { target: id }

// Ability events  
component AbilityUsed { caster: id, ability: string, targets: list }
component CooldownComplete { entity: id, ability: string }

// Status events
component BuffApplied { target: id, buff: string, duration: float }
component BuffExpired { target: id, buff: string }

// Game flow events
component TurnStart { entity: id }
component TurnEnd { entity: id }
component CombatStart { }
component CombatEnd { victor: string }
```

---

## 6. Rule Engine

### 6.1 Rule Matching

When an event triggers, the engine finds matching rules:

```rust
struct Rule {
    /// Rule identifier
    id: RuleId,
    
    /// Event type(s) this rule responds to
    triggers: Vec<EventType>,
    
    /// Optional condition
    condition: Option<Expression>,
    
    /// Priority for ordering
    priority: i32,
    
    /// Compiled rule body
    body: CompiledBlock,
}
```

### 6.2 Execution Order

1. Find all rules matching the event type
2. Evaluate conditions (filter non-matching)
3. Sort by priority (higher first)
4. Execute each rule in order

```
Event: DamageEvent

Matching Rules:
  ├── [Priority 100] Shield absorption
  ├── [Priority  50] Damage reduction  
  ├── [Priority   0] Apply damage
  └── [Priority -50] Death check
```

### 6.3 Rule Context

Rules execute with context:

```rust
struct RuleContext {
    /// The triggering event
    event: EntityId,
    
    /// World state
    world: &mut World,
    
    /// Timeline for scheduling
    timeline: &mut Timeline,
    
    /// Tracker output collector
    trackers: &mut TrackerOutput,
}
```

### 6.4 BCL Integration

Rules can call BCL choice functions:

```brl
rule on TurnStart {
    let target = call_choice("select_attack_target", entity, enemies)
    schedule AttackEvent {
        attacker: entity.id
        target: target
    }
}
```

---

## 7. Tracker System

### 7.1 Purpose

Trackers automatically capture component data for user feedback. They specify which component to track on which events, and the engine handles data collection.

### 7.2 Tracker Definition

```rust
struct Tracker {
    /// Tracker identifier
    id: TrackerId,
    
    /// Component type to track
    component_type: ComponentType,
    
    /// Event type(s) that trigger tracking
    triggers: Vec<EventType>,
}
```

### 7.3 Tracking Behavior

When a tracker fires:
1. Engine queries all entities with the specified component
2. Captures all field values for each entity
3. Packages as TrackerOutput with event context
4. Sends to UI/output stream

### 7.4 Output Format

```rust
struct TrackerOutput {
    /// Timestamp when the tracker fired
    time: Decimal,
    
    /// Event that triggered this tracker
    event_type: EventType,
    
    /// Component being tracked
    component_type: ComponentType,
    
    /// All entities with this component and their data
    entities: Vec<EntityComponentData>,
}

struct EntityComponentData {
    /// Entity ID
    entity_id: EntityId,
    
    /// Component fields as key-value pairs
    fields: HashMap<String, FieldValue>,
}

enum FieldValue {
    String(String),
    Integer(i64),
    Float(f64),
    Decimal(Decimal),
    Boolean(bool),
    EntityId(EntityId),
}
```

### 7.5 Examples

Trackers were removed from the language and engine. Instead of declaring `tracker` blocks, author explicit rule actions that emit UI-friendly events or schedule `LogEvent` entities. The UI subscribes to these events and updates accordingly.

BRL alternative (emit UI event):
```brl
rule on_damage on DamageEvent {
    // Emit a UI-friendly event with necessary context
    schedule LogEvent {
        message: "Damage applied",
        data: "attacker=" + event.DamageEvent.source as string + ", target=" + event.DamageEvent.target as string + ", amount=" + event.DamageEvent.amount as string
    }
}
```

UI behavior:
```javascript
// Subscribe to LogEvent or other emitted UI events
function handleLogEvent(evt) {
  // Parse evt.data and update health bars, combat log, animations, etc.
}
```

---

## 8. Intermediate Representation

### 8.1 Purpose

The IR (Intermediate Representation) allows:
- Single compiler frontend (BRL parser)
- Multiple backends (JS, WASM, native)
- Optimization passes
- Debugging support

### 8.2 IR Structure

```rust
/// A compiled BRL module
struct IRModule {
    /// Module name
    name: String,
    
    /// Component definitions
    components: Vec<IRComponent>,
    
    /// Rule definitions
    rules: Vec<IRRule>,
    
    /// Function definitions
    functions: Vec<IRFunction>,
    
    /// Tracker definitions
    trackers: Vec<IRTracker>,
}

struct IRComponent {
    name: String,
    fields: Vec<IRField>,
}

struct IRField {
    name: String,
    field_type: IRType,
    optional: bool,
}

enum IRType {
    String,
    Boolean,
    Integer,
    Float,
    Decimal { precision: u8 },
    EntityId,
    Component(String),
    List(Box<IRType>),
}
```

### 8.3 IR Instructions

```rust
enum IRInstruction {
    // Variables
    LoadLocal(LocalId),
    StoreLocal(LocalId),
    
    // Entity/Component access
    GetComponent { entity: Operand, component: String },
    SetField { entity: Operand, component: String, field: String, value: Operand },
    HasComponent { entity: Operand, component: String },
    
    // Entity lifecycle
    CreateEntity,
    DeleteEntity(Operand),
    AddComponent { entity: Operand, component: IRComponent },
    RemoveComponent { entity: Operand, component: String },
    
    // Events
    ScheduleImmediate(Operand),
    ScheduleDelayed { event: Operand, delay: Operand },
    ScheduleRecurring { event: Operand, interval: Operand },
    CancelRecurring(Operand),
    
    // Control flow
    Jump(LabelId),
    JumpIf { condition: Operand, target: LabelId },
    Call { function: String, args: Vec<Operand> },
    CallChoice { function: String, args: Vec<Operand> },
    Return(Option<Operand>),
    
    // Arithmetic & logic
    BinaryOp { op: BinaryOp, left: Operand, right: Operand },
    UnaryOp { op: UnaryOp, operand: Operand },
    Compare { op: CompareOp, left: Operand, right: Operand },
    
    // Tracker output
    EmitTracker { tracker: TrackerId, data: Operand },
}
```

---

## 9. Engine Interfaces

### 9.1 Core Engine Interface

```rust
trait BlinkEngine {
    /// Initialize with game rules
    fn load_rules(&mut self, rules: IRModule) -> Result<()>;
    
    /// Load initial game state
    fn load_state(&mut self, state: GameState) -> Result<()>;
    
    /// Load player choices (BCL)
    fn load_choices(&mut self, choices: BCLModule) -> Result<()>;
    
    /// Run simulation until completion or limit
    fn run(&mut self, options: RunOptions) -> SimulationResult;
    
    /// Step one event
    fn step(&mut self) -> Option<StepResult>;
    
    /// Get current state snapshot
    fn get_state(&self) -> GameStateSnapshot;
    
    /// Get tracker output since last call
    fn drain_tracker_output(&mut self) -> Vec<TrackerOutput>;
}
```

### 9.2 Run Options

```rust
struct RunOptions {
    /// Maximum simulation time
    max_time: Option<Decimal>,
    
    /// Maximum events to process
    max_events: Option<u64>,
    
    /// Maximum real time to spend
    max_real_time: Option<Duration>,
    
    /// Time scale (simulation time / real time)
    time_scale: f64,
    
    /// Collect tracker output?
    collect_trackers: bool,
}
```

### 9.3 Browser-Specific Interface

See [browser-engine.md](browser-engine.md) for JavaScript/WASM specifics.

---

## Appendix A: Performance Considerations

### Memory Management
- Use arena allocation for entities
- Pool component storage
- Avoid frequent allocations during simulation

### Batching
- Process multiple events per frame when catching up
- Batch tracker outputs
- Use dirty flags for change detection

### WASM Optimization
- Minimize JS/WASM boundary crossings
- Use SharedArrayBuffer where available
- Consider web workers for heavy computation

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2024-12-31 | Initial draft |
