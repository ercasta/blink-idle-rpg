# Fix: Waves increment but no enemies appear / are defeated

## Problem Statement
Waves were incrementing but no enemies were appearing or being defeated during gameplay.

## Root Cause
Multiple BRL rules were accessing singleton-like components (GameState, SpawnConfig, RunStats, FleeConfig) without first checking if the entity had those components. When events fired, these rules would execute for ALL entities in the game, not just the specific entity with the required components. This caused the rules to fail or behave unexpectedly for entities without the required components.

### Key Issue
The `handle_enemy_spawned` rule (which spawns enemies for each wave) was firing for every entity when the `EnemySpawned` event occurred. Since most entities don't have GameState/SpawnConfig components, the rule would fail when trying to access fields like `entity.GameState.currentTier`, preventing enemies from spawning.

## Solution
Added proper component existence checks (`if entity.ComponentName`) to all rules that access these singleton-like components. This ensures rules only execute for entities that have the required components.

### Rules Fixed
1. **handle_enemy_spawned** - Now checks for GameState AND SpawnConfig
2. **start_retargeting_system** - Now checks for GameState
3. **boss_defeated_victory** - Now checks for GameState
4. **spawn_replacement_enemy** - Now checks for GameState
5. **count_player_death** - Now checks for GameState
6. **apply_death_penalty** - Now checks for RunStats AND FleeConfig
7. **flee_battle** - Now checks for RunStats AND FleeConfig
8. **update_flee_cooldown** - Now checks for RunStats AND FleeConfig
9. **complete_run** - Now checks for RunStats AND GameState
10. **reschedule_retargeting** - Now checks for GameState
11. **start_global_retargeting** - Now checks for GameState

## Changes to hielements.hie
No changes required to hielements.hie - this is a bug fix in the game logic implementation.

## Files Modified
- `game/brl/classic-rpg.brl` - Added component existence checks to 11 rules
- `game/ir/*.ir.json` - Regenerated from fixed BRL

## Testing
- Compiler tests: ✅ All passed (17 unit tests, 31 language tests)
- IR verification: ✅ Confirmed proper conditional checks in compiled IR
- Build pipeline: ✅ Successfully built compiler, packages, and demo package

## Expected Behavior After Fix
- GameStart event triggers initial enemy spawning correctly
- EnemySpawned event spawns enemies for each wave without errors
- Wave counter increments properly as enemies are defeated
- Boss spawns correctly at final tier
- All game state management rules work correctly
