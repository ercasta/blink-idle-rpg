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
12. [Choice Points](#choice-points)

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

rule on DamageTaken dmg {
	let target = dmg.target
	target.Health.current -= dmg.amount
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
when       create     delete     has        new
choice     let
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
| `list` | List of entities (shorthand for `list<id>`) | `[entity1, entity2]` |
| `list<T>` | List of type T (T can be: id, integer, string, etc.) | `[1, 2, 3]` |

### 3.2 Component Types

Components define structured data types:

```brl
component Position {
	x: float
	y: float
}
```

### 3.3 Type Annotations (Mandatory)

BRL requires explicit type annotations on all variable declarations to catch errors early:

```brl
let damage: integer = 10
let name: string = "warrior"
let target: id = @player1
let enemies: list = entities having Enemy
```

Type annotations are mandatory for:
- Variable declarations with `let`
- Function parameters
- Function return types

Component fields always require type annotations.

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

Entities are created using the `let` keyword with mandatory type annotation `id` and the `new entity` syntax:

```brl
// Create empty entity
let hero: id = new entity

// Create entity with components (preferred)
let hero: id = new entity {
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

Components can also be added after entity creation:

```brl
let hero: id = new entity
hero.add(Character {
	name: "Hero"
	level: 1
})
hero.add(Health {
	current: 100
	maximum: 100
})
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

Rules define reactions to events. Each rule receives the triggering event as a parameter:

```brl
rule RuleName on EventType(evt: id) {
	// rule body - evt is the event entity with type id
}
```

The event parameter is mandatory and provides access to the event's components and fields.

**Event Cancellation**: Rules can cancel further processing of an event:

```brl
rule InterceptDamage on DamageTaken(dmg: id) {
	if dmg.DamageEvent.amount > 100 {
		// Cancel this damage event - no further rules will process it
		cancel dmg
		return
	}
}
```

### 6.2 Event Context

Within a rule, the event parameter provides access to event data:

```brl
rule ApplyDamage on DamageTaken(dmg: id) {
	// Access event components/fields
	let damage: integer = dmg.DamageEvent.amount
	let target: id = dmg.DamageEvent.target
    
	// Modify the target entity
	target.Health.current -= damage
    
	if target.Health.current <= 0 {
		let deathEvt: id = schedule Death { target: target }
	}
}
```

To process multiple entities, explicitly query them using `entities having`:

```brl
rule InitializeHeroes on GameStart(gs: id) {
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

### 6.3 Conditional Rules

Conditions can reference the event parameter:

```brl
rule CriticalHit on AttackLanded(atk: id) when atk.AttackEvent.is_critical {
	// Only triggers for critical hits
	let target: id = atk.AttackEvent.target
	target.Health.current -= atk.AttackEvent.damage * 2
}
```

### 6.4 Priority

Rules can have priority for ordering:

```brl
rule HighPriority on Event(evt: id) [priority: 100] {
	// Executes first
}

rule LowPriority on Event(evt: id) [priority: -100] {
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
