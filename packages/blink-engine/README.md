# @blink/engine

A pure TypeScript/JavaScript implementation of the Blink Idle RPG engine that runs in browsers.

## Features

- **Standalone**: No server required for gameplay
- **Pure JavaScript**: No WASM, no Rust compilation required
- **Browser DevTools**: Native debugging support
- **Framework Agnostic**: Works with React, Vue, Svelte, vanilla JS, etc.

## Installation

```bash
npm install @blink/engine
```

## Quick Start

```typescript
import { BlinkGame } from '@blink/engine';

// Create game instance
const game = await BlinkGame.create({
  timeScale: 5.0,  // 5x speed
  debug: true
});

// Load game rules (compiled IR)
await game.loadRules('./game.ir.json');

// Subscribe to simulation events
game.onSimulation((event) => {
  if (event.type === 'completed') {
    console.log('Game completed!');
  }
});

game.onSimulation((event) => {
  if (event.type === 'completed') {
    console.log('Game completed!');
  }
});

// Start the game
game.start();
```

## API

### BlinkGame

The main game class that coordinates all engine subsystems.

#### Static Methods

- `BlinkGame.create(options?)` - Create a new game instance (async)
- `BlinkGame.createSync(options?)` - Create a new game instance (sync)

#### Instance Methods

- `loadRules(url)` - Load game rules from a URL
- `loadRulesFromString(json)` - Load game rules from a JSON string
- `loadRulesFromObject(obj)` - Load game rules from a parsed object
- `setInitialState(state)` - Set initial game state
- `start()` - Start the simulation
- `pause()` - Pause the simulation
- `resume()` - Resume paused simulation
- `stop()` - Stop the simulation
- `reset()` - Reset to initial state
- `step()` - Step forward by one event
- `runUntilComplete(maxSteps?)` - Run until no more events
- `getTime()` - Get current simulation time
- `getState()` - Get current game state snapshot
- `query(...componentNames)` - Query entities with components
- `getComponent(entityId, componentName)` - Get component data
- `scheduleEvent(eventType, delay?, options?)` - Schedule an event
- `scheduleRecurringEvent(eventType, interval, options?)` - Schedule a recurring event
- `cancelEvent(eventId)` - Cancel a scheduled or recurring event
- `onSimulation(callback)` - Subscribe to simulation events
- `setTimeScale(scale)` - Set simulation speed
- `destroy()` - Clean up resources

## Recurring Events

The engine supports recurring events that automatically reschedule themselves:

```typescript
// Schedule a health regeneration event every 2 seconds
const regenId = game.scheduleRecurringEvent('Regeneration', 2.0, {
  source: playerId
});

// Later, cancel the recurring event
game.cancelEvent(regenId);
```

This feature aligns with BRL's native `recurring` keyword for scheduled events.

### GameOptions

```typescript
interface GameOptions {
  debug?: boolean;        // Enable debug logging
  timeScale?: number;     // Simulation speed multiplier
  maxEventsPerFrame?: number;  // Max events per frame
}
```

## Architecture

```
@blink/engine/
├── src/
│   ├── index.ts          # Main exports
│   ├── BlinkGame.ts      # Main game class
│   ├── ir/               # IR loading and types
│   │   ├── loader.ts
│   │   └── types.ts
│   ├── timeline/         # Event scheduling
│   │   └── Timeline.ts
│   ├── ecs/              # Entity-Component storage
│   │   └── Store.ts
│   ├── rules/            # Rule execution
│   │   └── Executor.ts
│   └── (trackers removed)
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## IR Format

The engine loads pre-compiled IR (Intermediate Representation) in JSON format:

```json
{
  "version": "1.0",
  "module": "game_name",
  "components": [...],
  "rules": [...],
  "functions": [...],
  "trackers": [...],
  "initial_state": {...}
}
```

See [IR Specification](../../doc/ir-specification.md) for full format details.

## License

MIT
