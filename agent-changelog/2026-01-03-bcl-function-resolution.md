# BCL Function Resolution Architecture Document

**Date**: 2026-01-03  
**Type**: Documentation

## Summary

Created comprehensive architectural documentation for BCL function resolution, expanding on the initial notes in `bcl resolution rules.md`.

## Changes

### New Files

- `doc/architecture/bcl-function-resolution.md` - Complete architectural document covering:
  - Problem statement: how the engine resolves which BCL function to call for specific entities
  - Current implementation status (noting that resolution is NOT currently implemented)
  - Resolution hierarchy (entity override → instance customization → template → class default → global)
  - Four binding strategy options with pros/cons analysis
  - Recommended hybrid approach (file-based organization + class defaults + entity overrides)
  - Resolution algorithm in TypeScript pseudocode
  - IR representation with `ChoiceFunctionDef` and `ChoicePointMeta` interfaces
  - Implementation roadmap (4 phases from foundation to advanced features)
  - Complete flow examples showing real-world usage

## Current State Analysis

The document identifies that BCL resolution is **NOT currently implemented**:

1. BCL files exist but are stored as text only
2. The demo uses hardcoded JavaScript functions that simulate BCL behavior
3. Player customizations in the browser are cosmetic (not compiled/executed)
4. No `call_choice` mechanism exists in the engine to invoke BCL functions

## Recommended Architecture

The document recommends a **hybrid approach**:

1. **File-based organization** for clarity and sharing
2. **Class-based defaults** as primary binding mechanism
3. **Entity-specific overrides** via naming convention
4. **Explicit `self` parameter** in all choice functions

Resolution order:
1. Entity-specific override (custom BCL for entity ID)
2. Entity's explicit `ChoiceBindings` component
3. Class default (from `{class}-skills.bcl`)
4. Global default (from BRL declaration)

## Hielements Impact

No changes to hielements.hie required - the new document fits under the existing `architecture_docs` element scope.

## Related Documents

- `doc/architecture/bcl resolution rules.md` - Original notes
- `doc/language/bcl-specification.md` - BCL language spec
- `doc/engine/architecture.md` - Engine architecture with BCL integration points
