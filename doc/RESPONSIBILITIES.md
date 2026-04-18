# Responsibility Boundaries: BRL vs TypeScript

This document defines what logic belongs in BRL (Blink Rule Language) vs
TypeScript, identifies known boundary violations, and tracks planned
migrations.

---

## Guiding Principles

| Layer | Language | Purpose |
|-------|----------|---------|
| **Game rules** | BRL | Combat formulas, event handling, spawn logic, AI behaviour, status effects, skill effects |
| **Game data** | BRL | Entity definitions (enemies, scenarios, world locations, NPCs, skills, quest content pools) |
| **Runtime presentation** | TypeScript | UI rendering, user input, animation, snapshot display, URL encoding, party management |
| **Runtime orchestration** | TypeScript | WASM engine loading, entity injection, checkpoint capture, scoring display |
| **Build tooling** | JavaScript/Node | Compilers, file copy scripts, WASM build pipeline |

### Rule of Thumb

> If it affects *what happens in the simulation* (damage, healing, spawning,
> movement, AI decisions), it belongs in **BRL**.
>
> If it affects *how the player sees or controls the simulation* (UI layout,
> animations, URL sharing, leaderboard storage), it belongs in **TypeScript**.

---

## Data Loading Architecture

All game data is defined in BRL files and compiled to JSON at build time
by `scripts/compile-game-data.js`.  The game app loads only pre-compiled
JSON — it never parses BRL at runtime.  There are **no hardcoded fallback
data** in TypeScript; BRL is the single source of truth.

| Module | BRL source | JSON output | What it loads |
|--------|-----------|-------------|---------------|
| `enemyData.ts` | `enemies.brl` | `enemies.json` | Enemy templates (stats, skills, tiers) |
| `scenarioData.ts` | `scenario-*.brl` | `scenarios.json` | Mode configs (spawn, scoring, flee) |
| `worldDataLoader.ts` | `story-world-data.brl` | `world-data.json` | Locations, paths, NPCs, comments, encounters |
| `heroClassData.ts` | `hero-classes.brl` | `hero-classes.json` | Class combat stats, skills, growth vectors, element threshold |
| `adventureDataLoader.ts` | `story-adventure-templates.brl`, `adventure-expansion-set-1.brl`, `expansion-pack-2.brl`, `story-quest-pools.brl` | `adventure-data.json` | Objective/milestone/event templates; hero encounter templates; quest content pools |

All loaders are called in parallel during `runSimulation()`, alongside
the WASM module load.  Results are cached after the first fetch.

### Error Handling

If BRL/JSON data is unavailable (e.g. build not run, missing files), the
game throws an error rather than silently falling back to stale data.
This ensures bugs from data mismatches are caught early.

---

## Resolved Boundary Issues

The following historical duplication has been fully resolved:

| Canonical source | Was duplicated at | Resolution |
|------------------|-------------------|------------|
| `game/brl/enemies.brl` | `WasmSimEngine.ts` `FALLBACK_ENEMY_TEMPLATES` | Removed — BRL loaded at runtime, no fallback |
| `game/brl/scenario-*.brl` | `WasmSimEngine.ts` `FALLBACK_NORMAL_CONFIG` | Removed — BRL loaded at runtime, no fallback |
| `game/brl/story-world-data.brl` | `worldData.ts` data arrays | Removed — BRL loaded at runtime, no fallback |
| `game/brl/hero-classes.brl` | `WasmSimEngine.ts` `FALLBACK_CLASS_BASE_*` / `traits.ts` `FALLBACK_CLASS_BASE_GROWTH` | Removed — BRL loaded at runtime, no fallback |
| `game/brl/story-adventure-templates.brl` + expansion BRLs | `adventureQuest.ts` template arrays | BRL loaded at runtime; no TS duplication |
| `game/brl/story-quest-pools.brl` | `adventureQuest.ts` hardcoded pools | Removed — quest content pools (villains, items, creatures, etc.) now in BRL |

**Remaining**: The `game/data/game-modes.json` ↔ `gameModes.ts` duplication
for the batch simulation tool is not yet resolved (presentation-only data).

---

## Files That Are Correctly in TypeScript

These files contain presentation or orchestration logic and should **not**
be migrated to BRL:

| File | Responsibility |
|------|----------------|
| `heroDescription.ts` | URL encoding/decoding for hero sharing |
| `adventureDescription.ts` | URL encoding/decoding for adventure sharing |
| `skillCatalog.ts` | Runtime BRL parser for UI display |
| `adventures.ts` | Adventure definitions for UI selection |
| `heroes.ts` | Hero class definitions for party selection UI |
| `gameModes.ts` | Mode definitions for UI selection |
| `adventureQuest.ts` | Quest composition algorithm (uses BRL-loaded data, NPC pool derived from world NPCs) |
| All `screens/*.tsx` | React UI components |
| All `components/*.tsx` | React UI components |
| `storage/*.ts` | IndexedDB persistence (roster, leaderboard) |

**Note**: The stat computation formulas (algorithms in `computeBaseStats`,
`deriveDamageCategory`, `deriveResistances`) remain in TypeScript because
they run in the React app before entity injection.  All game _data_ (balance
constants, growth weights, thresholds) is sourced from BRL.
