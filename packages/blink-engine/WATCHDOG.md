# Watchdog Event System

## Overview

The Watchdog Event System is a built-in safeguard that prevents the game from hanging mid-battle when events get lost or fail to schedule follow-up events. It works by periodically checking the game state and generating recovery events when necessary.

## How It Works

### Periodic Checks

The watchdog schedules a special `__WATCHDOG__` event at regular intervals (default: every 5 seconds). When this event fires:

1. **Check for Hang Condition**: The watchdog examines the event timeline to see if there are any non-watchdog events remaining
2. **Identify Active Combatants**: If no events remain, it searches for entities with `Attack`, `Target`, and `Health` components
3. **Generate Recovery Events**: For each alive combatant with a living target, it generates an immediate `DoAttack` event
4. **Reschedule**: The watchdog schedules itself to fire again after the configured interval

### Hang Detection

A "hang" is detected when:
- The event timeline contains only watchdog events (no game events)
- Active combatants exist (entities with Attack, Target, and Health components)
- The combatants are still alive (health > 0)
- The combatants have valid, alive targets

When this condition is detected, the watchdog generates recovery events to resume combat.

## Configuration

The watchdog can be configured when creating a game instance:

```typescript
const game = BlinkGame.createSync({
  watchdogEnabled: true,      // Enable/disable watchdog (default: true)
  watchdogInterval: 5.0       // Check interval in seconds (default: 5.0)
});
```

### Options

- **`watchdogEnabled`** (boolean, default: `true`)
  - Set to `false` to completely disable the watchdog system
  - Useful for testing specific scenarios or debugging

- **`watchdogInterval`** (number, default: `5.0`)
  - How often (in seconds) the watchdog should check game state
  - Smaller values = more frequent checks but slightly more overhead
  - Larger values = less overhead but slower hang recovery
  - Set to `0` or negative value to disable (same as `watchdogEnabled: false`)

## Usage Examples

### Basic Usage (Default Settings)

```typescript
// Watchdog is enabled by default with 5-second interval
const game = BlinkGame.createSync();
game.loadRulesFromObject(gameRules);
game.start();
```

### Custom Interval

```typescript
// Check every 2 seconds for faster hang detection
const game = BlinkGame.createSync({
  watchdogInterval: 2.0
});
```

### Disabled for Testing

```typescript
// Disable watchdog to test specific hang scenarios
const game = BlinkGame.createSync({
  watchdogEnabled: false
});
```

## Debug Mode

When debug mode is enabled, the watchdog logs its activity:

```typescript
const game = BlinkGame.createSync({
  debug: true,
  watchdogEnabled: true,
  watchdogInterval: 5.0
});
```

Debug output includes:
- When watchdog events are scheduled
- When watchdog checks fire
- How many events are in the timeline
- Which combatants are found
- When recovery events are generated

Example debug output:
```
[BlinkGame] Scheduled watchdog event 0 at 5
[BlinkGame] Watchdog check at time 5
[BlinkGame] Timeline has 0 events
[BlinkGame] Non-watchdog events: 0
[BlinkGame] Found 2 potential combatants
[BlinkGame] Watchdog: Generating recovery DoAttack event for entity 0
[BlinkGame] Watchdog: Generating recovery DoAttack event for entity 1
[BlinkGame] Scheduled watchdog event 3 at 10
```

## Implementation Details

### Internal Event Type

The watchdog uses the reserved event type `__WATCHDOG__` which:
- Is automatically filtered from user-visible event results
- Does not match any user-defined rules
- Is handled entirely within the game engine

### Performance Impact

The watchdog has minimal performance impact:
- Scheduling overhead: O(log n) per watchdog event (standard heap insertion)
- Check overhead: O(n) where n is the number of entities with required components
- Only activates when the watchdog event fires (configurable interval)
- Typical overhead: < 1% of simulation time with default settings

### Thread Safety

The watchdog is not thread-safe. It should only be used in single-threaded environments (which is the current design of the engine).

## Testing

Comprehensive tests verify watchdog functionality:

1. **Test 1: Default Behavior** - Verifies watchdog is enabled by default
2. **Test 2: Disable Option** - Verifies watchdog can be disabled
3. **Test 3: Hang Recovery** - Simulates a hang and verifies recovery
4. **Test 4: Rescheduling** - Verifies watchdog reschedules itself

Run tests with:
```bash
cd packages/blink-engine
npm run build
node dist/watchdog.test.js
```

## When to Adjust Settings

### Increase Interval (> 5 seconds)

- **Very long battles**: If battles naturally take many minutes, less frequent checks are sufficient
- **Performance-critical scenarios**: When every millisecond counts
- **Stable rules**: When you're confident events won't get lost

### Decrease Interval (< 5 seconds)

- **Fast-paced combat**: When battles complete in seconds
- **Debugging**: To catch hangs more quickly during development
- **Unstable rules**: When testing new or complex rule sets
- **User experience**: For more responsive hang detection

### Disable Completely

- **Testing hang conditions**: When you specifically want to test what happens during a hang
- **Benchmarking**: When measuring pure rule execution performance
- **Deterministic replay**: When you need exact event ordering without watchdog interference

## Troubleshooting

### Watchdog Not Firing

Check that:
1. Watchdog is enabled: `watchdogEnabled: true`
2. Interval is positive: `watchdogInterval > 0`
3. Game is started: `game.start()` was called
4. Time is advancing: Events are being processed

### Watchdog Firing Too Often

Increase the interval:
```typescript
const game = BlinkGame.createSync({
  watchdogInterval: 10.0  // Check every 10 seconds instead
});
```

### Watchdog Not Generating Recovery Events

The watchdog only generates recovery events when:
- No non-watchdog events exist in the timeline
- Entities have all three components: Attack, Target, and Health
- The entity's health is > 0
- The target's health is > 0

Check your entity setup to ensure these conditions can be met.

## Future Enhancements

Possible future improvements:
- Configurable recovery event types (not just `DoAttack`)
- Custom hang detection callbacks
- Watchdog statistics and reporting
- Multiple watchdog strategies for different game modes
- Automatic interval adjustment based on game state
