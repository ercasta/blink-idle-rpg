# BCL Resolution Rules Implementation

**Date**: 2026-01-04  
**Type**: Feature Implementation

## Summary

Implemented the BCL resolution rules as specified in `doc/architecture/bcl resolution rules.md`. This change makes choice functions first-class citizens in BRL/BDL, allows binding choice functions directly to entities (not via a ChoiceBindings component), and adds engine support for resolving and calling bound choice functions.

## Key Design Decisions

Based on feedback, the implementation follows these principles:
1. **Roster is NOT a language construct** - It's a regular BRL-defined component like any other
2. **Bound functions are first-class entity properties** - No ChoiceBindings component needed; functions bind directly to entities
3. **No fallback mechanism** - If a function is not bound to an entity, a runtime error is raised

## Changes Made

### Documentation Updates

1. **Updated `doc/architecture/bcl resolution rules.md`**:
   - Removed outdated references to Roster and ChoiceBindings components
   - Documented the new `.functionName = choice(...)` syntax
   - Added examples of IR output with `bound_functions`
   - Documented engine API methods for accessing bound functions
   - Added reference links to related documents

### Compiler Changes

1. **Lexer (`src/compiler/src/lexer/mod.rs`)**:
   - Added `choice` keyword token

2. **Parser (`src/compiler/src/parser/mod.rs`)**:
   - Added `BoundFunctionDef` AST node for bound choice functions
   - Updated `EntityDef` to include `bound_functions` field
   - Implemented parsing for `.functionName = choice(...) { }` syntax
   - Added `parse_bound_function()` method
   - Added `parse_choice_param_type()` for composite types (e.g., `Character & Skills`)
   - Added support for `list` type shorthand (without angle brackets)
   - Added test for parsing entity with bound function

3. **Analyzer (`src/compiler/src/analyzer/mod.rs`)**:
   - Added `TypedBoundFunction` type
   - Updated `TypedEntity` to include `bound_functions` field
   - Added `analyze_bound_function()` method with parameter scope handling

4. **IR Generator (`src/compiler/src/ir/mod.rs`)**:
   - Added `IRBoundFunction` type with params, return_type, body, and source fields
   - Updated `IREntity` to include optional `bound_functions` field
   - Added `generate_bound_function()` method

### Engine Implementation Changes (existing)

#### packages/blink-engine/src/ir/types.ts
- Added `IRBoundFunctions` interface - map of function names to definitions
- Added `IRBoundFunction` interface - function definition with params, body, source
- Extended `IREntityDefinition` with `bound_functions` field

#### packages/blink-engine/src/BlinkGame.ts
- Added `getBoundFunctions()` - get all bound functions for an entity
- Added `getBoundFunction()` - get a specific bound function
- Added `getBoundFunctionSource()` - get source for UI display
- Added `getBoundFunctionNames()` - list all bound function names

## Example BDL Syntax

```bdl
entity @warrior {
    Character { name: "Sir Braveheart", class: "Warrior" }
    Health { current: 120, max: 120 }
    
    .selectAttackTarget = choice(enemies: list): id {
        let target = enemies[0]
        for enemy in enemies {
            if enemy.Combat.damage > target.Combat.damage {
                target = enemy
            }
        }
        return target.id
    }
    
    .selectCombatSkill = choice(character: Character & Skills, allies: list, enemies: list): string {
        let hp_pct = character.Health.current / character.Health.max
        if hp_pct < 0.3 {
            return "defensive_stance"
        }
        return "power_strike"
    }
}
```

## Example IR Output

```json
{
  "initial_state": {
    "entities": [{
      "id": 0,
      "name": "warrior",
      "components": { ... },
      "bound_functions": {
        "selectAttackTarget": {
          "params": [{ "name": "enemies", "type": { "type": "list", "element": { "type": "entity" } } }],
          "return_type": { "type": "entity" },
          "body": { ... }
        }
      }
    }]
  }
}
```

## Testing

- All existing compiler tests pass (15 tests)
- New test added for parsing entity with bound function
- Manual compilation test verified IR output contains `bound_functions`

## Future Work

- Update hero definitions in `game/bdl/heroes.bdl` with actual bound choice functions
- Implement source text capture for bound functions (for UI display)
- Connect HTML demo to use bound functions from IR

## Related Documents

- `doc/architecture/bcl resolution rules.md` - High-level architecture
- `doc/architecture/bcl-compiler-requirements.md` - Detailed requirements
- `doc/architecture/bcl-function-resolution.md` - Resolution architecture
