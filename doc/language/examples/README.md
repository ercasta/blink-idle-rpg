# Blink Example: Basic Combat

This folder contains example BRL and BCL code demonstrating basic combat mechanics.

## Files

| File | Description |
|------|-------------|
| `combat-components.brl` | Component definitions for combat |
| `combat-rules.brl` | Combat rules |
| `player-strategy.bcl` | Example player strategy |

## combat-components.brl

```brl
// Core combat components

component Character {
    name: string
    class: string
    level: integer
}

component Health {
    current: integer
    maximum: integer
}

component Stats {
    strength: integer
    dexterity: integer
    constitution: integer
    intelligence: integer
    wisdom: integer
}

component Position {
    x: float
    y: float
}

// Combat event components

component DamageEvent {
    source: id
    target: id
    amount: integer
    damage_type: string
}

component AttackEvent {
    attacker: id
    defender: id
    ability: string
}

component DeathEvent {
    target: id
}
```

## combat-rules.brl

```brl
// Basic combat rules

rule ProcessAttack on AttackEvent {
    let attacker = event.AttackEvent.attacker
    let defender = event.AttackEvent.defender
    
    // Calculate damage
    let base_damage = attacker.Stats.strength
    let damage = base_damage + random(1, 6)
    
    // Schedule damage event
    schedule DamageEvent {
        source: attacker
        target: defender
        amount: damage
        damage_type: "physical"
    }
}

rule ApplyDamage on DamageEvent {
    let target = event.DamageEvent.target
    let amount = event.DamageEvent.amount
    
    target.Health.current -= amount
    
    if target.Health.current <= 0 {
        target.Health.current = 0
        schedule DeathEvent {
            target: target
        }
    }
}

rule HandleDeath on DeathEvent {
    let target = event.DeathEvent.target
    
    // Remove from combat
    target.remove(InCombat)
}

// Tracker for combat log
tracker CombatLog on DamageEvent {
    let source_name = event.DamageEvent.source.Character.name
    let target_name = event.DamageEvent.target.Character.name
    let amount = event.DamageEvent.amount
    
    emit message("{source_name} hits {target_name} for {amount} damage!")
}

tracker DeathLog on DeathEvent {
    let target_name = event.DeathEvent.target.Character.name
    emit message("{target_name} has been defeated!")
}
```

## player-strategy.bcl

```bcl
// Example player strategy

// Party definition
party {
    hero {
        class: "Warrior"
        name: "Blink"
        stats {
            strength: 14
            dexterity: 12
            constitution: 14
            intelligence: 8
            wisdom: 10
        }
    }
}

// Target selection: attack weakest enemy
choice fn select_attack_target(attacker: Character, enemies: list): id {
    let target = enemies[0]
    
    for enemy in enemies {
        if enemy.Health.current < target.Health.current {
            target = enemy
        }
    }
    
    return target.id
}

// Ability selection: always basic attack
choice fn select_ability(character: Character): string {
    return "basic_attack"
}
```

## Running This Example

```bash
# Compile rules
blink-compiler compile combat-components.brl combat-rules.brl -o combat.ir

# Run simulation
blink-run combat.ir --choices player-strategy.bcl
```
