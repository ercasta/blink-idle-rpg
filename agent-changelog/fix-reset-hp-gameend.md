# Fix: Reset, HP Growth, and Game Ending Issues

## Problem Statement
1. Reset does not work properly
2. After a few thousand enemies, the party's HP starts growing continuously
3. The game never ends

## Root Cause Analysis

### Issue 1: Reset Function
- Location: `game/demos/rpg-demo.html` line 3593-3608
- The `resetGame()` function needs to properly reset the party selection screen
- Currently it calls `initGame()` which doesn't reset the UI to party selection

### Issue 2: HP Growth
- Location: `game/brl/classic-rpg.brl` lines 443-448
- The `level_up_stats` rule adds to both max and current health: `entity.Health.current += 10`
- This is correct and expected behavior for leveling up
- However, there might be an issue with experience granting that's causing excessive leveling
- **Root cause**: Line 417 in `grant_experience` rule grants 50 XP to ALL players for EACH enemy defeated
- This fires for every player entity when any enemy is defeated
- With 4 players, this means each player gets 50 XP when one enemy dies

### Issue 3: Game Never Ends
- Location: `game/brl/classic-rpg.brl` lines 230-270
- The `handle_enemy_spawned` event keeps scheduling new waves indefinitely
- Line 258: `if nextWaveIndex > entity.SpawnConfig.wavesPerTier` - but `wavesPerTier` is not defined in SpawnConfig component
- The boss spawn check at line 246 requires reaching `maxTier`, but waves keep spawning
- Line 469: `spawn_replacement_enemy` has a limit of 1000 enemies, but the wave spawning continues beyond that

## Planned Changes

### Change 1: Fix Reset Function (rpg-demo.html)
- Modify `resetGame()` to properly reset to party selection screen
- Clear all game state and UI elements
- Show party selection screen again

### Change 2: Fix Experience Granting (classic-rpg.brl)
- The `grant_experience` rule should only grant XP once per enemy defeat, not once per player
- Change the rule to fire for the GameState entity instead of player entities
- Or add a check to ensure XP is only granted once

### Change 3: Fix Game Ending Logic (classic-rpg.brl)
- Add `wavesPerTier` to SpawnConfig component definition
- Ensure the wave spawning stops when appropriate conditions are met
- The spawn_replacement_enemy rule should stop when boss is spawned or game is over
- Add proper game ending condition when all content is cleared

## Implementation Plan

1. Fix the BRL file first:
   - Add `wavesPerTier` field to SpawnConfig component ✅
   - Fix the experience granting to only fire once per enemy defeat ✅
   - Fix the spawn_replacement_enemy rule to respect boss spawned state ✅
   
2. Fix the HTML reset function:
   - Modify resetGame() to return to party selection ✅
   - Properly clean up game state ✅

3. Test the changes:
   - Build compiler ✅
   - Compile BRL ✅
   - Run language tests ✅ (31 passed)
   - Build packages ✅
   - Test in browser (pending manual verification)

## Implementation Complete

All code changes have been successfully implemented and compiled. The changes address all three issues:

1. **Reset Function**: Now properly returns to party selection screen
2. **HP Growth**: Fixed experience granting to prevent multiple XP grants per enemy
3. **Game Ending**: Added checks to prevent infinite enemy spawning after boss

### Files Modified
- `game/brl/classic-rpg.brl` - Core game logic fixes
- `game/demos/rpg-demo.html` - Reset function fix
- `game/ir/classic-rpg.ir.json` - Recompiled with fixes
