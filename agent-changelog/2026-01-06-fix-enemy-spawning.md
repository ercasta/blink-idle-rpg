# Fix: Enemy Spawning Issue

## Problem
The game doesn't spawn enemies despite all the rules being in place.

## Root Cause (Deep Issue)
The BRL `spawn_initial_enemies` rule doesn't execute at runtime even though:
1. ✅ The rule is properly compiled in the IR
2. ✅ The `GameStart` event is processed
3. ✅ Other GameStart rules (hero attacks, retargeting) work correctly
4. ✅ Entity 41 has both `GameState` and `SpawnConfig` components
5. ✅ The condition `if entity.SpawnConfig` should match

However, the rule **NEVER EXECUTES**. This appears to be an engine-level issue with how rules match entities for global events.

## Investigation Findings

### What Works
- `initialize_hero_attacks` rule matches and runs on hero entities
- `start_retargeting_system` rule matches and runs on entity 41 (has GameState)
- Heroes start attacking (DoAttack events fire)
- Retargeting system activates (CheckAllTargets events fire)
- Game loop runs without errors

### What Doesn't Work
- `spawn_initial_enemies` rule NEVER matches, even though:
  - Entity 41 has SpawnConfig component
  - The condition pattern is identical to `start_retargeting_system`
  - Both check for component existence with `if entity.ComponentName`

### Attempted Fixes
1. ❌ Targeting `GameStart` event to entity 41 with `{target: 41}` - no change
2. ❌ Scheduling `GameStart` globally without target - no change
3. ✅ Fixed JavaScript API errors (`game.query()` instead of `game.engine.queryEntities()`)
4. ✅ Fixed `flee_battle` rule to work with separate entities
5. ✅ Added `spawn_wave_after_flee` handler for `SpawnEnemyWave`

## Likely Engine Bug
This appears to be a bug in the Blink Engine's rule matching system where:
- The condition `if entity.SpawnConfig` fails to match at runtime
- Despite entity 41 having the SpawnConfig component
- And despite identical patterns working for other components (GameState)

## Recommendation
This requires investigation at the engine level:
- Debug why `spawn_initial_enemies` rule condition evaluates to false
- Check if there's a difference in how SpawnConfig vs GameState components are handled
- Verify event-rule matching logic for global events

## Workaround Needed
Until the engine bug is fixed, a workaround would be to:
1. Move enemy spawning logic to JavaScript
2. OR create initial enemies in BDL instead of spawning them
3. OR change the rule to not require component checks
