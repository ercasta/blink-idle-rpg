/// Blink Runtime Library
///
/// Game-agnostic runtime for the Blink WASM engine.
/// Provides ECS World, Timeline, Event system, string interning, and built-in functions.
///
/// Generated game code (from BRL → Rust compilation) links against this crate
/// and provides concrete component types, rule functions, and entity initializers.

pub mod builtins;
pub mod event;
pub mod interning;
pub mod timeline;
pub mod value;
pub mod world;

// Re-export key types for convenience
pub use builtins::{brl_abs, brl_ceil, brl_floor, brl_log, brl_max, brl_min, brl_round, brl_sqrt, Rng};
pub use event::{Event, EventId};
pub use interning::{InternedString, StringInterner};
pub use timeline::Timeline;
pub use value::{EntityId, EntitySnapshot, GameStateSnapshot, Value, NO_ENTITY};
pub use world::{ComponentStorage, TypedStorage, World};

/// The main game engine that coordinates World, Timeline, and event dispatch.
/// Generated code provides the dispatch function and initial entity setup.
pub struct Engine {
    pub world: World,
    pub timeline: Timeline,
    pub interner: StringInterner,
    pub rng: Rng,
    max_while_iterations: u32,
}

impl Engine {
    /// Create a new engine with default settings.
    pub fn new() -> Self {
        Engine {
            world: World::new(),
            timeline: Timeline::new(),
            interner: StringInterner::new(),
            rng: Rng::new(42),
            max_while_iterations: 10_000,
        }
    }

    /// Create a new engine with a specific RNG seed.
    pub fn with_seed(seed: u64) -> Self {
        Engine {
            world: World::new(),
            timeline: Timeline::new(),
            interner: StringInterner::new(),
            rng: Rng::new(seed),
            max_while_iterations: 10_000,
        }
    }

    /// Get the current simulation time.
    pub fn get_time(&self) -> f64 {
        self.timeline.get_time()
    }

    /// Check if there are pending events.
    pub fn has_events(&self) -> bool {
        self.timeline.has_events()
    }

    /// Get the max while loop iterations guard.
    pub fn max_while_iterations(&self) -> u32 {
        self.max_while_iterations
    }

    /// Reset the engine to initial state.
    pub fn reset(&mut self) {
        self.world.reset();
        self.timeline.reset();
    }

    /// Export the game state as a JSON string.
    /// This is the primary mechanism for the JS wrapper to read state.
    pub fn get_state_json<F>(&self, entity_serializer: F) -> String
    where
        F: Fn(&World, &StringInterner, EntityId) -> std::collections::HashMap<String, std::collections::HashMap<String, serde_json::Value>>,
    {
        let entities: Vec<EntitySnapshot> = self
            .world
            .get_all_entities()
            .iter()
            .map(|&id| EntitySnapshot {
                id,
                variable: self.world.get_variable_name(id).map(|s| s.to_string()),
                components: entity_serializer(&self.world, &self.interner, id),
            })
            .collect();

        let snapshot = GameStateSnapshot {
            time: self.timeline.get_time(),
            entities,
            pending_events: self.timeline.len(),
        };

        serde_json::to_string(&snapshot).unwrap_or_else(|_| "{}".to_string())
    }
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_creation() {
        let engine = Engine::new();
        assert_eq!(engine.get_time(), 0.0);
        assert!(!engine.has_events());
    }

    #[test]
    fn test_engine_with_seed() {
        let engine = Engine::with_seed(12345);
        assert_eq!(engine.get_time(), 0.0);
    }

    #[test]
    fn test_engine_reset() {
        let mut engine = Engine::new();
        engine
            .timeline
            .schedule_delay(1.0, Event::new(InternedString::NONE));
        assert!(engine.has_events());
        engine.reset();
        assert!(!engine.has_events());
    }
}
