# Watchdog Event System Implementation

**Date:** 2026-01-02  
**Issue:** Battle hanging mid-battle due to lost events  
**Solution:** Add scheduled "watchdog" events to reevaluate game state

## Problem Statement

The game sometimes hangs mid-battle, likely because some events get lost and no new events are generated. This occurs when:
1. An event doesn't schedule a follow-up event due to a bug or edge case
2. All entities die simultaneously and no cleanup events fire
3. A rule condition fails unexpectedly and breaks the event chain

## Proposed Solution

Implement a watchdog timer system that periodically schedules "heartbeat" or "reevaluation" events to catch unmanaged cases and prevent hangs.

### Key Features

1. **Watchdog Timer**: Periodic events scheduled at configurable intervals
2. **State Reevaluation**: Check if the game should still be running (e.g., are there living combatants?)
3. **Event Recovery**: Generate necessary events if the event queue becomes empty unexpectedly
4. **Configurable**: Allow enabling/disabling and configuring watchdog interval
5. **Non-intrusive**: Should not interfere with normal game flow

## Changes to hielements.hie

No changes needed to `hielements.hie` - this is an implementation detail within the existing `js_engine` element.

## Implementation Plan

### 1. Add Watchdog Configuration to GameOptions
- Add `watchdogInterval` option (in seconds, 0 = disabled)
- Add `watchdogEnabled` boolean flag
- Default: enabled with 5 second interval

### 2. Extend Timeline with Watchdog Support
- Add method to schedule recurring watchdog events
- Track watchdog event IDs for cleanup

### 3. Add Watchdog Event Handling to BlinkGame
- Schedule initial watchdog event on start()
- Reschedule watchdog event each time it fires
- Implement watchdog handler to check game state
- Clear watchdog events on stop()

### 4. Implement State Check Logic
- Check if timeline has events (excluding watchdog)
- Check if entities with Attack/Target components exist
- Generate recovery events if needed

### 5. Testing
- Unit tests for watchdog scheduling
- Integration tests for hang prevention
- Performance tests to ensure minimal overhead

## Files to Modify

1. **packages/blink-engine/src/BlinkGame.ts**
   - Add watchdog configuration options
   - Add watchdog scheduling logic
   - Add watchdog event handler

2. **packages/blink-engine/src/timeline/Timeline.ts**
   - Add methods for tracking watchdog events
   - Add method to check if only watchdog events remain

3. **packages/blink-engine/src/index.ts**
   - Export watchdog-related types

## Testing Strategy

1. Create a test scenario that would normally hang
2. Verify watchdog detects the hang condition
3. Verify watchdog generates recovery events
4. Verify normal gameplay is unaffected
5. Verify watchdog can be disabled

## Rollout Plan

1. Implement core watchdog functionality
2. Test with existing combat scenarios
3. Add watchdog to combat demo
4. Document watchdog configuration
5. Optional: Add UI toggle for watchdog in demo

## Success Criteria

- No more battle hangs in test scenarios
- Watchdog adds < 1% overhead to simulation
- Watchdog can be disabled without side effects
- All existing tests pass
