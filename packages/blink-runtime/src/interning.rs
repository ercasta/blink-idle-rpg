/// String interning for efficient string comparisons.
/// At compile time, all string literals in BRL are assigned integer IDs.
/// At runtime, comparisons use integer equality instead of string comparison.

use std::collections::HashMap;

/// An interned string represented as a u32 index.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug, Default)]
pub struct InternedString(pub u32);

impl InternedString {
    pub const NONE: InternedString = InternedString(0);
}

/// Global string intern table.
/// Maps string values to integer IDs and back.
pub struct StringInterner {
    to_id: HashMap<String, u32>,
    to_string: Vec<String>,
}

impl StringInterner {
    pub fn new() -> Self {
        let mut interner = StringInterner {
            to_id: HashMap::new(),
            to_string: Vec::new(),
        };
        // Reserve index 0 for the empty/none string
        interner.to_string.push(String::new());
        interner.to_id.insert(String::new(), 0);
        interner
    }

    /// Intern a string, returning its ID. If already interned, returns existing ID.
    pub fn intern(&mut self, s: &str) -> InternedString {
        if let Some(&id) = self.to_id.get(s) {
            return InternedString(id);
        }
        let id = self.to_string.len() as u32;
        self.to_string.push(s.to_string());
        self.to_id.insert(s.to_string(), id);
        InternedString(id)
    }

    /// Resolve an interned string back to its string value.
    pub fn resolve(&self, id: InternedString) -> &str {
        self.to_string
            .get(id.0 as usize)
            .map(|s| s.as_str())
            .unwrap_or("")
    }
}

impl Default for StringInterner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intern_and_resolve() {
        let mut interner = StringInterner::new();
        let id1 = interner.intern("hello");
        let id2 = interner.intern("world");
        let id3 = interner.intern("hello"); // duplicate

        assert_eq!(id1, id3); // same string = same ID
        assert_ne!(id1, id2); // different strings = different IDs
        assert_eq!(interner.resolve(id1), "hello");
        assert_eq!(interner.resolve(id2), "world");
    }

    #[test]
    fn test_none_string() {
        let interner = StringInterner::new();
        assert_eq!(interner.resolve(InternedString::NONE), "");
    }

    #[test]
    fn test_default() {
        let id = InternedString::default();
        assert_eq!(id, InternedString::NONE);
    }
}
