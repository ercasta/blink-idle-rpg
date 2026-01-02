# Party Build Leaderboard Feature

**Date**: 2026-01-02
**Agent**: GitHub Copilot Coding Agent
**Issue**: Add party build optimization through repeated runs with leaderboard

## Requirements

From problem statement:
1. Game is played N times to find the best party build
2. Add flee/retreat option from fights (loses X time penalty)
3. Add death penalty (N times X time before respawn)
4. Player defines flee criteria in BCL
5. Record completion time and party composition (BCL)
6. Store runs in browser localStorage
7. Display leaderboard of best builds and run times

## Implementation Approach

### 1. Game Mechanics Changes

#### Flee/Retreat System
- **Retreat Time Penalty (X)**: 10 seconds baseline
- **Death Time Multiplier (N)**: 5x (50 seconds death penalty)
- Add "Flee" button in combat UI
- When fleeing:
  - Party exits current encounter
  - All enemies despawn
  - New enemies spawn after penalty time
  - Add X seconds to total run time

#### Death System Enhancement  
- When a character dies:
  - Add N*X seconds penalty (50 seconds)
  - Character respawns with full health
  - Continue fighting

### 2. Run Tracking System

#### Data Structure
```javascript
{
  runId: string,
  timestamp: number,
  completionTime: number,
  partyComposition: {
    characters: string[],
    bclFiles: string[]
  },
  statistics: {
    enemiesDefeated: number,
    playerDeaths: number,
    retreats: number,
    timePenalties: number
  }
}
```

#### Storage
- Use localStorage with key: `blink_rpg_runs`
- Store as JSON array
- Limit to 100 most recent runs
- Auto-prune older runs

### 3. BCL Integration

Add support for flee decision functions in BCL:
```bcl
choice fn should_flee(party, enemies): boolean {
    // Example: Flee if average party health < 30%
    let total_health = 0
    let total_max_health = 0
    for hero in party {
        total_health += hero.Health.current
        total_max_health += hero.Health.max
    }
    let health_pct = total_health / total_max_health
    return health_pct < 0.3
}
```

### 4. Leaderboard UI

#### Components
- Leaderboard panel in rpg-demo.html
- Sortable columns:
  - Rank
  - Completion Time
  - Party Composition
  - Statistics (Deaths, Retreats)
  - Date
- Filters:
  - By character selection
  - By time range
- Actions:
  - Load party from run
  - Clear leaderboard
  - Export/import data

### 5. UI Updates

#### Combat Screen
- Add "Flee Battle" button (with cooldown)
- Show time penalties incurred
- Display current run statistics

#### Leaderboard Screen
- Toggle between game and leaderboard
- Visual highlighting of best run
- Comparison view

## Changes to hielements.hie

Add documentation for:
- Leaderboard storage system
- Flee/retreat mechanics
- Run tracking system

## Files Modified

1. `game/demos/rpg-demo.html` - Main game UI with leaderboard
2. `hielements.hie` - Documentation update
3. `doc/language/bcl-user-guide.md` - Add flee decision examples
4. `agent-changelog/20260102_party_build_leaderboard.md` - This file

## Testing Plan

1. Test flee mechanism
   - Verify time penalty applied
   - Verify enemies despawn/respawn
2. Test death penalties
   - Verify 5x time penalty
   - Verify respawn mechanics
3. Test storage
   - Verify runs saved to localStorage
   - Verify persistence across page reloads
   - Verify pruning of old runs
4. Test leaderboard
   - Verify sorting by completion time
   - Verify display of all run data
   - Verify filters work correctly

## Implementation Order

1. ✅ Create changelog file
2. Add run tracking to rpg-demo.html
3. Implement flee mechanism
4. Add death penalty system
5. Create localStorage integration
6. Build leaderboard UI
7. Test all features
8. Update documentation
