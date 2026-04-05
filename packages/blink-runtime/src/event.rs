/// Event struct for the timeline system.
/// Events are the primary mechanism for triggering game logic.

use std::collections::HashMap;

use crate::interning::InternedString;
use crate::value::{EntityId, Value, NO_ENTITY};

/// Unique event ID for cancellation.
pub type EventId = u32;

/// An event in the game simulation.
#[derive(Clone, Debug)]
pub struct Event {
    pub event_type: InternedString,
    pub source: EntityId,
    pub target: EntityId,
    pub fields: HashMap<InternedString, Value>,
    pub event_id: EventId,
}

impl Event {
    /// Create a new event with the given type.
    pub fn new(event_type: InternedString) -> Self {
        Event {
            event_type,
            source: NO_ENTITY,
            target: NO_ENTITY,
            fields: HashMap::new(),
            event_id: 0,
        }
    }

    /// Builder: set the source entity.
    pub fn with_source(mut self, source: EntityId) -> Self {
        self.source = source;
        self
    }

    /// Builder: set the target entity.
    pub fn with_target(mut self, target: EntityId) -> Self {
        self.target = target;
        self
    }

    /// Builder: add a field.
    pub fn with_field(mut self, name: InternedString, value: Value) -> Self {
        self.fields.insert(name, value);
        self
    }

    /// Get a field value by interned name.
    pub fn get_field(&self, name: InternedString) -> &Value {
        self.fields.get(&name).unwrap_or(&Value::None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::interning::StringInterner;

    #[test]
    fn test_event_creation() {
        let mut interner = StringInterner::new();
        let event_type = interner.intern("DoAttack");
        let field_name = interner.intern("damage");

        let event = Event::new(event_type)
            .with_source(1)
            .with_target(2)
            .with_field(field_name, Value::Integer(10));

        assert_eq!(event.event_type, event_type);
        assert_eq!(event.source, 1);
        assert_eq!(event.target, 2);
        assert_eq!(*event.get_field(field_name), Value::Integer(10));
    }

    #[test]
    fn test_event_missing_field() {
        let mut interner = StringInterner::new();
        let event_type = interner.intern("Test");
        let missing = interner.intern("missing");

        let event = Event::new(event_type);
        assert!(event.get_field(missing).is_none());
    }
}
