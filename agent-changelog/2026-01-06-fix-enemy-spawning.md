# Fix: Enemy Spawning Issue

## Problem
The game doesn't spawn enemies despite all the rules being in place.

## Root Cause
The `GameStart` event is scheduled without an entity target in `rpg-demo.html`:
```javascript
game.scheduleEvent('GameStart', 0, {});
```

However, the BRL rule `spawn_initial_enemies` requires an entity with `SpawnConfig`:
```brl
rule spawn_initial_enemies on GameStart {
    if entity.SpawnConfig {
        // ... spawn enemies
    }
}
```

Since `GameStart` has no entity context (empty `{}`), the condition `if entity.SpawnConfig` never matches, and the rule never fires.

## Solution
The `GameStart` event needs to target the entity that has both `GameState` and `SpawnConfig` components. According to the IR, this is entity ID 41.

### Changes Required in `rpg-demo.html`:
1. Find the entity with `SpawnConfig` before starting the game
2. Schedule `GameStart` with that entity as the target

## Additional Issue Found
There's a `SpawnEnemyWave` event scheduled in line 636 of `classic-rpg.brl` but NO rule handles it. This will cause issues after fleeing.

### Fix Required in `classic-rpg.brl`:
Either remove the `SpawnEnemyWave` event or add a handler rule for it.
