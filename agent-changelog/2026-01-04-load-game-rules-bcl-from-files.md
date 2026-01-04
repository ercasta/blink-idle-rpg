# Load Game Rules and BCL from Files

**Date**: 2026-01-04  
**Type**: Feature Implementation

## Summary

Implementing the loading of game rules (BRL), player strategies (BCL), and game data (BDL) from files as specified in `doc/architecture/bcl resolution rules.md`. This change makes the game actually use the files in game/brl, game/bcl, and game/bdl directories instead of hardcoded logic.

## Problem Statement

Currently:
- IR (game/ir/classic-rpg.ir.json) contains compiled BRL rules and BDL data
- BCL files exist in game/bcl/ but are not loaded or used at runtime
- The HTML demo has hardcoded JavaScript logic instead of using BCL
- Dev mode shows placeholder source instead of actual BCL files

## Goals

Per the "bcl resolution rules.md" document:
1. Load BCL files from game/bcl/ directory
2. Make BCL available to the BCL customization UI
3. Load BRL/BDL source from IR.source_map for dev mode
4. Create architecture for future BCL resolution (when compiler supports it)

## Implementation Approach

Since browser-based BRL compilation is not yet implemented (compileAndExecuteBRL is a stub), we'll:

### Phase 1: Load and Display BCL Files
- [x] IR already loads BRL/BDL from source_map for dev mode
- [ ] Load BCL files from game/bcl/ directory
- [ ] Display BCL in BCL editor UI
- [ ] Allow customization of BCL (stored in localStorage)

### Phase 2: BCL Integration (Future)
When compiler supports browser BCL compilation:
- Create BRL snippet that loads heroes from BDL
- Bind BCL choice functions to hero entities
- Implement call_choice resolution mechanism

## Current Architecture

**Data Flow:**
```
game/brl/classic-rpg.brl  ─┐
game/bdl/heroes.bdl       ├─> Compiler ─> game/ir/classic-rpg.ir.json ─> BlinkEngine
game/bdl/enemies.bdl      │                                                   │
game/bdl/game-config.bdl  ┘                                                   │
                                                                               ↓
game/bcl/*.bcl ─────────────> (Not compiled) ───> Load as text ──> BCL Editor UI
                                                                               │
                                                                               ↓
                                              (Future) Browser Compiler ──> IR Delta
```

## Changes

### 1. HTML: Load BCL Files

Modify rpg-demo.html to:
- Fetch BCL files from game/bcl/ directory
- Parse and store BCL content
- Make available to BCL customization UI

### 2. BCL Editor Integration

Connect loaded BCL to the existing BCL editor UI:
- Show default BCL implementations
- Allow players to view and edit
- Store customizations in localStorage

## Related Documents

- `doc/architecture/bcl resolution rules.md` - Original requirements
- `doc/architecture/bcl-function-resolution.md` - Detailed architecture
- `doc/language/bcl-specification.md` - BCL language spec
- `hielements.hie` - Project structure specification
