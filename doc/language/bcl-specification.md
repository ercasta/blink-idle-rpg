# Blink Choice Language (BCL) Specification

**Version**: 0.1.0-draft  
**Status**: Draft  
**Last Updated**: 2024-12-31

## Table of Contents

1. [Introduction](#1-introduction)
2. [Relationship to BRL](#2-relationship-to-brl)
3. [Allowed Constructs](#3-allowed-constructs)
4. [Disallowed Constructs](#4-disallowed-constructs)
5. [Choice Functions](#5-choice-functions)
6. [Party Configuration](#6-party-configuration)
7. [Strategy Patterns](#7-strategy-patterns)
8. [Examples](#8-examples)

---

## 1. Introduction

The Blink Choice Language (BCL) is a domain-specific language for players to define:

- **Party composition**: Which characters to include
- **Character builds**: Stats, equipment, abilities
- **Decision rules**: How characters behave in combat and exploration

### Design Goals

1. **Safe**: Cannot corrupt game state
2. **Accessible**: Easier to learn than BRL
3. **Expressive**: Cover all meaningful player decisions
4. **Deterministic**: Same choices produce same results

### Audience

BCL is designed for **players**, not game developers. It should be:
- Readable without deep programming knowledge
- Focused on game decisions, not implementation details
- Forgiving of minor syntax variations where possible

---

## 2. Relationship to BRL

BCL is a **strict subset** of BRL. Every valid BCL program is also valid BRL.

### What BCL Inherits from BRL

| Feature | Available in BCL |
|---------|------------------|
| Comments | ✅ Yes |
| Identifiers | ✅ Yes |
| Base types | ✅ Yes |
| Expressions | ✅ Yes (read-only) |
| Functions | ✅ Yes (pure functions) |
| Modules | ✅ Yes |
| Conditionals | ✅ Yes |
| Loops | ✅ Yes (read-only iteration) |

### What BCL Removes from BRL

| Feature | Available in BCL |
|---------|------------------|
| Component definitions | ❌ No |
| Rule definitions | ❌ No |
| Entity creation | ❌ No |
| Entity deletion | ❌ No |
| Component modification | ❌ No |
| Event scheduling | ❌ No |
| Tracker definitions | ❌ No |

---

## 3. Allowed Constructs

### 3.1 Reading Entity Data

```bcl
// Read component fields
entity.Health.current
entity.Character.name
enemy.Position.x

// Check component existence
entity.has(Poisoned)
entity.has(Shield)
```

### 3.2 Expressions

All BRL expressions are allowed for computing values:

```bcl
// Arithmetic
health_percent = entity.Health.current / entity.Health.maximum

// Comparison
is_low_health = entity.Health.current < 20

// Logical
should_heal = is_low_health && healer.has(HealAbility)
```

### 3.3 Pure Functions

Functions that compute values without side effects:

```bcl
fn calculate_threat(enemy: Character & Health): integer {
    return enemy.Character.level * enemy.Health.current
}

fn find_weakest(enemies: list): id {
    let weakest = enemies[0]
    for enemy in enemies {
        if enemy.Health.current < weakest.Health.current {
            weakest = enemy
        }
    }
    return weakest.id
}
```

### 3.4 Choice Functions (Special)

BCL introduces special `choice` functions that return decisions:

```bcl
choice fn select_target(allies: list, enemies: list): id {
    // Return the enemy to attack
    return find_weakest(enemies)
}
```

### 3.5 Conditionals

```bcl
if entity.Health.current < 30 {
    return "heal"
} else if enemies.count > 3 {
    return "aoe_attack"
} else {
    return "single_attack"
}
```

### 3.6 Read-Only Iteration

```bcl
for enemy in visible_enemies {
    if enemy.Character.level > 10 {
        // Found a strong enemy
    }
}
```

---

## 4. Disallowed Constructs

The following BRL constructs are **not allowed** in BCL:

### 4.1 Component Definitions

```bcl
// ❌ NOT ALLOWED in BCL
component CustomData {
    value: integer
}
```

### 4.2 Entity Creation

```bcl
// ❌ NOT ALLOWED in BCL
create entity {
    Character { name: "New Hero" }
}
```

### 4.3 State Modification

```bcl
// ❌ NOT ALLOWED in BCL
entity.Health.current = 100
entity.Health.current -= 10
entity.add(Buff { ... })
entity.remove(Debuff)
delete entity
```

### 4.4 Event Scheduling

```bcl
// ❌ NOT ALLOWED in BCL
schedule DamageEvent { ... }
schedule [delay: 1.0] Effect { ... }
cancel event_id
```

### 4.5 Rules and Triggers

```bcl
// ❌ NOT ALLOWED in BCL
rule on DamageEvent {
    // ...
}

tracker on HealthChanged {
    // ...
}
```

---

## 5. Choice Functions

### 5.1 Overview

Choice functions are the core of BCL - they implement decision points declared in BRL. BRL declares **choice points** that define what decisions are available for customization; BCL provides the implementations.

### 5.2 Relationship to BRL Choice Points

BRL declares choice points with signatures and documentation:

```brl
// In BRL (game rules)
choice fn select_attack_target(attacker: Character, enemies: list): id
/// "Choose which enemy to attack. Affects combat focus strategy."
```

BCL implements these choice points:

```bcl
// In BCL (player strategy)
choice fn select_attack_target(attacker: Character, enemies: list): id {
    // Custom implementation
    return find_weakest(enemies)
}
```

### 5.3 Syntax

Choice functions are special BCL functions that the game engine calls to make decisions:

```bcl
choice fn function_name(context_params...): return_type {
    // Decision logic
    return decision
}
```

### 5.4 Common Choice Signatures

The game defines standard choice function signatures (declared in BRL, implemented in BCL):

```bcl
// Target selection for attacks
choice fn select_attack_target(
    attacker: Character,
    enemies: list
): id

// Ability selection
choice fn select_ability(
    character: Character & Abilities,
    allies: list,
    enemies: list
): string

// Item usage
choice fn select_item(
    character: Character & Inventory,
    situation: string
): id?

// Formation position
choice fn select_position(
    character: Character,
    available_positions: list
): Position

// Flee decision
choice fn should_flee_from_battle(
    party: list,
    enemies: list,
    runStats: RunStats
): boolean
```

### 5.5 Customization Deltas

When players customize choice functions in the game UI:
- Only the modified choice functions are saved
- These are stored as "BCL deltas" - partial BCL that overrides specific choices
- The delta is applied on top of the hero's base BCL file
- Deltas can be downloaded and shared

Example delta file:
```bcl
// custom-strategy.bcl - Player customization delta
// Overrides: select_attack_target

choice fn select_attack_target(attacker: Character, enemies: list): id {
    // Always focus on bosses first
    for enemy in enemies {
        if enemy.Enemy.isBoss {
            return enemy.id
        }
    }
    // Fall back to lowest health
    return find_weakest(enemies)
}
```

---

## 6. Party Configuration

BCL is used to define the player's party:

### 6.1 Party Definition

```bcl
party {
    hero {
        class: "Warrior"
        name: "Blink"
        stats {
            strength: 15
            dexterity: 10
            constitution: 14
            intelligence: 8
            wisdom: 10
            charisma: 12
        }
    }
    
    companion {
        class: "Mage"
        name: "Spark"
        stats {
            strength: 6
            dexterity: 12
            constitution: 10
            intelligence: 16
            wisdom: 14
            charisma: 10
        }
    }
}
```

### 6.2 Equipment Choices

```bcl
equipment for hero {
    weapon: "longsword"
    armor: "chainmail"
    accessory: "ring_of_protection"
}

equipment for companion {
    weapon: "staff"
    armor: "robes"
    accessory: "amulet_of_mana"
}
```

### 6.3 Ability Choices

```bcl
abilities for hero {
    active: ["power_strike", "shield_bash", "taunt"]
    passive: ["armor_mastery"]
}

abilities for companion {
    active: ["fireball", "ice_shard", "heal"]
    passive: ["mana_regen"]
}
```

---

## 7. Strategy Patterns

Common BCL patterns for game strategies:

### 7.1 Focus Fire (Attack Weakest)

```bcl
choice fn select_attack_target(attacker: Character, enemies: list): id {
    let target = enemies[0]
    for enemy in enemies {
        if enemy.Health.current < target.Health.current {
            target = enemy
        }
    }
    return target.id
}
```

### 7.2 Priority Targeting

```bcl
fn threat_priority(enemy: Character): integer {
    // Healers first, then damage dealers, then tanks
    if enemy.class == "Healer" { return 100 }
    if enemy.class == "Mage" { return 80 }
    if enemy.class == "Rogue" { return 70 }
    if enemy.class == "Warrior" { return 50 }
    return 0
}

choice fn select_attack_target(attacker: Character, enemies: list): id {
    let target = enemies[0]
    let highest_priority = threat_priority(target)
    
    for enemy in enemies {
        let priority = threat_priority(enemy)
        if priority > highest_priority {
            target = enemy
            highest_priority = priority
        }
    }
    return target.id
}
```

### 7.3 Adaptive Healing

```bcl
choice fn select_heal_target(healer: Character, allies: list): id? {
    let critical_threshold = 0.3
    let heal_threshold = 0.7
    
    // First, find critically wounded
    for ally in allies {
        let health_pct = ally.Health.current / ally.Health.maximum
        if health_pct < critical_threshold {
            return ally.id
        }
    }
    
    // Then, find anyone needing healing
    for ally in allies {
        let health_pct = ally.Health.current / ally.Health.maximum
        if health_pct < heal_threshold {
            return ally.id
        }
    }
    
    // No one needs healing
    return null
}
```

### 7.4 Resource Management

```bcl
choice fn select_ability(character: Character & Resources, enemies: list): string {
    let mana_pct = character.Resources.mana / character.Resources.max_mana
    
    // Conserve mana when low
    if mana_pct < 0.2 {
        return "basic_attack"
    }
    
    // Use AoE for groups
    if enemies.count >= 3 && mana_pct > 0.5 {
        return "fireball"
    }
    
    // Single target otherwise
    return "ice_shard"
}
```

---

## 8. Examples

### 8.1 Complete Party File

```bcl
// my_party.bcl - A balanced party configuration

module my_party

// === PARTY COMPOSITION ===

party {
    warrior {
        class: "Warrior"
        name: "Tank"
        stats {
            strength: 14
            dexterity: 10
            constitution: 16
            intelligence: 8
            wisdom: 10
            charisma: 10
        }
    }
    
    mage {
        class: "Mage"
        name: "Blaster"
        stats {
            strength: 6
            dexterity: 12
            constitution: 10
            intelligence: 18
            wisdom: 12
            charisma: 10
        }
    }
    
    healer {
        class: "Cleric"
        name: "Medic"
        stats {
            strength: 10
            dexterity: 10
            constitution: 12
            intelligence: 10
            wisdom: 16
            charisma: 14
        }
    }
}

// === STRATEGY FUNCTIONS ===

fn is_tank(character: Character): boolean {
    return character.class == "Warrior"
}

fn health_percentage(entity: Health): float {
    return entity.Health.current / entity.Health.maximum
}

// === CHOICE IMPLEMENTATIONS ===

choice fn select_attack_target(attacker: Character, enemies: list): id {
    // Tanks attack whoever is hitting allies
    if is_tank(attacker) {
        for enemy in enemies {
            if enemy.target != null && !is_tank(enemy.target) {
                return enemy.id
            }
        }
    }
    
    // Others focus weakest enemy
    let target = enemies[0]
    for enemy in enemies {
        if enemy.Health.current < target.Health.current {
            target = enemy
        }
    }
    return target.id
}

choice fn select_ability(character: Character, allies: list, enemies: list): string {
    // Healer logic
    if character.class == "Cleric" {
        for ally in allies {
            if health_percentage(ally) < 0.4 {
                return "heal"
            }
        }
    }
    
    // Mage logic
    if character.class == "Mage" {
        if enemies.count >= 3 {
            return "fireball"
        }
        return "ice_shard"
    }
    
    // Warrior logic
    if character.class == "Warrior" {
        if health_percentage(character) > 0.8 {
            return "power_strike"
        }
        return "defensive_stance"
    }
    
    return "basic_attack"
}
```

---

## Appendix A: BCL vs BRL Quick Reference

| Feature | BRL | BCL |
|---------|-----|-----|
| Read components | ✅ | ✅ |
| Write components | ✅ | ❌ |
| Define components | ✅ | ❌ |
| Create entities | ✅ | ❌ |
| Delete entities | ✅ | ❌ |
| Schedule events | ✅ | ❌ |
| Define rules | ✅ | ❌ |
| Define trackers | ✅ | ❌ |
| Pure functions | ✅ | ✅ |
| Choice functions | ❌ | ✅ |
| Modules | ✅ | ✅ |
| Party definition | ❌ | ✅ |

---

## Appendix B: Error Messages

BCL provides clear error messages for common mistakes:

```
Error: Cannot modify component in BCL
  --> my_party.bcl:42:5
   |
42 |     entity.Health.current = 100
   |     ^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = help: BCL can only read values, not modify them
   = help: Use a choice function to return a decision instead
```

```
Error: Entity creation not allowed in BCL
  --> my_party.bcl:15:1
   |
15 | create entity {
   | ^^^^^^^^^^^^^
   |
   = help: Define party members using the 'party' block instead
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2024-12-31 | Initial draft |
