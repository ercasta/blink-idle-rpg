# Blink Data Language (BDL) Specification

**Version**: 0.1.0-draft  
**Status**: Draft  
**Last Updated**: 2026-01-03

## Table of Contents

1. [Introduction](#introduction)
2. [Relationship to BRL](#relationship-to-brl)
3. [Allowed Constructs](#allowed-constructs)
4. [Disallowed Constructs](#disallowed-constructs)
5. [Entity Definitions](#entity-definitions)
6. [Component Setting](#component-setting)
7. [Examples](#examples)
8. [Loading Order](#loading-order)

---

## 1. Introduction

The Blink Data Language (BDL) is a domain-specific language for **content creators** to define:

- **Entity definitions**: Static game data like characters, enemies, items
- **Component values**: Setting initial values for entity components
- **Game configuration**: Data that drives game behavior

### Design Goals

1. **Simple**: Easy for non-programmers to understand and modify
2. **Safe**: Cannot define behavior, only data
3. **Declarative**: Express what data exists, not how to create it
4. **Separated**: Keeps game data separate from game logic

### Audience

BDL is designed for **content creators** and **game designers**, not game programmers. It should be:
- Readable without programming knowledge
- Focused on game data configuration
- Separate from rules and behavior (BRL)
- Separate from player strategies (BCL)

---

## 2. Relationship to BRL

BDL is a **strict subset** of BRL, limited to entity creation and component initialization.

### What BDL Inherits from BRL

| Feature | Available in BDL |
|---------|------------------|
| Comments | ✅ Yes |
| Identifiers | ✅ Yes |
| Literal values (strings, numbers, booleans) | ✅ Yes |
| Entity creation | ✅ Yes |
| Component initialization | ✅ Yes |

### What BDL Removes from BRL

| Feature | Available in BDL |
|---------|------------------|
| Component definitions | ❌ No |
| Rule definitions | ❌ No |
| Function definitions | ❌ No |
| Tracker definitions | ❌ No |
| Event scheduling | ❌ No |
| Control flow (if, for, while) | ❌ No |
| Variable declarations | ❌ No |
| Expressions (arithmetic, comparison) | ❌ No |

---

## 3. Allowed Constructs

### 3.1 Entity Creation

```bdl
entity HeroName {
    ComponentName {
        field1: value1
        field2: value2
    }
}
```

### 3.2 Named Entity References

```bdl
entity @warrior {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
    }
}
```

### 3.3 Literal Values

```bdl
// String literals
"hello world"
'single quotes'

// Numeric literals
42          // integer
3.14        // float

// Boolean literals
true
false

// Null
null
```

### 3.4 Comments

```bdl
// Single-line comment

/* Multi-line
   comment */
```

---

## 4. Disallowed Constructs

The following BRL constructs are **not allowed** in BDL:

### 4.1 Component Definitions

```bdl
// ❌ NOT ALLOWED in BDL
component Health {
    current: integer
    max: integer
}
```

Components must be defined in BRL files, not BDL.

### 4.2 Rules

```bdl
// ❌ NOT ALLOWED in BDL
rule on DamageEvent {
    entity.Health.current -= event.amount
}
```

### 4.3 Functions

```bdl
// ❌ NOT ALLOWED in BDL
fn calculate_damage(base: integer): integer {
    return base * 2
}
```

### 4.4 Expressions

```bdl
// ❌ NOT ALLOWED in BDL
entity Example {
    Stats {
        damage: 10 + 5    // Arithmetic not allowed
        level: baseLevel  // Variables not allowed
    }
}
```

Only literal values are allowed in component fields.

---

## 5. Entity Definitions

### 5.1 Basic Entity

```bdl
entity {
    Character {
        name: "Goblin"
        class: "Monster"
        level: 1
    }
    Health {
        current: 60
        max: 60
    }
}
```

### 5.2 Named Entity

Named entities can be referenced later:

```bdl
entity @goblin_template {
    Character {
        name: "Goblin Scout"
        class: "Monster"
    }
    Enemy {
        tier: 1
        isBoss: false
        expReward: 25
    }
}
```

### 5.3 Multiple Components

```bdl
entity @warrior {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
        level: 1
        experience: 0
        experienceToLevel: 100
    }
    Health {
        current: 120
        max: 120
    }
    Mana {
        current: 30
        max: 30
    }
    Stats {
        strength: 16
        dexterity: 10
        intelligence: 8
        constitution: 14
        wisdom: 8
    }
    Combat {
        damage: 18
        defense: 10
        attackSpeed: 0.8
        critChance: 0.1
        critMultiplier: 1.5
    }
}
```

---

## 6. Component Setting

### 6.1 Field Types

| Type | Example |
|------|---------|
| String | `name: "Warrior"` |
| Integer | `level: 10` |
| Float | `speed: 1.5` |
| Boolean | `isBoss: true` |
| Null | `target: null` |

### 6.2 Optional Fields

If a component has optional fields defined in BRL, they can be omitted:

```bdl
entity @simple {
    Character {
        name: "Hero"
        class: "Fighter"
        // level, experience etc. use defaults from BRL
    }
}
```

---

## 7. Examples

### 7.1 Hero Definitions (heroes.bdl)

```bdl
// Hero character definitions for the RPG demo

entity @warrior {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
        level: 1
        experience: 0
        experienceToLevel: 100
    }
    Health {
        current: 120
        max: 120
    }
    Mana {
        current: 30
        max: 30
    }
    Stats {
        strength: 16
        dexterity: 10
        intelligence: 8
        constitution: 14
        wisdom: 8
    }
    Combat {
        damage: 18
        defense: 10
        attackSpeed: 0.8
        critChance: 0.1
        critMultiplier: 1.5
    }
    Team {
        id: "player"
        isPlayer: true
    }
    Skills {
        skill1: "power_strike"
        skill2: ""
        skill3: ""
        skill4: ""
        skillPoints: 0
    }
}

entity @mage {
    Character {
        name: "Elara Flamecaster"
        class: "Mage"
        level: 1
        experience: 0
        experienceToLevel: 100
    }
    Health {
        current: 70
        max: 70
    }
    Mana {
        current: 100
        max: 100
    }
    Stats {
        strength: 6
        dexterity: 12
        intelligence: 18
        constitution: 8
        wisdom: 14
    }
    Combat {
        damage: 25
        defense: 4
        attackSpeed: 0.6
        critChance: 0.1
        critMultiplier: 2.0
    }
    Team {
        id: "player"
        isPlayer: true
    }
    Skills {
        skill1: "fireball"
        skill2: ""
        skill3: ""
        skill4: ""
        skillPoints: 0
    }
}
```

### 7.2 Enemy Definitions (enemies.bdl)

```bdl
// Enemy templates for the RPG demo

entity @goblin_scout {
    Character {
        name: "Goblin Scout"
        class: "Monster"
        level: 1
    }
    Health {
        current: 60
        max: 60
    }
    Combat {
        damage: 8
        defense: 2
        attackSpeed: 1.0
    }
    Enemy {
        tier: 1
        isBoss: false
        expReward: 25
    }
    Team {
        id: "enemy"
        isPlayer: false
    }
}

entity @orc_raider {
    Character {
        name: "Orc Raider"
        class: "Monster"
        level: 2
    }
    Health {
        current: 90
        max: 90
    }
    Combat {
        damage: 12
        defense: 4
        attackSpeed: 0.8
    }
    Enemy {
        tier: 2
        isBoss: false
        expReward: 35
    }
    Team {
        id: "enemy"
        isPlayer: false
    }
}

entity @dragon_lord {
    Character {
        name: "Dragon Lord Vexar"
        class: "Boss"
        level: 10
    }
    Health {
        current: 500
        max: 500
    }
    Combat {
        damage: 40
        defense: 15
        attackSpeed: 0.8
        critChance: 0.2
        critMultiplier: 2.5
    }
    Enemy {
        tier: 6
        isBoss: true
        expReward: 500
    }
    Team {
        id: "enemy"
        isPlayer: false
    }
}
```

---

## 7. Bound Choice Functions

BDL supports **bound choice functions** - choice functions that are directly associated with an entity as first-class citizens. This enables each hero to have their own decision-making logic defined inline in the BDL file.

### 7.1 Syntax

Choice functions can be bound to entities using the following syntax:

```bdl
entity @hero_name {
    // ... component definitions ...
    
    // Bind a choice function to this entity
    chooseEnemy = choice (character: Character, enemies: list): id {
        // Function body (BCL subset only)
        for enemy in enemies {
            if enemy.Health.current < 50 {
                return enemy.id
            }
        }
        return enemies[0].id
    }
}
```

### 7.2 Rules for Bound Choice Functions

1. **Bound Only**: BDL can only declare **bound** choice functions (attached to an entity), not standalone/unbound choice functions
2. **BCL Subset**: The function body follows BCL rules - no state modification, only pure logic
3. **Assignment**: Choice functions can be copied from one entity to another: `a.chooseEnemy = b.chooseEnemy`
4. **Explicit Parameters**: The function must include all parameters it needs - no implicit `self`
5. **Required Binding**: If BRL code calls a choice function on an entity that doesn't have it bound, a runtime error is raised - there is no fallback mechanism

### 7.3 Complete Example

```bdl
entity @warrior {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
    }
    Health {
        current: 120
        max: 120
    }
    
    // Bind choice functions directly to the entity
    select_attack_target = choice (character: Character, enemies: list): id {
        return find_weakest(enemies)
    }
    
    select_combat_skill = choice (character: Character, allies: list, enemies: list): string {
        return "power_strike"
    }
}
```

### 7.4 Compilation

Bound choice functions compile to the IR with entity association. The functions are stored as first-class properties of the entity, not in a separate component:

```json
{
  "initial_state": {
    "entities": [
      {
        "id": "@warrior",
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
            "return_type": { "type": "entity" },
            "body": {
              "type": "call",
              "function": "find_weakest",
              "args": [{ "type": "param", "name": "enemies" }]
            },
            "source": "choice (character: Character, enemies: list): id {\n    return find_weakest(enemies)\n}"
          },
          "select_combat_skill": {
            "params": [
              { "name": "character", "type": "entity" },
              { "name": "allies", "type": "list" },
              { "name": "enemies", "type": "list" }
            ],
            "return_type": { "type": "string" },
            "body": {
              "type": "literal",
              "value": "power_strike"
            },
            "source": "choice (character: Character, allies: list, enemies: list): string {\n    return \"power_strike\"\n}"
          }
        }
      }
    ]
  }
}
```

---

## 8. Loading Order

BDL files are loaded **after** BRL and BCL files because they depend on component definitions from BRL.

### 8.1 Compilation Order

During compilation, files are processed in this order:

```
1. BRL files (component, rule, function, tracker definitions)
2. BCL files (player strategies and choice functions)
3. BDL files (entity data - requires component definitions)
```

This is the **compilation pipeline order**. The compiler validates BDL entity definitions against the components defined in BRL.

### 8.2 Runtime Loading

At runtime, the execution order depends on the target platform:
- **Native engines**: Load compiled IR containing all entities
- **Browser engines**: May load JSON representations of BDL data

Currently, JSON files serve as an intermediate runtime format until browser-based BDL parsing is implemented.

### 8.3 File Extensions

- `.bdl` - Blink Data Language files
- Located in `game/bdl/` directory

### 8.4 Compilation

BDL compiles to the `initial_state.entities` section of the IR:

```json
{
  "initial_state": {
    "entities": [
      {
        "id": "@warrior",
        "components": {
          "Character": { "name": "Sir Braveheart", ... },
          "Health": { "current": 120, "max": 120 },
          ...
        }
      }
    ]
  }
}
```

---

## Appendix A: BDL vs BRL vs BCL Quick Reference

| Feature | BRL | BCL | BDL |
|---------|-----|-----|-----|
| Component definitions | ✅ | ❌ | ❌ |
| Rule definitions | ✅ | ❌ | ❌ |
| Function definitions | ✅ | ✅ | ❌ |
| Tracker definitions | ✅ | ❌ | ❌ |
| Entity creation | ✅ | ❌ | ✅ |
| Component initialization | ✅ | ❌ | ✅ |
| Variable declarations | ✅ | ✅ | ❌ |
| Expressions | ✅ | ✅ | ❌ |
| Control flow | ✅ | ✅ | ❌ |
| Choice functions (unbound) | ❌ | ✅ | ❌ |
| Bound choice functions | ❌ | ❌ | ✅ |
| Party definition | ❌ | ✅ | ❌ |

---

## Appendix B: Error Messages

BDL provides clear error messages for disallowed constructs:

```
Error: Component definitions not allowed in BDL
  --> heroes.bdl:5:1
   |
 5 | component Custom {
   | ^^^^^^^^^
   |
   = help: Define components in a BRL file instead
   = help: BDL can only create entities with existing components
```

```
Error: Expressions not allowed in BDL
  --> enemies.bdl:12:17
   |
12 |         damage: 10 + 5
   |                    ^^^
   |
   = help: Use a literal value instead: damage: 15
   = help: BDL only accepts literal values for component fields
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-03 | Initial draft |
| 0.2.0 | 2026-01-04 | Added bound choice functions (section 7) as first-class entity properties |
