# BCL Resolution Rules Implementation

**Date**: 2026-01-04  
**Type**: Feature Implementation

## Summary

Implementing the BCL resolution rules as specified in `doc/architecture/bcl resolution rules.md`. This change makes choice functions first-class citizens in BRL/BDL, allows binding choice functions directly to entities (not via a ChoiceBindings component), and adds engine support for resolving and calling bound choice functions.

## Key Design Decisions

Based on feedback, the implementation follows these principles:
1. **Roster is NOT a language construct** - It's a regular BRL-defined component like any other
2. **Bound functions are first-class entity properties** - No ChoiceBindings component needed; functions bind directly to entities
3. **No fallback mechanism** - If a function is not bound to an entity, a runtime error is raised

## Requirements (from bcl resolution rules.md)

1. Modify BRL/BDL to make choice functions first-class citizens
2. Allow associating choice functions to entities (including anonymous declarations)
3. Pre-made heroes have their choice functions declared and bound in BDL
4. Pre-made heroes stored in a `Roster` component (defined in BRL like any other component)
5. HTML engine exposes interface to get entities and components
6. HTML engine exposes method to compile and execute BRL code
7. HTML UI creates game entity, loads heroes from BDL, creates Roster component
8. HTML interface BCL editing UI gets choice functions from hero entities via utility function
9. BRL calls choice functions on entities (invoking bound function)

## Changes

### Language Specification Changes

#### doc/language/bdl-specification.md
- Added section 7: Bound Choice Functions as first-class entity properties
- Functions bind directly to entities, not via a component
- Required binding: if function not found, error is raised (no fallback)

#### doc/language/brl-specification.md
- Added section 13.7: Entity-Bound Choice Functions
- Syntax for calling choice functions on entities: `entity.choiceFunction(...)`
- Strict resolution: error if function not bound (no fallback to class/global defaults)

### IR Specification Changes

#### doc/ir-specification.md
- Added section 11.4: Initial State with `bound_functions` stored directly on entities
- Removed ChoiceBindings component (not a language construct)
- Removed Roster from IR spec (it's a regular BRL-defined component)

### Engine Implementation Changes

#### packages/blink-engine/src/ir/types.ts
- Added `IRBoundFunctions` interface - map of function names to definitions
- Added `IRBoundFunction` interface - function definition with params, body, source
- Extended `IREntityDefinition` with `bound_functions` field
- Removed `IRChoiceBindings`, `IRRoster`, `IRBoundChoiceFunction` (simplified approach)

#### packages/blink-engine/src/BlinkGame.ts
- Added `getBoundFunctions()` - get all bound functions for an entity
- Added `getBoundFunction()` - get a specific bound function
- Added `getBoundFunctionSource()` - get source for UI display
- Added `getBoundFunctionNames()` - list all bound function names
- Removed `getRoster()`, `getChoiceBindings()` methods (not needed with new approach)

## Hielements Impact

No changes to hielements.hie required. Documentation fits under existing scopes.

## Related Documents

- `doc/architecture/bcl resolution rules.md` - Original requirements
- `doc/architecture/bcl-function-resolution.md` - Detailed architecture
- `doc/language/bcl-specification.md` - BCL language spec
- `doc/ir-specification.md` - IR format specification
