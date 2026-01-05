# BCL Compiler Requirements for Bound Functions

## Overview
This document specifies the compiler changes needed to support choice function binding in BDL, enabling the full BCL resolution architecture described in `bcl resolution rules.md`.

## Current State
- ✅ Engine has `getBoundFunctions()` API implemented
- ✅ IR types defined: `IRBoundFunctions`, `IRBoundFunction`
- ❌ Compiler doesn't parse BCL choice function syntax in BDL
- ❌ Compiler doesn't output `bound_functions` in IR
- ❌ No association between hero classes and BCL files

## Required Compiler Changes

### 1. Parser Changes (src/compiler/src/parser/mod.rs)

#### Add Choice Function to EntityDef
```rust
#[derive(Debug, Clone)]
pub struct EntityDef {
    pub name: Option<String>,
    pub components: Vec<ComponentInit>,
    pub bound_functions: Vec<BoundFunctionDef>,  // NEW
    pub span: Span,
}

#[derive(Debug, Clone)]
pub struct BoundFunctionDef {
    pub name: String,
    pub params: Vec<ParamDef>,
    pub return_type: TypeExpr,
    pub body: Block,
    pub span: Span,
}
```

#### Add Parsing for Choice Function Syntax
In BDL entity definitions, support (use variable-assignment or anonymous entities):
```bdl
warrior = new entity {
    Character { ... }
    Health { ... }
    
    // Bind choice function to entity
    .selectTarget = choice(character: Character, enemies: list): id {
        // Choose enemy with lowest health
        let target = enemies[0]
        for enemy in enemies {
            if enemy.Health.current < target.Health.current {
                target = enemy
            }
        }
        return target.id
    }
}
```

Syntax rules:
- `.functionName` indicates a bound function
- `choice` keyword marks it as a choice function
- Parameters and return type follow BRL function syntax
- Body is a standard BRL block

### 2. Analyzer Changes (src/compiler/src/analyzer/mod.rs)

Add type checking for bound functions:
```rust
#[derive(Debug, Clone)]
pub struct TypedEntity {
    pub name: Option<String>,
    pub components: Vec<TypedComponentInit>,
    pub bound_functions: Vec<TypedBoundFunction>,  // NEW
}

#[derive(Debug, Clone)]
pub struct TypedBoundFunction {
    pub name: String,
    pub params: Vec<TypedParam>,
    pub return_type: Type,
    pub body: TypedBlock,
}
```

Validation:
- Ensure function parameters have valid types
- Check return type matches body
- Validate that bound functions don't reference undefined components

### 3. IR Generator Changes (src/compiler/src/ir/mod.rs)

#### Update IREntity Structure
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IREntity {
    pub id: Option<String>,
    pub name: Option<String>,
    pub components: IndexMap<String, IndexMap<String, IRValue>>,
    
    // NEW: Bound choice functions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bound_functions: Option<IndexMap<String, IRBoundFunction>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRBoundFunction {
    pub params: Vec<IRParam>,
    pub return_type: IRType,
    pub body: IRExpression,
    
    // Original source for UI display
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}
```

#### Generate bound_functions in IR
When processing `TypedEntity`:
1. For each `TypedBoundFunction`, convert to `IRBoundFunction`
2. Include original source code from source map
3. Add to entity's `bound_functions` map

### 4. Compilation Workflow

#### Current Workflow
```
game/brl/classic-rpg.brl → Compiler → game/ir/classic-rpg.ir.json
game/bdl/heroes.bdl      →          ↗
game/bdl/enemies.bdl     →         ↗
```

#### New Workflow with BCL
```
game/brl/classic-rpg.brl → Compiler → game/ir/classic-rpg.ir.json
game/bdl/heroes.bdl      →          ↗  (contains inline choice functions)
game/bdl/enemies.bdl     →         ↗
game/bcl/*.bcl           → (for reference/templates only)
```

Note: BCL files are NOT compiled separately. Instead, BDL files contain inline choice function definitions that reference BCL patterns.

## Example BDL Transformation

### Before (Current)
```bdl
warrior = new entity {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
        level: 1
    }
    Health { current: 120, max: 120 }
    Combat { damage: 18, defense: 10 }
}
```

### After (With Bound Functions)
```bdl
warrior = new entity {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
        level: 1
    }
    Health { current: 120, max: 120 }
    Combat { damage: 18, defense: 10 }
    
    // Bind choice functions for warrior AI
    .selectAttackTarget = choice(character: Character, enemies: list): id {
        // Warriors prioritize high-threat targets
        let target = enemies[0]
        let highestDamage = 0
        
        for enemy in enemies {
            if enemy.Combat.damage > highestDamage {
                target = enemy
                highestDamage = enemy.Combat.damage
            }
        }
        return target.id
    }
    
    .selectCombatSkill = choice(
        character: Character & Skills & Health, 
        allies: list, 
        enemies: list
    ): string {
        let hp_pct = character.Health.current / character.Health.max
        
        if hp_pct < 0.3 {
            return "defensive_stance"
        }
        
        if enemies.count >= 2 {
            return "cleave"
        }
        
        return "power_strike"
    }
}
```

## Expected IR Output

```json
{
  "initial_state": {
    "entities": [
      {
        "id": "warrior",
        "name": "Sir Braveheart",
        "components": {
          "Character": { "name": "Sir Braveheart", "class": "Warrior", "level": 1 },
          "Health": { "current": 120, "max": 120 }
        },
        "bound_functions": {
          "selectAttackTarget": {
            "params": [
              { "name": "character", "type": "Character" },
              { "name": "enemies", "type": { "list": "entity" } }
            ],
            "return_type": "id",
            "body": { /* IR expression tree */ },
            "source": "choice(character: Character, enemies: list): id {\n    // Warriors prioritize...\n}"
          },
          "selectCombatSkill": {
            "params": [ /* ... */ ],
            "return_type": "string",
            "body": { /* IR expression tree */ },
            "source": "choice(...): string {\n    let hp_pct = ...\n}"
          }
        }
      }
    ]
  }
}
```

## HTML Integration After Compiler Update

Once compiler generates `bound_functions` in IR:

### Current Approach (Temporary)
```javascript
// Parse BCL files at runtime
await loadBclFiles();
choicePointsData = extractChoiceFunctionsFromBCL();
const impl = getDefaultBclImplementation(choiceId);
```

### Future Approach (After Compiler)
```javascript
// Extract from IR via engine API
const entityId = hero.id;
const boundFunctions = game.getBoundFunctions(entityId);
const functionNames = game.getBoundFunctionNames(entityId);
const source = game.getBoundFunctionSource(entityId, functionName);
```

## Implementation Checklist

- [ ] **Parser**: Add `BoundFunctionDef` to AST
- [ ] **Parser**: Implement `.functionName = choice(...) { }` syntax
- [ ] **Analyzer**: Add type checking for bound functions
- [ ] **IR Generator**: Output `bound_functions` on entities
- [ ] **IR Generator**: Include source text in IR
- [ ] **BDL Files**: Update 30 hero definitions with bound functions
- [ ] **HTML**: Replace BCL parsing with engine API calls
- [ ] **Tests**: Add compiler tests for choice function syntax
- [ ] **Documentation**: Update language specs

## Estimated Effort
- **Compiler changes**: 6-8 hours (Rust development)
- **BDL updates**: 2-3 hours (30 heroes × 3-5 functions each)
- **HTML refactor**: 1-2 hours (remove parsing, use API)
- **Testing**: 2-3 hours
- **Total**: ~12-16 hours

## Notes
- BCL files (game/bcl/*.bcl) remain as reference implementations
- Players can still customize via BCL editor (stored in localStorage)
- Future: Browser-based BCL compiler could generate IR deltas
- This approach aligns with doc/architecture/bcl resolution rules.md
