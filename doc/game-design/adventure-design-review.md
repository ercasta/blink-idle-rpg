# Adventure System Design Review

Story mode currently generates stories that are sometimes inconsistent and have little appeal from a storytelling perspective.

I think we need to act on multiple levels:
- **Narrative content expansion**: dialogues, descriptions, must be extended
- **Narrative consistency and event ordering**: some things still happen out of order, e.g. enemy fights while heroes are solving hero encounters.

Some Ideas:
- **Pathos level management**: randomly generate a "pathos pattern" e.g. flat, up, peak, down, or going up / down multiple times. In the encounter/events library, assign a "pathos level" to each encounter, so when the story encounters are randomly selected, they are selected in a way that follows that story "pathos pattern" (there might be a library of pathos patterns that are randomly)
- **Structure**: the story might have a multilevel structure, e.g. a backbone made by a main quest, potentially made of a predetermined set of steps; on top of this, some minor events or side quests might happen. The steps of the main / side quests might involve travelling to a set of locations, e.g. the story might specify that the initial location is also the final location where the heroes must be, so even if the first location is drawn randomly, it will also be the last one to be visited. This might be managed by defining a set of locations (like the "pluggable slots" concept) that are referenced multiple times.
- **Characterization**: create dialogues with "pluggable characters" e.g. some parts of dialogues select the speaker, or the person addressed, based on hero traits. Each piece of dialogue has "affinity traits" that allow selecting a character
- **Consistency**: combined with the previous idea, once a character is selected, this information is tracked as subsequent piece of dialogue will select the same character
- **Inertia**: some things shift gradually. Hero mood. Hostility / friendship with NPCs, etc.
- **Localization**: some things might only happen in some location, or locations with some characteristics, like mountain, town.
- **Dynamicity**: some parts of the descriptions, or hero comments, might be based not only on hero traits but also on condition, e.g. mood, night / day, weather.


Everything must be designed in a way that content might be gradually expanded by game authors in terms of content.

Testing the system.
- We might generate a set of stories and see how well they could be represented by the adventure design system we are designing, reflecting on possible improvements / issues.

---

## Current System Analysis

This section analyses the existing BRL codebase as of the review date, mapping each design idea above to the current implementation and identifying concrete gaps.

### Current Architecture Overview

The adventure system is spread across several BRL files:

| File | Role |
|---|---|
| `story-adventure.brl` | ECS component and event schemas for the quest system (AdventureState, QuestMilestone, QuestEvent, SlotBinding, …) |
| `story-adventure-templates.brl` | Data entities: 9 ObjectiveTemplate, 14 MilestoneTemplate, ~20 EventTemplate |
| `adventure-expansion-set-1.brl` | 30 HeroEncounterTemplate (class + trait encounters), related components and rules |
| `expansion-pack-2.brl` | 30 additional HeroEncounterTemplate (different scenarios) |
| `story-quest-pools.brl` | Content pools: villains, items, curses, portals, riddles, threats, cargos, etc. |
| `story-rules.brl` | Day-by-day narrative generation (StoryGenerate → StoryProcessDay → StoryFinalize) |
| `story-mode.brl` | NarrativeEntry, StoryConfig, TravelState, PartyPosition, EncounterState components |
| `story-world.brl` | WorldLocation, WorldPath, BlockingEncounter, HeroArrivalComment components |
| `story-world-data.brl` | 15 concrete world locations with descriptions, paths, NPCs, arrival comments |

Quest composition (selecting objectives, milestones, events, drawing from pools) is performed in TypeScript (`adventureQuest.ts`). The BRL side handles day-by-day narrative output: travel, encounters, arrivals, camp/rest, hero encounters.

---

### Issues Found

#### 1. Enemy fights during hero encounters (narrative consistency)

**Location**: `story-rules.brl` — `story_process_day` rule, lines ~660–912.

**Problem**: When `heroEncToday` is true, the rule correctly skips travel (`shouldTravel = false`) and calls `emitHeroEncounterDay`. However, the encounter simulation itself is driven by TypeScript's combat engine independently of this BRL flag. The `StoryGenerateConfig.totalEncounters` counter keeps counting down across all days including hero-encounter days, meaning the narrative log may show enemy fights mixed with the hero encounter on the same day. The combat engine does not know about hero-encounter-day blocking.

**Fix needed**: TypeScript must not schedule combat encounters on days that have a hero encounter. Alternatively, `StoryHeroEncounter.triggerDay` must be communicated back to the TypeScript combat scheduler so it can exclude those days from the encounter pool.

#### 2. Narrative context loss between quest and narrative layers

**Problem**: The `StoryGenerateConfig` passes `questObjective`, `activeMilestone`, and `completedMilestones` as plain strings. These strings are stamped into every `StoryStepData` and used in the UI, but they are never threaded back into the narrative text itself. Quest events and milestone completions are resolved in TypeScript, so by the time BRL runs, the quest arc is already over — BRL only sees the final snapshot. This means the narrative log cannot describe *how* a milestone was completed or what events occurred during it.

**Fix needed**: Pass richer quest state to BRL — at minimum a list of completed event IDs in order, so BRL can emit narrative for each quest event in the correct temporal position. Or migrate milestone/event resolution into BRL so the causal chain is visible to the narrative rules.

#### 3. No location-specific event filtering

**Problem**: `EventTemplate` has a `triggerLocation` field ("wilderness", "town", "dungeon", "any") but this is not evaluated during narrative generation in BRL — only the TypeScript composition algorithm references it when selecting events. Once an event is bound to a milestone, its location constraint is not checked at narrative time. As a result, a town-only event might be narrated while the party is in the wilderness.

**Fix needed**: When emitting event narratives in BRL, check the current `SelectedLocation.locationType` against the event's `triggerLocation` and either skip or adapt the narrative.

#### 4. Flat encounter narrative (no variation by time-of-day, weather, terrain)

**Problem**: Encounter text in `story_process_day` is generated with generic phrases ("The party encounters X!"). The system already carries `pathDescription`, `elementalAffinity`, and `dangerLevel` per location but none of these are used to colour encounter narrative. Day vs. night is not tracked beyond the camp/ambush decision.

**Fix needed**: Add contextual modifiers to encounter narrative based on location type, terrain, and time-of-day. This is purely a content expansion in BRL — no schema changes strictly required, but a `WeatherState` component could enable weather-driven variation.

#### 5. Hero arrival comments: very limited pool, single trait axis

**Problem**: `findArrivalComment` in `story-rules.brl` only checks the `rc` (reckless/cautious) trait axis and hero class. There is a second axis `od` (offensive/defensive) defined in `StoryHeroInfo.traitOd` but it is never used for arrival comments. The pool in `story-world-data.brl` is small (around 10 entries).

**Fix needed**: Expand `HeroArrivalComment` to support `od` trait checks and add more entries to the pool.

#### 6. Quest scoring is a stub

**Problem**: The `QuestScore` component is defined in `story-adventure.brl` and its fields are computed in TypeScript, but the scoring values are never fed back into BRL narrative. The `StoryStepData.score` field is always set to `0` in `emitStep`. Heroes' journey scores are thus invisible in the narrative log.

**Fix needed**: Either pass computed scores through `StoryGenerateConfig` or emit score events from TypeScript that BRL can reference when generating summary narrative.

---

### Mapping Design Ideas to Implementation Changes

#### Pathos Level Management

**Concept**: Assign a `pathosLevel` (1–5) to each encounter/event template. At adventure composition time, generate a `pathosPattern` (e.g., "rising", "peak_end", "valley_peak", "flat") and select encounters so their pathos levels follow the pattern.

**Current gap**: No `pathosLevel` field exists on any template. No pathos pattern logic exists in TypeScript or BRL.

**Proposed component changes**:
```
// Add to EventTemplate, MilestoneTemplate, HeroEncounterTemplate:
pathosLevel: integer        // 1 (calm) to 5 (climactic)

// New entity type for pathos patterns:
component PathosPattern {
    patternId: string       // e.g. "rising", "peak_end", "valley_peak", "flat"
    sequence: string        // CSV of pathos levels, e.g. "1,2,3,4,5"
}
```

**Proposed event changes**: None required at the BRL event level. The TypeScript composition algorithm selects encounters by matching their `pathosLevel` to the next expected level in the drawn pattern. No new events needed.

**Proposed rule changes**: None in BRL narrative rules. The selection logic lives in TypeScript `adventureQuest.ts` — the `selectEncountersForMilestone` function would need a pathos-aware variant.

**Extensibility**: Authors add new encounters with a `pathosLevel` field. New `PathosPattern` entities can be added without code changes — the composition algorithm picks a random pattern entity.

---

#### Structural / Location Anchoring

**Concept**: The main quest references specific named locations (e.g., start and end at the same town). Locations are "pluggable slots" that are bound once per adventure and reused in templates.

**Current gap**: `selectMap` in `story-rules.brl` picks locations purely by seed-driven graph walk — there is no mechanism to anchor a specific slot (e.g., `{destination_name}`) to a specific `SelectedLocation`. The `AdventureState.objectiveWinCondition` "destination_reached" relies on reaching the last location, but there is no named binding between the destination slot and an actual world location.

**Proposed component changes**:
```
// Extend SlotBinding with a locationId counterpart:
component LocationSlotBinding {
    slotName: string        // e.g. "destination_name", "portal_location"
    locationId: string      // World location ID bound to this slot
    locationIndex: integer  // Index in the SelectedLocation chain
}

// Extend ObjectiveTemplate with optional anchor constraints:
// (new fields on ObjectiveTemplate)
startLocationSlot: string   // Slot name that must bind to the journey's start, e.g. "start_town"
endLocationSlot: string     // Slot name that must bind to the journey's end, e.g. "destination_name"
```

**Proposed rule changes**: The `selectMap` function should, after selecting locations, emit `LocationSlotBinding` entities for any objective that specifies `startLocationSlot` / `endLocationSlot`. Downstream narrative emission can then reference location names via these bindings rather than through the general `SlotBinding`.

---

#### Characterization and Consistency

**Concept**: Dialogue lines have "affinity traits" to select a specific speaker from the party. Once a hero is chosen as the voice for a dialogue thread, that binding is tracked so later lines in the same scene use the same hero.

**Current gap**: Dialogue attribution is done by random hero index selection in BRL narrative rules (e.g., `let watchIdx = floor(random_range(0, hCount))`). There is no persistent "active speaker" tracking.

**Proposed component changes**:
```
component DialogueSpeaker {
    sceneId: string         // Identifies a narrative scene (e.g., "arrival_town_1")
    heroIndex: integer      // Index of the hero assigned to speak in this scene
    heroName: string        // Cached name
    affinityTraits: string  // CSV of traits that prefer this hero, e.g. "rc_positive,class_mage"
}
```

**Proposed rule changes**: When a narrative scene begins, a helper function `assignSpeaker(sceneId, affinityTraits)` checks for an existing `DialogueSpeaker` entity with matching `sceneId`. If none, it selects the best-matching hero and creates one. Subsequent narrative lines in the same scene call `getSpeaker(sceneId)` to retrieve the same hero. At scene end, the entity is removed.

**Extensibility**: Authors add `affinityTraits` to `EventTemplate.narrativeOnTrigger` headers (e.g., a special comment or a new field on `EventTemplate`) without touching rules.

---

#### Inertia (Hero Mood, NPC Relations)

**Concept**: Hero mood shifts gradually based on outcomes. NPC hostility/friendship accumulates across interactions.

**Current gap**: `StoryHeroInfo` has trait axes (`traitRc`, `traitOd`) but no mutable mood or relationship state. There is no component tracking NPC relationship values.

**Proposed component changes**:
```
component HeroMoodState {
    heroIndex: integer
    heroName: string
    moodLevel: integer      // -5 (despairing) to +5 (elated), starts at 0
    lastShift: string       // Reason for last mood change (for narrative)
}

component NpcRelation {
    npcName: string
    relationLevel: integer  // -5 (hostile) to +5 (friendly), starts at 0
    lastInteractionDay: integer
}
```

**Proposed events**:
```
event HeroMoodShifted { heroName: string, delta: integer, reason: string }
event NpcRelationShifted { npcName: string, delta: integer, reason: string }
```

**Proposed rule changes**: Milestone completions, bailouts, hero encounter outcomes all schedule `HeroMoodShifted`. Town visits with `NpcRelation` above 2 enable special narrative lines. The BRL narrative helpers read `HeroMoodState.moodLevel` to select contextual text variants (e.g., a despairing hero comments differently on travel than an elated one).

---

#### Localization (Location-Aware Events)

**Concept**: Certain events or dialogue lines may only fire in specific location types or terrain.

**Current gap**: `EventTemplate.triggerLocation` exists but is not enforced at narrative time in BRL (see Issue 3 above). `HeroEncounterTemplate` also has `triggerLocation` but it is only informational.

**Proposed rule changes** (no new schema needed):
- In `story_process_day`, when iterating over triggered events, add a guard:
  ```
  if event.triggerLocation == "any" || event.triggerLocation == curLoc.locationType { ... }
  ```
- Add a `locationTags` field to `EventTemplate` (mirrors `HeroArrivalComment.locationTags`) so events can be filtered by terrain tags (e.g., "mountain", "coastal") in addition to location type.

**New field on EventTemplate**:
```
locationTags: string    // CSV of required tags, e.g. "mountain,fortified". Empty = no tag filter.
```

---

#### Dynamicity (Condition-Based Narrative)

**Concept**: Hero comments and descriptions vary by mood, time-of-day, and weather.

**Current gap**: BRL narrative rules emit generic text. Time-of-day is tracked via `hour` (0–11) in `NarrativeEntry` but is not used to vary combat or travel text. Weather does not exist as a system concept.

**Proposed component changes**:
```
component WeatherState {
    weatherType: string     // "clear", "rain", "storm", "fog", "snow", "heat"
    intensity: integer      // 1 (mild) to 3 (severe)
    startDay: integer
    durationDays: integer
}
```

**Proposed event**:
```
event WeatherChanged { weatherType: string, intensity: integer }
```

**Proposed rule changes**: 
- At journey start, `story_generate` draws a random `WeatherState` (or a sequence of them for a multi-day weather system).
- `story_process_day` reads the active `WeatherState` and appends weather-specific phrases to travel narrative, encounter descriptions, and camp text.
- `HeroMoodState.moodLevel` is decremented by severe weather and incremented by clear weather (scheduling `HeroMoodShifted`).

**Extensibility**: New weather types are added to the `WeatherState.weatherType` pool in BRL content files, and corresponding narrative phrases are added as new `WeatherNarrativeTemplate` entities.

---

### Summary Table: Changes Required

| Feature | New Components | New Events | Rule Changes | TypeScript Changes |
|---|---|---|---|---|
| Pathos Level Management | `pathosLevel` field on templates; `PathosPattern` entity type | None | None in BRL | `adventureQuest.ts`: pathos-aware encounter selection |
| Location Anchoring | `LocationSlotBinding` | None | `selectMap` emits location slot bindings | `adventureQuest.ts`: pass anchor slots to BRL |
| Characterization & Consistency | `DialogueSpeaker` | None | `assignSpeaker` / `getSpeaker` helpers; scene management in narrative rules | None |
| Inertia (Mood & NPC Relations) | `HeroMoodState`, `NpcRelation` | `HeroMoodShifted`, `NpcRelationShifted` | Mood shifts on milestone/bailout/encounter; mood-variant narrative text | None |
| Localization | `locationTags` field on `EventTemplate` | None | Guard on event trigger location in `story_process_day` | None |
| Dynamicity / Weather | `WeatherState` | `WeatherChanged` | Weather draw at journey start; weather phrases in day/travel/camp narrative | None |
| Combat/Hero-Encounter Ordering (Bug Fix) | None | None | None in BRL | Combat scheduler must exclude hero-encounter days |
| Score in Narrative (Bug Fix) | None | None | Read score fields in finalize summary | Pass scores through `StoryGenerateConfig` |

---

### Extensibility Principles

All proposed changes maintain the principle that **game authors can expand content without touching rules**:

- New `PathosPattern` entities: add to any BRL content file.
- New `WeatherNarrativeTemplate` entities: add to any BRL content file.
- New `HeroArrivalComment` entries: add to `story-world-data.brl`.
- New events with `locationTags` or `pathosLevel`: add to `story-adventure-templates.brl` or an expansion file.
- New `NpcRelation` narrative branches: add `narrativeOnTrigger` variants to existing event templates using the `|` separator.

Rule code only needs to change when new *behaviour* is introduced (e.g., the `assignSpeaker` helper for characterization consistency or the weather draw at journey start).
