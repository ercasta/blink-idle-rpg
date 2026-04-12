# Learning Path: Game Designer

This guide is for game designers implementing **new game logic** in BRL —
new rules, combat mechanics, status effects, AI behaviours, or balance
changes.

---

## Prerequisites

- Understanding of game design concepts (balance, feedback loops, player agency)
- Willingness to learn BRL syntax (similar to a simple scripting language)
- No Rust, TypeScript, or web development knowledge required

## Getting Started

1. **[INTRODUCTION.md](INTRODUCTION.md)** — What Blink Idle RPG is
2. **[brl/brl-user-guide.md](brl/brl-user-guide.md)** — Complete BRL tutorial
   (start-to-finish)
3. **[game-design/README.md](game-design/README.md)** — All game systems at
   a glance
4. **[RESPONSIBILITIES.md](RESPONSIBILITIES.md)** — What belongs in BRL vs
   TypeScript

## Core Concepts

### BRL Building Blocks

| Concept | BRL Keyword | Purpose |
|---------|-------------|---------|
| **Component** | `component` | Data schema attached to entities (e.g. `Health { current, max }`) |
| **Entity** | `entity` | A game object carrying components (e.g. a hero, an enemy) |
| **Event** | `event` | Something that happens in the simulation (e.g. `DoAttack`, `SpawnEnemy`) |
| **Rule** | `rule` | Logic triggered by an event (e.g. "when DoAttack fires, calculate damage") |
| **Function** | `fn` | Reusable logic called from rules (e.g. `reduce_by_resist()`) |

### How the Simulation Works

```
Events on a timeline  →  Rules process each event  →  Rules modify components
      ↑                                                      │
      └──── Rules can schedule new events ←──────────────────┘
```

The engine pops events from a priority queue, finds matching rules, and
executes them.  Rules read/write component data and schedule future events.

## Game Systems — Design Docs + BRL Files

| System | Design Doc | BRL Source |
|--------|------------|------------|
| **Combat** | [combat.md](game-design/combat.md) | `game/brl/classic-rpg.brl` (rules) |
| **Characters** | [characters.md](game-design/characters.md) | `game/brl/heroes.brl` (AI functions) |
| **Enemies** | [enemies.md](game-design/enemies.md) | `game/brl/enemies.brl` (templates) |
| **Skills** | [skills.md](game-design/skills.md) | `game/brl/skill-catalog.brl` |
| **Status Effects** | [status-effects.md](game-design/status-effects.md) | `game/brl/classic-rpg.brl` |
| **Damage Types** | [damage-types.md](game-design/damage-types.md) | `game/brl/classic-rpg.brl` |
| **Encounters** | [encounters.md](game-design/encounters.md) | `game/brl/classic-rpg.brl` |
| **Scoring** | [scoring.md](game-design/scoring.md) | `game/brl/scenario-*.brl` |
| **Game Modes** | [game-modes.md](game-design/game-modes.md) | `game/brl/scenario-*.brl` |
| **Story Mode** | [story-mode.md](game-design/story-mode.md) | `game/brl/story-mode.brl` |
| **World** | [world-design.md](game-design/world-design.md) | `game/brl/story-world.brl`, `story-world-data.brl` |
| **Adventures** | [adventure-design.md](game-design/adventure-design.md) | `game/brl/story-adventure.brl`, `adventure-expansion-set-1.brl` |
| **Traits** | [character-traits.md](game-design/character-traits.md) | (TypeScript — see note below) |

> **Note on Traits**: Hero stat formulas and trait-to-stat derivation currently
> live in TypeScript (`game/app/src/data/traits.ts`).  See
> [RESPONSIBILITIES.md](RESPONSIBILITIES.md) for the migration plan.

## Common Tasks

### Tuning Game Balance (No Code Changes)

Edit entity values in `game/brl/scenario-*.brl`:
- `scenario-easy.brl` — Easy difficulty
- `scenario-normal.brl` — Normal (canonical) difficulty
- `scenario-hard.brl` — Hard difficulty

Then test with the batch simulation tool:
```bash
npm run test:massive         # Run large-scale validation
```

Or use `tools/simulate.js` for quick comparisons (see
[WORKFLOW.md § For Game Designers](WORKFLOW.md#for-game-designers-tuning-balance)).

### Adding a New Rule

1. Open `game/brl/classic-rpg.brl`
2. Add a new `rule` block triggered by the relevant event:
   ```brl
   rule apply_poison on DoAttack {
       // ... your logic here
   }
   ```
3. Rebuild and test:
   ```bash
   npm run build:wasm && npm run install:wasm && npm run dev:app
   ```

### Adding a New Component

1. Define the component in the appropriate BRL file:
   ```brl
   component Poison {
       damagePerTick: integer
       ticksRemaining: integer
   }
   ```
2. Add rules that use the component
3. Rebuild

### Adding a New Event

1. Declare the event in your BRL file:
   ```brl
   event ApplyPoison { target: entity_id, damage: integer }
   ```
2. Add rules triggered by the event
3. Schedule the event from an existing rule:
   ```brl
   schedule ApplyPoison after 1.0d { target: someEntity, damage: 5 }
   ```

## Testing Your Changes

```bash
npm run compile-brl          # Quick syntax/semantic check
npm run test:harness         # Full E2E test (BRL → native binary → simulation)
npm run test:massive         # Large-scale balance validation
npm run dev:app              # Visual test in the browser
```

## Reference

- [brl/brl-specification.md](brl/brl-specification.md) — Complete BRL language reference
- [brl/brl-user-guide.md](brl/brl-user-guide.md) — Tutorials and examples
- [WORKFLOW.md](WORKFLOW.md) — Build pipeline and workflows
