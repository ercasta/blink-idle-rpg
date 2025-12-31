# BRL User Guide

**Blink Rule Language (BRL)** - A comprehensive guide for game developers

**Version**: 0.1.0  
**Last Updated**: 2024-12-31

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Quick Reference](#quick-reference)
4. [Step-by-Step Tutorials](#step-by-step-tutorials)
5. [Common Patterns](#common-patterns)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Complete Examples](#complete-examples)

---

## Introduction

### What is BRL?

BRL (Blink Rule Language) is a domain-specific language for defining game rules in the Blink Idle RPG engine. It's designed for **game developers** who want to create engaging idle RPG experiences.

### Who Should Use This Guide?

This guide is for:
- Game developers creating new Blink games
- Programmers familiar with basic programming concepts
- Anyone who wants to define game mechanics, components, and rules

### Key Features

- **Declarative Syntax**: Describe what should happen, not how
- **Type Safety**: Catch errors before runtime
- **Event-Driven**: React to game events with rules
- **ECS Architecture**: Entity-Component-System for flexible design

### BRL vs BCL

| Aspect | BRL | BCL |
|--------|-----|-----|
| **Target User** | Game developers | Players |
| **Purpose** | Define game rules | Define player strategies |
| **Capabilities** | Full control | Read-only, choices only |
| **State Modification** | ✅ Yes | ❌ No |

---

## Getting Started

### Installation

#### Prerequisites

Before using BRL, you need:
- **Rust** (for the compiler): Install from [rustup.rs](https://rustup.rs/)
- **Node.js** (for the engine): Install from [nodejs.org](https://nodejs.org/)

#### Building the Compiler

```bash
# Clone the repository
git clone https://github.com/ercasta/blink-idle-rpg.git
cd blink-idle-rpg

# Build the compiler
cd src/compiler
cargo build --release

# Test the compiler
cargo run -- --help
```

### Your First BRL Program

Let's create a simple clicker game:

```brl
// clicker.brl - A simple clicking game

// Define a component to track clicks
component Clicks {
    count: integer
}

// Rule: When a Click event happens, increment the count
rule handle_click on Click {
    entity.Clicks.count += 1
}

// Track the click count for UI display
tracker Clicks on Click
```

### Compiling Your Code

```bash
# Compile to IR (Intermediate Representation)
cargo run -- compile -i clicker.brl -o clicker.ir.json --pretty

# Check for errors without compiling
cargo run -- check -i clicker.brl
```

### Running Your Game

```typescript
// JavaScript/TypeScript
import { BlinkGame } from '@blink/engine';

const game = await BlinkGame.create();
await game.loadRules('./clicker.ir.json');
game.start();

// Schedule a click event
game.scheduleEvent('Click', { entity: entityId });
```

---

## Quick Reference

### Syntax at a Glance

```brl
// Comments
// Single-line comment
/* Multi-line comment */

// Components (data structures)
component ComponentName {
    field: type
}

// Rules (event reactions)
rule RuleName on EventType {
    // code here
}

// Functions
fn function_name(param: type): return_type {
    return value
}

// Trackers (UI feedback)
tracker ComponentName on EventType

// Modules
module module_name {
    // declarations
}
```

### Base Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text | `"hello"` |
| `boolean` | True/false | `true` or `false` |
| `integer` | Whole number | `42` |
| `float` | Decimal number | `3.14` |
| `decimal` | Fixed precision | `10.50d` |
| `id` | Entity reference | `@entity123` |

### Keywords

```
component  rule       on         trigger    event
entity     if         else       for        while
fn         return     true       false      null
schedule   cancel     recurring  module     import
tracker    when       create     delete     has
```

### Operators

```brl
// Arithmetic
+  -  *  /  %  (negation: -)

// Comparison
==  !=  <  <=  >  >=

// Logical
&&  ||  !

// Assignment
=  +=  -=  *=  /=  %=
```

### Common Patterns

```brl
// Read component field
entity.ComponentName.field

// Check component exists
entity.has(ComponentName)

// Iterate multiple components
for component in entity.ComponentName {
    // ...
}

// Schedule immediate event
schedule EventName { field: value }

// Schedule delayed event
schedule [delay: 1.5] EventName { field: value }

// Schedule recurring event
let id = schedule recurring [interval: 1.0] EventName { }

// Cancel recurring event
cancel id
```

---

## Step-by-Step Tutorials

### Tutorial 1: Building a Health System

**Goal**: Create a health system with damage and healing.

#### Step 1: Define Components

```brl
// Health tracking
component Health {
    current: integer
    maximum: integer
}

// Character information
component Character {
    name: string
    level: integer
}
```

#### Step 2: Define Events

Events are just components on special entities:

```brl
// Event: Damage dealt to an entity
component DamageEvent {
    target: id
    amount: integer
    source: id?
}

// Event: Healing applied to an entity
component HealEvent {
    target: id
    amount: integer
}
```

#### Step 3: Create Rules

```brl
// Apply damage
rule apply_damage on DamageEvent {
    let target = event.DamageEvent.target
    target.Health.current -= event.DamageEvent.amount
    
    // Check for death
    if target.Health.current <= 0 {
        target.Health.current = 0
        schedule Death { target: target.id }
    }
}

// Apply healing
rule apply_heal on HealEvent {
    let target = event.HealEvent.target
    target.Health.current += event.HealEvent.amount
    
    // Cap at maximum
    if target.Health.current > target.Health.maximum {
        target.Health.current = target.Health.maximum
    }
}
```

#### Step 4: Add Trackers

```brl
// Track health changes for UI
tracker Health on DamageEvent
tracker Health on HealEvent
tracker Character on DamageEvent  // Show names in combat log
```

### Tutorial 2: Creating a Combat System

**Goal**: Build an auto-attack combat system.

#### Step 1: Define Combat Components

```brl
component Attack {
    damage: integer
    speed: float  // attacks per second
}

component Target {
    entity: id?  // current target
}
```

#### Step 2: Create Attack Logic

```brl
// Main attack rule
rule auto_attack on DoAttack {
    // Check if we have a valid target
    if entity.Target.entity != null {
        let target = entity.Target.entity
        
        // Deal damage
        schedule DamageEvent {
            target: target.id
            amount: entity.Attack.damage
            source: entity.id
        }
        
        // Schedule next attack
        let delay = 1.0 / entity.Attack.speed
        schedule [delay: delay] DoAttack {
            attacker: entity.id
        }
    }
}
```

#### Step 3: Handle Death

```brl
rule handle_death on Death {
    let victim = event.Death.target
    
    // Clear as target for all attackers
    // (In real implementation, iterate all entities)
    
    // Remove from game
    delete victim
}
```

### Tutorial 3: Implementing Buffs and Debuffs

**Goal**: Create temporary status effects.

#### Step 1: Define Buff Component

```brl
component Buff {
    name: string
    duration: float
    magnitude: float
}
```

Note: An entity can have multiple Buff components.

#### Step 2: Apply Buffs

```brl
rule apply_buff on BuffApplied {
    let target = event.BuffApplied.target
    
    // Add buff to target
    target.add(Buff {
        name: event.BuffApplied.name
        duration: event.BuffApplied.duration
        magnitude: event.BuffApplied.magnitude
    })
    
    // Schedule buff expiration
    schedule [delay: event.BuffApplied.duration] BuffExpired {
        target: target.id
        buff_name: event.BuffApplied.name
    }
}
```

#### Step 3: Tick Buffs

```brl
rule tick_buffs on GameTick {
    // Iterate all buffs on this entity
    for buff in entity.Buff {
        buff.duration -= event.GameTick.delta_time
        
        if buff.duration <= 0 {
            entity.remove(buff)
        }
    }
}
```

### Tutorial 4: Resource Management (Mana)

**Goal**: Add mana for abilities.

#### Step 1: Define Resource Component

```brl
component Mana {
    current: integer
    maximum: integer
    regen_per_second: float
}
```

#### Step 2: Mana Regeneration

```brl
rule mana_regen on GameTick {
    if entity.has(Mana) {
        let regen = entity.Mana.regen_per_second * event.GameTick.delta_time
        entity.Mana.current += regen as integer
        
        if entity.Mana.current > entity.Mana.maximum {
            entity.Mana.current = entity.Mana.maximum
        }
    }
}
```

#### Step 3: Ability with Mana Cost

```brl
rule cast_spell on CastSpell {
    let cost = event.CastSpell.mana_cost
    
    // Check if we have enough mana
    if entity.Mana.current >= cost {
        entity.Mana.current -= cost
        
        // Apply spell effect
        schedule DamageEvent {
            target: event.CastSpell.target
            amount: event.CastSpell.damage
            source: entity.id
        }
    }
}
```

---

## Common Patterns

### Pattern 1: Cooldown System

```brl
component Cooldown {
    name: string
    remaining: float
}

rule use_ability_with_cooldown on UseAbility {
    let cooldown_name = "ability_" + event.UseAbility.ability_name
    
    // Check if on cooldown
    let on_cooldown = false
    for cd in entity.Cooldown {
        if cd.name == cooldown_name {
            on_cooldown = true
        }
    }
    
    if !on_cooldown {
        // Use ability
        // ... ability logic ...
        
        // Add cooldown
        entity.add(Cooldown {
            name: cooldown_name
            remaining: event.UseAbility.cooldown_duration
        })
        
        // Schedule cooldown removal
        schedule [delay: event.UseAbility.cooldown_duration] CooldownExpired {
            entity: entity.id
            cooldown_name: cooldown_name
        }
    }
}

rule tick_cooldowns on GameTick {
    for cd in entity.Cooldown {
        cd.remaining -= event.GameTick.delta_time
        
        if cd.remaining <= 0 {
            entity.remove(cd)
        }
    }
}
```

### Pattern 2: Damage Over Time (DOT)

```brl
component Poison {
    damage_per_second: integer
    duration: float
}

rule apply_poison on PoisonApplied {
    let target = event.PoisonApplied.target
    
    target.add(Poison {
        damage_per_second: event.PoisonApplied.dps
        duration: event.PoisonApplied.duration
    })
    
    // Schedule tick
    let tick_id = schedule recurring [interval: 1.0] PoisonTick {
        target: target.id
    }
}

rule poison_tick on PoisonTick {
    let target = event.PoisonTick.target
    
    for poison in target.Poison {
        // Deal damage
        schedule DamageEvent {
            target: target.id
            amount: poison.damage_per_second
        }
        
        // Reduce duration
        poison.duration -= 1.0
        
        if poison.duration <= 0 {
            target.remove(poison)
        }
    }
}
```

### Pattern 3: Conditional Damage Modifiers

```brl
fn calculate_critical_damage(base: integer, crit_chance: float): integer {
    // In real game, use random number generator
    // For now, simplified
    let is_crit = crit_chance > 0.5
    if is_crit {
        return base * 2
    }
    return base
}

rule apply_damage_with_modifiers on DamageEvent {
    let target = event.DamageEvent.target
    let base_damage = event.DamageEvent.amount
    let final_damage = base_damage
    
    // Apply defender's armor reduction
    if target.has(Armor) {
        let reduction = target.Armor.value
        final_damage = final_damage - reduction
        if final_damage < 0 {
            final_damage = 0
        }
    }
    
    // Apply damage
    target.Health.current -= final_damage
}
```

### Pattern 4: Event Chaining

```brl
// Event chains: Attack -> Hit -> Damage -> Death

rule on_attack on AttackEvent {
    // Roll to hit
    let hit_chance = entity.Attack.accuracy
    // Simplified: always hit
    
    schedule HitEvent {
        attacker: entity.id
        target: event.AttackEvent.target
    }
}

rule on_hit on HitEvent {
    // Calculate damage
    let damage = event.HitEvent.attacker.Attack.damage
    
    schedule DamageEvent {
        target: event.HitEvent.target
        amount: damage
        source: event.HitEvent.attacker.id
    }
}

rule on_damage on DamageEvent {
    let target = event.DamageEvent.target
    target.Health.current -= event.DamageEvent.amount
    
    if target.Health.current <= 0 {
        schedule Death {
            target: target.id
            killer: event.DamageEvent.source
        }
    }
}
```

### Pattern 5: Stat Calculation

```brl
component Stats {
    strength: integer
    dexterity: integer
    intelligence: integer
    constitution: integer
}

fn calculate_max_health(stats: Stats): integer {
    return 100 + (stats.Stats.constitution * 10)
}

fn calculate_damage(stats: Stats, weapon_damage: integer): integer {
    let str_bonus = stats.Stats.strength / 2
    return weapon_damage + str_bonus
}

rule on_level_up on LevelUp {
    // Recalculate derived stats
    entity.Health.maximum = calculate_max_health(entity)
    entity.Attack.damage = calculate_damage(entity, entity.Weapon.base_damage)
}
```

---

## Best Practices

### 1. Component Design

**Do:**
```brl
// Small, focused components
component Health {
    current: integer
    maximum: integer
}

component Mana {
    current: integer
    maximum: integer
}
```

**Don't:**
```brl
// Overly large, unfocused components
component Everything {
    health: integer
    mana: integer
    strength: integer
    // ... 20 more fields
}
```

### 2. Event Naming

**Do:**
```brl
// Clear, descriptive event names
component DamageEvent { }
component HealEvent { }
component LevelUpEvent { }
```

**Don't:**
```brl
// Vague or abbreviated names
component DMG { }
component Evt1 { }
```

### 3. Rule Organization

**Do:**
```brl
// One responsibility per rule
rule apply_damage on DamageEvent {
    entity.Health.current -= event.DamageEvent.amount
}

rule check_death on DamageEvent {
    if entity.Health.current <= 0 {
        schedule Death { target: entity.id }
    }
}
```

**Don't:**
```brl
// Kitchen sink rules
rule do_everything on DamageEvent {
    // damage, death, xp, loot, animations, sound...
}
```

### 4. Type Safety

**Do:**
```brl
// Use explicit types for clarity
fn calculate_damage(base: integer, multiplier: float): integer {
    return (base * multiplier) as integer
}
```

**Don't:**
```brl
// Rely too heavily on inference for complex logic
fn calc(x, y) {
    return x * y  // What types? What's the result?
}
```

### 5. Documentation

**Do:**
```brl
// Combat system for idle RPG
// Implements auto-attack with cooldowns

// Stores attack capability
component Attack {
    damage: integer      // Base damage per hit
    speed: float         // Attacks per second
    critical_chance: float  // 0.0 to 1.0
}
```

**Don't:**
```brl
// No comments or unclear purpose
component A {
    d: integer
    s: float
    c: float
}
```

### 6. Error Handling

**Do:**
```brl
rule apply_damage on DamageEvent {
    if event.DamageEvent.target != null {
        let target = event.DamageEvent.target
        if target.has(Health) {
            target.Health.current -= event.DamageEvent.amount
        }
    }
}
```

**Don't:**
```brl
rule apply_damage on DamageEvent {
    // Assume everything exists
    event.DamageEvent.target.Health.current -= event.DamageEvent.amount
}
```

### 7. Performance Considerations

**Do:**
```brl
// Schedule recurring events efficiently
let regen_id = schedule recurring [interval: 1.0] RegenerationTick {
    entity: entity.id
}

// Cancel when no longer needed
cancel regen_id
```

**Don't:**
```brl
// Re-schedule manually every time
rule regen on RegenerationTick {
    // ... regen logic ...
    
    // Creates event spam
    schedule [delay: 1.0] RegenerationTick { }
}
```

---

## Troubleshooting

### Common Errors

#### Error: "Component not found"

```
Error: Component 'Helth' not found
  --> combat.brl:15:5
```

**Cause**: Typo in component name.

**Solution**: Check spelling. Component names are case-sensitive.

```brl
// Wrong
entity.Helth.current

// Correct
entity.Health.current
```

#### Error: "Cannot assign to read-only field"

```
Error: Cannot modify field 'event.amount'
  --> combat.brl:23:5
```

**Cause**: Trying to modify event data.

**Solution**: Event data is read-only. Modify target entity instead.

```brl
// Wrong
event.DamageEvent.amount *= 2

// Correct
let modified_damage = event.DamageEvent.amount * 2
```

#### Error: "Type mismatch"

```
Error: Expected integer, found float
  --> combat.brl:30:25
```

**Cause**: Assigning wrong type to field.

**Solution**: Use type casting.

```brl
// Wrong
entity.Health.current = 50.5

// Correct
entity.Health.current = 50.5 as integer
```

#### Error: "Undefined variable"

```
Error: Variable 'target' not defined
  --> combat.brl:40:5
```

**Cause**: Using variable before declaration.

**Solution**: Declare with `let`.

```brl
// Wrong
target.Health.current = 0

// Correct
let target = event.DamageEvent.target
target.Health.current = 0
```

### Debugging Tips

#### 1. Use Trackers Liberally

```brl
// Track everything during development
tracker Health on DamageEvent
tracker Character on DamageEvent
tracker Combat on DamageEvent

// Remove unnecessary trackers for production
```

#### 2. Add Logging Events

```brl
component LogEvent {
    message: string
    data: string
}

rule debug_damage on DamageEvent {
    schedule LogEvent {
        message: "Damage applied"
        data: "amount=" + event.DamageEvent.amount as string
    }
}

tracker LogEvent on LogEvent
```

#### 3. Test Incrementally

```brl
// Start simple
rule test on TestEvent {
    schedule LogEvent { message: "Test fired" }
}

// Add complexity gradually
rule test on TestEvent {
    if entity.has(Health) {
        schedule LogEvent { message: "Entity has health" }
    }
}
```

### Performance Issues

#### Issue: "Too many events firing"

**Symptom**: Game slows down, event queue grows.

**Solution**: Check for event loops.

```brl
// Bad: Creates infinite loop
rule bad on EventA {
    schedule EventA { }  // Schedules itself!
}

// Good: Use conditions or delays
rule good on EventA {
    if entity.Health.current > 0 {
        schedule [delay: 1.0] EventA { }
    }
}
```

#### Issue: "Memory growing"

**Symptom**: Increasing memory usage over time.

**Solution**: Clean up recurring events.

```brl
rule start_regen on BuffApplied {
    let regen_id = schedule recurring [interval: 1.0] Regen {
        target: entity.id
    }
    
    // Store ID to cancel later
    entity.RegenTracker.event_id = regen_id
}

rule stop_regen on BuffExpired {
    cancel entity.RegenTracker.event_id
}
```

---

## Complete Examples

### Example 1: Simple Idle Clicker

Complete clicker game with upgrades:

```brl
// === COMPONENTS ===

component Clicks {
    count: integer
    per_click: integer
}

component AutoClicker {
    clicks_per_second: float
}

component Upgrades {
    click_multiplier: integer
    auto_clicker_level: integer
}

// === EVENTS ===

component Click {
    entity: id
}

component BuyUpgrade {
    entity: id
    upgrade_type: string
}

component AutoClickTick {
    entity: id
}

// === RULES ===

rule handle_click on Click {
    let clicker = event.Click.entity
    clicker.Clicks.count += clicker.Clicks.per_click
}

rule buy_upgrade on BuyUpgrade {
    let player = event.BuyUpgrade.entity
    let upgrade = event.BuyUpgrade.upgrade_type
    
    if upgrade == "click_multiplier" {
        let cost = player.Upgrades.click_multiplier * 10
        if player.Clicks.count >= cost {
            player.Clicks.count -= cost
            player.Clicks.per_click += 1
            player.Upgrades.click_multiplier += 1
        }
    }
    
    if upgrade == "auto_clicker" {
        let cost = player.Upgrades.auto_clicker_level * 50
        if player.Clicks.count >= cost {
            player.Clicks.count -= cost
            player.AutoClicker.clicks_per_second += 0.5
            player.Upgrades.auto_clicker_level += 1
        }
    }
}

rule auto_click on AutoClickTick {
    let player = event.AutoClickTick.entity
    let clicks = player.AutoClicker.clicks_per_second
    player.Clicks.count += clicks as integer
}

// === TRACKERS ===

tracker Clicks on Click
tracker Clicks on BuyUpgrade
tracker Clicks on AutoClickTick
tracker Upgrades on BuyUpgrade
```

### Example 2: Turn-Based Combat

```brl
// === COMPONENTS ===

component Character {
    name: string
    level: integer
    team: integer  // 0 = player, 1 = enemy
}

component Health {
    current: integer
    maximum: integer
}

component Stats {
    attack: integer
    defense: integer
    speed: integer
}

component CombatState {
    turn_order: integer
    is_defending: boolean
}

// === EVENTS ===

component CombatStart {
    participants: list
}

component TurnStart {
    entity: id
}

component ActionChosen {
    actor: id
    action: string
    target: id?
}

// === FUNCTIONS ===

fn calculate_damage(attacker: Stats, defender: Stats): integer {
    let base_damage = attacker.Stats.attack
    let defense = defender.Stats.defense
    let damage = base_damage - (defense / 2)
    if damage < 1 {
        return 1
    }
    return damage
}

fn find_next_combatant(participants: list): id {
    let fastest = participants[0]
    for participant in participants {
        if participant.Stats.speed > fastest.Stats.speed {
            fastest = participant
        }
    }
    return fastest.id
}

// === RULES ===

rule init_combat on CombatStart {
    // Sort by speed and assign turn order
    let turn = 0
    for participant in event.CombatStart.participants {
        participant.CombatState.turn_order = turn
        turn += 1
    }
    
    // Start first turn
    let first = find_next_combatant(event.CombatStart.participants)
    schedule TurnStart { entity: first }
}

rule process_action on ActionChosen {
    let actor = event.ActionChosen.actor
    let action = event.ActionChosen.action
    let target = event.ActionChosen.target
    
    if action == "attack" {
        let damage = calculate_damage(actor, target)
        target.Health.current -= damage
        
        if target.Health.current <= 0 {
            schedule Death { target: target.id }
        }
    }
    
    if action == "defend" {
        actor.CombatState.is_defending = true
    }
    
    // Next turn
    schedule NextTurn { }
}

// === TRACKERS ===

tracker Health on ActionChosen
tracker Character on ActionChosen
tracker CombatState on TurnStart
```

### Example 3: Inventory System

```brl
// === COMPONENTS ===

component Inventory {
    capacity: integer
    gold: integer
}

component Item {
    name: string
    type: string
    value: integer
    stack_count: integer
    owner: id
}

component Equipment {
    weapon: id?
    armor: id?
    accessory: id?
}

// === EVENTS ===

component PickupItem {
    character: id
    item: id
}

component DropItem {
    character: id
    item: id
}

component EquipItem {
    character: id
    item: id
}

component SellItem {
    character: id
    item: id
}

// === FUNCTIONS ===

fn count_items(character: id): integer {
    let count = 0
    // In real implementation, iterate all items
    // For simplification:
    return count
}

fn can_stack(item1: Item, item2: Item): boolean {
    return item1.Item.name == item2.Item.name &&
           item1.Item.type == item2.Item.type
}

// === RULES ===

rule pickup_item on PickupItem {
    let character = event.PickupItem.character
    let item = event.PickupItem.item
    
    // Check inventory space
    let item_count = count_items(character)
    if item_count < character.Inventory.capacity {
        // Try to stack
        let stacked = false
        // Check existing items for stacking...
        
        if !stacked {
            // Add as new item
            item.Item.owner = character.id
        }
    }
}

rule equip_item on EquipItem {
    let character = event.EquipItem.character
    let item = event.EquipItem.item
    let item_type = item.Item.type
    
    if item_type == "weapon" {
        // Unequip current weapon
        if character.Equipment.weapon != null {
            let old_weapon = character.Equipment.weapon
            old_weapon.Item.owner = character.id
        }
        
        // Equip new weapon
        character.Equipment.weapon = item.id
        item.Item.owner = null
    }
    
    // Similar for armor and accessory...
}

rule sell_item on SellItem {
    let character = event.SellItem.character
    let item = event.SellItem.item
    
    // Add gold
    character.Inventory.gold += item.Item.value
    
    // Remove item
    delete item
}

// === TRACKERS ===

tracker Inventory on PickupItem
tracker Inventory on SellItem
tracker Equipment on EquipItem
tracker Item on PickupItem
```

---

## Next Steps

### Further Reading

- [BRL Specification](brl-specification.md) - Complete language reference
- [BCL User Guide](bcl-user-guide.md) - For players defining strategies
- [Engine Architecture](../engine/architecture.md) - How BRL is executed
- [IR Specification](../ir-specification.md) - Compiler output format

### Example Projects

Check out complete example projects:
- `examples/brl/simple-clicker.brl` - Minimal clicker
- `examples/brl/simple-combat.brl` - Combat system
- `examples/bcl/` - Player strategy examples

### Getting Help

- **Documentation**: Check the [language specification](brl-specification.md)
- **Examples**: Browse `examples/brl/` directory
- **Issues**: Report bugs on GitHub

### Contributing

Want to improve BRL? Contributions welcome!
- Propose new features
- Submit bug reports
- Add examples
- Improve documentation

---

**Happy Game Development!** 🎮
