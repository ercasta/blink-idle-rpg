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
8. [Trackers](#trackers)
9. [Expressions](#expressions)
10. [Choice Functions (BCL)](#choice-functions-bcl)
11. [Source Map](#source-map)
12. [Serialization](#serialization)
13. [Versioning](#versioning)

---

## 1. Overview

The Blink Intermediate Representation (IR) is the **central contract** between the BRL compiler and all execution engines. It defines a portable, validated format that:

- Is produced by the compiler (Track 2)
- Is consumed by all engines (Tracks 3, 4, 5)
- Contains all information needed for execution
- Has been validated for correctness

```
┌─────────────┐       ┌─────────────┐       ┌───────────────────┐
│   BRL/BCL   │──────►│  Compiler   │──────►│   Blink IR (.ir)  │
│  Source     │       │  (Track 2)  │       │                   │
└─────────────┘       └─────────────┘       └─────────┬─────────┘
                                                      │
                  ┌───────────────────────────────────┼────────┐
                  │                                   │        │
                  ▼                                   ▼        ▼
          ┌──────────────┐               ┌────────────┐  ┌─────────┐
          │ Rust Engine  │               │ JS Engine  │  │ Batch   │
          │  (Track 3)   │               │ (Track 4)  │  │(Track 5)│
          └──────────────┘               └────────────┘  └─────────┘
```

---

## 2. Design Goals

### 2.1 Portability
- JSON format for maximum compatibility
- No platform-specific features
- Self-contained (no external references)

### 2.2 Validation
- Compiler validates all rules at compile time
- Engines can assume IR is well-formed
- Schema validation is optional for engines

### 2.3 Efficiency
- Compact representation
- Pre-resolved references (indices, not names)
- Optimized for sequential execution

### 2.4 Debuggability
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
  "trackers": [...],
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
| `trackers` | Yes | Tracker definitions (from BRL) |
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
| `len` | `(list) -> number` | Length of list |

---

## 8. Trackers

### 8.1 Tracker Definition

```json
{
  "trackers": [
    {
      "id": 0,
      "component": "Health",
      "event": "DoAttack"
    },
    {
      "id": 1,
      "component": "Gold",
      "event": "CollectReward"
    }
  ]
}
```

### 8.2 Tracker Output

When a tracker fires, engines output:

```json
{
  "tracker_id": 0,
  "event": "DoAttack",
  "time": 12500,
  "entities": [
    {
      "id": 1,
      "component": "Health",
      "before": { "current": 100, "max": 100 },
      "after": { "current": 85, "max": 100 }
    }
  ]
}
```

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

The `initial_state` section contains entity definitions from BDL files, including their components, choice bindings, and bound choice functions.

### 11.4.1 Initial State Structure

```json
{
  "initial_state": {
    "entities": [
      {
        "id": "@warrior",
        "components": {
          "Character": { "name": "Sir Braveheart", "class": "Warrior" },
          "Health": { "current": 120, "max": 120 },
          "ChoiceBindings": {
            "select_attack_target": "warrior_select_attack_target",
            "select_combat_skill": "warrior_select_combat_skill"
          }
        }
      }
    ],
    "roster": {
      "heroes": ["@warrior", "@mage", "@rogue", "@cleric"]
    },
    "bound_choice_functions": [
      {
        "id": "warrior_select_attack_target",
        "entity_id": "@warrior",
        "name": "select_attack_target",
        "params": [
          { "name": "character", "type": "entity" },
          { "name": "enemies", "type": "list" }
        ],
        "return_type": "entity",
        "body": { "type": "call", "function": "find_weakest", "args": [...] },
        "source": "choice (character: Character, enemies: list): id {\n    return find_weakest(enemies)\n}"
      }
    ]
  }
}
```

### 11.4.2 ChoiceBindings Component

The `ChoiceBindings` component maps choice point names to bound function IDs:

```json
{
  "ChoiceBindings": {
    "select_attack_target": "warrior_select_attack_target",
    "select_combat_skill": "warrior_select_combat_skill",
    "should_flee_from_battle": "flee_conservative"
  }
}
```

### 11.4.3 Roster Component

The `Roster` component on the game entity lists available heroes:

```json
{
  "id": "@game",
  "components": {
    "Roster": {
      "heroes": ["@warrior", "@mage", "@rogue", "@cleric", "@ranger", "@paladin"]
    }
  }
}
```

### 11.4.4 Bound Choice Functions

Bound choice functions are anonymous choice functions defined inline in BDL and associated with specific entities:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the function |
| `entity_id` | string | Entity this function is bound to |
| `name` | string | Choice point name this implements |
| `params` | array | Function parameters |
| `return_type` | string | Return type |
| `body` | IRExpression | Compiled function body |
| `source` | string | Original BCL/BDL source (for UI display) |

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
