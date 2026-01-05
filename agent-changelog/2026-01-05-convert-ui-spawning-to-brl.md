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

## Changes Required

### 1. Add Enemy Replacement Rule to BRL (`game/brl/classic-rpg.brl`)

Add a rule that schedules enemy spawning when one is defeated:

```brl
// Spawn a replacement enemy when one is defeated
rule spawn_replacement_enemy on EnemyDefeated {
    if entity.GameState.enemiesDefeated < 1000 && entity.GameState.gameOver == false {
        // Schedule spawning of a new enemy
        schedule [delay: 0.1] SpawnEnemy {
            tier: 1
        }
    }
}
```

### 2. Remove UI Spawning Code (`game/demos/rpg-demo.html`)

Remove or comment out the UI code that handles enemy spawning:
- Lines 2920-2987: `spawnEnemy()` function
- Lines 2989-3002: `spawnInitialEnemies()` function
- Line 3493: Call to `spawnEnemy()` in EnemyDefeated handler
- Lines 3496-3518: Manual retargeting logic (now handled by BRL)

### 3. Verify Game Start Flow

After changes, the flow should be:
1. User selects heroes
2. `initGameWithParty()` creates hero entities
3. `game.scheduleEvent('GameStart', 0, {})` triggers BRL initialization
4. BRL `initialize_hero_attacks` rule starts hero attacks
5. BRL `start_retargeting_system` rule starts retargeting
6. BRL `spawn_initial_enemies` rule spawns 5 enemies
7. Combat begins
8. When enemy dies, BRL `spawn_replacement_enemy` rule spawns new enemy
9. BRL `start_global_retargeting` ensures dead targets are replaced

## Files to Change

1. `game/brl/classic-rpg.brl` - Add spawn_replacement_enemy rule
2. `game/demos/rpg-demo.html` - Remove UI spawning code

## Testing

- [ ] Compile BRL with `make compile-brl`
- [ ] Build demo package with `make demo-package`
- [ ] Verify enemies spawn on game start
- [ ] Verify new enemies spawn when one is defeated
- [ ] Verify retargeting works correctly
- [ ] Verify game continues until victory/defeat condition
