# Browser Engine Implementation

**Version**: 0.1.0-draft  
**Status**: Draft  
**Last Updated**: 2024-12-31

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [JavaScript API](#javascript-api)
4. [WASM Integration](#wasm-integration)
5. [Game Client Integration](#game-client-integration)
6. [Performance Optimization](#performance-optimization)
7. [Development Setup](#development-setup)
8. [Implementation Roadmap](#implementation-roadmap)

---

## 1. Overview

The Browser Engine is a JavaScript/WASM implementation of the Blink Engine that runs entirely in a web browser. This is the primary target for the game client.

### Goals

1. **Standalone**: No server required for gameplay
2. **Responsive**: Smooth UI updates during simulation
3. **Portable**: Works across modern browsers
4. **Debuggable**: Good developer experience

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Core Engine | Rust → WASM | Performance-critical simulation |
| JS Bindings | wasm-bindgen | Rust/JS interop |
| API Layer | TypeScript | Developer-friendly interface |
| Build | wasm-pack | WASM packaging |

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER ENVIRONMENT                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     GAME CLIENT (JS/TS)                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │   UI Layer   │  │  Game Loop   │  │  Asset Manager   │   │   │
│  │  │  (React/Vue) │  │  (rAF-based) │  │                  │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │   │
│  │         │                 │                    │             │   │
│  │         └─────────────────┼────────────────────┘             │   │
│  │                           │                                  │   │
│  │                           ▼                                  │   │
│  │  ┌───────────────────────────────────────────────────────┐   │   │
│  │  │              @blink/engine (TypeScript API)           │   │   │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐   │   │   │
│  │  │  │ BlinkGame   │  │ EventStream  │  │ StateQuery  │   │   │   │
│  │  │  └─────────────┘  └──────────────┘  └─────────────┘   │   │   │
│  │  └───────────────────────────┬───────────────────────────┘   │   │
│  │                              │                               │   │
│  └──────────────────────────────┼───────────────────────────────┘   │
│                                 │                                   │
│                                 ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   WASM MODULE (Rust)                        │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │  Timeline   │  │  ECS Store   │  │  Rule Engine     │   │   │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘   │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │  BCL Interp │  │  IR Executor │  │  Tracker Output  │   │   │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Threading Model

```
┌─────────────────┐         ┌─────────────────┐
│   Main Thread   │         │   Web Worker    │
│                 │         │   (optional)    │
│  • UI Rendering │  msg    │                 │
│  • User Input   │ ◄─────► │  • Simulation   │
│  • Animation    │         │  • Heavy compute│
│                 │         │                 │
└─────────────────┘         └─────────────────┘
```

For simple games, simulation runs on the main thread. For complex simulations, a Web Worker can be used.

---

## 3. JavaScript API

### 3.1 Package Structure

```
@blink/engine/
├── index.ts              # Main exports
├── BlinkGame.ts          # Main game class
├── types/                # TypeScript definitions
│   ├── components.ts
│   ├── events.ts
│   └── state.ts
├── wasm/                 # WASM bindings
│   └── blink_engine_bg.wasm
└── utils/                # Helper utilities
```

### 3.2 Core Classes

#### BlinkGame

```typescript
class BlinkGame {
  /**
   * Create a new game instance
   */
  static async create(options: GameOptions): Promise<BlinkGame>;
  
  /**
   * Load compiled game rules (BRL → IR)
   */
  async loadRules(rulesUrl: string): Promise<void>;
  async loadRulesFromBuffer(buffer: ArrayBuffer): Promise<void>;
  
  /**
   * Load player choices (BCL)
   */
  async loadChoices(bclSource: string): Promise<void>;
  
  /**
   * Set initial game state
   */
  setInitialState(state: GameState): void;
  
  /**
   * Start the simulation
   */
  start(): void;
  
  /**
   * Pause the simulation
   */
  pause(): void;
  
  /**
   * Resume paused simulation
   */
  resume(): void;
  
  /**
   * Stop and reset the simulation
   */
  stop(): void;
  
  /**
   * Step forward by one event
   */
  step(): StepResult | null;
  
  /**
   * Get current simulation time
   */
  getTime(): number;
  
  /**
   * Get current game state
   */
  getState(): GameStateSnapshot;
  
  /**
   * Query entities with specific components
   */
  query<T extends ComponentType[]>(...components: T): QueryResult<T>;
  
  /**
   * Subscribe to tracker events
   */
  onTracker(callback: (event: TrackerEvent) => void): Unsubscribe;
  
  /**
   * Subscribe to simulation events
   */
  onSimulation(callback: (event: SimulationEvent) => void): Unsubscribe;
  
  /**
   * Set time scale (1.0 = real time)
   */
  setTimeScale(scale: number): void;
  
  /**
   * Destroy the game instance and free resources
   */
  destroy(): void;
}
```

### 3.3 Type Definitions

```typescript
interface GameOptions {
  /** Enable debug mode */
  debug?: boolean;
  
  /** Time scale (default: 1.0) */
  timeScale?: number;
  
  /** Use Web Worker for simulation */
  useWorker?: boolean;
  
  /** Maximum events per frame */
  maxEventsPerFrame?: number;
}

interface GameState {
  entities: EntityDefinition[];
}

interface EntityDefinition {
  id?: string;
  components: Record<string, ComponentData>;
}

interface ComponentData {
  [field: string]: string | number | boolean | null;
}

interface GameStateSnapshot {
  time: number;
  entities: Map<EntityId, EntitySnapshot>;
}

interface EntitySnapshot {
  id: EntityId;
  components: Map<string, ComponentData>;
}

interface StepResult {
  time: number;
  event: EventInfo;
  trackerOutput: TrackerEvent[];
}

interface TrackerEvent {
  time: number;
  trackerId: string;
  type: 'message' | 'value' | 'state_change' | 'custom';
  data: unknown;
}

interface SimulationEvent {
  type: 'started' | 'paused' | 'resumed' | 'stopped' | 'completed' | 'error';
  time?: number;
  error?: Error;
}

type Unsubscribe = () => void;
```

### 3.4 Usage Example

```typescript
import { BlinkGame } from '@blink/engine';

async function main() {
  // Create game instance
  const game = await BlinkGame.create({
    timeScale: 10.0,  // 10x speed
    debug: true
  });
  
  // Load game rules
  await game.loadRules('/rules/combat.blink');
  
  // Load player choices
  await game.loadChoices(`
    party {
      warrior { class: "Fighter", name: "Hero" }
    }
    
    choice fn select_target(enemies: list): id {
      return enemies[0].id
    }
  `);
  
  // Set initial state
  game.setInitialState({
    entities: [
      {
        id: 'enemy_1',
        components: {
          Character: { name: 'Goblin', level: 1 },
          Health: { current: 20, maximum: 20 }
        }
      }
    ]
  });
  
  // Subscribe to combat log
  game.onTracker((event) => {
    if (event.type === 'message') {
      console.log(`[${event.time.toFixed(2)}s] ${event.data}`);
    }
  });
  
  // Subscribe to simulation events
  game.onSimulation((event) => {
    if (event.type === 'completed') {
      console.log('Game completed!');
    }
  });
  
  // Start the game
  game.start();
}

main().catch(console.error);
```

---

## 4. WASM Integration

### 4.1 Rust-to-WASM Compilation

Using `wasm-pack` and `wasm-bindgen`:

```rust
// src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmEngine {
    engine: BlinkEngine,
}

#[wasm_bindgen]
impl WasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmEngine {
        WasmEngine {
            engine: BlinkEngine::new()
        }
    }
    
    pub fn load_rules(&mut self, ir_bytes: &[u8]) -> Result<(), JsValue> {
        self.engine.load_rules_from_bytes(ir_bytes)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    pub fn step(&mut self) -> JsValue {
        match self.engine.step() {
            Some(result) => serde_wasm_bindgen::to_value(&result).unwrap(),
            None => JsValue::NULL
        }
    }
    
    pub fn get_state(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.engine.get_state()).unwrap()
    }
    
    pub fn drain_tracker_output(&mut self) -> JsValue {
        let output = self.engine.drain_tracker_output();
        serde_wasm_bindgen::to_value(&output).unwrap()
    }
}
```

### 4.2 Memory Management

```typescript
// TypeScript wrapper handles WASM memory
class WasmBridge {
  private engine: WasmEngine;
  private memory: WebAssembly.Memory;
  
  async init(): Promise<void> {
    const wasm = await import('./wasm/blink_engine');
    this.engine = new wasm.WasmEngine();
    this.memory = wasm.memory;
  }
  
  destroy(): void {
    this.engine.free();  // Release WASM memory
  }
}
```

### 4.3 Data Transfer

Minimize JS/WASM boundary crossings:

```typescript
// BAD: Many small calls
for (const entity of entities) {
  const health = engine.get_component(entity.id, 'Health');
  // Process health...
}

// GOOD: Batch query
const snapshot = engine.get_state();  // Single call
for (const [id, entity] of snapshot.entities) {
  const health = entity.components.get('Health');
  // Process health...
}
```

---

## 5. Game Client Integration

### 5.1 React Integration

```tsx
import { BlinkGame } from '@blink/engine';
import { useEffect, useState, useRef } from 'react';

function useBlinkGame(rulesUrl: string, choices: string) {
  const gameRef = useRef<BlinkGame | null>(null);
  const [state, setState] = useState<GameStateSnapshot | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    let mounted = true;
    
    async function init() {
      const game = await BlinkGame.create({ timeScale: 5.0 });
      await game.loadRules(rulesUrl);
      await game.loadChoices(choices);
      
      if (!mounted) {
        game.destroy();
        return;
      }
      
      game.onTracker((event) => {
        if (event.type === 'message') {
          setLogs(prev => [...prev, event.data as string]);
        }
      });
      
      game.onSimulation(() => {
        setState(game.getState());
      });
      
      gameRef.current = game;
    }
    
    init();
    
    return () => {
      mounted = false;
      gameRef.current?.destroy();
    };
  }, [rulesUrl, choices]);
  
  return {
    game: gameRef.current,
    state,
    logs,
    start: () => gameRef.current?.start(),
    pause: () => gameRef.current?.pause(),
    resume: () => gameRef.current?.resume(),
  };
}

function GameComponent() {
  const { game, state, logs, start, pause } = useBlinkGame(
    '/rules/game.blink',
    playerChoices
  );
  
  return (
    <div>
      <button onClick={start}>Start</button>
      <button onClick={pause}>Pause</button>
      
      <div className="health-bars">
        {state?.entities.forEach((entity, id) => {
          const health = entity.components.get('Health');
          if (health) {
            return <HealthBar key={id} health={health} />;
          }
        })}
      </div>
      
      <div className="combat-log">
        {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>
    </div>
  );
}
```

### 5.2 Game Loop Integration

```typescript
class GameRenderer {
  private game: BlinkGame;
  private lastTime: number = 0;
  private animationFrame: number = 0;
  
  start() {
    this.game.start();
    this.animationFrame = requestAnimationFrame(this.loop.bind(this));
  }
  
  private loop(time: number) {
    const delta = time - this.lastTime;
    this.lastTime = time;
    
    // Update UI based on current state
    this.render(this.game.getState());
    
    // Continue loop
    this.animationFrame = requestAnimationFrame(this.loop.bind(this));
  }
  
  private render(state: GameStateSnapshot) {
    // Update health bars, positions, animations...
  }
  
  stop() {
    cancelAnimationFrame(this.animationFrame);
    this.game.stop();
  }
}
```

---

## 6. Performance Optimization

### 6.1 Frame Budget

Target 60fps = 16.67ms per frame

```
┌─────────────────────────────────────────┐
│         16.67ms Frame Budget            │
├─────────────────────────────────────────┤
│ Simulation:     ~4ms (25%)              │
│ State Transfer: ~2ms (12%)              │
│ UI Update:      ~8ms (48%)              │
│ Buffer:         ~2ms (15%)              │
└─────────────────────────────────────────┘
```

### 6.2 Batching Events

```typescript
const MAX_EVENTS_PER_FRAME = 100;

function processFrame() {
  let eventsProcessed = 0;
  
  while (eventsProcessed < MAX_EVENTS_PER_FRAME) {
    const result = game.step();
    if (!result) break;
    eventsProcessed++;
  }
  
  // Now update UI once
  updateUI(game.getState());
}
```

### 6.3 Differential Updates

```typescript
class DiffTracker {
  private previousState: Map<EntityId, EntitySnapshot>;
  
  getDiff(newState: GameStateSnapshot): StateDiff {
    const diff: StateDiff = {
      added: [],
      removed: [],
      changed: []
    };
    
    // Compare and generate minimal diff
    // ...
    
    return diff;
  }
}
```

### 6.4 Web Worker Usage

For complex simulations:

```typescript
// main.ts
const worker = new Worker('simulation-worker.js');

worker.postMessage({ type: 'init', rules: rulesBuffer });
worker.postMessage({ type: 'start' });

worker.onmessage = (event) => {
  if (event.data.type === 'state') {
    updateUI(event.data.state);
  }
};

// simulation-worker.js
import { BlinkGame } from '@blink/engine';

let game: BlinkGame;

self.onmessage = async (event) => {
  switch (event.data.type) {
    case 'init':
      game = await BlinkGame.create({ useWorker: false });
      await game.loadRulesFromBuffer(event.data.rules);
      break;
      
    case 'start':
      runSimulation();
      break;
  }
};

function runSimulation() {
  setInterval(() => {
    for (let i = 0; i < 100; i++) {
      game.step();
    }
    self.postMessage({ type: 'state', state: game.getState() });
  }, 16);
}
```

---

## 7. Development Setup

### 7.1 Prerequisites

- Node.js 18+
- Rust 1.70+
- wasm-pack

### 7.2 Build Commands

```bash
# Install dependencies
npm install

# Build WASM module
wasm-pack build --target web

# Build TypeScript
npm run build

# Run tests
npm test

# Development server
npm run dev
```

### 7.3 Project Structure

```
packages/
├── blink-engine-wasm/      # Rust WASM core
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
├── blink-engine/           # TypeScript API
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── BlinkGame.ts
│       └── wasm/           # Generated WASM bindings
└── example-client/         # Example game client
    ├── package.json
    └── src/
        └── main.ts
```

---

## 8. Implementation Roadmap

### Phase 1: Core Engine (MVP)
**Target**: Minimal working simulation

- [ ] Basic timeline implementation
- [ ] Simple ECS store
- [ ] Event scheduling (immediate + delayed)
- [ ] Rule execution
- [ ] WASM compilation setup

**Deliverable**: Can run simple combat simulation

### Phase 2: JavaScript API
**Target**: Usable from browser

- [ ] TypeScript API design
- [ ] wasm-bindgen integration
- [ ] State snapshot API
- [ ] Tracker event streaming
- [ ] Basic documentation

**Deliverable**: NPM package with working API

### Phase 3: BCL Support
**Target**: Player choices work

- [ ] BCL parser (subset of BRL)
- [ ] BCL interpreter
- [ ] Choice function integration
- [ ] Party definition support

**Deliverable**: Players can define strategies

### Phase 4: Performance
**Target**: Production-ready performance

- [ ] Batch processing
- [ ] Memory optimization
- [ ] Web Worker support
- [ ] Profiling tools

**Deliverable**: 60fps on target hardware

### Phase 5: Developer Experience
**Target**: Easy game development

- [ ] Hot reloading
- [ ] Debug visualization
- [ ] Error messages
- [ ] Example projects

**Deliverable**: Complete development workflow

---

## Appendix A: Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | Full |
| Firefox | 89+ | Full |
| Safari | 15+ | Full |
| Edge | 90+ | Full |

Required features:
- WebAssembly
- ES2020
- Optional: SharedArrayBuffer, Web Workers

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2024-12-31 | Initial draft |
