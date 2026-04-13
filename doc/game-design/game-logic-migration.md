# Game Logic Migration Plan — TypeScript to BRL

This document analyzes all TypeScript code in `game/app/src/data/` that implements
game logic, and defines a phased migration plan to move that logic into BRL.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Classification of Each File](#classification-of-each-file)
3. [Migration Phases](#migration-phases)
4. [BRL Language Extensions Required](#brl-language-extensions-required)
5. [Engine Changes Required](#engine-changes-required)
6. [Risks and Mitigations](#risks-and-mitigations)

---

## Current State Analysis

The `game/app/src/data/` directory contains 8 TypeScript files. Some contain
pure presentation/runtime logic (correct in TypeScript), while others contain
game logic and game data that should be expressed in BRL according to the
project's guiding principle:

> If it affects *what happens in the simulation*, it belongs in **BRL**.
> If it affects *how the player sees or controls the simulation*, it belongs in **TypeScript**.

### Summary Table

| File | Lines | Game Logic? | Migration Priority |
|------|------:|-------------|-------------------|
| `adventureQuest.ts` | ~2,060 | **Yes — primary** | Phase 2 |
| `traits.ts` | ~572 | **Yes — core formulas** | Phase 1 |
| `worldData.ts` | ~510 | **Yes — duplicates BRL** | Phase 3 |
| `heroes.ts` | ~152 | **Partial — 6 hardcoded heroes** | Phase 1 |
| `heroDescription.ts` | ~397 | No — presentation only | — |
| `adventureDescription.ts` | ~397 | No — presentation only | — |
| `adventures.ts` | ~133 | No — UI utilities only | — |
| `gameModes.ts` | ~33 | No — UI metadata only | — |
| `skillCatalog.ts` | ~110 | No — runtime BRL parser for UI | — |

---

## Classification of Each File

### `traits.ts` — Core Game Formulas (Phase 1)

**What must migrate to BRL (game logic):**

| Function | Lines | Description |
|----------|------:|-------------|
| `computeBaseStats()` | 85–143 | Deterministic stat distribution from class + traits |
| `computeLevelUpGains()` | 151–206 | Per-level stat gains with trait-driven affinities |
| `deriveDamageCategory()` | 428–430 | Physical vs magical from `pm` trait |
| `deriveDamageElement()` | 436–451 | Element derivation from `fw`/`we`/`ld` traits |
| `deriveResistances()` | 474–485 | 0–50% resistance per damage type from traits |
| `computeLinePreferenceScore()` | 498–514 | Front/back line score from weighted traits |
| `computeLinePreference()` | 516–518 | Front/back classification |
| `computeRole()` | 526–561 | Combat role scoring with class bias |
| `CLASS_BASE_GROWTH` | 68–76 | Class growth vectors `[STR, DEX, INT, CON, WIS]` |
| `ELEMENT_THRESHOLD` | 422 | Threshold constant for element derivation |

**What stays in TypeScript (presentation):**

| Function | Description |
|----------|-------------|
| `TRAIT_AXES[]` | Trait axis metadata for UI labels |
| `randomTraits()` | Random trait generation for UI hero creation |
| `heroSummary()` | Text formatting for UI display |

**Removed features:** `simulateHeroPath()`, `pickSkill()`, `scoreSkill()`,
and all class skill tree data (`WARRIOR_SKILLS`, `MAGE_SKILLS`, etc.) have
been **removed**. The hero path prediction feature was a TypeScript-only
simulation that duplicated what the WASM engine does. Skill trees are
defined in BRL (`skill-catalog.brl`) and the WASM engine handles actual
skill selection during combat.

**BRL extension needed:** `sqrt()` and `log()` — the Box-Muller transform
used by `computeLevelUpGains()` requires these math functions. Both will be
added as BRL built-in functions.
See [BRL Language Extensions](#brl-language-extensions-required).

---

### `adventureQuest.ts` — Quest Generation System (Phase 2)

**What must migrate to BRL (game logic + game data):**

| Content | Lines | Description |
|---------|------:|-------------|
| `OBJECTIVE_TEMPLATES[]` | 99–154 | 6 objective templates (rescue, retrieve, defeat, etc.) |
| `MILESTONE_TEMPLATES[]` | 171–321 | 10 milestone templates with bail-out days |
| `EVENT_TEMPLATES[]` | 329–520 | 14 event templates (key + side events) |
| `HERO_ENCOUNTER_TEMPLATES[]` | 650–1280 | 30 hero-matched encounter templates |
| `VILLAIN_POOL[]` | 535–553 | 10 villain name/title entries |
| `ITEM_POOL[]` | 555–573 | 15 quest item entries |
| `CREATURE_POOL[]` | 575–584 | 10 creature name entries |
| Other pools | 586–620 | Curse, portal, riddle, threat, info, inscription, cargo pools |
| `generateAdventureQuest()` | ~1495–1722 | Deterministic quest composition algorithm |
| `simulateQuestProgress()` | ~1778–1922 | Quest simulation with milestone activation |
| `matchHeroEncounters()` | — | Hero-class/trait encounter matching algorithm |
| Scoring constants | ~1727–1741 | `QUEST_MILESTONE_NORMAL_BONUS`, `QUEST_OBJECTIVE_BONUS`, etc. |
| `Rng` class | 20–57 | Splitmix32 PRNG (BRL already has xoshiro256**) |
| `djb2Hash()` / `computeAdventureSeed()` | 62–83 | Seed derivation from adventure config |

**What stays in TypeScript (presentation / runtime):**

| Function | Description |
|----------|-------------|
| `resolveSlots()` | String templating for narrative text (presentation concern) |
| `generateQuestNarrative()` | Weaves events into narrative log for UI display |
| URL-related helpers | Adventure sharing utilities |

**Existing BRL infrastructure:** `story-adventure.brl` already defines the ECS
components (`AdventureState`, `QuestMilestone`, `QuestEvent`, `SlotBinding`,
`BailoutTimer`, `QuestScore`, etc.) and events. The component schema is ready;
only the rules and data entities need to be authored.

**Design decisions:**
- **Seed computation** moves to BRL (via `hash_string()` built-in) to guarantee
  stable, consistent simulation across engines.
- **String template resolution** stays in TypeScript — it is a presentation
  concern (BRL stores template IDs and slot bindings; TypeScript resolves them).
- **Content selection** (`shuffle`, `pick`, `filter`) — add these as BRL
  built-in functions backed by Rust, so the composition algorithm can be
  expressed naturally in BRL.

This is the biggest migration item. Sub-phases:
- 2a: Move content pools to BRL as entity data
- 2b: Move composition algorithm to BRL rules
- 2c: Move simulation/scoring to BRL rules

---

### `worldData.ts` — World Data Duplication (Phase 3)

**What must migrate (data duplication — already in BRL):**

| Data | Count | BRL Source |
|------|------:|------------|
| `WORLD_LOCATIONS` | 15 | `story-world-data.brl` |
| `WORLD_PATHS` | 25 | `story-world-data.brl` |
| `WORLD_NPCS` | 20 | `story-world-data.brl` |
| `HERO_ARRIVAL_COMMENTS` | 40 | `story-world-data.brl` |
| `BLOCKING_ENCOUNTERS` | 6 | `story-world-data.brl` |

**What must migrate (game logic):**

| Function | Description |
|----------|-------------|
| `selectWorldMap()` | BFS subgraph selection from seed — game logic |

**What stays in TypeScript:**

| Function | Description |
|----------|-------------|
| `getLocationById()` etc. | Lookup helpers for runtime indexing |
| `selectArrivalComments()` | Narrative selection for UI display |

**Dependency:** This file is consumed by `adventureQuest.ts`. Migration should
happen after or alongside Phase 2 so that quest composition can read world data
from BRL entities rather than TypeScript arrays.

**Approach:**

Use the engine API approach: once quest logic runs inside WASM (Phase 2),
the engine returns world data as part of its state. TypeScript reads it from
engine output. Alternatively, parse `story-world-data.brl` at runtime (like
`skillCatalog.ts` does for skills) and populate typed arrays.

**Note on IR:** The IR JSON pipeline (`compile-brl-to-ir.js`) is not used
by the web app at runtime — the app uses only the WASM engine, which has
rules baked into the binary. The IR exists for test tooling and reference
only. It is not a loading path for world data.

**Also migrate:** `selectWorldMap()` — BFS subgraph selection is game logic
(affects which locations the party visits). Move to a BRL rule triggered by a
map generation event.

---

### `heroes.ts` — Starter Hero Definitions (Phase 1)

**What must migrate to BRL (game data):**

The 6 hardcoded starter heroes (Aldric, Lyra, Sasha, Theron, Kira, Elara) are
game balance data. Their trait values and computed stats should be defined as BRL
entities so that game designers can tune them without touching TypeScript.

**What stays in TypeScript:**

| Content | Description |
|---------|-------------|
| `generateRandomHero()` | Runtime hero generation for UI |
| `generateRandomParty()` | Runtime party generation for UI |
| `FIRST_NAMES[]` | Name pools for random generation |
| `CLASS_EMOJIS` | UI display data |

**Note:** After migration, TypeScript will load the starter heroes from the
hero roster (dynamic data managed by the player) rather than hardcoding them.
The BRL entities serve as *default templates* that seed the initial roster.

---

### Files That Stay in TypeScript

#### `heroDescription.ts` — Hero Narrative Generation

All content is presentation: trait-to-prose sentence banks, paragraph
composition, and URL encoding/decoding for hero share links. No game impact.

#### `adventureDescription.ts` — Adventure Narrative Generation

Difficulty-based prose generators and URL encoding/decoding for adventure share
links. No game impact.

#### `adventures.ts` — Random Adventure UI Utilities

Adventure name pools (`ADVENTURE_ADJECTIVES`, `ADVENTURE_NOUNS`), random
environment generation, and party generation for the adventure selection UI.
No game impact.

#### `gameModes.ts` — Game Mode UI Labels

Static array of 4 mode definitions (normal, easy, hard, custom) with display
names and descriptions. UI metadata only.

#### `skillCatalog.ts` — Runtime BRL Parser

Fetches and parses `skill-catalog.brl` at runtime for UI display. This is a
bridge between BRL data and the UI — correctly in TypeScript.

---

## Migration Phases

### Phase 1 — Hero Stat Formulas and Starter Heroes

**Goal:** Move all hero-related game formulas and balance data to BRL.

**Files affected:**
- `traits.ts` → new BRL file `hero-traits.brl` (or extend `heroes.brl`)
- `heroes.ts` → new BRL entity declarations for 6 starter heroes

**What to create in BRL:**
1. `component HeroTraitProfile` — 12 trait axis values
2. `component ClassBaseGrowth` — `[STR, DEX, INT, CON, WIS]` growth vectors
3. BRL function `compute_base_stats(hero: id): void` — sets stat components
4. BRL function `derive_damage_category(hero: id): string` — returns `"physical"` or `"magical"`
5. BRL function `derive_damage_element(hero: id): string` — returns element name
6. BRL function `derive_resistances(hero: id): void` — sets resistance component fields
7. BRL function `compute_line_preference(hero: id): string` — returns `"front"` or `"back"`
8. BRL function `compute_role(hero: id): string` — returns role name
9. Entity declarations for 6 starter heroes with trait values

**TypeScript changes:**
- `traits.ts` keeps UI-only functions (`TRAIT_AXES`, `randomTraits`, `heroSummary`)
- `heroes.ts` reads starter heroes from roster/BRL rather than hardcoding them
- Engine uses event-driven approach: inject a `ComputeStats` event, let the
  BRL rule fire, and read the resulting component values from engine state

**BRL extensions needed for this phase:**
- `sqrt()` and `log()` built-ins for Gaussian jitter in level-up gains
- `sort()` built-in backed by Rust for role scoring (also useful for future features)

---

### Phase 2 — Adventure Quest System

**Goal:** Move all quest content pools and composition logic to BRL.

**Files affected:**
- `adventureQuest.ts` → new BRL files:
  - `story-adventure-templates.brl` — entity data (objectives, milestones, events)
  - `story-adventure-pools.brl` — entity data (NPC, item, villain pools)
  - `story-adventure-rules.brl` — quest composition and simulation rules

**What to create in BRL:**

1. **Data entities** (one entity per template):
   - `ObjectiveTemplate` entities (6)
   - `MilestoneTemplate` entities (10)
   - `EventTemplate` entities (14)
   - `HeroEncounterTemplate` entities (already defined in `adventure-expansion-set-1.brl`, ~30)
   - Pool entities: `VillainEntry`, `ItemEntry`, `CreatureEntry`, `DungeonEntry`, etc.

2. **Composition rules:**
   - Rule on `AdventureCompose` event → select objective, milestones, events
   - Rule for slot binding resolution
   - Rule for hero encounter matching
   - Rule for milestone activation / bail-out timer management
   - Rule for quest scoring

3. **Scoring config entity:**
   - `QuestScoringConfig { milestoneBonusNormal, objectiveBonus, ... }`

**TypeScript changes:**
- `adventureQuest.ts` shrinks to: narrative generation + slot resolution
  (string interpolation), and orchestration calls to the WASM engine
- Quest state is returned from the engine via its API

**BRL extensions needed for this phase:**
- `hash_string()` built-in for deterministic seed computation in BRL
- `shuffle()`, `filter()` built-in functions backed by Rust

This is the biggest migration item. Sub-phases:
- 2a: Move content pools to BRL as entity data
- 2b: Move composition algorithm to BRL rules
- 2c: Move simulation/scoring to BRL rules

---

### Phase 3 — World Data Deduplication

**Goal:** Remove TypeScript copies of world data; read from BRL source.

**Files affected:**
- `worldData.ts` → remove data arrays; keep lookup helpers

**Approach:** Use the engine API. Once quest logic runs inside WASM (Phase 2),
the engine returns world data as part of its state. Alternatively, parse
`story-world-data.brl` at runtime (like `skillCatalog.ts` does for skills).

**Also migrate:** `selectWorldMap()` — BFS subgraph selection is game logic
(affects which locations the party visits). Move to a BRL rule triggered by a
map generation event.

---

### Phase 4 — Remaining Boundary Cleanup (Future)

These items from `RESPONSIBILITIES.md` are already tracked:

| Issue | Description |
|-------|-------------|
| Enemy template duplication | `enemies.brl` vs `WasmSimEngine.ts` constants |
| Game mode/scoring constants | `scenario-*.brl` vs `WasmSimEngine.ts` `MODE_CONFIGS` |

These are engine-level issues rather than `data/` file issues. They should be
addressed alongside the engine's entity loading improvements.

---

## BRL Language Extensions Required

The following BRL language or runtime extensions would unblock or simplify
the migration. Each is listed with its priority and the migration phase that
needs it.

### 1. `sqrt()` and `log()` Built-in Functions — Phase 1

**Need:** `computeLevelUpGains()` uses `gaussian()` which calls `Math.sqrt()`
and `Math.log()` via the Box-Muller transform for stat jitter.

**Decision:** Add both as BRL built-in functions. The Rust runtime already has
`f64::sqrt()` and `f64::ln()`. Implementation follows the existing pattern
of `brl_min`, `brl_max`, `brl_abs`, etc.

**Status:** Both `sqrt()` and `log()` implemented.

### 2. String Concatenation — Phase 2

**Need:** Quest templates use slot tokens like `"Rescue the {npc_name}"` that
must be resolved to `"Rescue the Eldara"`. BRL cannot construct strings
dynamically.

**Decision:** Keep slot resolution in TypeScript. This is a presentation
concern. BRL stores template IDs and slot bindings as separate components;
TypeScript reads them and performs the string substitution for UI display.

### 3. `abs()` Built-in Function — Phase 1

**Need:** `deriveDamageElement()` uses `Math.abs()` to find the trait axis
with the largest magnitude.

**Status:** Already available — `abs()` is listed in BRL built-in functions.
No extension needed.

### 4. `hash_string()` Built-in Function — Phase 2

**Need:** `computeAdventureSeed()` hashes the adventure configuration string
to derive a deterministic seed.

**Decision:** Add `hash_string(s: string): integer` as a BRL built-in.
Seed computation must be in BRL to guarantee stable, consistent simulation
across engines.

### 5. `sort()` Built-in Function — Phase 1

**Need:** `computeRole()` scores 6 roles and picks the highest. Also useful
for future features (content selection, encounter matching, etc.).

**Decision:** Add `sort()` as a BRL built-in function backed by Rust's
native sorting. No need to implement a sorting algorithm in BRL itself.

### 6. `shuffle()` and `filter()` Built-in Functions — Phase 2

**Need:** The quest composition algorithm uses shuffle, pick, and filter
on arrays for content selection.

**Decision:** Add these as BRL built-in functions backed by Rust.

---

## Engine Changes Required

### 1. Event-Driven BRL Invocation (Phase 1)

The WASM engine currently runs rules automatically on events. For hero stat
computation, TypeScript injects a `ComputeStats` event, lets the BRL rule
fire, and reads the resulting component values from engine state.

**Decision:** Use event/component interaction only — no direct BRL function
invocation from TypeScript.

### 2. IR Pipeline Status

The IR JSON pipeline (`tools/compile-brl-to-ir.js`, `packages/blink-compiler-ts/src/codegen.ts`)
generates JSON IR files. However, the web app does **not** use IR at runtime —
it uses only the WASM engine (BRL → Rust → WASM), which has rules baked into
the binary.

Current IR consumers:
- `game/brl-tests/` — integration test infrastructure
- `game/ir/` — reference/documentation
- `tools/simulate.js` — batch simulation tool

The IR pipeline is not a runtime dependency. World data loading (Phase 3)
should use BRL parsing at runtime or engine API, not IR.

### 3. Seed Injection API (Phase 2)

The engine needs a way to accept an adventure seed from TypeScript and
initialize its PRNG deterministically from it. The xoshiro256** PRNG is
already seeded; the API just needs to expose seed-setting.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **BRL lacks string ops** | Quest narrative generation cannot move fully to BRL | Keep slot resolution and narrative composition in TypeScript as presentation logic |
| **Large migration scope** | Phase 2 touches ~2,000 lines; risk of regressions | Sub-phase approach (2a/2b/2c) with test harness validation at each step |
| **Performance** | Moving complex algorithms to BRL/WASM may be slower than JS | Benchmark after Phase 1; WASM arithmetic is typically faster than JS |
| **Dual maintenance during migration** | Both TypeScript and BRL versions may coexist temporarily | Each phase should fully migrate a unit; never leave half-migrated logic |
| **World data loading path** | Removing TS world data requires a new loading mechanism | Use engine API or BRL runtime parsing (like skillCatalog.ts) |

---

## Appendix: File-by-File Disposition

| File | Disposition | Details |
|------|-------------|---------|
| `traits.ts` | **Shrink** | Remove formulas → BRL; remove hero path simulation; keep UI-only functions |
| `adventureQuest.ts` | **Shrink** | Remove pools + algorithms → BRL; keep narrative generation |
| `worldData.ts` | **Shrink** | Remove data arrays → load from engine/BRL; keep lookup helpers |
| `heroes.ts` | **Shrink** | Remove hardcoded heroes → BRL entities; keep random generation |
| `heroDescription.ts` | **Keep** | Pure presentation |
| `adventureDescription.ts` | **Keep** | Pure presentation |
| `adventures.ts` | **Keep** | UI utilities |
| `gameModes.ts` | **Keep** | UI metadata |
| `skillCatalog.ts` | **Keep** | Runtime BRL parser for UI |
