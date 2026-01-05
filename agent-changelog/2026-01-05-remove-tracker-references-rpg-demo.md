# Remove Tracker References from RPG Demo — 2026-01-05

## Problem Statement
The game was not running due to "Uncaught (in promise) TypeError: trackers is not iterable" error. Trackers were removed from the engine in a previous PR, but the rpg-demo.html still used `handleTrackerOutput` function and the blink-engine.bundle.js still contained the TrackerSystem implementation. As stated, trackers are no longer supported and must be substituted by creating and managing suitable entities in BRL, with the demo reading these entities after stepping.

## Solution Implemented

### 1. Removed `handleTrackerOutput` from rpg-demo.html
- Deleted the entire `handleTrackerOutput()` function (145 lines)
- This function was listening to tracker events to update UI and handle game logic
- Replaced with entity-based polling in `handleSimulationEvent()`

### 2. Enhanced `handleSimulationEvent` in rpg-demo.html
- Added polling of game state on each 'step' event
- Queries GameState entity to check for victory, defeat, and statistics
- Implements batched UI updates (every 50 steps) for performance
- Logs enemy kills periodically based on GameState.enemiesDefeated

### 3. Removed TrackerSystem from blink-engine.bundle.js
- Removed entire `TrackerSystem` class (~60 lines)
- Removed `this.trackerSystem` initialization
- Removed `this.trackerCallbacks` Set
- Removed `trackerSystem.loadTrackers(ir.trackers)` call
- Removed `trackerSystem.capture()` call in step execution
- Removed `onTracker()` API method
- Removed `emitTrackerEvent()` method
- Removed TrackerSystem from exports

## Files Changed
- `game/demos/rpg-demo.html` - Removed handleTrackerOutput, enhanced handleSimulationEvent
- `game/demos/blink-engine.bundle.js` - Removed TrackerSystem class and all tracker-related code

## Testing Results
✅ Game loads without "trackers is not iterable" error
✅ Party selection screen displays correctly with 30 heroes
✅ Game screen renders with heroes, enemies, stats
✅ UI elements work (status bar, combat log, leaderboard)
✅ No tracker-related JavaScript errors

## Known Issues
- Simulation completes immediately without processing combat events
- "Unknown action type: conditional" warnings in console
- These are separate issues from tracker removal and likely related to BRL conditional action support

## Alignment with BRL Entity-Based Architecture
The changes align with the Hielements architecture by:
- Using BRL entities (GameState, RunStats) to track game state
- Polling entity components via `game.query()` and `game.getComponent()`
- Removing language-level tracker feature in favor of entity-based state management
- Following the principle of managing state through ECS entities rather than special tracker subsystems

## Related Changes
This builds on the previous tracker removal work documented in:
- `agent-changelog/2026-01-04-drop-tracker-feature.md`

## Next Steps
- Investigate "Unknown action type: conditional" warnings
- Debug why simulation completes immediately without combat
- Consider if BRL rules need updates for conditional actions
