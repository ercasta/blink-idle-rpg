# BDL (Blink Data Language) Files

This folder contains Blink Data Language (BDL) files that define game data.

## What is BDL?

BDL is a subset of BRL dedicated to **content creators**. It allows only:
- Creating entities
- Setting component values

BDL is designed to be simple and safe - it cannot define behavior, only data.

## Files

| File | Description |
|------|-------------|
| `heroes.bdl` | Player character definitions with stats, skills, and abilities |
| `enemies.bdl` | Enemy templates including regular monsters and bosses |
| `game-config.bdl` | Game configuration data like spawn settings |

## Usage

BDL files are loaded **after** BRL files because they depend on component definitions from BRL.

Loading order:
1. `game/brl/*.brl` - Component definitions and rules
2. `game/bcl/*.bcl` - Player strategies (optional)
3. `game/bdl/*.bdl` - Entity data

## Syntax Overview

```bdl
// Define a hero character
entity @warrior {
    Character {
        name: "Sir Braveheart"
        class: "Warrior"
        level: 1
    }
    Health {
        current: 120
        max: 120
    }
    // ... more components
}
```

## See Also

- [BDL Specification](../../doc/language/bdl-specification.md) - Full language documentation
- [BRL Specification](../../doc/language/brl-specification.md) - Game logic language
- [BCL Specification](../../doc/language/bcl-specification.md) - Player choice language
