/// Value enum for dynamic event fields and runtime values.
/// Component fields use native Rust types (generated structs), but event fields
/// and some runtime contexts need a dynamic value type.

use crate::interning::InternedString;
use serde::Serialize;

/// Entity ID type - a simple u32 wrapper.
pub type EntityId = u32;

/// Sentinel value for "no entity".
pub const NO_ENTITY: EntityId = 0;

/// Dynamic value type for event fields and runtime contexts.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    Integer(i64),
    Number(f64),
    String(InternedString),
    Boolean(bool),
    Entity(EntityId),
    List(Vec<Value>),
    None,
}

impl Default for Value {
    fn default() -> Self {
        Value::None
    }
}

impl Value {
    /// Convert to i64, coercing if possible.
    pub fn as_integer(&self) -> i64 {
        match self {
            Value::Integer(v) => *v,
            Value::Number(v) => *v as i64,
            Value::Boolean(v) => if *v { 1 } else { 0 },
            Value::Entity(v) => *v as i64,
            _ => 0,
        }
    }

    /// Convert to f64, coercing if possible.
    pub fn as_number(&self) -> f64 {
        match self {
            Value::Number(v) => *v,
            Value::Integer(v) => *v as f64,
            Value::Boolean(v) => if *v { 1.0 } else { 0.0 },
            Value::Entity(v) => *v as f64,
            _ => 0.0,
        }
    }

    /// Convert to bool.
    pub fn as_boolean(&self) -> bool {
        match self {
            Value::Boolean(v) => *v,
            Value::Integer(v) => *v != 0,
            Value::Number(v) => *v != 0.0,
            Value::Entity(v) => *v != NO_ENTITY,
            Value::None => false,
            Value::String(s) => *s != InternedString::NONE,
            Value::List(l) => !l.is_empty(),
        }
    }

    /// Convert to EntityId.
    pub fn as_entity(&self) -> EntityId {
        match self {
            Value::Entity(v) => *v,
            Value::Integer(v) => *v as EntityId,
            Value::Number(v) => *v as EntityId,
            _ => NO_ENTITY,
        }
    }

    /// Check if value is None.
    pub fn is_none(&self) -> bool {
        matches!(self, Value::None)
    }

    /// Serialize to JSON-compatible format for state export.
    pub fn to_json_value(&self, interner: &crate::interning::StringInterner) -> serde_json::Value {
        match self {
            Value::Integer(v) => serde_json::Value::Number(serde_json::Number::from(*v)),
            Value::Number(v) => serde_json::json!(*v),
            Value::String(s) => serde_json::Value::String(interner.resolve(*s).to_string()),
            Value::Boolean(v) => serde_json::Value::Bool(*v),
            Value::Entity(v) => serde_json::Value::Number(serde_json::Number::from(*v)),
            Value::List(items) => {
                let arr: Vec<serde_json::Value> =
                    items.iter().map(|v| v.to_json_value(interner)).collect();
                serde_json::Value::Array(arr)
            }
            Value::None => serde_json::Value::Null,
        }
    }
}

/// Serializable state snapshot for a single entity, used in JSON export.
#[derive(Serialize, Debug)]
pub struct EntitySnapshot {
    pub id: EntityId,
    pub variable: Option<String>,
    pub components: std::collections::HashMap<String, std::collections::HashMap<String, serde_json::Value>>,
}

/// Full game state snapshot for JSON export.
#[derive(Serialize, Debug)]
pub struct GameStateSnapshot {
    pub time: f64,
    pub entities: Vec<EntitySnapshot>,
    pub pending_events: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_value_conversions() {
        assert_eq!(Value::Integer(42).as_integer(), 42);
        assert_eq!(Value::Integer(42).as_number(), 42.0);
        assert_eq!(Value::Number(3.14).as_integer(), 3);
        assert_eq!(Value::Number(3.14).as_number(), 3.14);
        assert!(Value::Boolean(true).as_boolean());
        assert!(!Value::Boolean(false).as_boolean());
        assert_eq!(Value::Entity(5).as_entity(), 5);
        assert!(!Value::None.as_boolean());
        assert!(Value::None.is_none());
    }

    #[test]
    fn test_value_default() {
        let v = Value::default();
        assert!(v.is_none());
    }
}
