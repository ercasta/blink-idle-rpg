# Responsibility Boundaries: BRL vs TypeScript

This document defines what logic belongs in BRL (Blink Rule Language) vs
TypeScript, identifies known boundary violations, and tracks planned
migrations.

---

## Guiding Principles

| Layer | Language | Purpose |
|-------|----------|---------|
| **Game rules** | BRL | Combat formulas, event handling, spawn logic, AI behaviour, status effects, skill effects |
| **Game data** | BRL | Entity definitions (enemies, scenarios, world locations, NPCs, skills) |
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

## Known Boundary Issues

The following TypeScript modules contain logic that duplicates or should be
expressed in BRL.  These are not bugs — the game works correctly — but they
represent maintenance risk because changes must be made in two places.

### 1. World Data Duplication

| Source of truth | Duplicate |
|-----------------|-----------|
| `game/brl/story-world-data.brl` | `game/app/src/data/worldData.ts` |

**What**: 15 locations, 25 paths, 20 NPCs, 40 hero arrival comments, 6
blocking encounters are defined in both BRL and TypeScript.

**Why it exists**: The TypeScript copy is needed by the narrative generation
and quest composition logic that runs in the React app (outside the WASM
engine).

**Recommended migration**: When the adventure quest system moves into the
WASM engine (see `doc/game-design/adventure-design.md`), the TypeScript
duplicate can be removed and the engine can return world data via its API.

### 2. Enemy Templates in TypeScript

| Source of truth | Duplicate |
|-----------------|-----------|
| `game/brl/enemies.brl` | `WasmSimEngine.ts` `ENEMY_TEMPLATES` constant |

**What**: Enemy stat tables (HP, damage, speed, tier, XP) are defined in
BRL entities and also hardcoded in the TypeScript engine wrapper.

**Why it exists**: The TypeScript copy is used to inject enemy entities into
the WASM engine at runtime.  The WASM binary contains only compiled rules,
not entity data.

**Recommended migration**: Load enemy BRL data at runtime (either by
parsing the BRL file served from `public/game-files/enemies.brl`, or by
including entity data in the IR JSON and loading it programmatically).

### 3. Game Mode / Scoring Constants

| Source of truth | Duplicate |
|-----------------|-----------|
| `game/brl/scenario-*.brl` | `WasmSimEngine.ts` `MODE_CONFIGS` |
| `game/data/game-modes.json` | `game/app/src/data/gameModes.ts` |

**What**: Difficulty parameters (spawn rates, scaling, scoring thresholds)
appear in BRL scenario files, JSON data files, and TypeScript constants.

**Why it exists**: The WASM engine receives entity data at runtime, so the
TypeScript layer must know the values to inject.  The JSON files serve the
batch simulation tool.

**Recommended migration**: Have both the web app and batch tool read from a
single source (either the BRL files or the JSON files), eliminating the
TypeScript constants.

### 4. Hero Stat Computation

| BRL | TypeScript |
|-----|------------|
| `heroes.brl` (AI functions only) | `traits.ts` (`computeBaseStats`, `deriveDamageCategory`, `deriveResistances`) |

**What**: Base stat formulas, damage type derivation, and resistance
calculation are in TypeScript.

**Why it exists**: Heroes are created at runtime from the player's party
selection.  The stat computation runs in the React app before entity
injection.

**Recommended migration**: These formulas could be expressed as BRL
functions that the engine evaluates during entity creation, keeping
game balance logic in one place.

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
| All `screens/*.tsx` | React UI components |
| All `components/*.tsx` | React UI components |
| `storage/*.ts` | IndexedDB persistence (roster, leaderboard) |

---

## File Duplication Eliminated

The following duplication has been resolved by the build-time copy script
(`scripts/copy-game-files.js`):

| Canonical source | Was duplicated at | Resolution |
|------------------|-------------------|------------|
| `game/brl/*.brl` | `game/app/public/game-files/*.brl` | Auto-copied at build time; copies removed from git |
| `game/bcl/*.bcl` | `game/app/public/game-files/*.bcl` | Auto-copied at build time; copies removed from git |

The two files that had diverged (`classic-rpg.brl` missing DamageType/Resistance
components, `scenario-normal.brl` with different balance values) are now always
in sync because the canonical source is the only file that is edited.
