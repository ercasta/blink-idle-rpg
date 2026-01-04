# Remove Named Entities and Implement Variable-Based Entity System

**Date**: 2026-01-04  
**Agent**: GitHub Copilot Coding Agent  
**Request**: Remove named entities concept and implement variable-based entity reference system

## Summary

This change removes the concept of named entities (e.g., `@warrior`) from BRL/BDL and replaces it with a variable-based entity reference system.

## Changes Overview

### New Syntax

#### Creating entities:
```bdl
warrior = new entity {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
    }
}
```

#### Querying entities:
```brl
let warriors = entities having Character  // Returns array of entities
```

### Language Changes

1. **Remove `@name` entity syntax** - Entities are nameless by default (deprecated but still supported)
2. **Add `new entity` syntax** - Create entities with variable assignment
3. **Add `having` keyword** - Query entities by component type

### Files Modified

1. `src/compiler/src/lexer/mod.rs` - Added `new`, `having`, `entities` keywords
2. `src/compiler/src/parser/mod.rs` - Updated entity parsing, added EntitiesHaving expression
3. `src/compiler/src/analyzer/mod.rs` - Updated type checking, renamed name to variable
4. `src/compiler/src/ir/mod.rs` - Updated IR generation, renamed name to variable
5. `doc/ir-specification.md` - Updated IR format documentation
6. `packages/blink-engine/src/ir/types.ts` - Added variable field to TypeScript types
7. `AGENTS.md` - Added language compilation test suite requirement
8. `src/compiler/tests/language_tests.rs` - Created comprehensive test suite (28 tests)

### Hielements Changes

No changes required to hielements.hie - the file structure remains the same.

## Migration Guide

### Before (Old Syntax):
```bdl
entity @warrior {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
    }
}
```

### After (New Syntax):
```bdl
warrior = new entity {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
    }
}
```

## Backward Compatibility

The old `entity @name { ... }` syntax is still supported but deprecated. It will be removed in a future version.

## Future Work (Not Implemented)

The following features were requested but not implemented in this PR:
- Array-based component access (`a.fighter += Component`)
- Implicit `[0]` indexing for component arrays

These features may be added in future work if needed.
