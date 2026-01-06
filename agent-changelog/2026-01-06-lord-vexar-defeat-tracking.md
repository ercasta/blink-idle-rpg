# Lord Vexar Defeat Tracking

## Problem Statement
The game is not working consistently. We need to create a dedicated event that triggers when Lord Vexar is defeated (or alternatively a component that is only created after his defeat). The system should test that every game ends with the defeat of Lord Vexar, even if the party dies multiple times and respawns.

## Root Cause Analysis

### Current Implementation
- Lord Vexar defeat is detected in the `boss_defeated_victory` rule (line 475-491)
- When Lord Vexar is defeated, the GameState flags are set:
  - `bossDefeated = true`
  - `victory = true`
  - `gameOver = true`
- A `GameOver` event is scheduled

### Issues Identified
1. **No dedicated component**: There's no specific component that marks Lord Vexar's defeat
2. **No dedicated event**: There's no specific `LordVexarDefeated` event
3. **Testing difficulty**: Hard to verify in tests that Lord Vexar was actually defeated
4. **Clarity**: The game ending logic is mixed with general boss defeat logic

## Proposed Solution

### Solution 1: Add LordVexarDefeated Component
Add a component that is only created when Lord Vexar is defeated:

```brl
// Component that marks when Lord Vexar has been defeated
component LordVexarDefeated {
    defeatedAt: float
    defeatedBy: list<id>
}
```

This component will be attached to the GameState entity when Lord Vexar is defeated.

### Solution 2: Add LordVexarDefeated Event
Add a dedicated event that is triggered when Lord Vexar is defeated:

```brl
rule boss_defeated_victory on EnemyDefeated {
    if entity.GameState {
        entity.GameState.enemiesDefeated += 1
        // If this was the named final boss, finish the run with victory.
        if event.isBoss {
            let defeated = event.enemy
            if defeated.Enemy.name == "Lord Vexar" {
                entity.GameState.bossDefeated = true
                entity.GameState.victory = true
                entity.GameState.gameOver = true
                
                // NEW: Add LordVexarDefeated component
                create entity LordVexarDefeated {
                    defeatedAt: simulation_time()
                    defeatedBy: [0, 1, 2, 3]  // Hero IDs
                }
                
                // NEW: Emit LordVexarDefeated event
                schedule LordVexarDefeated {
                    boss: defeated
                }
                
                schedule GameOver {
                    victory: true
                }
            }
        }
    }
}
```

### Solution 3: Prevent Actions After Lord Vexar Defeat
Update spawning and respawn rules to stop when Lord Vexar is defeated:

```brl
// Prevent enemy spawning after Lord Vexar is defeated
rule spawn_replacement_enemy on EnemyDefeated {
    if entity.GameState {
        // Check if Lord Vexar has been defeated by looking for the component
        let vexarDefeated = entities having LordVexarDefeated
        if vexarDefeated.count > 0 {
            return  // Don't spawn new enemies
        }
        
        if entity.GameState.enemiesDefeated < 1000 && entity.GameState.gameOver == false && entity.GameState.bossSpawned == false {
            let currentTier = entity.GameState.currentTier
            schedule [delay: 0.1] SpawnEnemy {
                tier: currentTier
            }
        }
    }
}

// Prevent player respawn after Lord Vexar is defeated
rule respawn_on_player_defeated on PlayerDefeated {
    // Check if Lord Vexar has been defeated
    let vexarDefeated = entities having LordVexarDefeated
    if vexarDefeated.count > 0 {
        return  // Don't respawn players after victory
    }
    
    // Schedule respawn for the dead player after 120s
    schedule [delay: 120.0] RespawnPlayer {
        player: event.player
    }
}
```

## Changes to hielements.hie

### Components
- Add `LordVexarDefeated` component to track when the final boss is defeated

### Events
- Add `LordVexarDefeated` event that triggers when Lord Vexar is defeated

### Rules
- Update `boss_defeated_victory` rule to create the component and emit the event
- Update `spawn_replacement_enemy` rule to check for Lord Vexar defeat
- Update `respawn_on_player_defeated` rule to check for Lord Vexar defeat

## Testing Strategy

### Automated Test
Create a test script that:
1. Runs 10 games
2. For each game, checks that:
   - The `LordVexarDefeated` component exists in the final state
   - The `LordVexarDefeated` event was triggered
   - The game ended with `gameOver = true` and `victory = true`
   - Lord Vexar was actually defeated

### Manual Test
1. Start a game
2. Let the party progress through waves
3. Verify party can respawn after deaths
4. Wait for Lord Vexar to spawn
5. Verify game ends when Lord Vexar is defeated
6. Verify no new enemies spawn after victory
7. Verify no respawns happen after victory

## Implementation Steps

1. ✅ Create this changelog document
2. [ ] Update hielements.hie with new component and event
3. [ ] Update classic-rpg.brl with new rules
4. [ ] Compile BRL to IR
5. [ ] Run language tests
6. [ ] Create test script for 10-game run
7. [ ] Run tests and verify success
8. [ ] Document results

## Benefits

1. **Clear tracking**: Explicit component marks Lord Vexar defeat
2. **Testability**: Easy to verify in tests that boss was defeated
3. **Event-driven**: Dedicated event can trigger other effects
4. **Maintainability**: Clear separation of concerns
5. **Debugging**: Easier to see game state in dev tools
