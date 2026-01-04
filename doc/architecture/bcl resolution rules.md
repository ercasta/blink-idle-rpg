# BCL Resolution Rules

Blink Choice Language allows players to specify behaviour in correspondence of specific rules. This document describes how the engine resolves which BCL function to call for each entity.

## Core Principles

1. **Choice functions are first-class citizens** - They can be defined inline in BDL entity definitions and are bound directly to entities
2. **No ChoiceBindings component** - Functions bind directly to entities as `bound_functions`
3. **No Roster component** - Hero entities are regular entities loaded from BDL; Roster (if needed) is a regular BRL-defined component
4. **Required binding** - If a choice function is not found on an entity, an error is raised (no fallback)

## Implementation

### 1. BDL Entity Syntax with Bound Choice Functions

BDL allows declaring bound choice functions directly on entity definitions using the `.functionName = choice(...) { ... }` syntax:

```bdl
entity @warrior {
    Character { name: "Sir Braveheart", class: "Warrior", level: 1 }
    Health { current: 120, max: 120 }
    Combat { damage: 18, defense: 10 }
    
    // Bound choice function for target selection
    .selectAttackTarget = choice(character: Character, enemies: list): id {
        // Warriors prioritize high-threat targets
        let target = enemies[0]
        for enemy in enemies {
            if enemy.Combat.damage > target.Combat.damage {
                target = enemy
            }
        }
        return target.id
    }
    
    // Bound choice function for skill selection
    .selectCombatSkill = choice(character: Character & Skills & Health, allies: list, enemies: list): string {
        let hp_pct = character.Health.current / character.Health.max
        if hp_pct < 0.3 {
            return "defensive_stance"
        }
        return "power_strike"
    }
}
```

### 2. IR Output

The compiler generates `bound_functions` directly on entities in the IR:

```json
{
  "initial_state": {
    "entities": [{
      "id": "warrior",
      "name": "Sir Braveheart",
      "components": { ... },
      "bound_functions": {
        "selectAttackTarget": {
          "params": [
            { "name": "character", "type": "Character" },
            { "name": "enemies", "type": { "list": "entity" } }
          ],
          "return_type": "id",
          "body": { /* IR expression tree */ },
          "source": "choice(character: Character, enemies: list): id { ... }"
        }
      }
    }]
  }
}
```

### 3. Engine API

The JavaScript engine exposes methods to access bound functions:

- `getBoundFunctions(entityId)` - Get all bound functions for an entity
- `getBoundFunction(entityId, functionName)` - Get a specific bound function
- `getBoundFunctionSource(entityId, functionName)` - Get source code for UI display
- `getBoundFunctionNames(entityId)` - Get list of bound function names

### 4. Runtime Resolution

When BRL calls a choice function on an entity:

```brl
rule on TurnStart {
    let target = entity.selectAttackTarget(entity, enemies)
    // ...
}
```

The engine:
1. Looks up `bound_functions.selectAttackTarget` on the entity
2. If not found, throws an error (no fallback mechanism)
3. If found, executes the function with provided parameters

### 5. Function Assignment

Functions can be assigned from one entity to another:

```brl
a.selectTarget = b.selectTarget
```

This copies the function reference, allowing entities to share strategies.

## Browser Integration

1. **IR Loading**: Browser loads pre-compiled IR with bound_functions
2. **BCL Editor**: Uses `getBoundFunctionSource()` to display/edit functions
3. **Customization Storage**: Player modifications stored in localStorage
4. **Future**: Browser-based BCL compiler creates IR delta for custom functions

## Related Documents

- [bcl-compiler-requirements.md](bcl-compiler-requirements.md) - Detailed compiler implementation spec
- [bcl-function-resolution.md](bcl-function-resolution.md) - Architecture overview
- [bcl-specification.md](../language/bcl-specification.md) - BCL language reference
