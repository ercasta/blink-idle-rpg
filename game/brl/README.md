# BRL Examples

Example Blink Rule Language (BRL) source files demonstrating language features.

## Files

| File | Description | Features Demonstrated |
|------|-------------|----------------------|
| `simple-clicker.brl` | Minimal clicker game | Components, rules |
| `simple-combat.brl` | Basic combat system | Functions, conditions, scheduling |
| `classic-rpg.brl` | Classic RPG with classes and skills | Multiple components, complex rules, game state |

## Compiling Examples

Once the compiler is built:

```bash
# Compile to IR
blink-compiler compile -i simple-clicker.brl -o simple-clicker.ir.json --pretty

# Check for errors
blink-compiler check -i simple-combat.brl
```

## Language Reference

See the [BRL Specification](../doc/language/brl-specification.md) for complete language documentation.
