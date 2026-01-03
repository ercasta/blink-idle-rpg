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

### 5. JSON Data Files
Created/updated JSON files as runtime representations of BDL data:
- Created `game/data/enemies.json` - Enemy templates from enemies.bdl
- Updated `game/data/characters.json` - Added comment noting it's generated from heroes.bdl

### 6. Game Demo Updates
Updated `game/demos/rpg-demo.html`:
- Added `loadEnemyData()` function to load enemies from JSON file
- Updated initialization to load enemy data from external JSON
- Kept fallback to embedded data if JSON load fails

## Migration Path

The BDL files are now the source of truth for game data:
- `game/bdl/heroes.bdl` → `game/data/characters.json` (runtime format)
- `game/bdl/enemies.bdl` → `game/data/enemies.json` (runtime format)
- `game/bdl/game-config.bdl` → Used by BRL rules

Until the compiler supports BDL parsing directly, JSON files serve as an intermediate runtime format.

## Loading Order

BDL files must be loaded AFTER BRL files:
1. BRL files (component definitions, rules, trackers)
2. BCL files (player strategies)
3. BDL files (entity data - requires component definitions from BRL)

## Next Steps

1. Implement BDL parser in the compiler (reuse BRL lexer/parser with restrictions)
2. Update IR generation to include BDL entities in `initial_state`
3. Create tooling to auto-generate JSON from BDL for runtime use
4. Eventually load BDL directly in the browser

## File Structure

```
game/
├── bdl/
│   ├── README.md
│   ├── heroes.bdl       # 30 hero definitions (source of truth)
│   ├── enemies.bdl      # 9 enemy templates (source of truth)
│   └── game-config.bdl  # Game configuration (source of truth)
├── brl/
│   └── classic-rpg.brl  # Updated with HeroInfo, SpawnConfig components
├── bcl/
│   └── ...              # Player strategies (unchanged)
├── data/
│   ├── characters.json  # Runtime format (from heroes.bdl)
│   └── enemies.json     # Runtime format (from enemies.bdl)
└── demos/
    └── rpg-demo.html    # Updated to load enemy data from JSON
```
