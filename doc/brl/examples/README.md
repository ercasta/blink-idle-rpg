# Blink Example: Basic Combat

This folder contains example BRL code demonstrating basic combat mechanics.

## Files

| File | Description |
|------|-------------|
| `combat-components.brl` | Component definitions for combat |
| `combat-rules.brl` | Combat rules |

## Running This Example

```bash
# Compile rules
npx @blink/compiler-ts compile combat-components.brl combat-rules.brl -o combat.ir

# Run simulation (native or wasm runner)
node tools/simulate.js --data combat.ir
```
