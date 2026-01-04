# BCL Resolution Rules Implementation

**Date**: 2026-01-04  
**Type**: Feature Implementation

## Summary

Implementing the BCL resolution rules as specified in `doc/architecture/bcl resolution rules.md`. This change makes choice functions first-class citizens in BRL/BDL, allows binding choice functions to entities, and adds engine support for resolving and calling bound choice functions.

## Requirements (from bcl resolution rules.md)

1. Modify BRL/BDL to make choice functions first-class citizens
2. Allow associating choice functions to entities (including anonymous declarations)
3. Pre-made heroes have their choice functions declared and bound in BDL
4. Pre-made heroes stored in a `Roster` component on the game entity
5. HTML engine exposes interface to get entities and components
6. HTML engine exposes method to compile and execute BRL code
7. HTML UI creates game entity, loads heroes from BDL, creates Roster component
8. HTML interface BCL editing UI gets choice functions from hero entities via utility function
9. BRL calls choice functions on entities (invoking bound function)

## Changes

### hielements.hie Changes

None required - existing architecture documentation scope covers the new architectural documents.

### Language Specification Changes

#### doc/language/bdl-specification.md
- Added section 7.5: Bound Choice Functions in BDL
- Allows anonymous choice function declarations bound to entities
- Allows copying choice functions between entities

#### doc/language/brl-specification.md
- Added section 13.7: Entity-Bound Choice Functions
- Choice functions can be bound to entities at runtime
- Syntax for calling choice functions on entities: `entity.choiceFunction(...)`

### IR Specification Changes

#### doc/ir-specification.md
- Added `Roster` component definition in initial_state section
- Added `ChoiceBindings` component for tracking bound choice functions per entity
- Added `bound_choice_functions` field in initial_state for anonymous choice functions from BDL

### Engine Implementation Changes

#### packages/blink-engine/src/ir/types.ts
- Added `IRChoiceBinding` interface for entity choice function bindings
- Added `IRBoundChoiceFunction` interface for anonymous choice function definitions
- Added `IRRoster` interface for game Roster component
- Extended `IRInitialState` with `roster` and `bound_choice_functions` fields
- Extended `IREntityDefinition` with optional `choice_bindings` field

#### packages/blink-engine/src/BlinkGame.ts
- Added `getEntities()` method to get all entities
- Added `getEntitiesWithComponent()` method to query entities by component
- Added `getEntityData()` method to get full entity data including components
- Added `getRoster()` method to get game Roster component
- Added `getChoiceBindings()` method to get entity's choice function bindings
- Added `getChoiceFunctionSource()` method to get BCL source for bound choice functions
- Added `compileAndExecuteBRL()` stub method for future BRL compilation support

### BDL Data Changes

#### game/bdl/heroes.bdl
- Added `ChoiceBindings` component to hero entities
- Added anonymous choice function definitions bound to each hero
- References hero-specific BCL strategy files

## Hielements Impact

No changes to hielements.hie required. The new documentation fits under existing scopes:
- `architecture_docs` scope covers `doc/architecture/`
- Language specs are covered by existing checks

## Testing

- Engine tests verify new interfaces work correctly
- Existing tests remain passing

## Related Documents

- `doc/architecture/bcl resolution rules.md` - Original requirements
- `doc/architecture/bcl-function-resolution.md` - Detailed architecture
- `doc/language/bcl-specification.md` - BCL language spec
- `doc/ir-specification.md` - IR format specification
