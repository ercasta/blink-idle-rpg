# Comprehensive Analysis: Let Keyword and Scope Management Implementation

**Date**: 2026-01-05  
**Related PR**: #65 (Entity Cloning Feature)  
**Issue**: IR doesn't preserve `let` statement variable bindings

## Executive Summary

This document provides a comprehensive analysis of the current BRL language implementation, identifying gaps in variable binding and scope management. The core issue is that **`let` statements are completely dropped during IR generation**, making local variables unavailable at runtime.

## 1. Current Implementation State

### 1.1 Compiler Pipeline

```
BRL Source → Lexer → Parser → Analyzer → IR Generator → IR JSON → Engine
```

| Stage | File | Status |
|-------|------|--------|
| Lexer | `src/compiler/src/lexer/mod.rs` | ✅ Complete |
| Parser | `src/compiler/src/parser/mod.rs` | ✅ Complete |
| Analyzer | `src/compiler/src/analyzer/mod.rs` | ⚠️ Partial |
| IR Generator | `src/compiler/src/ir/mod.rs` | ❌ Missing let support |
| Engine Executor | `packages/blink-engine/src/rules/Executor.ts` | ⚠️ Limited |

### 1.2 Let Statement Flow

#### Parser (Working ✅)
```rust
// src/compiler/src/parser/mod.rs:1032-1060
fn parse_let_statement(&mut self) -> Result<Statement, ParseError> {
    let name = ...;
    let type_annotation = ...;
    let value = self.parse_expression()?;
    Ok(Statement::Let(LetStatement { name, type_annotation, value, span }))
}
```

#### Analyzer (Working ✅)
```rust
// src/compiler/src/analyzer/mod.rs:433-448
TypedStatement::Let {
    name: let_stmt.name.clone(),
    var_type,
    value,
}
// Correctly adds variable to scope: scope.define(let_stmt.name.clone(), var_type.clone());
```

#### IR Generator (BROKEN ❌)
```rust
// src/compiler/src/ir/mod.rs:620-687
fn generate_statement_action(&self, stmt: &TypedStatement) -> Option<IRAction> {
    match stmt {
        TypedStatement::Assignment { ... } => Some(IRAction::Modify { ... }),
        TypedStatement::If { ... } => Some(IRAction::Conditional { ... }),
        TypedStatement::For { ... } => Some(IRAction::Loop { ... }),
        TypedStatement::Schedule { ... } => Some(IRAction::Schedule { ... }),
        TypedStatement::Create { ... } => Some(IRAction::Spawn { ... }),
        TypedStatement::Delete { ... } => Some(IRAction::Despawn { ... }),
        _ => None,  // <-- LET STATEMENTS ARE DROPPED HERE!
    }
}
```

**Root Cause**: The `_ => None` catch-all in `generate_statement_action` silently drops:
- `TypedStatement::Let` - Variable declarations
- `TypedStatement::While` - While loops  
- `TypedStatement::Return` - Return statements
- `TypedStatement::Cancel` - Cancel statements
- `TypedStatement::Expr` - Expression statements

### 1.3 Engine Executor (Limited)

The engine has `bindings` for trigger-bound variables but no mechanism for rule-local variables:

```typescript
// packages/blink-engine/src/rules/Executor.ts:24-28
export interface ExecutionContext {
  store: Store;
  timeline: Timeline;
  event: ScheduledEvent;
  bindings: Map<string, EntityId>;  // Only for event bindings!
  params: Map<string, IRFieldValue>;  // Only for function params!
  functions: Map<string, IRFunction>;
}
```

## 2. Gap Analysis

### 2.1 Missing IR Action Types

The IR specification (`doc/ir-specification.md`) defines action types:
- ✅ `modify` - Modify component field
- ✅ `schedule` - Schedule event  
- ✅ `emit` - Emit immediate event
- ✅ `spawn` - Create entity
- ✅ `despawn` - Remove entity
- ❌ **`let` / `bind`** - Variable binding (MISSING)
- ❌ **`while`** - While loop (MISSING in IR, but `loop` exists for for-loops)

### 2.2 Missing IR Expression Types

The IR has expression types but lacks:
- ❌ **Block expressions** - For scoped variable bindings
- ❌ **Sequence expressions** - For ordered evaluation with variable capture

### 2.3 Symbol Table Gaps

| Feature | Analyzer | IR Generator | Engine |
|---------|----------|--------------|--------|
| Component symbols | ✅ | ✅ | ✅ |
| Function symbols | ✅ | ✅ | ✅ |
| Rule parameters | ✅ | ✅ (trigger bindings) | ✅ |
| Local variables | ✅ | ❌ | ❌ |
| Nested scopes | ✅ | ❌ | ❌ |
| For-loop variables | ✅ | ⚠️ (in Loop action) | ⚠️ |

### 2.4 Scope Management Issues

The analyzer correctly tracks scopes:
```rust
// src/compiler/src/analyzer/mod.rs:141-172
struct Scope {
    variables: HashMap<String, Type>,
    parent: Option<Box<Scope>>,
}

impl Scope {
    fn with_parent(parent: Scope) -> Self { ... }
    fn define(&mut self, name: String, typ: Type) { ... }
    fn lookup(&self, name: &str) -> Option<&Type> { ... }
}
```

But this scope information is **lost** when generating IR because:
1. No IR representation for variable bindings
2. No runtime context for local variables in the engine

## 3. Potential Duplicates

### 3.1 Expression Evaluation Paths

There are two paths for evaluating expressions in the engine:
1. `evaluateExpression()` - General expression evaluation
2. `evaluateEntityExpression()` - Entity-specific evaluation

Both handle `var` expressions but only look in `bindings` (trigger variables), not local variables.

### 3.2 Scope Definition

Scope is defined/used in multiple places:
1. `analyzer/mod.rs:Scope` - Compile-time scope tracking
2. `Executor.ts:ExecutionContext.bindings` - Runtime trigger bindings
3. `Executor.ts:ExecutionContext.params` - Function parameters

These should be unified into a single variable resolution system.

## 4. Detailed Proposal

### Phase 1: IR Schema Extension

Add a new action type to the IR specification:

```json
{
  "type": "let",
  "name": "varName",
  "value": { "type": "literal", "value": 42 }
}
```

Update `doc/ir-specification.md`:
```markdown
### 6.3 Action Types

| Type | Description |
|------|-------------|
| `let` | Bind a value to a local variable |
| `modify` | Modify component field |
| ... |

#### Let Action
```json
{
  "type": "let",
  "name": "damage",
  "value": {
    "type": "binary",
    "op": "multiply",
    "left": { "type": "field", "entity": "attacker", "component": "Combat", "field": "damage" },
    "right": { "type": "literal", "value": 1.5 }
  }
}
```
```

### Phase 2: Compiler IR Generation

Update `src/compiler/src/ir/mod.rs`:

```rust
// Add new IRAction variant
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum IRAction {
    // ... existing variants ...
    
    /// Bind a value to a local variable
    #[serde(rename = "let")]
    Let {
        name: String,
        value: IRExpression,
    },
    
    /// While loop
    #[serde(rename = "while")]
    While {
        condition: IRExpression,
        body: Vec<IRAction>,
    },
}

// Update generate_statement_action
fn generate_statement_action(&self, stmt: &TypedStatement) -> Option<IRAction> {
    match stmt {
        TypedStatement::Let { name, value, .. } => {
            Some(IRAction::Let {
                name: name.clone(),
                value: self.generate_expression(value),
            })
        }
        TypedStatement::While { condition, body } => {
            Some(IRAction::While {
                condition: self.generate_expression(condition),
                body: self.generate_block_actions(body),
            })
        }
        // ... existing cases ...
    }
}
```

### Phase 3: Engine Execution Context

Update `packages/blink-engine/src/rules/Executor.ts`:

```typescript
export interface ExecutionContext {
  store: Store;
  timeline: Timeline;
  event: ScheduledEvent;
  bindings: Map<string, EntityId>;
  params: Map<string, IRFieldValue>;
  functions: Map<string, IRFunction>;
  locals: Map<string, IRFieldValue>;  // NEW: Local variables
}

// Update executeAction
private executeAction(action: IRAction, context: ExecutionContext): void {
  switch (action.type) {
    case 'let':
      this.executeLet(action, context);
      break;
    case 'while':
      this.executeWhile(action, context);
      break;
    // ... existing cases ...
  }
}

private executeLet(action: IRLetAction, context: ExecutionContext): void {
  const value = this.evaluateExpression(action.value, context);
  context.locals.set(action.name, value);
}

private executeWhile(action: IRWhileAction, context: ExecutionContext): void {
  while (this.evaluateExpression(action.condition, context)) {
    for (const bodyAction of action.body) {
      this.executeAction(bodyAction, context);
    }
  }
}

// Update evaluateExpression to check locals
evaluateExpression(expr: IRExpression, context: ExecutionContext): IRFieldValue {
  switch (expr.type) {
    case 'var': {
      // Check locals first, then bindings
      if (context.locals.has(expr.name)) {
        return context.locals.get(expr.name)!;
      }
      const entityId = context.bindings.get(expr.name);
      return entityId !== undefined ? entityId : null;
    }
    // ... rest unchanged ...
  }
}
```

### Phase 4: Scope Chain for Nested Blocks

For proper nested scope handling:

```typescript
interface ScopeChain {
  current: Map<string, IRFieldValue>;
  parent?: ScopeChain;
}

function lookupVariable(name: string, scope: ScopeChain): IRFieldValue | undefined {
  if (scope.current.has(name)) {
    return scope.current.get(name);
  }
  if (scope.parent) {
    return lookupVariable(name, scope.parent);
  }
  return undefined;
}

function enterScope(parent: ScopeChain): ScopeChain {
  return { current: new Map(), parent };
}
```

### Phase 5: TypeScript IR Type Updates

Update `packages/blink-engine/src/ir/types.ts`:

```typescript
export type IRAction = 
  | IRModifyAction 
  | IRScheduleAction 
  | IREmitAction 
  | IRSpawnAction 
  | IRDespawnAction
  | IRLetAction      // NEW
  | IRWhileAction;   // NEW

export interface IRLetAction {
  type: 'let';
  name: string;
  value: IRExpression;
  source_location?: SourceLocation;
}

export interface IRWhileAction {
  type: 'while';
  condition: IRExpression;
  body: IRAction[];
  source_location?: SourceLocation;
}
```

## 5. Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | `let` action in IR | Low | Critical |
| P0 | `let` action execution | Low | Critical |
| P0 | Variable lookup in expressions | Low | Critical |
| P1 | `while` loop support | Medium | High |
| P1 | Nested scope chain | Medium | High |
| P2 | Expression statements | Low | Medium |
| P2 | `cancel` statement | Low | Medium |
| P3 | Return from rules (early exit) | Medium | Low |

## 6. Testing Strategy

### 6.1 New Language Tests

```rust
#[test]
fn test_let_statement_ir_generation() {
    let source = r#"
        rule test on TestEvent {
            let x = 10
            let y = x + 5
            entity.Health.current = y
        }
    "#;
    
    let ir = compile(source, &CompilerOptions::default()).unwrap();
    let rule = &ir.rules[0];
    
    // Should have 3 actions: let, let, modify
    assert_eq!(rule.actions.len(), 3);
    assert!(matches!(rule.actions[0], IRAction::Let { .. }));
}

#[test]
fn test_let_with_complex_expression() {
    let source = r#"
        component Health { current: integer max: integer }
        rule test on TestEvent {
            let templates = entities having Health
            let first = templates[0]
        }
    "#;
    
    let ir = compile(source, &CompilerOptions::default()).unwrap();
    // Verify clone expression is preserved in let value
}
```

### 6.2 Engine Integration Tests

```typescript
describe('let statement execution', () => {
  it('should bind simple literals', async () => {
    const ir = {
      rules: [{
        trigger: { type: 'event', event: 'Test' },
        actions: [
          { type: 'let', name: 'x', value: { type: 'literal', value: 10 } },
          { type: 'modify', entity: { type: 'var', name: 'entity' }, 
            component: 'Health', field: 'current', 
            op: 'set', value: { type: 'var', name: 'x' } }
        ]
      }]
    };
    // Test that x is accessible in subsequent actions
  });
});
```

## 7. Migration Notes

### 7.1 Backward Compatibility

- Existing IR without `let` actions will continue to work
- Engine should gracefully handle unknown action types (log warning)

### 7.2 Documentation Updates

- Update `doc/ir-specification.md` with `let` and `while` actions
- Update `doc/language/brl-specification.md` with runtime semantics
- Add examples showing variable usage patterns

## 8. Related Future Work

1. **Mutable Variables**: Currently all `let` bindings are immutable. Consider `let mut x = 10` for reassignable variables.

2. **Variable Shadowing**: Define semantics for re-declaring variables in nested scopes.

3. **Type Annotations in IR**: Consider preserving type information in IR for better error messages.

4. **Debug Symbols**: Use variable names for debugging/tracing.

## 9. Conclusion

The `let` statement implementation gap is a critical issue that blocks complex game logic. The proposed solution is relatively straightforward:

1. Add `let` action type to IR
2. Generate IR for `let` statements  
3. Add `locals` map to execution context
4. Update variable resolution to check locals

This can be implemented incrementally, with P0 features completing the basic functionality and subsequent phases adding refinements.

## Appendix: Code References

| Component | File | Key Lines |
|-----------|------|-----------|
| Let parsing | `parser/mod.rs` | 1032-1060 |
| Let analysis | `analyzer/mod.rs` | 433-448 |
| IR generation (bug) | `ir/mod.rs` | 620-687 |
| Engine execution | `rules/Executor.ts` | 204-420 |
| IR types (TS) | `ir/types.ts` | 112-152 |
| IR types (Rust) | `ir/mod.rs` | 270-347 |
