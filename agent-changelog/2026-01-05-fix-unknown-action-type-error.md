# Fix: "Unknown action type: conditional" Error

**Date**: 2026-01-05  
**Issue**: PR #70 mentioned "Unknown action type: conditional" warnings during execution  
**Root Cause**: Bundled JavaScript engine missing IR action handlers added in PR #67

## Problem Analysis

The TypeScript source (`packages/blink-engine/src/rules/Executor.ts`) had correct implementations for all IR action types, but the standalone browser bundle (`game/demos/blink-engine.bundle.js`) was not updated.

Missing action types:
- `conditional` - if/else execution
- `loop` - for-each loops
- `let` - local variable binding
- `while` - while loops

These action types are documented in **doc/ir-specification.md section 6.3** and are essential for BRL rules with control flow.

## Solution

### 1. Updated Execution Context
Added `locals` Map to context for local variable storage:
```javascript
const context = {
  store,
  timeline,
  event,
  bindings,
  params: new Map(),
  locals: new Map(),  // NEW
  functions: this.functions,
};
```

### 2. Added Action Handlers
Extended `executeAction()` switch statement:
```javascript
case 'conditional':
  this.executeConditional(action, context);
  break;
case 'loop':
  this.executeLoop(action, context);
  break;
case 'let':
  this.executeLet(action, context);
  break;
case 'while':
  this.executeWhile(action, context);
  break;
```

### 3. Implemented Handler Methods

#### executeLet()
Binds values to local variables:
```javascript
executeLet(action, context) {
  const value = this.evaluateExpression(action.value, context);
  context.locals.set(action.name, value);
}
```

#### executeConditional()
Executes if/else branches:
```javascript
executeConditional(action, context) {
  const condition = this.evaluateExpression(action.condition, context);
  if (condition) {
    for (const thenAction of action.then_actions) {
      this.executeAction(thenAction, context);
    }
  } else if (action.else_actions) {
    for (const elseAction of action.else_actions) {
      this.executeAction(elseAction, context);
    }
  }
}
```

#### executeLoop()
Iterates over arrays with validation:
```javascript
executeLoop(action, context) {
  const iterable = this.evaluateExpression(action.iterable, context);
  if (!Array.isArray(iterable)) {
    console.warn(`Loop iterable is not an array: ${typeof iterable}`);
    return;
  }

  for (const item of iterable) {
    const fieldValue = this.toFieldValue(item);
    if (fieldValue === null && item !== null) {
      console.warn(`Loop item could not be converted to valid field value: ${typeof item}`);
    }
    context.locals.set(action.variable, fieldValue);
    
    for (const bodyAction of action.body) {
      this.executeAction(bodyAction, context);
    }
  }
}
```

#### executeWhile()
Executes loops with iteration limit:
```javascript
executeWhile(action, context) {
  let iterations = 0;
  
  while (this.evaluateExpression(action.condition, context) && iterations < MAX_WHILE_ITERATIONS) {
    for (const bodyAction of action.body) {
      this.executeAction(bodyAction, context);
    }
    iterations++;
  }
  
  if (iterations >= MAX_WHILE_ITERATIONS) {
    console.warn(`While loop exceeded maximum iterations (${MAX_WHILE_ITERATIONS}), stopping`);
  }
}
```

### 4. Added Helper Methods

#### toFieldValue()
Type validation for runtime values:
```javascript
toFieldValue(value) {
  if (value === null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  return null;
}
```

#### MAX_WHILE_ITERATIONS constant
Added at top level for maintainability:
```javascript
const MAX_WHILE_ITERATIONS = 10000;
```

### 5. Updated Variable Resolution
Changed 'var' expression evaluation to check locals first:
```javascript
case 'var': {
  // Check locals first (let bindings), then entity bindings
  if (context.locals.has(expr.name)) {
    return context.locals.get(expr.name);
  }
  const entityId = context.bindings.get(expr.name);
  return entityId !== undefined ? entityId : null;
}
```

## Testing

### All Pre-submission Checks Pass ✅
- Compiler builds successfully
- BRL files compile to IR correctly
- Demo package builds successfully
- All 32 language compilation tests pass
- Code review completed and feedback addressed
- Security scan passed (0 vulnerabilities)

### Files Modified
- `game/demos/blink-engine.bundle.js` - Added 85 lines (4 handlers + helpers)
- `game/ir/classic-rpg.ir.json` - Regenerated during build

## Code Review Feedback Addressed

1. ✅ Moved MAX_WHILE_ITERATIONS to top-level constant for better maintainability
2. ✅ Added warning when loop items cannot be converted to valid field values

## Impact

The engine now fully supports all IR action types as documented in the specification. This enables:
- Complex control flow in BRL rules
- Local variable scoping with `let` statements
- Conditional logic with `if/else`
- Iteration with `for` and `while` loops
- Proper variable resolution priority: locals → bindings → params

## References

- IR Specification: `doc/ir-specification.md` section 6.3
- TypeScript Implementation: `packages/blink-engine/src/rules/Executor.ts`
- PR #67: Added these action types to TypeScript source
- PR #70: Reported the "Unknown action type: conditional" error
