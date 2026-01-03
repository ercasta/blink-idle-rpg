# BDL (Blink Data Language) Implementation

**Date:** 2026-01-03
**Context:** New requirement to define BDL as a subset of BRL for content creators

## Summary

Created BDL (Blink Data Language), a subset of BRL dedicated to content creators. BDL only allows creating entities and setting components, making it safe and simple for non-programmers to define game data.

## Changes Made

### 1. BDL Specification
- Created `doc/language/bdl-specification.md` with full language documentation
- BDL is a strict subset of BRL that only allows:
  - Entity creation with `entity` blocks
  - Component initialization with literal values
  - Comments (single-line and multi-line)
- BDL does NOT allow:
  - Component definitions
  - Rule definitions
  - Function definitions
  - Tracker definitions
  - Variables or expressions
  - Control flow

### 2. BDL Data Files
Created `game/bdl/` folder with:
- `README.md` - Documentation for the BDL folder
- `heroes.bdl` - All 30 hero character definitions with stats, skills, and UI info
- `enemies.bdl` - 9 enemy templates across 6 tiers including bosses
- `game-config.bdl` - Game state, run stats, flee config, and spawn config

### 3. BRL Component Updates
Added new components to `game/brl/classic-rpg.brl`:
- `HeroInfo` - Stores hero metadata for party selection UI (id, description, difficulty, role, playstyle)
- `SpawnConfig` - Stores spawn configuration (boss frequency, tier progression, scaling rates)

### 4. Architecture Updates
Updated `hielements.hie`:
- Added BDL to language specification section
- Added BDL element to game_content section with file existence checks
- Updated language documentation references

## Migration Path

The BDL files contain all the data previously in:
- `game/data/characters.json` - Now in `game/bdl/heroes.bdl`
- Embedded enemy templates in HTML - Now in `game/bdl/enemies.bdl`
- Game configuration constants - Now in `game/bdl/game-config.bdl`

The original `characters.json` is retained for backward compatibility until the game demo is updated to load from BDL.

## Loading Order

BDL files must be loaded AFTER BRL files:
1. BRL files (component definitions, rules, trackers)
2. BCL files (player strategies)
3. BDL files (entity data - requires component definitions from BRL)

## Next Steps

1. Implement BDL parser in the compiler (reuse BRL lexer/parser with restrictions)
2. Update IR generation to include BDL entities in `initial_state`
3. Update game demo to load character data from BDL instead of JSON
4. Eventually deprecate `game/data/characters.json`

## File Structure

```
game/
├── bdl/
│   ├── README.md
│   ├── heroes.bdl       # 30 hero definitions
│   ├── enemies.bdl      # 9 enemy templates
│   └── game-config.bdl  # Game configuration
├── brl/
│   └── classic-rpg.brl  # Updated with HeroInfo, SpawnConfig components
├── bcl/
│   └── ...              # Player strategies (unchanged)
└── data/
    └── characters.json  # Legacy (retained for compatibility)
```
