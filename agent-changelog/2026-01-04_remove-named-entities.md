# Remove Named Entities and Implement Array-Based Entity System

**Date**: 2026-01-04  
**Agent**: GitHub Copilot Coding Agent  
**Request**: Remove named entities concept and implement array-based entity system

## Summary

This change removes the concept of named entities (e.g., `@warrior`) from BRL/BDL and replaces it with a variable-based entity reference system with array support.

## Changes Overview

### New Syntax

#### Creating entities:
```brl
a = new entity
a.fighter = Character      // Assign component to fighter array
a.fighter += Character     // Append to fighter array
a.fighter.name = "Sir Braveheart"  // Implicit [0] indexing
a.fighter[0].name = "Sir Braveheart"  // Explicit indexing
```

#### Querying entities:
```brl
warriors = entities having Character  // Returns array of entities
```

### Language Changes

1. **Remove `@name` entity syntax** - Entities are nameless by default
2. **Add `new entity` syntax** - Create entities with variable assignment
3. **Support array components** - Components can be arrays
4. **Implicit `[0]` indexing** - When not specified, array index defaults to 0
5. **Add `having` keyword** - Query entities by component type

### Files Modified

1. `doc/language/brl-specification.md` - Updated entity syntax
2. `doc/language/bdl-specification.md` - Updated entity syntax
3. `src/compiler/src/lexer/mod.rs` - Added `new`, `having` keywords
4. `src/compiler/src/parser/mod.rs` - Updated entity parsing
5. `src/compiler/src/analyzer/mod.rs` - Updated type checking
6. `src/compiler/src/ir/mod.rs` - Updated IR generation
7. `doc/ir-specification.md` - Updated IR format
8. `game/bdl/*.bdl` - Migrated to new syntax
9. `AGENTS.md` - Added language compilation test suite requirement

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
warrior = new entity
warrior.Character = Character {
    name: "Sir Braveheart"
    class: "Warrior"
}
```

Or with the shorthand:
```bdl
warrior = new entity {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
    }
}
```
