# Location & Encounter Management — Analysis and Design

This document analyses the current state of location tracking, encounter
management, and story stepping in the Blink Idle RPG, then proposes changes
to address the requirements in the issue.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Gap Analysis](#gap-analysis)
3. [Proposed Changes](#proposed-changes)
4. [Open Issues](#open-issues)

---

## Current State Analysis

### BRL Components

| Component | File | Purpose |
|-----------|------|---------|
| `StoryConfig` | `story-mode.brl` | Journey state: day, encounters, locations visited, XP multiplier |
| `MapLocation` | `story-mode.brl` | A single location on the procedural map (type, danger, visited) |
| `TravelState` | `story-mode.brl` | Party travel status (resting, travelling, ambush chance) |
| `NarrativeEntry` | `story-mode.brl` | A single narrative log message (day, hour, level, text) |
| `NarrativeLog` | `story-mode.brl` | Entry count for the log |
| `WorldLocation` | `story-world.brl` | Named, authored location with description and elemental affinity |
| `WorldPath` | `story-world.brl` | Connection between two world locations with path type |
| `WorldNpc` | `story-world.brl` | Named NPC bound to locations |
| `HeroArrivalComment` | `story-world.brl` | Hero comment on arriving at a location |
| `BlockingEncounter` | `story-world.brl` | Encounter that halts travel until resolved |
| `PartyPosition` | design doc only | Designed but **not implemented** in BRL — exists only in story-mode.md |
| `AdventureState` | `story-adventure.brl` | Quest objective, milestone index, completion state |
| `QuestMilestone` | `story-adventure.brl` | Individual milestone in a quest chain |
| `QuestEvent` | `story-adventure.brl` | Event within a milestone |

### BRL Events (story-world.brl)

| Event | Purpose |
|-------|---------|
| `LocationDescriptionShown` | Location description displayed |
| `HeroCommentTriggered` | Hero arrival comment triggered |
| `LocationBuffApplied/Removed` | Location-based buff changes |
| `BlockingEncounterTriggered` | Blocking encounter activated |
| `BlockingEncounterResolved` | Blocking encounter resolved |
| `NpcRoleAssigned` | NPC assigned an adventure role |

### TypeScript Engine (`WasmSimEngine.ts`)

- `_runStoryMode()` runs the WASM combat sim, then computes story KPIs
  **post-hoc** from seed and encounter totals.
- Location tracking is **seed-derived**: `locationsVisited` is calculated
  from `totalEncounters / STORY_ENCOUNTERS_PER_LOCATION`, not from actual
  travel simulation.
- `_generateNarrativeLog()` builds the entire narrative deterministically
  from seed, heroes, and final KPIs — locations are selected via
  `selectWorldMap()` but the party doesn't actually move through them;
  it's a linear walk through the `locationNames` array.

### TypeScript Types (`types.ts`)

- `GameSnapshot` has combat KPIs only: score, enemies defeated, bosses,
  deaths, hero levels. **No location or encounter info.**
- `StoryKpis` has summary-level data (locations visited, towns rested,
  ambushes survived) but **no per-step location/encounter state**.
- `NarrativeEntry` has day/hour/level/text but **no structured metadata**
  about what step type it represents (arrival, departure, encounter).

### UI (`BattleScreen.tsx`)

- `ImmersiveStoryView` shows one day at a time with Next Day / Skip to
  Results buttons.
- The top bar shows score and day number — **no location or encounter name**.
- No expandable panel for quests or milestones.
- Navigation is forward-only: Next Day and Skip to Results.

---

## Gap Analysis

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| Track party location (current + destination) | Seed-derived post-hoc, no actual tracking | Need `StoryStepInfo` with location per step |
| Traveling represented as locations | Paths exist in world data but narrative walks linearly | Need step type indicating "travelling on path X" |
| Encounters happen at locations, blocking stops progress | BlockingEncounter BRL component exists but resolution is cosmetic (narrative only) | Need encounter info per step, blocking flag |
| Intermediate snapshots tied to messages | One snapshot per day, narrative entries not tied to snapshots | Need per-step snapshots with step metadata |
| UI: location band below score | Not present | Add location/encounter info band |
| UI: expandable quests/milestones panel | Not present | Add collapsible panel |
| UI: step/step-to-end-of-day/previous-step/previous-day navigation | Only Next Day / Skip | Add 4 navigation buttons |
| Score snapshotted per step | Score only snapshotted per day | Need score in step metadata |

---

## Proposed Changes

### 1. New `StoryStep` type (`types.ts`)

A `StoryStep` represents one discrete moment in the story. Each step has a
type (departure, travel, encounter, arrival, rest, camp, day-end) and
carries location/encounter context plus the score at that point.

```typescript
export type StoryStepType =
  | 'day_start'
  | 'departure'
  | 'travel'
  | 'encounter'
  | 'blocking_encounter'
  | 'arrival'
  | 'town_rest'
  | 'camp'
  | 'night_ambush'
  | 'day_end'
  | 'journey_start'
  | 'journey_end';

export interface StoryStep {
  /** Unique step index within the run */
  index: number;
  /** Day this step occurs on (1-based) */
  day: number;
  /** Hour within the day */
  hour: number;
  /** Step type */
  type: StoryStepType;
  /** Current location name (where the party is) */
  locationName: string;
  /** Location ID (world location ID) */
  locationId: string;
  /** Destination name (if travelling or departing) */
  destinationName?: string;
  /** Path name/description (if travelling) */
  pathDescription?: string;
  /** Encounter name (if in encounter) */
  encounterName?: string;
  /** Whether this encounter blocks progress */
  isBlocking?: boolean;
  /** Score at this step */
  score: number;
  /** Narrative entries associated with this step */
  narrativeEntries: NarrativeEntry[];
  /** Active quest objective title */
  questObjective?: string;
  /** Active milestone title */
  activeMilestone?: string;
  /** Completed milestones (titles) */
  completedMilestones?: string[];
}
```

### 2. Extended `_runStoryMode` return

The function will additionally return `storySteps: StoryStep[]`.

### 3. Extended `_generateNarrativeLog`

Refactored to also produce `StoryStep[]` as it walks through the
day/encounter structure.  Each narrative `emit()` also tags itself to the
current step.

### 4. UI Changes to `ImmersiveStoryView`

#### Location / Encounter Band

Below the score bar, add a second thin bar showing:
- 📍 Current location name
- 🗡️ Encounter name (when in encounter step)

#### Expandable Quests/Milestones Panel

A collapsible card between the location band and narrative log:
- Shows active quest objective
- Lists milestones with completed/active/pending status

#### Navigation Buttons

Replace the single "Next Day" button with a button row:
- **⏪ Prev Day**: go to first step of previous day
- **◀ Prev Step**: go to previous step
- **▶ Next Step**: advance one step
- **⏩ Next Day**: advance to first step of next day
- **⏭ Skip to Results**: jump to end (unchanged)

---

## Open Issues

1. **Performance**: Per-step data will be larger than per-day. We estimate
   ~5-15 steps per day × 30 days = 150-450 steps. This is acceptable for
   in-memory use but confirms the decision not to persist narrative data.

2. **BRL vs TypeScript**: The actual party-position tracking is done in
   TypeScript narrative generation, not in BRL rules. Full BRL migration
   of travel/voting is a separate task. This change extends the TypeScript
   side to produce richer step data.

3. **Score interpolation**: The combat score comes from WASM snapshots (one
   per ~4 kills). We interpolate the score across story steps within a day.
   This is approximate but sufficient for the stepped UI.

4. **Blocking encounter resolution**: Currently cosmetic (narrative text
   only). Making blocking encounters actually halt step progression is a
   UI-level concern — the step is flagged as blocking and shown to the
   user, but since the sim is pre-computed, it doesn't change the outcome.
   True blocking would require a BRL-level simulation change (future work).
