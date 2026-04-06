# WASM Engine & Web Integration Design

*Status: Implementation guide — all decisions are final unless noted*

---

## Overview

This document defines the complete design for integrating the Blink game engine with the web player app (`game/app/`). 

### Goals

- **Checkpoint-driven UI**: The simulation runs to completion, capturing state at N=30 defined progress checkpoints. The UI replays these snapshots at one per second so the player watches the battle unfold over ~30 seconds regardless of how fast the simulation actually runs.
- **Engine abstraction**: The WASM engine (`blink-runtime` compiled via `wasm-pack`) is the sole engine. Game rules are compiled from BRL → Rust → WASM. Entity data (heroes, enemies, config) is injected at runtime via `create_entity`/`add_component`. See `doc/WORKFLOW.md` for the full architecture.
- **Simple player flow**: No BRL editing. Players pick a game mode and a party of heroes, the simulation runs, and the results are shown.
- **Mobile-first**: Single-page app built on React 19 + Vite + Tailwind CSS, targeting 375 px phone screens.

---

## 2. N-Step Checkpoint System

### 2.1 What a Checkpoint Is

A *checkpoint* is a point during the simulation where the engine captures a `GameSnapshot` (score, tier, wave, hero levels, enemies defeated). The UI receives N snapshots and displays them sequentially at 1-second intervals.

### 2.2 N = 30 Checkpoints

The game defines **N = 30** progress checkpoints for a standard run.

Checkpoints fire in the BRL rules every **10 enemies defeated** via the `ProgressCheckpoint` event. A normal game runs until Lord Vexar (the tier-6 final boss) is defeated, which takes roughly 300 enemy kills — yielding 30 evenly-spaced checkpoints.

The `ProgressTracker` component on the game-state entity tracks the checkpoint counter and threshold.

### 2.3 BRL Events and Component

```
component ProgressTracker {
    checkpointInterval: integer   // enemies per checkpoint (default: 10)
    checkpointsReached: integer   // counter of checkpoints fired so far
    totalCheckpoints: integer     // target N (default: 30)
}

event ProgressCheckpoint {
    step: integer        // checkpoint number 1..N
    enemiesDefeated: integer
    simulationTime: float
}
```

The rule fires on each `EnemyDefeated` event:

```brl
rule check_progress_checkpoint on EnemyDefeated(ed: id) {
    if entity has ProgressTracker {
        let threshold = (entity.ProgressTracker.checkpointsReached + 1)
                        * entity.ProgressTracker.checkpointInterval
        if entity.GameState.enemiesDefeated >= threshold {
            entity.ProgressTracker.checkpointsReached += 1
            schedule ProgressCheckpoint {
                step: entity.ProgressTracker.checkpointsReached
                enemiesDefeated: entity.GameState.enemiesDefeated
                simulationTime: entity.RunStats.simulationTime
            }
        }
    }
}
```

### 2.4 Snapshot Format

The engine captures the following KPIs at each checkpoint:

```typescript
interface GameSnapshot {
  step: number;                    // 1..N
  simulationTime: number;          // in-game seconds
  enemiesDefeated: number;
  score: number;
  currentTier: number;
  currentWave: number;
  heroLevels: Record<string, number>;  // name → level
  bossesDefeated: number;
  playerDeaths: number;
  isGameOver: boolean;
  victory: boolean;
}
```

### 2.5 Replay Timing

```
Simulation runs to completion (~300 ms wall-clock)
         ↓
Snapshots array [s0, s1, ..., s30] captured
         ↓
UI starts replay loop:
  show s0 immediately
  every 1 000 ms: advance to next snapshot
  → total display time ≈ 30 seconds
```

The player sees the game "play out" in 30 animated steps even though the simulation completed almost instantly.

---

## 3. Engine Abstraction Interface

Both the current JS engine and the future WASM engine implement `ISimEngine`:

```typescript
interface ISimEngine {
  /** Load compiled IR. */
  loadIR(ir: unknown): void;

  /** Schedule the initial game event and begin. */
  start(): void;

  /** Run to completion and return all captured snapshots. */
  runToEnd(maxSteps?: number): Promise<GameSnapshot[]>;

  /** Clean up resources. */
  destroy(): void;
}
```

### 3.1 JS Engine Adapter

> **Note:** The JS engine has been removed. The only engine is the Rust/WASM engine.
> The original JS adapter description is kept below for historical context.

`game/app/src/engine/JsEngine.ts` (REMOVED) wrapped `@blink/engine`'s `BlinkGame`:

```typescript
class JsEngine implements ISimEngine {
  private game: BlinkGame;

  async runToEnd(maxSteps = 500_000): Promise<GameSnapshot[]> {
    const snapshots: GameSnapshot[] = [];

    // Subscribe to checkpoint events
    const unsub = this.game.onSimulation(event => {
      if (event.type === 'step' && event.event?.eventType === 'ProgressCheckpoint') {
        snapshots.push(this.captureSnapshot(event.event));
      }
    });

    this.game.scheduleEvent('GameStart', 0);
    this.game.runUntilComplete(maxSteps);
    unsub();

    // Append final state
    snapshots.push(this.captureFinalSnapshot());
    return snapshots;
  }
}
```

### 3.2 WASM Engine Adapter (v2)

When `packages/blink-runtime` is compiled to WASM via `wasm-pack`:

```typescript
class WasmEngine implements ISimEngine {
  private worker: Worker;

  async runToEnd(): Promise<GameSnapshot[]> {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        if (e.data.type === 'complete') resolve(e.data.snapshots);
        if (e.data.type === 'error') reject(e.data.error);
      };
      this.worker.postMessage({ type: 'run' });
    });
  }
}
```

The Web Worker runs the WASM engine in a background thread so it never blocks the UI.

---

## 4. Application Flow

```
HomeScreen
    ↓ "Start a Run"
ModeSelectScreen (Normal / Casual / Hardcore / Speed Run / Endless)
    ↓ mode chosen
PartySelectScreen (pick 1–6 heroes from 6 pre-built classes)
    ↓ "Run!"
  [simulation runs to completion, snapshots captured]
BattleScreen (30-second animated replay)
    ↓ simulation finishes OR "Skip"
ResultsScreen (final KPIs, score, share)
```

---

## 5. Pre-built Hero Definitions

For v1, the web app ships with 6 pre-built hero definitions (one per class). These are loaded directly into the engine as entity definitions before the simulation starts — they are not read from QR codes.

```typescript
const HEROES: HeroDefinition[] = [
  { name: 'Aldric',  class: 'Warrior', ... },
  { name: 'Lyra',   class: 'Mage',    ... },
  { name: 'Sasha',  class: 'Ranger',  ... },
  { name: 'Theron', class: 'Paladin', ... },
  { name: 'Kira',   class: 'Rogue',   ... },
  { name: 'Elara',  class: 'Cleric',  ... },
];
```

---

## 6. IR Loading

The compiled IR is served as a static JSON file from the web app's `public/` directory:

```
game/app/public/
└── ir/
    ├── classic-rpg.ir.json     ← compiled from game/brl/*.brl
    └── scenario-normal.ir.json ← compiled from game/brl/scenario-normal.brl
```

The app fetches the IR at run start:

```typescript
const ir = await fetch('/ir/classic-rpg.ir.json').then(r => r.json());
await engine.loadIR(ir);
```

The Makefile `compile-brl` target outputs IR files to `game/app/public/ir/` as part of the build process.

---

## 7. Battle Screen UI

```
┌─────────────────────────────┐
│  🐉  Blink Idle RPG         │  title
├─────────────────────────────┤
│  Step 12 / 30               │  progress indicator
│  ████████░░░░░░░░░░░░  40%  │  progress bar
├─────────────────────────────┤
│  Tier 2 · Wave 47           │
│  Score  ██████ 4,230        │  animated score counter
│  Kills  87                  │
│  Bosses 1                   │
│  Deaths 2                   │
├─────────────────────────────┤
│  Hero Levels                │
│  ⚔️ Aldric   Lv 8           │
│  🧙 Lyra     Lv 7           │
│  🏹 Sasha    Lv 7           │
│  🙏 Elara    Lv 6           │
├─────────────────────────────┤
│  [ ⏭ Skip to Results ]     │
└─────────────────────────────┘
```

- Each second: advance to the next snapshot, animate score change.
- "Skip to Results" jumps immediately to the final snapshot and results screen.
- On the final checkpoint: auto-navigate to ResultsScreen after a 1-second pause.

---

## 8. Build Pipeline

```
make compile-brl          → compile game/brl/*.brl → game/app/public/ir/
cd game/app && npm install → install deps
cd game/app && npm run build → Vite bundles React app (WASM loaded from public/wasm/)
```

The WASM build (v2, when ready):

```
cd packages/blink-runtime && wasm-pack build --target web
cp pkg/ game/app/public/wasm/
```

---

## 9. Key Decisions (resolved open issues from `web-interface-design.md`)

| Issue | Decision |
|---|---|
| OI-1 (engine choice) | JS engine for v1; WASM engine for v2 (same `ISimEngine` interface) |
| OI-2 (stat value range) | 4-bit base stats (0–15), 3-bit growth rates (0–7) |
| OI-5 (behaviour bytes) | 12 named decision fields; bytes 12–23 reserved |
| OI-6 (roster persistence) | `localStorage` for v1 (heroes are small) |
| OI-8 (multi-player) | Local-only for v1 |
| OI-9 (WASM/JS threading) | WASM runs in Web Worker; JS runs on main thread (fast enough) |
| OI-14 (Worker for JS) | Deferred; JS engine stays on main thread for v1 |
| Battle screen complexity | Simplified: show step progress, aggregate KPIs, hero levels |
| N checkpoints | **N = 30**, one per 10 enemies defeated |
| Replay timing | 1 second per checkpoint; total ~30 seconds |
