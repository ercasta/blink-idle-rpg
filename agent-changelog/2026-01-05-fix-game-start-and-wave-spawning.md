# Fix Game Start and Wave-Based Enemy Spawning

## Date
2026-01-05

## Problem Statement
There are several critical issues with the game:
1. **Game doesn't start**: Nothing happens when clicking "Start Battle" - no attacks, no combat
2. **Reset removes all heroes**: They disappear completely after reset
3. **All enemy templates visible**: Including bosses like Lord Vexar who should only spawn after waves
4. **No tiered wave system**: Enemies should spawn in waves (tier 1, then tier 2, etc.) but Lord Vexar appears immediately
5. **Heroes respawn but game shows "all killed" banner**: Game should only end when Lord Vexar is defeated

## Root Causes

### Issue 1: Game Doesn't Start
- GameStart event is scheduled in the HTML but rules don't properly initialize combat
- Enemy templates (with `EnemyTemplate.isTemplate = true`) are being loaded as active enemies
- The UI loads all enemy entities from IR.initial_state instead of only loading templates for cloning

### Issue 2: Reset Removes Heroes
- Reset calls `game.destroy()` and then `initGame()`, but `initGame()` filters out heroes from the party
- The filtered IR removes selected heroes, leaving nothing

### Issue 3: All Enemy Templates Visible
- HTML code calls `extractEnemiesFromIR()` which loads ALL enemies from IR
- These enemies are meant to be templates (for cloning) but get loaded as active entities
- Enemy templates should stay in the game world as templates, not be displayed in UI

### Issue 4: No Wave-Based Spawning  
- BRL has wave spawning logic but `SpawnConfig.wavesPerTier` field is not defined
- The `handle_enemy_spawned` rule references `entity.SpawnConfig.wavesPerTier` (line 258) but this field doesn't exist
- Without this field, the wave progression logic fails

### Issue 5: Game Ending Logic
- The BRL had a rule that ended the game when all players died (removed in a previous fix)
- But the UI still shows game-over banner
- Victory condition is checking for 5 kills (line 553) instead of Lord Vexar defeat

## Changes to hielements.hie
No changes needed to hielements.hie

## Changes to BRL (classic-rpg.brl)

### 1. Add wavesPerTier to SpawnConfig component
```brl
component SpawnConfig {
    bossEveryKills: integer
    tierProgressionKills: integer
    maxTier: integer
    healthScaleRate: integer
    damageScaleRate: integer
    initialEnemyCount: integer
    wavesPerTier: integer           // NEW: number of waves per tier before advancing
}
```

### 2. Fix enemy template loading
Enemy templates in IR.initial_state should have:
- `EnemyTemplate.isTemplate = true`
- Should NOT be displayed in UI
- Should only be cloned when spawning enemies

### 3. Remove incorrect victory check
The `victory_check` rule (line 552) checks for 5 kills:
```brl
rule victory_check on CheckVictory {
    if entity.GameState.enemiesDefeated >= 5 {
        entity.GameState.bossDefeated = true
        entity.GameState.victory = true
        entity.GameState.gameOver = true
        schedule GameOver {
            victory: true
        }
    }
}
```
This is wrong - victory should only happen when Lord Vexar dies (already handled by `boss_defeated_victory` rule line 451).

### 4. Fix spawn_replacement_enemy rule
Line 476 spawns tier 1 enemies as replacements:
```brl
rule spawn_replacement_enemy on EnemyDefeated {
    if entity.GameState.enemiesDefeated < 1000 && entity.GameState.gameOver == false {
        // Schedule spawning of a new enemy to maintain combat
        schedule [delay: 0.1] SpawnEnemy {
            tier: 1  // WRONG: should use current tier
        }
    }
}
```
Should use current tier, not always tier 1.

## Changes to BDL (game-config.bdl)

Add wavesPerTier to SpawnConfig entity:
```bdl
entity spawn_config {
    SpawnConfig: {
        bossEveryKills: 50
        tierProgressionKills: 20
        maxTier: 6
        healthScaleRate: 50
        damageScaleRate: 10
        initialEnemyCount: 5
        wavesPerTier: 3              // NEW: 3 waves per tier
    }
    GameState: {
        currentWave: 1
        enemiesDefeated: 0
        playerDeaths: 0
        bossDefeated: false
        gameOver: false
        victory: false
        retargetingActive: false
        currentTier: 1
        waveInTier: 1
        bossSpawned: false
    }
    RunStats: {
        simulationTime: 0.0
        retreatCount: 0
        retreatPenalty: 0.0
        deathPenalty: 0.0
        totalTime: 0.0
        canFlee: true
        lastFleeTime: -999.0
    }
    FleeConfig: {
        retreatTimePenalty: 10.0
        deathTimePenaltyMultiplier: 5.0
        fleeCooldown: 5.0
    }
}
```

## Changes to HTML (rpg-demo.html)

### 1. Fix initGame to not filter out heroes
Currently line 3209:
```javascript
const filteredIR = {
    ...ir,
    initial_state: {
        entities: ir.initial_state.entities.filter(entity => {
            // Keep all entities EXCEPT hero templates
            return !entity.components.HeroTemplate;
        })
    }
};
```

Should also keep EnemyTemplate entities as templates:
```javascript
const filteredIR = {
    ...ir,
    initial_state: {
        entities: ir.initial_state.entities.filter(entity => {
            // Keep all entities EXCEPT hero templates (they're selected separately)
            // Keep enemy templates (for cloning during gameplay)
            return !entity.components.HeroTemplate;
        })
    }
};
```

### 2. Fix extractEnemiesFromIR to only extract templates
Currently this function extracts all enemies to display in UI. It should only extract templates for internal use:
```javascript
function extractEnemiesFromIR() {
    enemyTemplates = [];
    if (!classicRpgIR || !classicRpgIR.initial_state) return;
    
    for (const entity of classicRpgIR.initial_state.entities) {
        // Only extract enemy templates (not active enemies)
        if (entity.components.Enemy && entity.components.EnemyTemplate?.isTemplate) {
            enemyTemplates.push(entity);
        }
    }
    console.info(`Extracted ${enemyTemplates.length} enemy templates from IR.initial_state`);
}
```

### 3. Don't render enemy templates in UI
The UI should NOT show enemy templates. Only show active enemies (entities with Enemy component but without EnemyTemplate or with isTemplate=false).

## Implementation Steps
1. Add wavesPerTier to SpawnConfig component in BRL
2. Add wavesPerTier value to game-config.bdl
3. Remove or fix victory_check rule (line 552)
4. Fix spawn_replacement_enemy to use currentTier
5. Update HTML to not display enemy templates
6. Recompile BRL with BDL files
7. Test game start
8. Test wave progression
9. Test Lord Vexar spawns only at end
10. Test reset functionality

## Expected Behavior After Fix
1. Click "Start Adventure" → game initializes with 4 heroes
2. Click "Start Battle" → heroes start attacking
3. Enemies spawn in waves: 5 tier-1 enemies, then more tier-1s, then tier-2s, etc.
4. Lord Vexar spawns only after reaching max tier and completing waves
5. Game continues even if all heroes die (they respawn after 120s)
6. Game ends with victory only when Lord Vexar is defeated
7. Reset button reinitializes heroes and starts fresh
