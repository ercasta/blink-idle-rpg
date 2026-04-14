# BRL Source Files

Blink Rule Language (BRL) source files for the game.  BRL is used for both
**game rules** (components, events, rules) and **game data** (entity definitions).

---

## Files

| File | Description |
|------|-------------|
| `classic-rpg.brl` | All game rules: components, events, rules, helper functions |
| `heroes.brl` | Hero AI behaviour functions (`select_attack_target`, `select_combat_skill`) |
| `hero-classes.brl` | Hero class balance data: base combat stats, starting skills, growth vectors, element threshold |
| `enemies.brl` | Enemy entity definitions (templates for each enemy type) |
| `game-config.brl` | Default game configuration entities (game state, flee config) |
| `scenario-easy.brl` | Easy difficulty overrides (spawn rate, scaling, penalties) |
| `scenario-normal.brl` | Normal difficulty configuration (canonical balanced values) |
| `scenario-hard.brl` | Hard difficulty overrides |
| `story-mode.brl` | Story mode components (StoryConfig, MapLocation, TravelState) — extends classic-rpg.brl |
| `story-adventure.brl` | Adventure quest components (`AdventureState`, `QuestMilestone`, etc.) and composition rules — *planned* |
| `story-adventure-templates.brl` | Objective, milestone, and event template entities — *planned* |
| `story-adventure-pools.brl` | NPC, villain, item, location, and creature pool entities — *planned* |
| `story-adventure-rules.brl` | Custom event rules (duel, search, etc.) — *planned* |
| `story-world.brl` | World system components (`WorldLocation`, `WorldPath`, `WorldNpc`, `HeroArrivalComment`, `LocationBuff`, `BlockingEncounter`, `NpcRoleAssignment`) — see [world-design.md](../../doc/game-design/world-design.md) |
| `story-world-data.brl` | World entity data: 15 named locations, 25 paths, 20 NPCs, 40 hero arrival comments, 6 blocking encounters |
| `adventure-expansion-set-1.brl` | Adventure expansion set 1: 30 hero-matched encounter templates (class + trait), matching rules, buff system |
| `test-heroes.brl` | Two hero entities (Warrior + Mage) used by the test harness only |

---

## Where Data is Stored

### Enemy configuration

**Source of truth:** `game/brl/enemies.brl`

Each enemy is a BRL entity with an `EnemyTemplate { isTemplate: true }` component.
At runtime the game **clones** the matching template entity when spawning a new enemy.
The spawning rules in `classic-rpg.brl` (`spawn_enemy_from_template`,
`spawn_lord_vexar`) select templates by `Enemy.tier` or `FinalBoss` component.

Enemy stat fields come directly from BRL component values (see `game-config.brl`
for component definitions):

```
enemies.brl  →  BRL entity  →  clone at runtime  →  live enemy entity
```

A human-readable JSON mirror lives at `game/data/enemies.json`.  This file is
**not** loaded by the game engine; it exists as documentation and as the data
source for the React app's UI (hero/enemy descriptions in party selection).

### Enemy wave / spawn configuration

**Source of truth:** `game/brl/scenario-*.brl`

Each scenario file defines a `game_state` entity that carries a `SpawnConfig`
component with these tuning values:

| Field | Normal | Easy | Hard |
|-------|--------|------|------|
| `initialEnemyCount` | 5 | 3 | 7 |
| `bossEveryKills` | 100 | 150 | 75 |
| `tierProgressionKills` | 50 | 75 | 40 |
| `healthScaleRate` | 200 | 100 | 300 |
| `damageScaleRate` | 300 | 150 | 450 |
| `maxTier` | 6 | 6 | 6 |
| `wavesPerTier` | 300 | 300 | 300 |

The spawn rules in `classic-rpg.brl` read these values at runtime.

### Hero definitions

**Source of truth for AI rules:** `game/brl/heroes.brl` (AI behaviour functions)

**Source of truth for class balance:** `game/brl/hero-classes.brl` (base combat
stats, starting skills, stat growth vectors, element threshold)

Hero entities are **not** stored in BRL for the production game — they are
created at runtime from the player's party selection in the React app
(`game/app/src/engine/WasmSimEngine.ts`, `game/app/src/data/heroes.ts`).
Class balance data is loaded from `hero-classes.brl` at runtime via
`heroClassData.ts` using the `brlParser.ts` utility.

`game/brl/test-heroes.brl` defines two hero entities (Aldric/Warrior and
Lyra/Mage) **for the test harness only** so `npm run test:harness` can run a
fully playable simulation without the React app.

### Game state and scoring

Defined in `game/brl/scenario-*.brl` (or `game-config.brl` for defaults).
Scoring parameters live in `WasmSimEngine.ts` (TypeScript constants mirrored
from `game/data/game-modes.json`).

---

## How Data is Loaded into the Game

```
┌─────────────────────────────────────────────────────────────────┐
│  Build time                                                      │
│                                                                  │
│  game/brl/*.brl  ──compile──▶  BRL → Rust → WASM binary        │
│    (rules + AI functions baked in)                               │
└──────────────────────────────┬──────────────────────────────────┘
                               │ deploy
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Runtime (browser)                                               │
│                                                                  │
│  React app  ──party select──▶  WasmSimEngine.ts                 │
│                                   │                             │
│                           create_entity / add_component         │
│                           (heroes, enemies, game config)        │
│                                   │                             │
│                           WASM engine  ◀── game/data/enemies.json│
│                           (rules already compiled in)           │
│                                   │                             │
│                           schedules GameStart                   │
│                                   │                             │
│                           runs simulation                       │
│                                   │                             │
│                           returns checkpoints to React          │
└─────────────────────────────────────────────────────────────────┘
```

**BRL → WASM:**  `npm run build:wasm` compiles all BRL rules to Rust source via
the TypeScript compiler, then `wasm-pack` produces `blink_rpg_wasm.js` + `.wasm`.
The rules are baked into the binary; no BRL is needed at runtime.

**Entity injection:**  The React app creates entities by calling
`wasmGame.create_entity(id)` and `wasmGame.add_component(id, name, fieldsJson)`
before scheduling `GameStart`.  This allows the player's chosen heroes and the
selected difficulty's spawn config to be injected without recompiling the WASM.

**Enemy templates:**  Enemy template entities (Goblin Scout … Dragon Lord Vexar)
are also injected at runtime from the constants in `WasmSimEngine.ts`, which
mirror the values in `game/brl/enemies.brl` and `game/data/enemies.json`.

**Web app game-files:**  Some BRL/BCL files are served as static assets by the
web app (e.g. `skill-catalog.brl` is fetched at runtime for skill descriptions).
These files are copied automatically from `game/brl/` and `game/bcl/` into
`game/app/public/game-files/` by `npm run copy-game-files` (run automatically
as part of `npm run dev:app` and `npm run build:app`).  Do **not** edit the
copies in `public/game-files/` directly — always edit the source files here.

---

## Compiling

```bash
npm run compile-brl    # compile BRL to IR (for React app)
npm run test:harness   # compile BRL to Rust native binary and run tests
npm run build:wasm     # compile BRL to WASM for the browser
```
