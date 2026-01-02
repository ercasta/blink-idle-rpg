# Recurring Retargeting Implementation

**Date:** 2026-01-02  
**Issue:** Enemy retargeting needs to be made recurrent (on both sides of the party)  
**Solution:** Implement self-rescheduling recurring retargeting checks

## Problem Statement

Currently, retargeting only happens when an enemy is defeated. This means:
- If a target becomes invalid, entities may stop attacking
- New targets aren't considered during combat
- Only players retarget after enemy death, not enemies after player death
- No periodic reassessment of targets based on combat dynamics

## Solution

Implement recurring retargeting using a self-rescheduling pattern:

1. **Periodic Retargeting**: A `CheckAllTargets` event that reschedules itself
2. **Both Sides**: Apply to all entities with Target components (players and enemies)
3. **Smart Target Selection**: Detect when current target is invalid (null or dead)
4. **Lifecycle Management**: Stop retargeting when game ends

## Implementation Details

### New Rules

1. **start_global_retargeting**: When the first enemy spawns (wave 1), schedule the first retargeting check
2. **check_entity_target**: Handle the `CheckAllTargets` event - check each entity's target validity
3. **reschedule_retargeting**: After checking, reschedule the next check (makes it recurring)

### Retargeting Interval

- Default: Every 2 seconds
- Allows entities to reassess targets during combat
- Not too frequent to avoid performance issues
- Frequent enough to handle target changes quickly

### Target Validation Logic

- Check if current target is null or has health <= 0
- If invalid, emit `FindNewTarget` event for that entity
- The actual target selection (finding a new target) is handled by external game logic

### Why Self-Rescheduling?

The BRL language spec includes `schedule recurring [interval: X]` syntax, but the compiler doesn't yet output the recurring/interval fields to the IR. The engine supports recurring events, but without compiler support, we use a self-rescheduling pattern where the event reschedules itself. This is functionally equivalent and works with the current compiler.

## Benefits

1. **Robust Combat**: Entities have their targets validated periodically
2. **Dynamic Targeting**: Targets are reassessed regularly
3. **Both Sides**: Both players and enemies benefit from retargeting checks
4. **Minimal Changes**: Works with current compiler and engine

## Files Modified

- `game/brl/classic-rpg.brl` - Added recurring retargeting rules
- `agent-changelog/2026-01-02-recurring-retargeting.md` - This file

## Future Improvements

- Complete compiler support for `schedule recurring` syntax
- Implement actual target selection logic in BRL (currently relies on external `FindNewTarget` handler)
- Add configurable retargeting intervals per entity type
