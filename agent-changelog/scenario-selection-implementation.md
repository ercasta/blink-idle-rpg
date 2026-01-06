# Scenario Selection Implementation

**Date:** 2026-01-06  
**Issue:** Add 3 different game scenarios with different waves and parameters

## Overview

Implemented a scenario selection system that allows players to choose from three different game difficulties before selecting their party. Each scenario has different game parameters (respawn time, death penalty, enemy spawn rates, boss frequency) and is compiled from scenario-specific BDL files.

## Changes Made

### 1. BDL Files Created (game/bdl/)

- **scenario-easy.bdl** - Casual Adventure
  - 3 enemies per wave (vs 5 normal)
  - 5s respawn time (vs 10s normal)
  - 3x death penalty = 15s (vs 5x = 50s normal)
  - Bosses every 150 kills (vs 100 normal)
  - 50% slower enemy scaling

- **scenario-normal.bdl** - Classic Campaign
  - Standard game balance (baseline)
  - 5 enemies per wave
  - 10s respawn time
  - 5x death penalty = 50s
  - Bosses every 100 kills

- **scenario-hard.bdl** - Nightmare Mode
  - 7 enemies per wave (vs 5 normal)
  - 15s respawn time (vs 10s normal)
  - 7x death penalty = 105s (vs 5x = 50s normal)
  - Bosses every 75 kills (vs 100 normal)
  - 50% faster enemy scaling

### 2. BRL Component Addition (game/brl/classic-rpg.brl)

Added `ScenarioInfo` component to store scenario metadata:
```brl
component ScenarioInfo {
    id: string
    name: string
    description: string
    difficulty: string
    respawnTime: string
    deathPenalty: string
    enemiesPerWave: string
    bossFrequency: string
}
```

### 3. Compiler Build Process (Makefile)

Modified `compile-brl` target to generate 4 IR files:
- `classic-rpg-easy.ir.json` (with scenario-easy.bdl)
- `classic-rpg-normal.ir.json` (with scenario-normal.bdl)
- `classic-rpg-hard.ir.json` (with scenario-hard.bdl)
- `classic-rpg.ir.json` (legacy, with game-config.bdl for backward compatibility)

Each compilation includes: classic-rpg.brl + heroes.bdl + enemies.bdl + scenario-*.bdl

### 4. UI Implementation (game/demos/rpg-demo.html)

#### New Scenario Selection Screen
- Added before party selection screen
- Displays 3 scenario cards with:
  - Name and difficulty badge
  - Description
  - Key parameters (respawn time, death penalty, enemies/wave, boss frequency)
  - Color-coded by difficulty (green=easy, blue=normal, red=hard)
  
#### Compilation Documentation Section
- Visual diagram showing compilation flow:
  - BRL (Rules) + BDL (Data) → Compiler → IR (Output)
- Explains how scenarios are created by combining different BDL files
- Shows file names involved in each step

#### JavaScript Changes
- Added scenario selection state and logic
- `renderScenarios()` - Loads and displays all 3 scenarios
- `loadScenarioIR()` - Loads scenario-specific IR file
- `selectScenario()` - Handles scenario selection and transitions to party selection
- Modified initialization to show scenario selection first instead of auto-loading IR

### 5. File Distribution

Copied scenario IR files to game/demos/ for web access:
- classic-rpg-easy.ir.json
- classic-rpg-normal.ir.json
- classic-rpg-hard.ir.json

## Compilation Process

The scenario selection system demonstrates the separation between BRL (rules/logic) and BDL (data/configuration):

1. **BRL defines the game logic** (classic-rpg.brl)
   - Components, rules, functions, trackers

2. **BDL defines the game data** (scenario-*.bdl)
   - Scenario configuration (SpawnConfig, FleeConfig)
   - Hero definitions (heroes.bdl)
   - Enemy definitions (enemies.bdl)

3. **Compiler combines them** (blink-compiler)
   - Processes BRL and all included BDL files
   - Validates syntax and semantics
   - Generates IR JSON

4. **Engine executes IR** (blink-engine)
   - Loads compiled IR file
   - Runs game simulation

## Testing

### Manual Testing Performed
1. ✅ Compiled all 4 IR files successfully
2. ✅ Verified ScenarioInfo component data in IR files
3. ✅ Tested scenario selection UI loads all 3 scenarios
4. ✅ Verified scenario cards show correct parameters
5. ✅ Tested clicking scenario transitions to party selection
6. ✅ Confirmed party selection loads heroes from selected scenario's IR
7. ✅ Verified "Start Adventure" button works with selected scenario

### Screenshots
- Scenario selection screen with 3 options and compilation diagram
- Party selection screen after choosing a scenario

## Files Modified

### New Files
- game/bdl/scenario-easy.bdl
- game/bdl/scenario-normal.bdl
- game/bdl/scenario-hard.bdl
- game/demos/classic-rpg-easy.ir.json
- game/demos/classic-rpg-normal.ir.json
- game/demos/classic-rpg-hard.ir.json
- agent-changelog/scenario-selection-implementation.md

### Modified Files
- game/brl/classic-rpg.brl (added ScenarioInfo component)
- Makefile (updated compile-brl target)
- game/demos/rpg-demo.html (added scenario selection UI and logic)
- game/ir/*.ir.json (regenerated with new component)

## Technical Notes

### BDL File Structure
Each scenario BDL file contains:
- `scenario_info` entity with ScenarioInfo component (metadata for UI)
- `flee_config` entity with FleeConfig component (respawn/death penalties)
- `spawn_config` entity with SpawnConfig component (enemy spawn parameters)
- `game_state` entity (runtime state tracking)
- `run_stats` entity (run statistics)
- `enemy_compendium` entity (enemy template references)

### Compilation Flow
```bash
# Easy scenario
blink-compiler compile -i classic-rpg.brl -o classic-rpg-easy.ir.json \
  --include heroes.bdl \
  --include enemies.bdl \
  --include scenario-easy.bdl

# Similar for normal and hard scenarios
```

### UI State Management
- Scenario selection happens first (on page load)
- Selected scenario's IR is loaded
- Party selection screen displays heroes from loaded IR
- Game starts with the selected scenario's parameters

## Future Enhancements

Potential improvements:
1. Add more scenarios with different themes (e.g., "Speed Run", "Boss Rush")
2. Allow players to create custom scenarios via UI
3. Store scenario preference in localStorage
4. Display scenario name/difficulty during gameplay
5. Add scenario-specific achievements
6. Create a scenario editor tool

## References

- BDL Specification: doc/language/bdl-specification.md
- BRL Specification: doc/language/brl-specification.md
- Makefile compilation: Makefile (lines 46-66)
- Demo implementation: game/demos/rpg-demo.html
