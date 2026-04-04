# BRL Source Files

Blink Rule Language (BRL) source files for the game. BRL is used for both game rules and game data (entities).

## Files

| File | Description |
|------|-------------|
| `classic-rpg.brl` | Classic RPG game rules: components, rules, functions |
| `heroes.brl` | Hero entity definitions and initial state |
| `enemies.brl` | Enemy entity definitions |
| `game-config.brl` | Game configuration entities |
| `scenario-easy.brl` | Easy difficulty scenario entities |
| `scenario-normal.brl` | Normal difficulty scenario entities |
| `scenario-hard.brl` | Hard difficulty scenario entities |

## Compiling

Once the compiler is built:

```bash
# Compile to IR
blink-compiler compile -i classic-rpg.brl -o classic-rpg.ir.json --pretty
```

## Language Reference

See the [BRL Specification](../../doc/language/brl-specification.md) for complete language documentation.
