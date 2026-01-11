# BRL/BDL Language Changes - January 11, 2026

## Summary

Major language syntax changes to enforce single standardized patterns and mandatory type declarations for early error detection.

## Key Changes

### 1. Mandatory Variable Declarations with Types

**Old (Multiple Options):**
```brl
let x = 10              // type inference
let name = "warrior"    // type inference
name = "hero"           // assignment without declaration
```

**New (Single Mandatory Pattern):**
```brl
let x: integer = 10
let name: string = "warrior"
let target: id = @player1
let enemies: list = entities having Enemy
```

**Rationale:** Mandatory type annotations catch errors at compile time and improve code clarity.

### 2. Standardized Entity Creation Syntax

**Old (Multiple Options):**
```bdl
entity { ... }                    // Anonymous
entity @name { ... }              // Legacy named
name = new entity { ... }         // Variable assignment
```

**New (Single Mandatory Pattern):**
```bdl
let entityName: id = new entity {
    Component {
        field: value
    }
}
```

**Empty Entity:**
```brl
let hero: id = new entity
```

**Rationale:** Single syntax reduces confusion, enforces consistency, and makes entity variables explicit.

### 3. Rule Event Parameters with Types

**Old:**
```brl
rule MyRule on EventType evt {
    let data = evt.field
}
```

**New:**
```brl
rule MyRule on EventType(evt: id) {
    let data: integer = evt.EventComponent.field
}
```

**Event Cancellation (New Feature):**
```brl
rule InterceptDamage on DamageTaken(dmg: id) {
    if dmg.DamageEvent.amount > 100 {
        cancel dmg
        return
    }
}
```

### 4. Event Scheduling Returns ID

**New:** All `schedule` operations return an event ID:
```brl
let evtId: id = schedule DamageEvent {
    source: attacker
    target: defender
    amount: 50
}

let delayedEvt: id = schedule [delay: 2.5] PoisonTick {
    target: entity
}

let recurringEvt: id = schedule recurring [interval: 1.0] Regeneration {
    target: entity
}

// Can cancel scheduled events
cancel recurringEvt
```

### 5. List Type Documentation

**Added to Base Types:**
- `list` - shorthand for `list<id>` (list of entities)
- `list<T>` - list of any type (integer, string, id, etc.)

**Examples:**
```brl
let enemies: list = entities having Enemy
let numbers: list<integer> = [1, 2, 3, 4, 5]
let names: list<string> = ["Alice", "Bob"]
```

### 6. Updated Keywords

**Added:**
- `let` - variable declaration
- `new` - entity creation

**Still Reserved:**
- `component`, `rule`, `on`, `trigger`, `event`
- `entity`, `if`, `else`, `for`, `while`
- `fn`, `return`, `true`, `false`, `null`
- `schedule`, `cancel`, `recurring`, `module`, `import`
- `when`, `create`, `delete`, `has`
- `choice`

## Breaking Changes

### For BRL Files

1. All variable declarations must use `let` with explicit type
2. All rules must declare event parameter with type: `on EventType(evt: id)`
3. Component field access through event uses component name: `evt.ComponentName.field`

### For BDL Files

1. All entity definitions must use: `let name: id = new entity { ... }`
2. Cannot use anonymous `entity { ... }` syntax
3. Cannot use `entity @name { ... }` legacy syntax
4. Bound choice functions remain: `.functionName = choice(...) { ... }`

### For BCL Files

1. All variable declarations must use `let` with explicit type
2. Function parameters must have explicit types
3. Return types must be explicit

## Migration Required

### BRL Files to Update:
- `game/brl/classic-rpg.brl` - Add types to all `let` declarations, update rule signatures

### BDL Files to Update:
- `game/bdl/heroes.bdl` - Convert `entity { ... }` to `let name: id = new entity { ... }`
- `game/bdl/enemies.bdl` - Convert entity definitions
- `game/bdl/game-config.bdl` - Convert entity definitions
- All scenario files (`scenario-*.bdl`)

### BCL Files to Update:
- `game/bcl/*.bcl` - Add types to all `let` declarations

### Test Files to Update:
- `game/tests/brl/*.brl` - Update syntax
- Integration tests that parse BRL/BDL

## Compiler Changes Needed

The TypeScript compiler at `packages/blink-compiler-ts/src/parser.ts` needs:

1. **Enforce `let` keyword** - reject variable assignments without `let`
2. **Enforce type annotations** - require explicit types on all `let` declarations
3. **Remove deprecated entity syntaxes** - only accept `let x: id = new entity { ... }`
4. **Update rule parsing** - require typed event parameter `on EventType(evt: id)`
5. **Support `cancel` statement** - new statement type for cancelling events
6. **Return event IDs from schedule** - type system recognizes schedule returns `id`

## Documentation Updated

- ✅ `doc/language/brl-specification.md` - Updated with all new syntax requirements
- ✅ `doc/language/bdl-specification.md` - Updated with single entity syntax
- ⏳ `doc/language/bcl-specification.md` - Needs updating (if exists)
- ⏳ Examples and tutorials - Need updating

## Testing Requirements

Before merging:
1. Update all BRL/BDL/BCL files to new syntax
2. Update compiler to enforce new rules
3. Run full test suite: `cd packages/blink-compiler-ts && npm test`
4. Build packages: `make build-packages`
5. Compile BRL: `make compile-brl`
6. Run game tests: `cd game/tests && npm test`
7. Test demo package: `make demo-package`

## Benefits

1. **Early Error Detection** - Type errors caught at compile time
2. **Consistency** - Single way to do each thing reduces confusion
3. **Better Tooling** - Explicit types enable better IDE support
4. **Maintainability** - Clearer code, easier to understand
5. **Event Control** - Can cancel events for better game logic flow

## Backward Compatibility

**NONE** - This is a breaking change. All existing BRL/BDL/BCL files must be updated to the new syntax.

The decision was made to prioritize language simplicity and consistency over backward compatibility.
