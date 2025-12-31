# BCL User Guide

**Blink Choice Language (BCL)** - A comprehensive guide for players

**Version**: 0.1.0  
**Last Updated**: 2024-12-31

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Quick Reference](#quick-reference)
4. [Step-by-Step Tutorials](#step-by-step-tutorials)
5. [Strategy Patterns](#strategy-patterns)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Complete Examples](#complete-examples)

---

## Introduction

### What is BCL?

BCL (Blink Choice Language) is a player-focused language for defining:
- **Party composition**: Which characters to include
- **Character builds**: Stats, equipment, and abilities
- **Decision strategies**: How characters behave in combat

### Who Should Use This Guide?

This guide is for:
- Players who want to customize their party behavior
- RPG enthusiasts who enjoy optimization
- Anyone interested in creating strategic AI for their characters

### Key Features

- **Safe**: Cannot break the game or corrupt save data
- **Accessible**: Easier to learn than programming
- **Powerful**: Express complex strategies
- **Fun**: Experiment with different builds and tactics

### BCL vs BRL

| Aspect | BCL (You!) | BRL (Developers) |
|--------|-----------|------------------|
| **Purpose** | Define strategies | Define game rules |
| **Can Read** | ✅ Entity data | ✅ Entity data |
| **Can Modify** | ❌ No | ✅ Yes |
| **Can Create** | ❌ No | ✅ Yes |
| **Focus** | Making choices | Creating mechanics |

**Think of it this way**: BRL defines *what's possible* in the game. BCL lets you choose *how to play*.

---

## Getting Started

### What You Need

To use BCL, you need:
- A Blink game (like the Classic RPG demo)
- A text editor (Notepad, VS Code, or any editor)
- Basic understanding of if/else logic

No programming experience required!

### Your First BCL File

Let's create a simple party:

```bcl
// my_party.bcl - My first party

// Define the party
party {
    hero {
        name: "Blink"
        class: "Warrior"
        stats {
            strength: 15
            dexterity: 10
            constitution: 14
        }
    }
}

// Define strategy: Attack the weakest enemy
choice fn select_attack_target(character, enemies): id {
    let weakest = enemies[0]
    for enemy in enemies {
        if enemy.Health.current < weakest.Health.current {
            weakest = enemy
        }
    }
    return weakest.id
}
```

### Loading Your Strategy

1. Save your BCL file (e.g., `my_party.bcl`)
2. Open the game demo in your browser
3. Click "Load Strategy"
4. Select your BCL file
5. Start the game!

### Understanding What Happens

When you load a BCL file:
1. The game reads your party definition
2. Creates your characters with chosen stats
3. Uses your choice functions during gameplay
4. Your characters make decisions based on your strategy

---

## Quick Reference

### Syntax Basics

```bcl
// Comments
// Single-line comment
/* Multi-line comment */

// Party definition
party {
    character_name {
        name: "Display Name"
        class: "ClassName"
        stats { /* ... */ }
    }
}

// Choice functions
choice fn function_name(params...): return_type {
    // decision logic
    return decision
}

// Regular functions
fn helper_function(param: type): type {
    return value
}

// Conditionals
if condition {
    // ...
} else {
    // ...
}

// Loops
for item in list {
    // ...
}
```

### What You Can Do

✅ **Allowed in BCL:**
- Read entity data (`entity.Health.current`)
- Check for components (`entity.has(Poisoned)`)
- Make calculations (`damage * 2`)
- Return decisions from choice functions
- Define helper functions
- Use if/else, for loops
- Compare values (`a > b`, `a == b`)

❌ **Not Allowed in BCL:**
- Modify entity data (`entity.Health.current = 100`)
- Create entities (`create entity { }`)
- Schedule events (`schedule DamageEvent { }`)
- Define new components
- Define rules or trackers

### Common Patterns

```bcl
// Check health percentage
let hp_pct = entity.Health.current / entity.Health.maximum

// Find weakest enemy
for enemy in enemies {
    if enemy.Health.current < target.Health.current {
        target = enemy
    }
}

// Check if entity has component
if entity.has(Poisoned) {
    // ...
}

// Conditional decision
if condition {
    return "option_a"
} else {
    return "option_b"
}
```

---

## Step-by-Step Tutorials

### Tutorial 1: Creating Your First Party

**Goal**: Build a balanced 3-character party.

#### Step 1: Choose Your Classes

```bcl
party {
    // Tank: Absorbs damage
    tank {
        name: "Shield"
        class: "Warrior"
    }
    
    // Damage dealer: Deals damage
    damage {
        name: "Striker"
        class: "Rogue"
    }
    
    // Healer: Keeps party alive
    healer {
        name: "Life"
        class: "Cleric"
    }
}
```

#### Step 2: Assign Stats

```bcl
party {
    tank {
        name: "Shield"
        class: "Warrior"
        stats {
            strength: 12      // Moderate damage
            dexterity: 8      // Lower dodge
            constitution: 16  // HIGH health
            intelligence: 6
            wisdom: 8
        }
    }
    
    damage {
        name: "Striker"
        class: "Rogue"
        stats {
            strength: 10
            dexterity: 18     // HIGH dodge and crit
            constitution: 10
            intelligence: 8
            wisdom: 8
        }
    }
    
    healer {
        name: "Life"
        class: "Cleric"
        stats {
            strength: 8
            dexterity: 10
            constitution: 12
            intelligence: 10
            wisdom: 16        // HIGH healing power
        }
    }
}
```

#### Step 3: Choose Equipment

```bcl
party {
    tank {
        name: "Shield"
        class: "Warrior"
        stats { /* ... */ }
        equipment {
            weapon: "sword_and_shield"
            armor: "plate_mail"
            accessory: "ring_of_protection"
        }
    }
    
    // ... similar for other characters
}
```

#### Step 4: Test Your Party

Save the file and load it in the game. See how they perform!

### Tutorial 2: Simple Target Selection

**Goal**: Make your characters attack smartly.

#### Strategy 1: Focus Fire (Kill Weakest First)

```bcl
choice fn select_attack_target(character, enemies): id {
    // Find the enemy with lowest health
    let target = enemies[0]
    
    for enemy in enemies {
        if enemy.Health.current < target.Health.current {
            target = enemy
        }
    }
    
    return target.id
}
```

**Why this works**: Reducing enemy count faster means less incoming damage.

#### Strategy 2: Priority Targeting (Kill Dangerous First)

```bcl
// Helper function to determine threat
fn threat_level(enemy): integer {
    // Healers are highest priority
    if enemy.Character.class == "Healer" {
        return 100
    }
    // Mages next
    if enemy.Character.class == "Mage" {
        return 80
    }
    // Rogues next
    if enemy.Character.class == "Rogue" {
        return 60
    }
    // Warriors last
    return 40
}

choice fn select_attack_target(character, enemies): id {
    let target = enemies[0]
    let highest_threat = threat_level(target)
    
    for enemy in enemies {
        let threat = threat_level(enemy)
        if threat > highest_threat {
            target = enemy
            highest_threat = threat
        }
    }
    
    return target.id
}
```

**Why this works**: Eliminate threats in order of danger.

### Tutorial 3: Ability Selection

**Goal**: Choose the right ability at the right time.

#### Basic Ability Logic

```bcl
choice fn select_ability(character, allies, enemies): string {
    let hp_pct = character.Health.current / character.Health.maximum
    
    // If low health and warrior, defend
    if character.class == "Warrior" && hp_pct < 0.3 {
        return "defensive_stance"
    }
    
    // If mage and multiple enemies, AoE
    if character.class == "Mage" && enemies.count >= 3 {
        return "fireball"
    }
    
    // If cleric, check if healing needed
    if character.class == "Cleric" {
        for ally in allies {
            let ally_hp = ally.Health.current / ally.Health.maximum
            if ally_hp < 0.5 {
                return "heal"
            }
        }
    }
    
    // Default: basic attack
    return "basic_attack"
}
```

### Tutorial 4: Resource Management

**Goal**: Use mana efficiently.

```bcl
choice fn select_ability(character, allies, enemies): string {
    // Check mana percentage
    let mana_pct = character.Mana.current / character.Mana.maximum
    
    // Low mana: conserve with basic attacks
    if mana_pct < 0.2 {
        return "basic_attack"
    }
    
    // Good mana: use abilities
    if enemies.count >= 3 && mana_pct > 0.5 {
        // AoE is efficient against groups
        return "blizzard"  // Costs 40 mana
    }
    
    // Single target
    if mana_pct > 0.3 {
        return "fireball"  // Costs 20 mana
    }
    
    return "basic_attack"
}
```

### Tutorial 5: Conditional Healing

**Goal**: Heal the right target at the right time.

```bcl
choice fn select_heal_target(healer, allies): id? {
    // Thresholds
    let critical = 0.25  // 25% health
    let low = 0.5        // 50% health
    
    // First priority: critical health
    for ally in allies {
        let hp_pct = ally.Health.current / ally.Health.maximum
        if hp_pct < critical {
            return ally.id
        }
    }
    
    // Second priority: anyone below 50%
    for ally in allies {
        let hp_pct = ally.Health.current / ally.Health.maximum
        if hp_pct < low {
            return ally.id
        }
    }
    
    // No one needs healing
    return null
}

choice fn select_ability(character, allies, enemies): string {
    if character.class == "Cleric" {
        let heal_target = select_heal_target(character, allies)
        if heal_target != null {
            return "heal"
        }
    }
    
    // No healing needed, attack instead
    return "smite"
}
```

---

## Strategy Patterns

### Pattern 1: Focus Fire

**Goal**: All characters attack the same target.

```bcl
// Global target selection
let global_target = null

choice fn select_attack_target(character, enemies): id {
    // If global target is dead or null, pick new one
    if global_target == null || !is_alive(global_target) {
        global_target = find_weakest(enemies)
    }
    return global_target
}

fn find_weakest(enemies): id {
    let weakest = enemies[0]
    for enemy in enemies {
        if enemy.Health.current < weakest.Health.current {
            weakest = enemy
        }
    }
    return weakest.id
}

fn is_alive(entity): boolean {
    return entity.Health.current > 0
}
```

### Pattern 2: Role-Based Targeting

**Goal**: Different roles target differently.

```bcl
choice fn select_attack_target(character, enemies): id {
    let role = character.Character.class
    
    // Tanks attack highest damage dealers
    if role == "Warrior" {
        return find_highest_damage(enemies)
    }
    
    // DPS focus weakest
    if role == "Rogue" || role == "Mage" {
        return find_weakest(enemies)
    }
    
    // Healers attack whoever tanks are fighting
    if role == "Cleric" {
        return find_tank_target(enemies)
    }
    
    return enemies[0].id
}

fn find_highest_damage(enemies): id {
    let target = enemies[0]
    let highest = 0
    
    for enemy in enemies {
        if enemy.Attack.damage > highest {
            target = enemy
            highest = enemy.Attack.damage
        }
    }
    
    return target.id
}
```

### Pattern 3: Adaptive Behavior

**Goal**: Change strategy based on battle state.

```bcl
fn count_alive_allies(allies): integer {
    let count = 0
    for ally in allies {
        if ally.Health.current > 0 {
            count = count + 1
        }
    }
    return count
}

fn average_party_health(allies): float {
    let total = 0.0
    for ally in allies {
        total = total + (ally.Health.current / ally.Health.maximum)
    }
    return total / allies.count
}

choice fn select_ability(character, allies, enemies): string {
    let party_health = average_party_health(allies)
    let ally_count = count_alive_allies(allies)
    
    // Desperate situation: focus survival
    if party_health < 0.3 || ally_count <= 2 {
        if character.class == "Cleric" {
            return "group_heal"
        }
        if character.class == "Warrior" {
            return "defensive_stance"
        }
    }
    
    // Good situation: aggressive
    if party_health > 0.7 && ally_count >= 3 {
        if character.class == "Warrior" {
            return "berserker_rage"
        }
        if character.class == "Mage" {
            return "meteor"
        }
    }
    
    // Normal: balanced approach
    return "basic_attack"
}
```

### Pattern 4: Cooldown Management

**Goal**: Track and use abilities optimally.

```bcl
// Note: Assuming game provides cooldown info

choice fn select_ability(character, allies, enemies): string {
    // Check which abilities are ready
    let has_big_cooldown = !character.has(Cooldown)  // Simplified
    
    // Use big ability when:
    // 1. It's off cooldown
    // 2. There are enough enemies
    // 3. We have enough mana
    if has_big_cooldown && 
       enemies.count >= 3 && 
       character.Mana.current > 50 {
        return "ultimate_ability"
    }
    
    // Use medium abilities
    if character.Mana.current > 30 {
        if enemies.count >= 2 {
            return "aoe_attack"
        }
        return "strong_attack"
    }
    
    // Basic attack when conserving
    return "basic_attack"
}
```

### Pattern 5: Buff Management

**Goal**: Apply buffs strategically.

```bcl
choice fn select_ability(character, allies, enemies): string {
    // Check if party needs buffs
    let party_has_attack_buff = false
    
    for ally in allies {
        if ally.has(AttackBuff) {
            party_has_attack_buff = true
        }
    }
    
    // Apply attack buff at start of tough fights
    if !party_has_attack_buff && enemies.count >= 3 {
        return "battle_cry"  // Buffs whole party
    }
    
    // Check if character needs personal buff
    if !character.has(DefenseBuff) && 
       character.Health.current / character.Health.maximum < 0.5 {
        return "iron_skin"  // Personal defense
    }
    
    // Otherwise, attack
    return "power_strike"
}
```

### Pattern 6: Formation-Based Strategy

**Goal**: Position matters.

```bcl
// Characters in front row take more damage
// Characters in back row are safer

choice fn select_position(character, available_positions): Position {
    let role = character.Character.class
    
    // Tanks go front
    if role == "Warrior" {
        for pos in available_positions {
            if pos.row == "front" {
                return pos
            }
        }
    }
    
    // Mages and healers go back
    if role == "Mage" || role == "Cleric" {
        for pos in available_positions {
            if pos.row == "back" {
                return pos
            }
        }
    }
    
    // Rogues flexible - middle if possible
    if role == "Rogue" {
        for pos in available_positions {
            if pos.row == "middle" {
                return pos
            }
        }
    }
    
    // Default: any position
    return available_positions[0]
}
```

---

## Best Practices

### 1. Start Simple

**Do:**
```bcl
// Start with basic strategy
choice fn select_attack_target(character, enemies): id {
    return enemies[0].id  // Attack first enemy
}
```

**Then iterate:**
```bcl
// Add logic gradually
choice fn select_attack_target(character, enemies): id {
    // Now attack weakest
    let target = enemies[0]
    for enemy in enemies {
        if enemy.Health.current < target.Health.current {
            target = enemy
        }
    }
    return target.id
}
```

### 2. Use Helper Functions

**Do:**
```bcl
fn health_percent(entity): float {
    return entity.Health.current / entity.Health.maximum
}

fn is_low_health(entity): boolean {
    return health_percent(entity) < 0.3
}

choice fn select_ability(character, allies, enemies): string {
    if is_low_health(character) {
        return "defensive_ability"
    }
    return "attack_ability"
}
```

**Don't:**
```bcl
choice fn select_ability(character, allies, enemies): string {
    if character.Health.current / character.Health.maximum < 0.3 {
        return "defensive_ability"
    }
    return "attack_ability"
}
```

### 3. Comment Your Strategy

**Do:**
```bcl
// Defensive warrior build
// Priority: Survival > Team support > Damage

choice fn select_ability(character, allies, enemies): string {
    let hp_pct = health_percent(character)
    
    // Below 30% health: use defensive abilities
    if hp_pct < 0.3 {
        return "defensive_stance"
    }
    
    // Between 30-70%: balanced approach
    // ...
}
```

### 4. Test Incrementally

1. Start with basic party
2. Test in game
3. Add one strategy element
4. Test again
5. Iterate

### 5. Balance Your Party

**Good:**
- 1 Tank (Warrior)
- 1-2 Damage (Mage/Rogue)
- 1 Healer (Cleric)

**Risky:**
- All damage dealers
- All tanks
- No healing

### 6. Consider Edge Cases

**Do:**
```bcl
choice fn select_heal_target(healer, allies): id? {
    // Check if there are allies to heal
    if allies.count == 0 {
        return null
    }
    
    for ally in allies {
        let hp_pct = ally.Health.current / ally.Health.maximum
        if hp_pct < 0.5 && hp_pct > 0 {  // Alive and hurt
            return ally.id
        }
    }
    
    return null
}
```

### 7. Name Things Clearly

**Do:**
```bcl
fn calculate_threat_score(enemy): integer { }
let critical_health_threshold = 0.25
choice fn select_priority_target(...) { }
```

**Don't:**
```bcl
fn calc(e): integer { }
let x = 0.25
choice fn fn1(...) { }
```

---

## Troubleshooting

### Common Issues

#### Issue: "My characters don't attack"

**Possible causes:**
1. No `select_attack_target` function defined
2. Function returns wrong type
3. Target doesn't exist

**Solution:**
```bcl
choice fn select_attack_target(character, enemies): id {
    // Always return a valid enemy
    if enemies.count > 0 {
        return enemies[0].id
    }
    // Fallback (shouldn't happen, but safe)
    return character.id  
}
```

#### Issue: "Healer never heals"

**Possible causes:**
1. Healing threshold too low
2. Not checking allies' health
3. Wrong ability name

**Solution:**
```bcl
choice fn select_ability(character, allies, enemies): string {
    if character.class == "Cleric" {
        // Check each ally
        for ally in allies {
            let hp_pct = ally.Health.current / ally.Health.maximum
            if hp_pct < 0.7 {  // Heal at 70%
                return "heal"
            }
        }
    }
    return "basic_attack"
}
```

#### Issue: "Party dies too quickly"

**Possible causes:**
1. Stats too low (especially constitution)
2. No defensive strategy
3. No healing
4. Bad target priority

**Solution:**
- Increase constitution stats
- Add a healer to party
- Make tank use defensive abilities
- Focus fire to reduce enemy count

#### Issue: "Mage runs out of mana"

**Solution:**
```bcl
choice fn select_ability(character, allies, enemies): string {
    if character.class == "Mage" {
        let mana_pct = character.Mana.current / character.Mana.maximum
        
        // Conserve mana when low
        if mana_pct < 0.3 {
            return "basic_attack"  // No mana cost
        }
        
        // Use efficient spells
        if enemies.count >= 3 {
            return "blizzard"  // High damage per mana
        }
        
        return "fireball"
    }
    return "basic_attack"
}
```

### Debugging Tips

#### 1. Add Logging (if supported)

```bcl
// Some games support logging
choice fn select_attack_target(character, enemies): id {
    let target = enemies[0]
    // Log target selection
    // (syntax varies by game)
    return target.id
}
```

#### 2. Test One Character at a Time

```bcl
// Start with simple party
party {
    test {
        name: "Test"
        class: "Warrior"
        stats { /* ... */ }
    }
}

// Add others after testing
```

#### 3. Use Simple Strategies First

```bcl
// Test: Always attack first enemy
choice fn select_attack_target(character, enemies): id {
    return enemies[0].id
}

// Once working, add complexity
```

### Getting Help

- Check example BCL files in `examples/bcl/`
- Read the [BCL Specification](bcl-specification.md)
- Look at strategy patterns in this guide
- Ask in community forums

---

## Complete Examples

### Example 1: Beginner Party (Balanced)

```bcl
// beginner_party.bcl
// A safe, balanced party for new players

module beginner_party

party {
    warrior {
        name: "Defender"
        class: "Warrior"
        stats {
            strength: 12
            dexterity: 8
            constitution: 16  // High health
            intelligence: 6
            wisdom: 8
            charisma: 10
        }
        equipment {
            weapon: "sword_and_shield"
            armor: "plate_mail"
            accessory: "ring_of_protection"
        }
    }
    
    mage {
        name: "Blaster"
        class: "Mage"
        stats {
            strength: 6
            dexterity: 10
            constitution: 10
            intelligence: 16  // High magic damage
            wisdom: 12
            charisma: 10
        }
        equipment {
            weapon: "staff"
            armor: "robes"
            accessory: "amulet_of_mana"
        }
    }
    
    cleric {
        name: "Healer"
        class: "Cleric"
        stats {
            strength: 8
            dexterity: 8
            constitution: 12
            intelligence: 10
            wisdom: 16  // High healing
            charisma: 12
        }
        equipment {
            weapon: "mace"
            armor: "chainmail"
            accessory: "holy_symbol"
        }
    }
}

// Simple, safe strategy
choice fn select_attack_target(character, enemies): id {
    // Everyone attacks weakest enemy (focus fire)
    let target = enemies[0]
    for enemy in enemies {
        if enemy.Health.current < target.Health.current {
            target = enemy
        }
    }
    return target.id
}

choice fn select_ability(character, allies, enemies): string {
    // Healer: Heal if anyone below 60%
    if character.class == "Cleric" {
        for ally in allies {
            let hp_pct = ally.Health.current / ally.Health.maximum
            if hp_pct < 0.6 {
                return "heal"
            }
        }
        return "smite"  // Attack if no healing needed
    }
    
    // Mage: AoE if 3+ enemies
    if character.class == "Mage" {
        if enemies.count >= 3 {
            return "fireball"
        }
        return "ice_shard"
    }
    
    // Warrior: Simple power attack
    if character.class == "Warrior" {
        return "power_strike"
    }
    
    return "basic_attack"
}
```

### Example 2: Advanced Party (Optimized)

```bcl
// advanced_party.bcl
// Min-maxed party with complex strategy

module advanced_party

// === PARTY ===

party {
    tank {
        name: "Ironwall"
        class: "Warrior"
        stats {
            strength: 10
            dexterity: 8
            constitution: 18  // MAX constitution
            intelligence: 6
            wisdom: 8
            charisma: 8
        }
        equipment {
            weapon: "legendary_shield"
            armor: "mythril_plate"
            accessory: "ring_of_regeneration"
        }
    }
    
    rogue {
        name: "Shadow"
        class: "Rogue"
        stats {
            strength: 12
            dexterity: 18  // MAX dexterity
            constitution: 8
            intelligence: 8
            wisdom: 6
            charisma: 10
        }
        equipment {
            weapon: "twin_daggers"
            armor: "shadow_leather"
            accessory: "cloak_of_invisibility"
        }
    }
    
    mage {
        name: "Archmage"
        class: "Mage"
        stats {
            strength: 6
            dexterity: 10
            constitution: 8
            intelligence: 18  // MAX intelligence
            wisdom: 14
            charisma: 8
        }
        equipment {
            weapon: "staff_of_destruction"
            armor: "arcane_robes"
            accessory: "ring_of_mana"
        }
    }
    
    cleric {
        name: "Saint"
        class: "Cleric"
        stats {
            strength: 8
            dexterity: 8
            constitution: 10
            intelligence: 12
            wisdom: 18  // MAX wisdom
            charisma: 10
        }
        equipment {
            weapon: "holy_staff"
            armor: "blessed_mail"
            accessory: "divine_amulet"
        }
    }
}

// === HELPER FUNCTIONS ===

fn health_percent(entity): float {
    return entity.Health.current / entity.Health.maximum
}

fn mana_percent(entity): float {
    return entity.Mana.current / entity.Mana.maximum
}

fn count_low_health_allies(allies): integer {
    let count = 0
    for ally in allies {
        if health_percent(ally) < 0.5 {
            count = count + 1
        }
    }
    return count
}

fn threat_score(enemy): integer {
    let score = 0
    
    // Base threat by class
    if enemy.Character.class == "Healer" {
        score = score + 100
    }
    if enemy.Character.class == "Mage" {
        score = score + 80
    }
    if enemy.Character.class == "Rogue" {
        score = score + 60
    }
    
    // Add bonus for low health (finish them)
    if health_percent(enemy) < 0.3 {
        score = score + 50
    }
    
    // Add threat from damage
    score = score + enemy.Attack.damage
    
    return score
}

// === CHOICE FUNCTIONS ===

choice fn select_attack_target(character, enemies): id {
    // Tank: Protect squishies by targeting high damage enemies
    if character.class == "Warrior" {
        let target = enemies[0]
        let highest_damage = 0
        for enemy in enemies {
            if enemy.Attack.damage > highest_damage {
                target = enemy
                highest_damage = enemy.Attack.damage
            }
        }
        return target.id
    }
    
    // DPS: Use threat scoring
    let target = enemies[0]
    let highest_threat = threat_score(target)
    
    for enemy in enemies {
        let threat = threat_score(enemy)
        if threat > highest_threat {
            target = enemy
            highest_threat = threat
        }
    }
    
    return target.id
}

choice fn select_ability(character, allies, enemies): string {
    let hp_pct = health_percent(character)
    let low_health_count = count_low_health_allies(allies)
    
    // === CLERIC ===
    if character.class == "Cleric" {
        let mana = mana_percent(character)
        
        // Emergency group heal
        if low_health_count >= 2 && mana > 0.4 {
            return "group_heal"
        }
        
        // Critical single heal
        for ally in allies {
            if health_percent(ally) < 0.25 {
                return "heal"
            }
        }
        
        // Normal single heal
        for ally in allies {
            if health_percent(ally) < 0.6 {
                return "heal"
            }
        }
        
        // No healing needed, attack
        return "smite"
    }
    
    // === MAGE ===
    if character.class == "Mage" {
        let mana = mana_percent(character)
        
        // Conserve mana
        if mana < 0.2 {
            return "basic_attack"
        }
        
        // Big AoE for crowds
        if enemies.count >= 4 && mana > 0.6 {
            return "meteor"
        }
        
        // Regular AoE
        if enemies.count >= 3 && mana > 0.4 {
            return "blizzard"
        }
        
        // Single target
        if mana > 0.3 {
            return "fireball"
        }
        
        return "basic_attack"
    }
    
    // === ROGUE ===
    if character.class == "Rogue" {
        // Execute low health enemies
        for enemy in enemies {
            if health_percent(enemy) < 0.2 {
                return "assassinate"
            }
        }
        
        // Use evasion when low health
        if hp_pct < 0.3 {
            return "evasion"
        }
        
        // High damage ability
        return "shadowstep"
    }
    
    // === WARRIOR ===
    if character.class == "Warrior" {
        // Defensive when low
        if hp_pct < 0.4 {
            return "defensive_stance"
        }
        
        // AoE for crowds
        if enemies.count >= 3 {
            return "cleave"
        }
        
        // Offensive
        return "power_strike"
    }
    
    return "basic_attack"
}
```

### Example 3: Theme Party (All Rogues)

```bcl
// rogue_party.bcl
// All-rogue speedrun party

module rogue_party

party {
    rogue1 {
        name: "Stealth"
        class: "Rogue"
        stats {
            strength: 10
            dexterity: 18
            constitution: 10
            intelligence: 8
            wisdom: 6
            charisma: 8
        }
    }
    
    rogue2 {
        name: "Shadow"
        class: "Rogue"
        stats {
            strength: 12
            dexterity: 16
            constitution: 10
            intelligence: 8
            wisdom: 6
            charisma: 8
        }
    }
    
    rogue3 {
        name: "Phantom"
        class: "Rogue"
        stats {
            strength: 14
            dexterity: 16
            constitution: 8
            intelligence: 6
            wisdom: 6
            charisma: 10
        }
    }
}

// Ultra-aggressive focus fire
choice fn select_attack_target(character, enemies): id {
    // All attack same target - maximize burst
    let target = enemies[0]
    for enemy in enemies {
        if enemy.Health.current < target.Health.current {
            target = enemy
        }
    }
    return target.id
}

choice fn select_ability(character, allies, enemies): string {
    // Check for execute opportunity
    for enemy in enemies {
        let hp_pct = enemy.Health.current / enemy.Health.maximum
        if hp_pct < 0.2 {
            return "assassinate"
        }
    }
    
    // High damage ability
    return "backstab"
}
```

---

## Next Steps

### Experiment!

The best way to learn is to try different strategies:

1. **Copy an example** from this guide
2. **Modify one thing** (e.g., change target priority)
3. **Test in game** and see what happens
4. **Iterate** based on results

### Learn More

- [BCL Specification](bcl-specification.md) - Complete language reference
- [BRL User Guide](brl-user-guide.md) - For creating game rules
- [Example BCL Files](../../examples/bcl/) - More complete examples

### Share Your Strategies

Found a great strategy? Share it with the community!

- Post in forums
- Upload to strategy sharing sites
- Create guides for others

### Advanced Topics

Once comfortable with basics, explore:
- Multi-phase boss strategies
- Adaptive learning algorithms
- Tournament-style party optimization
- Speed-run optimized builds

---

**Have Fun Strategizing!** 🎯
