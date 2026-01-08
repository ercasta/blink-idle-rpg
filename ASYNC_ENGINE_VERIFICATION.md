# Async Engine Verification for RPG Demo

## Overview

This document describes how the async engine from PR #93 has been applied to the main RPG game and how to verify it's working correctly.

## What is the Async Engine?

The async engine processes game events in batches with periodic yields to the browser's event loop, preventing UI blocking during heavy event processing. This was implemented in PR #93 to solve the "Page Unresponsive" issue during combat scenarios.

## Key Features

1. **Batch Processing**: Events are processed in batches of 10 at a time
2. **Async Yields**: After each batch, control yields back to the browser using `setTimeout(0)`
3. **UI Responsiveness**: The browser can handle user input and render updates between batches
4. **Same Accuracy**: Simulation timeline and event ordering remain unchanged

## Implementation Details

### In BlinkGame.ts

The async engine is implemented in `packages/blink-engine/src/BlinkGame.ts`:

```typescript
private async gameLoop(): Promise<void> {
  // ... setup code ...
  
  const BATCH_SIZE = 10; // Process 10 events at a time
  
  while (totalEventsProcessed < maxEventsPerFrame && hasEvents()) {
    // Process a batch of events
    let batchCount = 0;
    while (batchCount < BATCH_SIZE && hasMoreEvents()) {
      this.step(); // Process one event
      batchCount++;
      totalEventsProcessed++;
    }
    
    // Yield control back to the browser
    if (hasMoreEvents()) {
      await this.yieldToUI();
    }
  }
}

private yieldToUI(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
```

### In RPG Demo

The RPG demo (`game/demos/rpg-demo.html`) is configured to work with the async engine:

```javascript
game = BlinkEngine.BlinkGame.createSync({
  debug: true,
  msPerFrame: parseFloat(speedSlider.value) * 16,
  maxEventsPerFrame: 1000  // Max events per frame before yielding
});
```

## Verification Steps

### 1. Build the Bundles

The async engine code is in the TypeScript source. Build the bundles to include it:

```bash
make dev-setup
```

This creates:
- `game/demos/blink-engine.bundle.js` (with async engine)
- `game/demos/blink-compiler.bundle.js`

### 2. Verify Bundle Contents

Verify the async features are in the bundle:

```bash
# Check for async gameLoop
grep "async gameLoop" game/demos/blink-engine.bundle.js

# Check for BATCH_SIZE constant
grep "BATCH_SIZE = 10" game/demos/blink-engine.bundle.js

# Check for yieldToUI method
grep "yieldToUI()" game/demos/blink-engine.bundle.js
```

All three checks should return results.

### 3. Test the RPG Demo

Start a local web server and test the RPG demo:

```bash
cd game/demos
npx serve .
# Open http://localhost:3000/rpg-demo.html
```

### 4. Verify UI Responsiveness

During gameplay, verify the async engine is working:

1. **Start a Battle**: Click "Start Battle" to begin combat
2. **Heavy Processing**: Watch for combat with many events (multiple enemies, many attacks)
3. **Test UI Interaction**: While combat is running:
   - Try clicking buttons (Pause, Speed controls)
   - Try scrolling the log
   - Try hovering over elements
4. **Expected Behavior**:
   - ✅ UI should remain responsive
   - ✅ No "Page Unresponsive" warnings
   - ✅ Buttons respond immediately
   - ✅ Scrolling is smooth
   - ✅ Log updates in real-time

### 5. Test the Async Test Page

For a dedicated async engine test, try the async test demo:

```bash
cd game/demos
npx serve .
# Open http://localhost:3000/async-test.html
```

This page specifically tests:
- Rapid event chain processing
- UI interaction during simulation
- Real-time counter updates
- Event log updates

## Performance Characteristics

Based on testing from PR #93:

- **Batch Size**: 10 events per batch (tunable via BATCH_SIZE constant)
- **Yield Overhead**: ~1-2ms per yield (setTimeout scheduling)
- **Total Overhead**: <5% for typical event rates
- **UI Update Frequency**: Browser can render every ~10-20 events instead of every 100+

## Troubleshooting

### UI Still Feels Unresponsive

If the UI still feels unresponsive during heavy processing:

1. **Check Bundle**: Verify the bundle was built with the async code:
   ```bash
   grep "async gameLoop" game/demos/blink-engine.bundle.js
   ```

2. **Reduce Batch Size**: Edit `BlinkGame.ts` and reduce `BATCH_SIZE` from 10 to 5:
   ```typescript
   const BATCH_SIZE = 5; // More frequent yields
   ```
   Then rebuild: `cd packages/blink-engine && npm run build && npm run build:bundle`

3. **Reduce Events Per Frame**: Lower `maxEventsPerFrame` in rpg-demo.html:
   ```javascript
   maxEventsPerFrame: 100  // Instead of 1000
   ```

### Bundle Not Found

If the browser can't find `blink-engine.bundle.js`:

1. **Check Bundle Exists**:
   ```bash
   ls -l game/demos/blink-engine.bundle.js
   ```

2. **Rebuild If Missing**:
   ```bash
   make dev-setup
   ```

3. **Check Path**: Ensure rpg-demo.html references the correct path:
   ```html
   <script src="blink-engine.bundle.js"></script>
   ```

## Technical Notes

### Why Bundles Are Not Committed

The bundles (`*.bundle.js`) are in `.gitignore` (line 32) and are not tracked in git because:

1. They are generated artifacts (per "never version derived code" policy)
2. They can be regenerated from source with `make dev-setup`
3. Prevents stale file issues and merge conflicts
4. Reduces repository size

**Important**: Users must build bundles locally before running demos:
```bash
make dev-setup
```

You can verify bundles are not tracked with:
```bash
git ls-files game/demos/*.bundle.js  # Should return nothing
```

### Backward Compatibility

The async engine is **fully backward compatible**:
- All existing games and demos work without modification
- The public API remains unchanged
- Event ordering and timing are preserved
- Synchronous methods like `step()` still work

## References

- [Async Engine Documentation](../docs/async-engine.md) - Detailed documentation from PR #93
- [Engine Architecture](../doc/engine/architecture.md) - Overall engine architecture
- [BlinkGame.ts](../packages/blink-engine/src/BlinkGame.ts) - Source code with async implementation
