# Responsibility Boundaries: BRL vs TypeScript

This document defines what logic belongs in BRL (Blink Rule Language) vs
TypeScript, identifies known boundary violations, and tracks planned
migrations.

See [game-logic-migration.md](game-design/game-logic-migration.md) for the
detailed phased migration plan.

---

## Guiding Principles

| Layer | Language | Purpose |
|-------|----------|---------|
| **Game rules** | BRL | Combat formulas, event handling, spawn logic, AI behaviour, status effects, skill effects, stat computation, quest composition, scoring |
| **Game data** | BRL | Entity definitions (enemies, scenarios, world locations, NPCs, skills), content pools (objectives, milestones, events, villains, items), starter hero definitions, adventure descriptions, balance constants |
| **Dynamic player data** | TypeScript | Hero roster management, adventure roster management — loading and saving player-owned entities that are created/modified at runtime |
| **Runtime presentation** | TypeScript | UI rendering, user input, animation, snapshot display, URL encoding/decoding, narrative text composition, hero/adventure description prose generation |
| **Runtime orchestration** | TypeScript | WASM engine loading, entity injection, checkpoint capture, scoring display |
| **Build tooling** | JavaScript/Node | Compilers, file copy scripts, WASM build pipeline |

### Rule of Thumb

> **All game logic belongs in BRL.** If it affects *what happens in the
> simulation* — damage, healing, spawning, movement, AI decisions, stat
> growth, quest progression, scoring — it belongs in **BRL**.
>
> **All game data belongs in BRL.** If it defines *what the game contains* —
> enemies, skills, locations, NPCs, content pools, balance parameters,
> starter hero traits — it belongs in **BRL**.
>
> **TypeScript manages only dynamic data and presentation.** TypeScript
> loads/saves player-owned data (hero roster, adventure roster) and handles
> UI rendering, URL sharing, and narrative prose generation. It does **not**
> define game rules, formulas, or static content.

---

## Known Boundary Violations

The following TypeScript modules contain game logic or game data that should
be expressed in BRL. These are tracked in the
[migration plan](game-design/game-logic-migration.md).

### 1. Hero Stat Formulas — `traits.ts` (Migration Phase 1)

| Should be BRL | Currently in TypeScript |
|---------------|------------------------|
| Base stat computation | `computeBaseStats()` in `traits.ts` |
| Level-up stat gains | `computeLevelUpGains()` in `traits.ts` |
| Damage category/element derivation | `deriveDamageCategory()`, `deriveDamageElement()` in `traits.ts` |
| Resistance calculation | `deriveResistances()` in `traits.ts` |
| Line preference scoring | `computeLinePreferenceScore()` in `traits.ts` |
| Combat role assignment | `computeRole()` in `traits.ts` |
| Class growth vectors | `CLASS_BASE_GROWTH` in `traits.ts` |

**Why it exists**: Heroes are created at runtime from player's party
selection. Stat computation runs in the React app before entity injection.

**Migration**: Express these as BRL functions. The engine evaluates them
during entity creation, keeping all game balance logic in one place.
See Phase 1 in the migration plan for BRL extension requirements
(`sqrt()` built-in needed for Gaussian jitter).

### 2. Starter Hero Definitions — `heroes.ts` (Migration Phase 1)

| Should be BRL | Currently in TypeScript |
|---------------|------------------------|
| 6 starter heroes (traits, stats) | `HEROES[]` array in `heroes.ts` |

**Why it exists**: Starter heroes are hardcoded for immediate use in
the party selection UI.

**Migration**: Define starter heroes as BRL entity declarations. TypeScript
loads them as defaults for the hero roster. Random hero generation stays in
TypeScript (it is a UI convenience, not game data).

### 3. Adventure Quest Content & Logic — `adventureQuest.ts` (Migration Phase 2)

| Should be BRL | Currently in TypeScript |
|---------------|------------------------|
| 6 objective templates | `OBJECTIVE_TEMPLATES[]` |
| 10 milestone templates | `MILESTONE_TEMPLATES[]` |
| 14 event templates | `EVENT_TEMPLATES[]` |
| 30 hero encounter templates | `HERO_ENCOUNTER_TEMPLATES[]` |
| NPC/item/villain/creature pools | Various `*_POOL[]` arrays |
| Quest composition algorithm | `generateAdventureQuest()` |
| Quest simulation | `simulateQuestProgress()` |
| Hero encounter matching | `matchHeroEncounters()` |
| Scoring constants | `QUEST_MILESTONE_NORMAL_BONUS`, etc. |

**Why it exists**: The quest system was prototyped in TypeScript. BRL
component schemas are already defined in `story-adventure.brl` and
`adventure-expansion-set-1.brl` but the rules and data entities are not
yet authored.

**Migration**: Move content pools to BRL entity declarations. Move
composition and simulation algorithms to BRL rules. Keep narrative text
composition (slot resolution, prose generation) in TypeScript as
presentation logic.

### 4. World Data Duplication — `worldData.ts` (Migration Phase 3)

| Source of truth | Duplicate |
|-----------------|-----------|
| `game/brl/story-world-data.brl` | `game/app/src/data/worldData.ts` |

**What**: 15 locations, 25 paths, 20 NPCs, 40 hero arrival comments, 6
blocking encounters are defined in both BRL and TypeScript.

**Why it exists**: The TypeScript copy is needed by the narrative generation
and quest composition logic that runs in the React app (outside the WASM
engine).

**Migration**: When quest logic moves to WASM (Phase 2), remove the
TypeScript data arrays. Load world data from BRL via the IR JSON or
engine API. Keep lookup helpers and arrival comment selection in TypeScript.

### 5. Enemy Templates in TypeScript

| Source of truth | Duplicate |
|-----------------|-----------|
| `game/brl/enemies.brl` | `WasmSimEngine.ts` `ENEMY_TEMPLATES` constant |

**What**: Enemy stat tables (HP, damage, speed, tier, XP) are defined in
BRL entities and also hardcoded in the TypeScript engine wrapper.

**Why it exists**: The TypeScript copy is used to inject enemy entities into
the WASM engine at runtime. The WASM binary contains only compiled rules,
not entity data.

**Migration**: Load enemy BRL data at runtime (either by parsing the BRL
file served from `public/game-files/enemies.brl`, or by including entity
data in the IR JSON and loading it programmatically).

### 6. Game Mode / Scoring Constants

| Source of truth | Duplicate |
|-----------------|-----------|
| `game/brl/scenario-*.brl` | `WasmSimEngine.ts` `MODE_CONFIGS` |
| `game/data/game-modes.json` | `game/app/src/data/gameModes.ts` |

**What**: Difficulty parameters (spawn rates, scaling, scoring thresholds)
appear in BRL scenario files, JSON data files, and TypeScript constants.

**Why it exists**: The WASM engine receives entity data at runtime, so the
TypeScript layer must know the values to inject. The JSON files serve the
batch simulation tool.

**Migration**: Have both the web app and batch tool read from a single
source (either the BRL files or the JSON files), eliminating the TypeScript
constants.

---

## Files Correctly in TypeScript

These files contain presentation, orchestration, or dynamic-data logic and
should **not** be migrated to BRL:

| File | Responsibility | Why it stays in TypeScript |
|------|----------------|---------------------------|
| `heroDescription.ts` | Hero prose generation + URL encoding/decoding | Presentation: narrative text composition from trait data |
| `adventureDescription.ts` | Adventure prose generation + URL encoding/decoding | Presentation: difficulty/party description prose |
| `adventures.ts` | Random adventure generation for UI | UI convenience: name pools, random environment sliders |
| `gameModes.ts` | Game mode display labels | UI metadata: mode names and descriptions for selection UI |
| `skillCatalog.ts` | Runtime BRL parser for UI display | Bridge: parses BRL skill data for UI rendering |
| `heroes.ts` (partial) | Random hero generation, name pools | UI convenience: `generateRandomHero()`, `FIRST_NAMES[]`, `CLASS_EMOJIS` |
| `traits.ts` (partial) | Trait axis UI labels, skill tree preview | UI preview: `TRAIT_AXES[]`, `simulateHeroPath()`, `heroSummary()` |
| `worldData.ts` (partial) | Lookup helpers, arrival comment selection | Runtime indexing: `getLocationById()`, `selectArrivalComments()` |
| All `screens/*.tsx` | React UI components | Presentation layer |
| All `components/*.tsx` | React UI components | Presentation layer |
| `storage/*.ts` | IndexedDB persistence (roster, leaderboard) | Dynamic player data: hero roster, adventure roster, leaderboards |
| `engine/WasmSimEngine.ts` | WASM engine loading and orchestration | Runtime orchestration (entity injection, checkpoint capture) |

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
