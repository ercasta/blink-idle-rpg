# Blink IR Specification

**Version**: 0.1.0-draft  
**Status**: Draft  
**Last Updated**: 2026-01-03

## Table of Contents

1. [Overview](#overview)
2. [Design Goals](#design-goals)
3. [IR Format](#ir-format)
4. [Modules](#modules)
5. [Components](#components)
6. [Rules](#rules)
7. [Functions](#functions)
8. [Expressions](#expressions)
9. [Expressions](#expressions)
10. [Choice Functions (BCL)](#choice-functions-bcl)
11. [Source Map](#source-map)
12. [Serialization](#serialization)
13. [Versioning](#versioning)

---

## 1. Overview
---

---
- Human-readable format
- Source mapping information (optional)
- Meaningful names preserved

---

## 3. IR Format

### 3.1 File Extension

- `.ir.json` - Full JSON format (recommended)
- `.ir.msgpack` - MessagePack format (optional, for size)
- `.ir` - Default, engine chooses based on magic bytes

### 3.2 Top-Level Structure

```json
{
  "version": "1.0",
  "module": "game_name",
  "metadata": {
    "compiled_at": "2024-12-31T12:00:00Z",
    "compiler_version": "0.1.0",
    "source_hash": "sha256:..."
  },
  "components": [...],
  "rules": [...],
  "functions": [...],
  "constants": {...},
  "initial_state": {...},
  "choice_functions": [...],
  "choice_points": [...],
  "source_map": {...}
}
```

### 3.3 Field Descriptions

| Field | Required | Description |
|-------|----------|-------------|
| `version` | Yes | IR format version |
| `module` | Yes | Module name |
| `metadata` | No | Compilation metadata |
| `components` | Yes | Component type definitions (from BRL) |
| `rules` | Yes | Game rules (from BRL) |
| `functions` | Yes | Helper functions (from BRL) |
| `constants` | No | Named constants |
| `initial_state` | No | Initial entities (from BDL) |
| `choice_functions` | No | Player choice functions (from BCL) |
| `choice_points` | No | Metadata about customizable choices |
| `source_map` | No | Original source code for debugging |
```

---

## 4. Modules

### 4.1 Module Definition

```json
{
  "version": "1.0",
  "module": "combat_example",
  "imports": [],
  "exports": ["Health", "Attack", "attack_rule"]
}
```

### 4.2 Import/Export

Modules can import definitions from other compiled IR:

```json
{
  "imports": [
    {
      "module": "base_types",
      "components": ["Health", "Position"],
      "functions": ["distance"]
    }
  ]
}
```

---

## 5. Components

### 5.1 Component Definition

```json
{
  "components": [
    {
      "id": 0,
      "name": "Health",
      "fields": [
        { "name": "current", "type": "number", "default": 100 },
        { "name": "max", "type": "number", "default": 100 }
      ]
    },
    {
      "id": 1,
      "name": "Attack",
      "fields": [
        { "name": "damage", "type": "number", "default": 10 },
        { "name": "speed", "type": "number", "default": 1.0 }
      ]
    },
    {
      "id": 2,
      "name": "Target",
      "fields": [
        { "name": "entity", "type": "entity", "default": null }
      ]
    }
  ]
}
```

### 5.2 Field Types

| Type | JSON Representation | Description |
|------|---------------------|-------------|
| `number` | `{ "type": "number" }` | 64-bit float |
| `string` | `{ "type": "string" }` | UTF-8 string |
| `boolean` | `{ "type": "boolean" }` | true/false |
| `entity` | `{ "type": "entity" }` | Entity reference |
| `list<T>` | `{ "type": "list", "element": T }` | Typed list |
| `map<K,V>` | `{ "type": "map", "key": K, "value": V }` | Typed map |

---

## 6. Rules

### 6.1 Rule Definition

```json
{
  "rules": [
    {
      "id": 0,
      "name": "attack_rule",
      "trigger": {
        "type": "event",
        "event": "DoAttack",
        "bindings": {
          "attacker": "source"
        }
      },
      "filter": {
        "components": ["Attack", "Target"]
      },
      "condition": {
        "type": "binary",
        "op": "!=",
        "left": { "type": "field", "entity": "attacker", "component": "Target", "field": "entity" },
        "right": { "type": "literal", "value": null }
      },
      "actions": [
        {
          "type": "modify",
          "entity": { "type": "field", "entity": "attacker", "component": "Target", "field": "entity" },
          "component": "Health",
          "field": "current",
          "op": "subtract",
          "value": { "type": "field", "entity": "attacker", "component": "Attack", "field": "damage" }
        },
        {
          "type": "schedule",
          "event": "DoAttack",
          "source": { "type": "var", "name": "attacker" },
          "delay": { "type": "literal", "value": 100 }
        }
      ]
    }
  ]
}
```

### 6.2 Trigger Types

| Type | Description |
|------|-------------|
| `event` | Triggers on named event |
| `spawn` | Triggers when entity spawned |
| `tick` | Triggers every N time units |

### 6.3 Action Types

| Type | Description |
|------|-------------|
| `modify` | Modify component field |
| `schedule` | Schedule event |
| `emit` | Emit immediate event |
| `spawn` | Create entity |
| `despawn` | Remove entity |
| `add_component` | Add component to entity |
| `remove_component` | Remove component from entity |
| `conditional` | Conditional execution (if/else) |
| `loop` | For-each loop over iterable |
| `let` | Bind a value to a local variable |
| `while` | While loop with condition |

#### Let Action

Binds a value to a local variable for use in subsequent actions:

```json
{
  "type": "let",
  "name": "damage",
  "value": {
    "type": "binary",
    "op": "multiply",
    "left": { "type": "field", "entity": "entity", "component": "Combat", "field": "damage" },
    "right": { "type": "literal", "value": 1.5 }
  }
}
```

#### Conditional Action

Executes actions based on a condition:

```json
{
  "type": "conditional",
  "condition": { "type": "binary", "op": "gt", "left": ..., "right": ... },
  "then_actions": [ ... ],
  "else_actions": [ ... ]
}
```

#### Loop Action

Iterates over an array, binding each element to a variable:

```json
{
  "type": "loop",
  "variable": "enemy",
  "iterable": { "type": "call", "function": "entities_having", "args": [...] },
  "body": [ ... ]
}
```

#### While Action

Repeats actions while a condition is true:

```json
{
  "type": "while",
  "condition": { "type": "binary", "op": "lt", "left": ..., "right": ... },
  "body": [ ... ]
}
```

---

## 7. Functions

### 7.1 Function Definition

```json
{
  "functions": [
    {
      "id": 0,
      "name": "calculate_damage",
      "params": [
        { "name": "base", "type": "number" },
        { "name": "multiplier", "type": "number" }
      ],
      "return_type": "number",
      "body": {
        "type": "binary",
        "op": "multiply",
        "left": { "type": "param", "name": "base" },
        "right": { "type": "param", "name": "multiplier" }
      }
    }
  ]
}
```

### 7.2 Built-in Functions

Engines must provide these built-in functions:

| Function | Signature | Description |
|----------|-----------|-------------|
| `min` | `(number, number) -> number` | Minimum of two values |
| `max` | `(number, number) -> number` | Maximum of two values |
| `floor` | `(number) -> number` | Floor of value |
| `ceil` | `(number) -> number` | Ceiling of value |
| `round` | `(number) -> number` | Round to nearest |
| `abs` | `(number) -> number` | Absolute value |
| `random` | `() -> number` | Random 0.0-1.0 |
| `random_range` | `(number, number) -> number` | Random in range |
| `len` | `(any) -> number` | Length of value: returns array length for arrays, 1 for scalars (non-null), 0 for null |

---

## 9. Expressions

### 9.1 Expression Types

```json
// Literal value
{ "type": "literal", "value": 42 }

// Field access
{ "type": "field", "entity": "self", "component": "Health", "field": "current" }

// Variable reference
{ "type": "var", "name": "attacker" }

// Parameter reference
{ "type": "param", "name": "base" }

// Binary operation
{ "type": "binary", "op": "add", "left": {...}, "right": {...} }

// Unary operation
{ "type": "unary", "op": "not", "expr": {...} }

// Function call
{ "type": "call", "function": "calculate_damage", "args": [...] }

// Conditional
{ "type": "if", "condition": {...}, "then": {...}, "else": {...} }
```

### 9.2 Binary Operators

| Category | Operators |
|----------|-----------|
| Arithmetic | `add`, `subtract`, `multiply`, `divide`, `modulo` |
| Comparison | `eq`, `neq`, `lt`, `lte`, `gt`, `gte` |
| Logical | `and`, `or` |

---

## 10. Choice Functions (BCL)

Choice functions are player-customizable decision points compiled from BCL (Blink Choice Language).

### 10.1 Choice Function Definition

```json
{
  "choice_functions": [
    {
      "id": 0,
      "name": "select_target",
      "params": [
        { "name": "attacker", "type": "entity" },
        { "name": "enemies", "type": "list" }
      ],
      "return_type": "entity",
      "body": {
        "type": "call",
        "function": "first",
        "args": [
          { "type": "call", "function": "sort", "args": [...] }
        ]
      },
      "source_location": { "file": "warrior-skills.bcl", "line": 15, "column": 1 }
    }
  ]
}
```

### 10.2 Choice Points

Choice points are metadata about customizable choices, used by UI editors:

```json
{
  "choice_points": [
    {
      "id": "select_target",
      "name": "Target Selection",
      "signature": "choice fn select_target(attacker: entity_id, enemies: list): entity_id",
      "docstring": "Choose which enemy to attack based on party strategy",
      "category": "targeting",
      "applicable_classes": ["Warrior", "Rogue", "Ranger"],
      "default_behavior": "Targets the enemy with lowest health"
    },
    {
      "id": "should_flee",
      "name": "Flee Decision",
      "signature": "choice fn should_flee(party: list, enemies: list): boolean",
      "docstring": "Decide when to tactically retreat from combat",
      "category": "strategy",
      "applicable_classes": null,
      "default_behavior": "Flees when party health drops below 30%"
    }
  ]
}
```

---

## 11. Source Map

The source map contains original source code for debugging and development tools.

### 11.1 Source Map Structure

```json
{
  "source_map": {
    "files": [
      {
        "path": "classic-rpg.brl",
        "language": "brl",
        "content": "// Classic RPG System\ncomponent Character { ... }"
      },
      {
        "path": "warrior-skills.bcl",
        "language": "bcl",
        "content": "// Warrior targeting strategy\nchoice fn select_target(...)"
      },
      {
        "path": "heroes.bdl",
        "language": "bdl",
        "content": "// Hero definitions\nentity @warrior { ... }"
      }
    ]
  }
}
```

### 11.2 Source Location References

Rules, functions, and entities can reference their source location:

```json
{
  "rules": [
    {
      "id": 0,
      "name": "attack_rule",
      "source_location": {
        "file": "classic-rpg.brl",
        "line": 153,
        "column": 1,
        "end_line": 173,
        "end_column": 1
      }
    }
  ]
}
```

### 11.3 Usage

Source maps are optional but recommended for:
- Integrated development environments (IDE)
- Step-through debugging
- Error messages with source context
- BCL editor showing original code

To include source maps, compile with: `blink-compiler compile --source-map`

---

## 11.4 Initial State

The `initial_state` section contains entity definitions from BDL files, including their components and bound choice functions.

### 11.4.1 Initial State Structure

Bound choice functions are stored directly on entities as first-class properties, not in a separate component:

```json
{
  "initial_state": {
    "entities": [
      {
        "id": 0,
        "variable": "warrior",
        "components": {
          "Character": { "name": "Sir Braveheart", "class": "Warrior" },
          "Health": { "current": 120, "max": 120 }
        },
        "bound_functions": {
          "select_attack_target": {
            "params": [
              { "name": "character", "type": "entity" },
              { "name": "enemies", "type": "list" }
            ],
            "return_type": "entity",
            "body": { "type": "call", "function": "find_weakest", "args": [...] },
            "source": "choice (character: Character, enemies: list): id {\n    return find_weakest(enemies)\n}"
          },
          "select_combat_skill": {
            "params": [...],
            "return_type": "string",
            "body": { ... },
            "source": "..."
          }
        }
      }
    ]
  }
}
```

**Note**: The `variable` field replaces the old `name` field (and the `@name` syntax in BDL).
Entities are nameless; variables reference them. The new BDL syntax is:

```bdl
warrior = new entity {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
    }
}
```

### 11.4.2 Entity Queries

BRL/BCL can query entities by component using the `entities having` expression:

```brl
let warriors = entities having Character
```

This generates an IR call expression:

```json
{
  "type": "call",
  "function": "entities_having",
  "args": [
    { "type": "literal", "value": "Character" }
  ]
}
```

### 11.4.3 Bound Functions

Bound choice functions are defined inline in BDL and stored as first-class properties of entities. When BRL code calls a choice function on an entity, the engine looks up the function directly in the entity's `bound_functions` map.

| Field | Type | Description |
|-------|------|-------------|
| `params` | array | Function parameters |
| `return_type` | string | Return type |
| `body` | IRExpression | Compiled function body |
| `source` | string | Original BCL/BDL source (for UI display) |

**Resolution**: If the called function is not found in the entity's `bound_functions`, a runtime error is raised. There is no fallback mechanism.

---

## 12. Serialization

### 12.1 JSON Schema

Full JSON Schema available at: `schemas/ir-v1.json`

### 12.2 Example Complete IR

```json
{
  "version": "1.0",
  "module": "simple_clicker",
  "components": [
    {
      "id": 0,
      "name": "Clicks",
      "fields": [
        { "name": "count", "type": "number", "default": 0 }
      ]
    }
  ],
  "rules": [
    {
      "id": 0,
      "name": "handle_click",
      "trigger": { "type": "event", "event": "Click", "bindings": { "button": "source" } },
      "filter": { "components": ["Clicks"] },
      "actions": [
        {
          "type": "modify",
          "entity": { "type": "var", "name": "button" },
          "component": "Clicks",
          "field": "count",
          "op": "add",
          "value": { "type": "literal", "value": 1 }
        }
      ]
    }
  ],
  "functions": [],
  "trackers": [
    { "id": 0, "component": "Clicks", "event": "Click" }
  ],
  "initial_state": {
    "entities": [
      {
        "id": 0,
        "components": {
          "Clicks": { "count": 0 }
        }
      }
    ]
  }
}
```

---

## 13. Versioning

### 13.1 Version Format

`MAJOR.MINOR`

- **MAJOR**: Breaking changes (engines must update)
- **MINOR**: Additive changes (backwards compatible)

### 13.2 Compatibility Matrix

| IR Version | Rust Engine | JS Engine | Batch Engine |
|------------|-------------|-----------|--------------|
| 1.0 | 0.1.0+ | 0.1.0+ | 0.1.0+ |

### 13.3 Version Checking

Engines should check version and fail gracefully:

```typescript
function loadIR(ir: IRModule): void {
  const [major, minor] = ir.version.split('.').map(Number);
  if (major > SUPPORTED_MAJOR) {
    throw new Error(`IR version ${ir.version} not supported, max ${SUPPORTED_MAJOR}.x`);
  }
}
```

---

## Appendix A: IR Conformance Test Suite

Located at: `tests/ir/`

All engines must pass the conformance test suite:

```bash
# Run conformance tests
blink-test conformance --engine rust
blink-test conformance --engine js
blink-test conformance --engine batch
```

Test categories:
- `basic/` - Basic rule execution
- `timing/` - Event scheduling precision
- `ecs/` - Entity-component operations
- `expressions/` - Expression evaluation
- `trackers/` - Tracker output format

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2024-12-31 | Initial draft |
| 0.1.1 | 2026-01-03 | Added choice_functions (BCL) and source_map sections |
| 0.1.2 | 2026-01-04 | Added initial_state section with ChoiceBindings, Roster, bound_choice_functions |
