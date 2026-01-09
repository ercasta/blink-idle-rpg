# Blink Rule Language (BRL) Specification

**Version**: 0.1.0-draft  
**Status**: Draft  
**Last Updated**: 2024-12-31

## Table of Contents

1. [Introduction](#introduction)
2. [Lexical Structure](#lexical-structure)
3. [Type System](#type-system)
4. [Components](#components)
5. [Entities](#entities)
6. [Rules and Triggers](#rules-and-triggers)
7. [Events](#events)
8. [Expressions](#expressions)
9. [Statements](#statements)
10. [Functions](#functions)
11. [Modules](#modules)
12. [Trackers](#trackers)
13. [Choice Points](#choice-points)

---

## 1. Introduction

The Blink Rule Language (BRL) is a domain-specific language designed for defining game rules in the Blink Idle RPG engine. BRL is based on the Entity-Component-System (ECS) pattern and provides constructs for:

- Defining data structures (components)
- Reacting to game events (triggers and rules)
- Modifying game state (entities and components)
- Scheduling future events (timeline manipulation)

### Design Goals

1. **Declarative**: Express what should happen, not how
2. **Type-safe**: Catch errors at compile time
3. **Composable**: Build complex rules from simple parts
4. **Deterministic**: Same inputs produce same outputs

### Syntax Overview

BRL uses curly brackets `{}` for code blocks:

```brl
// Example BRL snippet
component Health {
    current: integer
    maximum: integer
}

rule on DamageTaken {
    entity.Health.current -= event.amount
}
```

---

## 2. Lexical Structure

### 2.1 Comments

```brl
// Single-line comment

/* 
   Multi-line comment
*/
```

### 2.2 Identifiers

Identifiers start with a letter or underscore, followed by letters, digits, or underscores:

```
identifier := [a-zA-Z_][a-zA-Z0-9_]*
```

### 2.3 Keywords

Reserved keywords:

```
component  rule       on         trigger    event
entity     if         else       for        while
fn         return     true       false      null
schedule   cancel     recurring  module     import
when       create     delete     has
choice
```

### 2.4 Literals

```brl
// String literals
"hello world"
'single quotes'

// Numeric literals
42          // integer
3.14        // float
12.50d      // decimal (fixed precision)

// Boolean literals
true
false

// Entity reference
@entity_id
```

---

## 3. Type System

### 3.1 Base Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"hello"` |
| `boolean` | True or false | `true` |
| `integer` | Whole number | `42` |
| `float` | Floating-point | `3.14` |
| `decimal` | Fixed precision | `10.50d` |
| `id` | Entity reference | `@player1` |

### 3.2 Component Types

Components define structured data types:

```brl
component Position {
    x: float
    y: float
}
```

### 3.3 Type Inference

BRL supports type inference in many contexts:

```brl
let damage = 10       // inferred as integer
let name = "warrior"  // inferred as string
```

### 3.4 Optional Types

Fields can be optional:

```brl
component Equipment {
    weapon: id?      // optional entity reference
    armor: id?
}
```

---

## 4. Components

### 4.1 Component Definition

```brl
component ComponentName {
    field1: type1
    field2: type2
    // ...
}
```

### 4.2 Component Examples

```brl
component Character {
    name: string
    level: integer
    experience: integer
}

component Health {
    current: integer
    maximum: integer
    regeneration: float
}

component Position {
    x: float
    y: float
    z: float
}

component Inventory {
    capacity: integer
    gold: integer
}
```

### 4.3 Multiple Components of Same Type

An entity can have multiple components of the same type, acting as a list:

```brl
component Buff {
    name: string
    duration: float
    magnitude: float
}

// An entity can have multiple Buff components
// Access as: entity.Buff[0], entity.Buff[1], etc.
// Or iterate: for buff in entity.Buff { ... }
```

---

## 5. Entities

### 5.1 Entity Creation

```brl
create entity {
    Character {
        name: "Hero"
        level: 1
        experience: 0
    }
    Health {
        current: 100
        maximum: 100
        regeneration: 1.0
    }
}
```

### 5.2 Entity Modification

```brl
// Add component to existing entity
entity.add(Poisoned {
    damage_per_second: 5
    duration: 10.0
})

// Remove component
entity.remove(Poisoned)

// Check if entity has component
if entity.has(Poisoned) {
    // ...
}
```

### 5.3 Entity Deletion

```brl
delete entity
```

---

## 6. Rules and Triggers

### 6.1 Rule Definition

Rules define reactions to events:

```brl
rule RuleName on EventType {
    // rule body
}
```

### 6.2 Event Context

Within a rule, special variables are available:

- `event` - The triggering event entity
- `entity` - The affected entity (if applicable)

```brl
rule ApplyDamage on DamageTaken {
    let damage = event.DamageEvent.amount
    entity.Health.current -= damage
    
    if entity.Health.current <= 0 {
        schedule Death { target: entity.id }
    }
}
```

### 6.3 Conditional Rules

```brl
rule CriticalHit on AttackLanded when event.AttackEvent.is_critical {
    // Only triggers for critical hits
}
```

### 6.4 Priority

Rules can have priority for ordering:

```brl
rule HighPriority on Event [priority: 100] {
    // Executes first
}

rule LowPriority on Event [priority: -100] {
    // Executes last
}
```

---

## 7. Events

### 7.1 Event Definition

Events are entities with components:

```brl
component DamageEvent {
    source: id
    target: id
    amount: integer
    damage_type: string
}

component AttackEvent {
    attacker: id
    defender: id
    weapon: id?
    is_critical: boolean
}
```

### 7.2 Scheduling Events

#### Immediate Events (Stack)

```brl
// Immediate: goes on top of event stack
schedule DamageEvent {
    source: attacker.id
    target: defender.id
    amount: 50
    damage_type: "physical"
}
```

#### Delayed Events (Timeline)

```brl
// Delayed by 2.5 seconds
schedule [delay: 2.5] PoisonTick {
    target: entity.id
    damage: 5
}
```

### 7.3 Recurring Events

```brl
// Schedule recurring event every 1.0 seconds
let regen_id = schedule recurring [interval: 1.0] Regeneration {
    target: entity.id
}

// Cancel recurring event
cancel regen_id
```

### 7.4 Timeline Precision

The timeline supports precision up to hundredths of seconds (0.01s):

```brl
schedule [delay: 0.05] QuickEvent { }  // 50ms delay
schedule [delay: 0.01] FastEvent { }   // 10ms delay (minimum)
```

---

## 8. Expressions

### 8.1 Arithmetic

```brl
a + b    // addition
a - b    // subtraction
a * b    // multiplication
a / b    // division
a % b    // modulo
-a       // negation
```

### 8.2 Comparison

```brl
a == b   // equality
a != b   // inequality
a < b    // less than
a <= b   // less or equal
a > b    // greater than
a >= b   // greater or equal
```

### 8.3 Logical

```brl
a && b   // and
a || b   // or
!a       // not
```

### 8.4 Field Access

```brl
entity.Component.field
entity.Component[index].field  // for multiple components
```

---

## 9. Statements

### 9.1 Variable Declaration

```brl
let x = 10
let name: string = "hero"
```

### 9.2 Assignment

```brl
entity.Health.current = 50
entity.Health.current += 10
entity.Health.current -= damage
```

### 9.3 Conditionals

```brl
if condition {
    // ...
} else if other_condition {
    // ...
} else {
    // ...
}
```

### 9.4 Loops

```brl
// For-in loop (iterate components)
for buff in entity.Buff {
    buff.duration -= delta_time
}

// While loop
while entity.Health.current > 0 {
    // ...
}
```

---

## 10. Functions

### 10.1 Function Definition

```brl
fn function_name(param1: type1, param2: type2): return_type {
    // body
    return value
}
```

### 10.2 Function Examples

```brl
fn calculate_damage(base: integer, multiplier: float): integer {
    return (base * multiplier) as integer
}

fn is_alive(entity: Health): boolean {
    return entity.Health.current > 0
}

// Function with component parameter (works on any entity with that component)
fn heal(target: Health, amount: integer) {
    target.Health.current += amount
    if target.Health.current > target.Health.maximum {
        target.Health.current = target.Health.maximum
    }
}
```

### 10.3 Component-based Typing

Functions can require entities to have specific components:

```brl
fn attack(attacker: Character & Equipment, defender: Health) {
    // attacker must have Character AND Equipment components
    // defender must have Health component
}
```

---

## 11. Modules

### 11.1 Module Definition

```brl
module combat {
    component DamageEvent { ... }
    
    fn calculate_damage(...) { ... }
    
    rule on DamageEvent { ... }
}
```

### 11.2 Imports

```brl
import combat
import combat.calculate_damage
import combat.{ DamageEvent, AttackEvent }
```

---
<!-- Trackers removed: documentation and language references condensed. -->

## 12. Choice Points

Choice points are declarations that mark customizable decision points in the game logic. They specify where players can customize behavior through BCL (Blink Choice Language). BRL declares choice points; BCL implements them.

### 13.1 Syntax

```brl
choice function_signature
/// "Docstring describing what this choice controls"
```

Or with a default implementation:

```brl
choice function_signature {
    /// "Docstring describing what this choice controls"
    // default implementation
}
```

### 13.2 Purpose

Choice points serve three purposes:

1. **Documentation**: They explicitly mark where player customization is allowed
2. **Contract**: They define the interface between BRL game rules and BCL player strategies  
3. **UI Integration**: The docstring is shown to players in customization interfaces

### 13.3 Examples

```brl
// Simple choice point declaration (must be implemented in BCL)
choice fn select_attack_target(attacker: Character, enemies: list): id
/// "Choose which enemy to attack. Default targets lowest health enemy."

// Choice point with default implementation
choice fn select_combat_skill(
    character: Character & Skills & Health,
    allies: list,
    enemies: list
): string {
    /// "Select which skill to use in combat. Controls your combat rotation."
    
    // Default: use basic attack
    return "basic_attack"
}

// Choice point for flee decision
choice fn should_flee_from_battle(
    party: list,
    enemies: list,
    runStats: RunStats
): boolean {
    /// "Decide when to tactically retreat. Fleeing costs 10s penalty but prevents death (50s penalty)."
    
    // Default: never flee automatically
    return false
}
```

### 13.4 Semantics

- Choice points are **pure functions** - they cannot modify game state
- They are called by BRL rules when decisions are needed
- BCL can override any declared choice point
- If no BCL override exists, the default implementation is used
- The docstring (starting with `///`) is required and shown to players

### 13.5 Integration with BCL

When a choice point is declared in BRL:

```brl
choice fn select_target(attacker: Character, enemies: list): id
/// "Choose which enemy to target for attacks."
```

BCL can override it:

```bcl
choice fn select_target(attacker: Character, enemies: list): id {
    // Custom targeting logic
    for enemy in enemies {
        if enemy.Enemy.isBoss {
            return enemy.id
        }
    }
    return enemies[0].id
}
```

### 13.6 IDE/UI Support

The game IDE can:
1. List all available choice points from BRL declarations
2. Show the docstring to help players understand each choice
3. Provide an editor for customizing the choice function
4. Save customizations as BCL deltas (only modified choices)

### 13.7 Entity-Bound Choice Functions

Choice functions can be bound to specific entities as first-class properties, allowing each entity to have its own decision-making logic. This binding happens in BDL (at entity definition time).

#### Calling Bound Choice Functions

When BRL needs to call a choice function, it calls it **on the entity**:

```brl
rule on TurnStart {
    // Call the bound choice function on the entity
    let target = entity.select_attack_target(enemies)
    
    // Use the returned value
    schedule Attack {
        source: entity.id
        target: target
    }
}
```

The syntax `entity.choiceFunctionName(args...)` invokes the choice function bound to that entity.

#### Resolution

When `entity.select_attack_target(enemies)` is called:

1. The engine looks for a function named `select_attack_target` bound directly to the entity
2. If not found, a **`UnboundFunctionError`** is raised - there is no fallback mechanism

This strict resolution ensures that:
- All required choice functions must be explicitly defined for each entity
- Missing bindings are caught immediately at runtime
- No implicit behavior is assumed

#### Error Handling

When a bound function is not found, the error message includes:
- The entity ID that was accessed
- The function name that was called
- A hint to check the entity's BDL definition

Example error:
```
UnboundFunctionError: Function 'select_attack_target' is not bound to entity '@warrior'
  at rule CombatTurn (classic-rpg.brl:153:5)
  
  Help: Ensure the entity has the function bound in its BDL definition:
        select_attack_target = choice (...) { ... }
```

Developers should ensure all entities have the required functions bound in their BDL definitions before calling them in BRL rules.

#### Example with Multiple Entities

```brl
rule on CombatTurn for attacker: Character {
    // Each attacker uses their own bound targeting strategy
    // If select_attack_target is not bound to attacker, an error is raised
    let target = attacker.select_attack_target(visible_enemies)
    
    // Each attacker uses their own skill selection
    let skill = attacker.select_combat_skill(allies, enemies)
    
    schedule UseSkill {
        source: attacker.id
        target: target
        skill: skill
    }
}
```

---

## Appendix A: Grammar (EBNF)

```ebnf
(* To be expanded *)

program = { declaration } ;

declaration = component_def
            | rule_def
            | function_def
            | module_def
            | choice_point_def ;

component_def = "component" identifier "{" { field_def } "}" ;

field_def = identifier ":" type ;

type = "string" | "boolean" | "integer" | "float" | "decimal" | "id"
     | identifier    (* component type *)
     | type "?"      (* optional *)
     ;

choice_point_def = "choice" function_signature [ "{" docstring { statement } "}" ]
                 | "choice" function_signature docstring ;

docstring = "///" string_literal ;
```

---

## Appendix B: Standard Library

(To be defined)

- Math functions
- String functions
- Collection utilities
- Random number generation

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2024-12-31 | Initial draft |
| 0.2.0 | 2026-01-04 | Added section 12.7: Entity-Bound Choice Functions |
