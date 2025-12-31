# Example IR Files

This directory contains example Intermediate Representation (IR) files that can be used for:

1. **Engine Development**: Test your engine implementation against known-good IR
2. **Learning**: Understand the IR format by examining real examples
3. **Integration Testing**: Verify engines produce consistent results

## Files

| File | Description | Complexity |
|------|-------------|------------|
| `simple-clicker.ir.json` | Minimal clicker game | Beginner |
| `simple-combat.ir.json` | Basic combat with attacks and health | Intermediate |

## Usage

### For Engine Developers

Load these IR files in your engine to test core functionality:

```typescript
// JavaScript Engine
const ir = await fetch('./examples/ir/simple-clicker.ir.json').then(r => r.json());
const engine = new BlinkEngine();
engine.loadIR(ir);
engine.start();
```

```rust
// Rust Engine
let ir_json = include_str!("../../examples/ir/simple-clicker.ir.json");
let ir: IRModule = serde_json::from_str(ir_json)?;
let mut engine = BlinkEngine::new();
engine.load_ir(ir)?;
engine.run();
```

### Expected Behavior

#### simple-clicker.ir.json

1. Initial state: one entity with `Clicks { count: 0 }`
2. When `Click` event fires, the count increases by 1
3. Tracker outputs `Clicks` component data after each click

#### simple-combat.ir.json

1. Initial state: Hero (100 HP, 15 damage) vs Goblin (50 HP, 8 damage)
2. `DoAttack` events trigger damage calculations
3. When health <= 0, `Death` event is emitted
4. Trackers capture Health and Character data on attacks

## IR Format

See [IR Specification](../doc/ir-specification.md) for the complete format documentation.

## Validation

Engine implementations should produce identical tracker output for the same IR input (given the same random seed). This ensures cross-engine consistency.
