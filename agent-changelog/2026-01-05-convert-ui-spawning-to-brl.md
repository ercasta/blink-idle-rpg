# Convert UI Enemy Spawning to BRL Rules

**Date:** January 5, 2026  
**Branch:** copilot/convert-ui-code-to-brl  
**Related Issue:** Convert UI code to BRL rules after implementing missing compiler features

## Problem Analysis

### UI Code Still Handling Enemy Spawning
The `spawnEnemy()` function in `rpg-demo.html` (lines 2920-2987) contains enemy spawning logic that should be handled by BRL rules using the newly implemented `clone` feature.

**Current Issues:**
1. UI manually spawns enemies when one is defeated (line 3493)
2. UI manually calculates enemy stats based on progression
3. UI manually assigns targets to spawned enemies
4. This duplicates game logic that should be in BRL

### BRL Missing Key Rule
The BRL has:
- ✅ `spawn_initial_enemies` - spawns 5 enemies on GameStart
- ✅ `spawn_enemy_from_template` - clones enemy template using `clone` keyword
- ❌ Missing: Rule to spawn new enemy when one is defeated

### Hero Template ID Conflict
The initial_state contains hero templates with IDs 0-35. When the UI tried to create selected heroes with IDs 0-3, this caused a conflict:
- Hero templates in BDL were being loaded as game entities
- UI couldn't create new hero entities with the same IDs
- This prevented the game from starting properly

## Changes Implemented

### 1. Add Enemy Replacement Rule to BRL (`game/brl/classic-rpg.brl`)

Added `spawn_replacement_enemy` rule that triggers on `EnemyDefeated` event:

```brl
// Spawn a replacement enemy when one is defeated
rule spawn_replacement_enemy on EnemyDefeated {
    if entity.GameState.enemiesDefeated < 1000 && entity.GameState.gameOver == false {
        // Schedule spawning of a new enemy to maintain combat
        schedule [delay: 0.1] SpawnEnemy {
            tier: 1
        }
    }
}
```

### 2. Add HeroTemplate Component

Added `HeroTemplate` component to BRL (similar to `EnemyTemplate`):

```brl
// Marks an entity as a hero template (not a spawned hero)
component HeroTemplate {
    isTemplate: boolean
}
```

Added `HeroTemplate { isTemplate: true }` to all 30 heroes in `game/bdl/heroes.bdl`.

### 3. Remove UI Spawning Code (`game/demos/rpg-demo.html`)

Removed or commented out:
- Lines 2920-2996: `spawnEnemy()` function (commented)
- Lines 2998-3011: `spawnInitialEnemies()` function (commented)  
- Lines 3475-3528: Enemy spawning logic from Death event handler (removed)

### 4. Filter Hero Templates from Game State

Added filtering logic before loading IR:

```javascript
// Filter out hero templates from initial_state before loading
const filteredIR = {
  ...ir,
  initial_state: {
    entities: ir.initial_state.entities.filter(entity => {
      // Keep all entities EXCEPT hero templates
      return !entity.components.HeroTemplate;
    })
  }
};

game.loadRulesFromObject(filteredIR);
```

This prevents hero templates from being loaded as game entities, avoiding ID conflicts.

## Game Flow After Changes

1. **Initialization:**
   - Load IR (rules + initial_state)
   - Extract hero templates for UI party selection (entities with HeroInfo + HeroTemplate)
   - Filter out hero templates before loading into game engine
   - Load filtered IR (enemy templates, game config, spawn config remain)

2. **Hero Selection:**
   - User selects up to 4 heroes from available templates
   - UI creates hero entities with IDs 0-3 based on selected templates
   - GameStart event is scheduled

3. **Game Start (when user clicks Start button):**
   - BRL `initialize_hero_attacks` rule starts hero attacks (staggered)
   - BRL `start_retargeting_system` rule activates retargeting every 2s
   - BRL `spawn_initial_enemies` rule spawns 5 enemies by scheduling SpawnEnemy events
   - BRL `spawn_enemy_from_template` rule clones enemy templates for each SpawnEnemy

4. **Combat Loop:**
   - Heroes and enemies attack each other
   - When enemy dies, BRL `spawn_replacement_enemy` spawns a new one
   - Retargeting system handles dead targets every 2 seconds
   - Combat continues until victory or defeat condition

## Files Changed

1. `game/brl/classic-rpg.brl` - Added HeroTemplate component and spawn_replacement_enemy rule
2. `game/bdl/heroes.bdl` - Added HeroTemplate to all 30 heroes
3. `game/demos/rpg-demo.html` - Removed UI spawning code and added hero template filtering
4. `game/ir/classic-rpg.ir.json` - Regenerated with new components
5. `agent-changelog/2026-01-05-convert-ui-spawning-to-brl.md` - This document

## Testing Results

✅ **Compiler Build:** Successful  
✅ **Package Build:** Successful  
✅ **BRL Compilation:** Successful (with 2 expected warnings about non-literal expressions)  
✅ **Demo Package Creation:** Successful  
✅ **Language Tests:** All 32 tests passed  

## Summary

The UI code for enemy spawning has been successfully converted to BRL rules. The game now:
- Spawns enemies using BRL rules with the `clone` keyword
- Maintains combat by spawning replacement enemies when one is defeated
- Properly separates hero templates (for UI) from game hero entities (0-3)
- Handles all game logic in BRL instead of UI code

The hero template ID conflict was resolved by:
1. Adding `HeroTemplate` component to mark heroes as templates
2. Filtering hero templates before loading IR into game engine
3. Allowing UI to create hero entities 0-3 without conflicts
