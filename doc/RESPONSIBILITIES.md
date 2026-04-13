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

### 1. World Data Duplication ✅ Resolved

| Source of truth | Duplicate |
|-----------------|-----------|
| `game/brl/story-world-data.brl` | `game/app/src/data/worldData.ts` (fallback only) |

**What**: 15 locations, 25 paths, 20 NPCs, 40 hero arrival comments, 6
blocking encounters are defined in BRL.

**Resolution**: `worldData.ts` now loads data from BRL at runtime via
`initWorldData()` (backed by `worldDataLoader.ts` and `brlParser.ts`).
The hardcoded TypeScript arrays serve as fallback defaults for environments
where BRL files are unavailable (e.g. unit tests).  The BRL file
`story-world-data.brl` is the single source of truth.

### 2. Enemy Templates in TypeScript ✅ Resolved

| Source of truth | Duplicate |
|-----------------|-----------|
| `game/brl/enemies.brl` | `WasmSimEngine.ts` `FALLBACK_ENEMY_TEMPLATES` (fallback only) |

**What**: Enemy stat tables (HP, damage, speed, tier, XP) are defined in
BRL entities and loaded at runtime.

**Resolution**: `enemyData.ts` loads enemy templates from `enemies.brl`
at runtime via `brlParser.ts`.  `WasmSimEngine.ts` calls `loadEnemyTemplates()`
in parallel with WASM module loading.  Hardcoded fallback data is used only
when BRL files are unavailable.

### 3. Game Mode / Scoring Constants ✅ Resolved

| Source of truth | Duplicate |
|-----------------|-----------|
| `game/brl/scenario-*.brl` | `WasmSimEngine.ts` `FALLBACK_NORMAL_CONFIG` (fallback only) |
| `game/data/game-modes.json` | `game/app/src/data/gameModes.ts` |

**What**: Difficulty parameters (spawn rates, scaling, scoring thresholds)
are defined in BRL scenario files and loaded at runtime.

**Resolution**: `scenarioData.ts` loads scenario configs from the BRL
scenario files (`scenario-normal.brl`, `scenario-easy.brl`,
`scenario-hard.brl`) at runtime.  `WasmSimEngine.ts` calls
`loadScenarioConfigs()` in parallel with WASM module loading.  Hardcoded
fallback data is used only when BRL files are unavailable.

**Remaining**: The `game/data/game-modes.json` ↔ `gameModes.ts` duplication
for the batch simulation tool is not yet resolved (presentation-only data).

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

The following duplication has been resolved:

| Canonical source | Was duplicated at | Resolution |
|------------------|-------------------|------------|
| `game/brl/*.brl` | `game/app/public/game-files/*.brl` | Auto-copied at build time; copies removed from git |
| `game/bcl/*.bcl` | `game/app/public/game-files/*.bcl` | Auto-copied at build time; copies removed from git |
| `game/brl/enemies.brl` | `WasmSimEngine.ts` `ENEMY_TEMPLATES` | BRL loaded at runtime via `enemyData.ts`; TS fallback only |
| `game/brl/scenario-*.brl` | `WasmSimEngine.ts` `MODE_CONFIGS` | BRL loaded at runtime via `scenarioData.ts`; TS fallback only |
| `game/brl/story-world-data.brl` | `worldData.ts` data arrays | BRL loaded at runtime via `worldDataLoader.ts`; TS fallback only |

The two files that had diverged (`classic-rpg.brl` missing DamageType/Resistance
components, `scenario-normal.brl` with different balance values) are now always
in sync because the canonical source is the only file that is edited.

### Runtime BRL Loading Architecture

The migration uses a common `brlParser.ts` utility that extracts entity and
component data from BRL files at runtime.  Three data loader modules use it:

| Module | BRL source | What it loads |
|--------|-----------|---------------|
| `enemyData.ts` | `enemies.brl` | Enemy templates (stats, skills, tiers) |
| `scenarioData.ts` | `scenario-*.brl` | Mode configs (spawn, scoring, flee) |
| `worldDataLoader.ts` | `story-world-data.brl` | Locations, paths, NPCs, comments, encounters |

All three loaders are called in parallel during `runSimulation()`, alongside
the WASM module load.  Results are cached after the first fetch.  If BRL
files are unavailable, hardcoded fallback data is used.
