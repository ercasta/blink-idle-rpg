# Implementation Plan: Language Syntax Update

## Overview
This document outlines the implementation steps for updating the Blink language compiler and all game files to match the new language specification.

## Compiler Changes (`packages/blink-compiler-ts/src/parser.ts`)

### 1. Enforce Mandatory `let` with Type Annotations
- **Current:** `parseLetStatement()` allows optional type annotations
- **Change:** Make type annotation mandatory, throw error if missing
- **Location:** Line ~635

```typescript
// OLD:
let typeAnnotation: AST.TypeExpr | null = null;
if (this.check(TokenKind.Colon)) {
  this.advance();
  typeAnnotation = this.parseType();
}

// NEW:
this.consume(TokenKind.Colon, ': (type annotation required)');
const typeAnnotation = this.parseType();
```

### 2. Remove Deprecated Entity Syntaxes
- **Current:** `parseEntity()` accepts multiple syntaxes (lines ~460-520)
  - `entity { ... }` (anonymous)
  - `entity @name { ... }` (legacy)
  - `@name = new entity { ... }` (legacy assignment)
- **Change:** Remove all entity parsing, entities must be created via `let` statement
- **New:** Entity creation only through `parseLetStatement()` with `new entity` expression

### 3. Update Rule Parsing for Typed Parameters
- **Current:** `rule Name on EventType alias { }` (line ~230-285)
- **Change:** `rule Name on EventType(alias: id) { }`
- **Modifications:**
  - After parsing event name, expect `(`
  - Parse parameter name
  - Expect `:` and type annotation
  - Expect `)`

### 4. AST Updates

#### Update RuleDef interface:
```typescript
export interface RuleDef {
  type: 'rule';
  name: string | null;
  triggerEvent: string;
  eventParam: ParamDef;  // CHANGED: from eventAlias: string
  condition: Expr | null;
  priority: number | null;
  body: Block;
  span: Span;
}
```

### 5. Cancel Statement
- **Status:** Already exists in AST and parser (confirmed lines ~620, ~730)
- **No changes needed**

## Game File Updates

### BRL Files

#### `game/brl/classic-rpg.brl` (877 lines)

Changes needed:
1. All `let` declarations must add explicit types (33+ instances)
2. All rule signatures change from `on EventType alias` to `on EventType(alias: id)`
3. All `schedule` calls should capture return value if needed

**Example transformations:**

```brl
// OLD:
rule initialize_hero_attacks on GameStart gs {
    let heroes = entities having Team
    for hero in heroes {
        if hero.Team.isPlayer && hero.Health.current > 0 {
            schedule [delay: 0.1] DoAttack {
                source: hero
            }
        }
    }
}

// NEW:
rule initialize_hero_attacks on GameStart(gs: id) {
    let heroes: list = entities having Team
    for hero in heroes {
        if hero.Team.isPlayer && hero.Health.current > 0 {
            let attackEvt: id = schedule [delay: 0.1] DoAttack {
                source: hero
            }
        }
    }
}
```

### BDL Files

All BDL files need entity syntax changes:

#### `game/bdl/heroes.bdl` (2218 lines)
- Convert all `entity { ... }` to `let heroName: id = new entity { ... }`
- Approximately 8-10 hero definitions

#### `game/bdl/enemies.bdl`
- Convert enemy templates

####

 `game/bdl/game-config.bdl`
- Convert configuration entities

#### `game/bdl/scenario-*.bdl`
- Convert scenario configurations

**Example transformation:**

```bdl
// OLD:
entity {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
        level: 1
    }
    Health {
        current: 120
        max: 120
    }
}

// NEW:
let sir_braveheart: id = new entity {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
        level: 1
    }
    Health {
        current: 120
        max: 120
    }
}
```

### BCL Files

#### `game/bcl/*.bcl` (8 files)
- Add type annotations to all `let` declarations inside choice functions

## Test File Updates

### `game/tests/brl/*.brl` (5 test files)
- Same transformations as main BRL files
- Add types to all `let` declarations
- Update rule signatures

## Implementation Order

1. ✅ **Update AST** (`packages/blink-compiler-ts/src/ast.ts`)
   - Change `RuleDef.eventAlias: string` to `RuleDef.eventParam: ParamDef`

2. ✅ **Update Parser** (`packages/blink-compiler-ts/src/parser.ts`)
   - Enforce mandatory type annotations in `parseLetStatement()`
   - Update `parseRule()` for typed parameters
   - Remove deprecated entity parsing methods

3. ✅ **Update main BRL file** (`game/brl/classic-rpg.brl`)
   - Add types to all variables
   - Update all rule signatures

4. ✅ **Update BDL files** (all files in `game/bdl/`)
   - Convert to `let name: id = new entity { }` syntax

5. ✅ **Update BCL files** (all files in `game/bcl/`)
   - Add type annotations

6. ✅ **Update test BRL files** (`game/tests/brl/*.brl`)
   - Same as main BRL updates

7. ✅ **Run tests**
   - `cd packages/blink-compiler-ts && npm test`
   - `make compile-brl`
   - `cd game/tests && npm test`

## Validation Checklist

- [ ] Compiler builds successfully
- [ ] All compiler tests pass
- [ ] BRL files compile without errors
- [ ] BDL files compile without errors
- [ ] BCL files compile without errors
- [ ] Generated IR is valid
- [ ] Game tests pass
- [ ] No deprecated syntax warnings

## Rollback Plan

If issues arise:
1. Git revert compiler changes
2. Git revert game file changes
3. Return to previous specification

All changes are tracked in git, allowing easy rollback if needed.
