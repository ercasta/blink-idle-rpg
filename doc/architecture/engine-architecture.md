# Blink Engine Architecture

## Timeline System

### Overview

The timeline manages future events ordered by their scheduled time.

### Data Structure

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

### Operations

| Operation | Complexity | Description |
|-----------|------------|-------------|
| `schedule(event, delay)` | O(log n) | Add event at current_time + delay |
| `schedule_at(event, time)` | O(log n) | Add event at absolute time |
| `pop_next()` | O(log n) | Remove and return next event |
| `peek()` | O(1) | View next event without removing |
| `cancel(id)` | O(n) | Remove event by ID |

### Recurring Events

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

### Immediate Event Stack

Events can trigger other events immediately. These go on a stack.

---

## Entity-Component System

### Overview

The ECS stores all game state as entities with attached components.

### Entity

An entity is simply a unique identifier:

```rust
struct EntityId(u64);
```

### Component Storage

Components are stored in typed containers.

---

## Event System

### Events as Entities

Events are entities with special components that describe the event payload and metadata.

---

## Rule Engine

### Rule Matching

When an event triggers, the engine finds matching rules by checking event type, evaluating conditions, and executing rules in priority order.

---

## Engine Interfaces

### Core Engine Interface

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
