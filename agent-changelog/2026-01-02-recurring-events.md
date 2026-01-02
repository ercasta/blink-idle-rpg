# Recurring Events Implementation

**Date:** 2026-01-02  
**Issue:** Battle hanging mid-battle due to lost events  
**Solution:** Implement BRL's native `recurring` event support instead of special watchdog system

## Problem Statement

The game was hanging mid-battle when events got lost and no new events were generated. The initial solution created a special "watchdog" event system, but this was overcomplicated.

## Proper Solution

BRL already has native support for `recurring` events via the `schedule recurring` keyword. Instead of creating a workaround, we implemented the actual feature in the engine.

### Key Features

1. **Recurring Events**: Events that automatically reschedule themselves
2. **Same Event ID**: Recurring events maintain the same ID across reschedules
3. **Cancellable**: Can be canceled using the event ID
4. **Configurable Interval**: Specify the interval between occurrences
5. **Optional Delay**: Support initial delay before first occurrence

## Implementation

### Timeline Changes

Added to `ScheduledEvent`:
- `recurring?: boolean` - Flag indicating recurring event
- `interval?: number` - Interval in seconds for recurring events

Modified `pop()` to automatically reschedule recurring events with the same ID.

Added `scheduleRecurring()` method for convenient recurring event creation.

### BlinkGame Changes

Added public methods:
- `scheduleRecurringEvent(eventType, interval, options)` - Schedule recurring event
- `cancelEvent(eventId)` - Cancel any scheduled event (including recurring)

## Testing

Created comprehensive tests in `recurring.test.ts`:
- Test 1: Basic recurring event ✓
- Test 2: Cancel recurring event ✓
- Test 3: Multiple recurring events ✓
- Test 4: Recurring event with delay ✓

All tests pass successfully.

## Usage Example

```typescript
// Schedule a regeneration event every 2 seconds
const regenId = game.scheduleRecurringEvent('Regeneration', 2.0, {
  source: playerId,
  delay: 5.0  // Optional: wait 5s before first occurrence
});

// Later, cancel the recurring event
game.cancelEvent(regenId);
```

## Benefits Over Watchdog Approach

1. **Simpler**: Uses native language feature rather than special system
2. **More flexible**: Can be used for any recurring behavior, not just combat
3. **Better aligned**: Matches BRL specification
4. **User-controlled**: Game rules control when to use recurring events
5. **Cleaner code**: No special event types or internal watchdog logic

## Files Modified

- `packages/blink-engine/src/timeline/Timeline.ts` - Added recurring event support
- `packages/blink-engine/src/BlinkGame.ts` - Added public API methods
- `packages/blink-engine/README.md` - Documented recurring events
- `packages/blink-engine/tsconfig.json` - Excluded test files

## Files Created

- `packages/blink-engine/src/recurring.test.ts` - Comprehensive tests
- `agent-changelog/2026-01-02-recurring-events.md` - This file

## Files Reverted

All watchdog-related files were removed:
- `packages/blink-engine/src/constants.ts`
- `packages/blink-engine/src/watchdog.test.ts`
- `packages/blink-engine/WATCHDOG.md`
- `agent-changelog/2026-01-02-watchdog-event-system.md`
