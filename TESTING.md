# Testing Guide

## Overview
Game logic is implemented in BRL with the HTML serving as UI layer only.

## Testing Checklist

### 1. BRL Compilation
```bash
make compile-brl
# Should compile without errors
# Verify game/ir/classic-rpg.ir.json contains expected components
```

### 2. Game Initialization
- Open `game/demos/classic-rpg.html`
- Select 4 heroes
- Click "Start Adventure"
- Verify:
  - Status bar shows "Sim Time" and "Total Time"
  - Run Statistics panel displays
  - Flee Battle button is present

### 3. Flee Mechanism
- Start battle
- Click "Flee Battle" button
- Expected behavior:
  - BRL `FleeFromBattle` event triggered
  - 10s penalty applied (visible in Run Statistics)
  - Enemies despawn
  - New enemies spawn
  - 5s cooldown before next flee

### 4. Death Penalties
- Let a hero die
- Expected behavior:
  - BRL `PlayerDefeated` event triggered
  - 50s penalty applied automatically
  - Death count increments
  - Penalty visible in Run Statistics panel

### 5. Run Tracking
- Complete a game (win or lose)
- Expected behavior:
  - `SaveRunToLeaderboard` event triggered
  - Run data saved to localStorage
  - Leaderboard displays the run
  - Shows completion time, party, stats

### 6. Leaderboard UI
- Complete multiple runs
- Open leaderboard panel
- Verify:
  - Runs sorted by completion time (fastest first)
  - Top 3 highlighted (gold/silver/bronze)
  - Party composition displayed
  - Statistics accurate
  - Export/Clear buttons work

## BRL Components to Monitor

### RunStats
```
simulationTime: float     // Current game time
retreatCount: integer     // Number of flees
retreatPenalty: float     // Total flee penalty (10s * count)
deathPenalty: float       // Total death penalty (50s * count)
totalTime: float          // sim + penalties (competitive metric)
canFlee: boolean          // Cooldown status
lastFleeTime: float       // Last flee timestamp
```

### FleeConfig
```
retreatTimePenalty: 10.0
deathTimePenaltyMultiplier: 5.0
fleeCooldown: 5.0
```

## BRL Events to Test

1. **FleeFromBattle** - Player initiates retreat
2. **DespawnAllEnemies** - Clears current wave
3. **SpawnEnemyWave** - Spawns new enemies post-flee
4. **UpdateRunStats** - Updates metrics
5. **SaveRunToLeaderboard** - Persists run on game over

## Expected Flow

```
Player clicks "Flee"
   ↓
HTML triggers: game.scheduleEvent('FleeFromBattle', ...)
   ↓
BRL rule: flee_battle
   ↓
- Checks canFlee (cooldown)
- Applies 10s penalty to retreatPenalty
- Updates totalTime
- Emits DespawnAllEnemies
- Schedules SpawnEnemyWave
   ↓
UI reads RunStats component
   ↓
Display updated penalties
```

## Known Issues
- Game is currently being restructured; some features may not work as described

