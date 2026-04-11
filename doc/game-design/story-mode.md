# Story Mode — Game Design

This document describes the **Story Mode** system — an alternative run type that replaces the 3000-encounter fight loop with a 30-day simulated journey through a procedurally generated map. The party travels between locations, makes decisions via trait-based voting, and encounters enemies during travel segments. A textual narrative is generated in real time so the player can read the story of their party's adventure.

All logic — map generation, party decisions, encounter spawning, travel, camping, and narrative text — is implemented in BRL. The UI's only responsibility is displaying the textual output and final results.

---

## Design Goals

- **Alternative experience**: Story Mode offers a narrative-driven run alongside the existing Fight Mode. Both produce a score and are stored in run history.
- **Same heroes, different journey**: The same hero roster, traits, classes, and combat rules apply. What changes is the *structure* around the encounters.
- **Deterministic from traits**: The virtual map, party decisions, encounter selection, and narrative text are all deterministic given the adventure's traits and the party composition.
- **Textual storytelling**: The run produces a scrollable textual log at three verbosity levels. This log is available during playback and on the results screen but is **not** persisted in run history (to save storage).
- **Implemented in BRL**: All story-mode logic lives in BRL rules. The UI receives structured narrative events and renders them — it does not contain game logic.

---

## Mode Selection

When starting a run, the adventure definition includes a `runType` field:

| Value | Description |
|-------|-------------|
| `fight` | Classic 3000-encounter mode (current behaviour) |
| `story` | 30-day story mode described in this document |

The player selects the run type on the adventure configuration screen. The choice is stored in `AdventureDefinition.runType` and encoded in share links.

All existing game modes (easy, normal, hard, custom) apply to story mode — they alter scoring rules, encounter difficulty, and flee config identically to fight mode.

---

## Time Model

Story mode replaces the encounter counter with a **simulation clock measured in days**.

| Parameter | Value | Notes |
|-----------|-------|-------|
| `totalDays` | 30 | Total simulated journey length |
| `hoursPerDay` | 12 | Usable travel/activity hours per day (rest happens automatically) |
| `snapshotInterval` | 1 day | One UI snapshot per day (30 snapshots total, matching the 30-checkpoint fight-mode display) |

The simulation clock advances as the party performs activities: travelling between locations, fighting encounters, camping, and resting. When `currentDay >= totalDays`, the run ends.

### Day Structure

Each day follows this loop:

```
DayStart
  ├── Party votes on next destination (or stay)
  ├── If travelling:
  │     ├── Consume travel time (hours)
  │     ├── For each travel segment:
  │     │     ├── Roll for encounter (probability based on route danger)
  │     │     └── If encounter: run combat (same rules as fight mode)
  │     └── Arrive at destination
  ├── If at town (tavern):
  │     ├── Full heal + optional bonuses
  │     └── Consume 2 hours
  ├── If camping in wilderness:
  │     ├── Partial heal (50% of missing HP/mana)
  │     ├── Night ambush chance (15% base)
  │     └── Consume remaining day hours
  └── DayEnd → record snapshot, advance day counter
```

---

## Virtual Map

### Map Structure

The virtual map is a **directed graph** of **locations** connected by **routes**. Locations are nodes; routes are edges with travel time and danger rating.

There are two location types:

| Type | Description | Heal | Bonuses |
|------|-------------|------|---------|
| **Town** (tavern) | A settlement with an inn | Full heal (HP + mana to max) | Optional: +5% XP for next day, shop buffs |
| **Wilderness** | A wild area (forest, ruins, cave, etc.) | Camp for partial heal | Higher encounter density, better XP rewards |

### Map Generation

The map is generated deterministically from a **seed** computed from the adventure's traits:

```
mapSeed = hash(adventureName + "|" + mode + "|" + str(requiredHeroCount) + "|"
               + sortedAllowedClasses.join(",") + "|"
               + str(environmentSettings.physicalPct) + "|"
               + str(environmentSettings.magicalPct) + "|"
               + str(environmentSettings.firePct) + "|"
               + str(environmentSettings.waterPct) + "|"
               + str(environmentSettings.windPct) + "|"
               + str(environmentSettings.earthPct) + "|"
               + str(environmentSettings.lightPct) + "|"
               + str(environmentSettings.darknessPct))
```

All values are converted to strings with a `|` delimiter before hashing. The `hash` function is a simple integer hash (e.g., DJB2 or FNV-1a) producing a 32-bit unsigned integer.

Using `mapSeed` as the PRNG seed, the generator produces:

1. **Location count**: 12–18 locations (scaled by `mapSeed % 7 + 12`).
2. **Town/wilderness ratio**: 30–40% towns, 60–70% wilderness.
3. **Location placement**: Locations are arranged in roughly 5 "layers" from start to end:
   - Layer 0: **Starting Town** (always a town — the party begins here)
   - Layers 1–3: Mixed towns and wilderness
   - Layer 4: **Final Destination** (always a wilderness — the climactic area)
4. **Route generation**: Each location connects to 2–3 locations in the next layer. Some skip-connections span two layers (shortcuts or detours). No backward edges.
5. **Route properties**: Each route has:
   - `travelHours`: 2–6 hours (based on distance between layers and a PRNG roll)
   - `dangerRating`: 1–5 (determines encounter probability per travel segment)
   - `terrain`: one of the terrain types below

### Location Naming

Location names are assembled from themed word banks selected by the adventure's environment settings:

| Environment Emphasis | Name Themes |
|---------------------|-------------|
| Fire-heavy | Ember Hollow, Ashfall Pass, Cindervale, Scorched Basin |
| Water-heavy | Mistshore, Tidecrest, Deepwell, Glimmer Falls |
| Wind-heavy | Galeridge, Stormcrest, Whispering Heights, Zephyr Crossing |
| Earth-heavy | Ironhold, Stonecradle, Deeproot, Boulder Arch |
| Light-heavy | Dawnspire, Solace Crossing, Radiant Glade, Luminary Rest |
| Darkness-heavy | Duskhollow, Shadowmere, Nightveil, Murk's End |
| Balanced / Physical | Crossroads, Thornfield, Rustvale, Old Bridge |
| Balanced / Magical | Arcane Bluff, Spellhaven, Runestone Ridge, Glyphwatch |

Each location draws 1–2 words from the relevant bank(s), ensuring no duplicates within a single map.

### Terrain Types

Routes have a terrain type that influences encounter flavour and enemy selection:

| Terrain | Description | Encounter Modifier | Common Enemies |
|---------|-------------|-------------------|----------------|
| `forest` | Dense woodland | +1 danger | Goblins, Dark Wolves, Trolls |
| `mountain` | Rocky highland passes | +0 danger, +1 travel hour | Orcs, Ogres, Dragons |
| `swamp` | Marshy lowlands | +1 danger, poison chance | Zombies, Vampires |
| `plains` | Open grasslands | −1 danger, fast travel | Orc Raiders, Skeleton Warriors |
| `ruins` | Ancient crumbling structures | +2 danger, bonus XP | Skeletons, Dark Mages, Demons |
| `cave` | Underground passages | +1 danger, ambush chance | Trolls, Demon Knights |

Terrain is selected based on the adventure's dominant environment element (highest `*Pct` slider) with PRNG variation.

---

## Party Decision System

### Voting Mechanism

At each decision point (start of day, when the party must choose a destination), each hero **votes** on the next location. The party takes the action with the most votes. Ties are broken by the hero with the highest `trait_co` (order trait — the most orderly hero is the tiebreaker). If multiple heroes share the highest `trait_co`, the hero with the lowest entity ID decides (deterministic ordering).

### Hero Voting Preferences

Each hero evaluates every reachable destination and assigns a **preference score** based on their traits. The destination with the highest score receives the hero's vote.

#### Preference Scoring

For each candidate destination `d`:

```
score(hero, d) =
    safetyScore(hero, d)
  + explorationScore(hero, d)
  + healingNeedScore(hero, d)
  + greedScore(hero, d)
  + noise(hero, d)
```

##### Safety Score
Cautious heroes prefer towns and low-danger routes; risky heroes seek danger.

```
safetyScore =
    w_rc × (isTown(d) ? +2.0 : −1.0)
  + w_rc × (−dangerRating(route) / 5.0)   // cautious avoids danger
  + w_od × (isTown(d) ? +1.0 : −0.5)      // defensive heroes prefer towns
```

##### Exploration Score
Adventurous (chaotic, sly) heroes prefer wilderness and unexplored locations.

```
explorationScore =
    (−w_co) × (isWilderness(d) ? +1.5 : 0.0)   // chaos prefers wilderness
  + (−w_sh) × (isUnvisited(d) ? +1.0 : −0.5)    // sly seeks new territory
```

##### Healing Need Score
When the party is injured, supportive and cautious heroes push for towns.

```
avgPartyHpPct = average(hero.Health.current / hero.Health.max) for all heroes
healingNeedScore =
    (−w_sa) × max(0, (1.0 − avgPartyHpPct) × 3.0)   // supportive → heal
  + w_rc × max(0, (1.0 − avgPartyHpPct) × 2.0)       // cautious → heal
```

##### Greed Score
Attacker and offensive heroes prefer high-danger wilderness for more XP.

```
greedScore =
    w_sa × (dangerRating(route) / 5.0) × 1.5   // attacker wants fights
  + (−w_od) × (dangerRating(route) / 5.0)       // offensive seeks challenge
```

##### Noise
Small deterministic noise seeded per hero-location-day to break symmetry. Uses the run's seeded PRNG:

```
noise = seeded_random(hero.id, d.id, currentDay) × 0.5   // [0, 0.5)
```

### Decision Types

| Decision | When | Options |
|----------|------|---------|
| **Choose destination** | Start of day | All locations connected by routes from current location |
| **Camp vs. press on** | After arriving at wilderness with hours remaining | Camp (end day, partial heal) or continue to next location |
| **Flee from encounter** | During travel combat (same rules as fight mode) | Flee (time penalty) or fight |

For "camp vs. press on", the vote uses the same trait logic: cautious/defensive heroes vote to camp, risky/offensive heroes vote to press on. If hours remaining < shortest route to any neighbour, camping is automatic.

---

## Encounters in Story Mode

### Encounter Triggering

During travel along a route, the simulation divides the route into **segments** of 1 hour each. For each segment:

```
encounterChance = 0.15 + (dangerRating × 0.10)
```

| Danger Rating | Encounter Chance per Segment |
|---------------|------------------------------|
| 1 | 25% |
| 2 | 35% |
| 3 | 45% |
| 4 | 55% |
| 5 | 65% |

A PRNG roll determines whether an encounter occurs. When it does, the encounter uses the **same combat rules** as fight mode:
- Enemy tier is based on the current day: `tier = clamp(floor(currentDay / 5) + 1, 1, 6)`.
  - Days 1–4: Tier 1, Days 5–9: Tier 2, Days 10–14: Tier 3, Days 15–19: Tier 4, Days 20–24: Tier 5, Days 25–30: Tier 6.
  - The tier-6 plateau in the final 5 days is intentional — it provides the climactic difficulty ramp where the final boss awaits.
- Enemy count matches party size ± 1.
- Between-encounter full healing still applies (each travel encounter is self-contained).
- XP, scoring, and death penalties apply normally.

### Boss Encounters

- **Mini-boss**: Every 5th encounter (encounter count across the whole run, not per route) includes a mini-boss.
- **Final boss (Lord Vexar)**: Spawns in the **Final Destination** location on day 30 (or the last day). Reaching the Final Destination triggers the climactic encounter.

### Encounter Flavour by Terrain

Enemy pools are filtered by terrain type in addition to tier:

| Terrain | Preferred Enemies (when available at tier) |
|---------|-------------------------------------------|
| `forest` | Goblin, Dark Wolf, Troll |
| `mountain` | Orc, Ogre, Dragon, Ancient Dragon |
| `swamp` | Zombie, Vampire |
| `plains` | Orc Raider, Skeleton Warrior |
| `ruins` | Skeleton, Dark Mage, Lich King |
| `cave` | Troll, Demon Knight, Demon Lord |

If the preferred pool is empty for the current tier, the standard tier pool is used as fallback.

### Night Ambush

When the party camps in the wilderness, there is a **15% base chance** of a night ambush:

```
ambushChance = min(0.40, 0.15 + (locationDangerAvg × 0.05))
```

Where `locationDangerAvg` is the average danger rating of all routes connected to that location. The cap of 40% ensures ambushes remain an occasional threat, not a certainty. At the maximum danger rating of 5, ambush chance reaches the 40% cap.

Ambush encounters use the same combat rules but heroes start at **75% of maximum HP** (they were resting, not fully alert). A successful defense awards bonus XP (+25%).

---

## Narrative System

### Overview

The narrative system produces a **textual log** of the party's journey. Messages are generated by BRL rules whenever significant events occur. Each message has a **verbosity level**:

| Level | Name | Description | Example |
|-------|------|-------------|---------|
| 1 | **Headlines** | Major events only | "Day 5 — The party arrives at Ironhold." |
| 2 | **Standard** | Decisions, encounters, arrivals | "After a vote, the party heads toward Shadowmere. Kira and Aldric argued for the dangerous route through the ruins." |
| 3 | **Detailed** | Combat results, individual votes, terrain descriptions | "The forest path narrows as twisted roots claw at the party's boots. A pack of goblins bursts from the undergrowth. Lyra unleashes a fireball, scorching two. The party prevails with no casualties." |

The player can toggle verbosity in the UI during playback and on the results screen. All three levels are generated; the UI filters by the selected level.

### Message Generation

Messages are generated by BRL rules and stored in a `NarrativeLog` component on the game-state entity. Each entry is:

```
component NarrativeEntry {
    day: integer
    hour: integer
    level: integer        // 1, 2, or 3
    text: string
}
```

The `NarrativeLog` component holds a list of entries:

```
component NarrativeLog {
    entries: list<NarrativeEntry>
}
```

### Narrative Templates

Narrative text is assembled from **template banks** indexed by event type. Templates use placeholder tokens replaced at generation time.

#### Travel Templates (Level 2)

```
"The party sets out from {origin} toward {destination}, following the {terrain} road."
"Leaving {origin} behind, the heroes march {direction} through {terrain_desc}."
"{leader} leads the way as the party departs {origin}. The path to {destination} stretches ahead."
```

#### Decision Templates (Level 2)

```
"A heated debate breaks out. {voters_for} vote to head for {destination}, outvoting {voters_against}."
"The party quickly agrees: {destination} is the next stop."
"{tiebreaker} settles the tie — the party will head to {destination}."
```

#### Arrival Templates (Level 1)

```
"Day {day} — The party arrives at {location}."
"After {hours} hours on the road, {location} comes into view."
"The gates of {location} welcome the weary travelers."    // town only
"The party makes camp at {location}."                      // wilderness only
```

#### Encounter Templates (Level 2)

```
"Ambush! {enemy_count} {enemy_name}s leap from the shadows."
"The road ahead is blocked by {enemy_count} {enemy_name}s."
"A {enemy_name} and its pack bar the party's path."
```

#### Combat Outcome Templates (Level 3)

```
"The party defeats the {enemy_name}s. {kills} enemies slain, {xp} XP earned."
"{hero_name} lands the killing blow on the {enemy_name}. The party earns {xp} XP."
"{hero_name} falls in battle but is revived by the party's magic."
"A fierce fight! {deaths} heroes fell but the party prevails."
"The party flees, losing precious time."
```

#### Town Templates (Level 2)

```
"The party rests at the {location} tavern. All wounds are healed."
"A warm meal and a soft bed restore the party to full strength."
"The innkeeper shares rumors of dangers ahead."
```

#### Camping Templates (Level 2)

```
"The party sets up camp as night falls. A small fire wards off the cold."
"Under a canopy of stars, the heroes take turns on watch."
"{hero_name} volunteers for first watch."    // hero with highest w_sh (honorable)
```

#### Ambush Templates (Level 2)

```
"The night watch spots movement! {enemy_count} {enemy_name}s attack the camp."
"A surprise attack in the dead of night! The party scrambles to defend."
```

#### Boss Templates (Level 1)

```
"At the heart of {location}, an ancient evil stirs — Lord Vexar appears!"
"A mini-boss emerges: a fearsome {enemy_name}, stronger than any foe yet faced."
```

#### Day Summary Templates (Level 1)

```
"Day {day} ends. The party rests at {location}. {encounters} encounters, {kills} kills, party HP at {hp_pct}%."
"Day {day} complete. {distance} hours traveled, {encounters} battles fought."
```

### Template Selection

Templates are selected using the PRNG seeded by `(mapSeed + day + hour + eventType)`, ensuring deterministic but varied text across the run.

---

## Scoring in Story Mode

Story mode uses the **same scoring components** as fight mode (`Score`, `ScoringRules`). The following adaptations apply:

| Aspect | Fight Mode | Story Mode |
|--------|-----------|------------|
| Run length | 3000 encounters | 30 days |
| Snapshot interval | Every 100 encounters | Every 1 day |
| Encounter source | Continuous spawning | Travel segments + ambushes |
| Expected encounter count | 3000 | ~60–120 (varies by route choices) |
| Boss frequency | Every 100 encounters | Every 5 encounters |
| Points per kill | Same | Same (mode-dependent) |
| Speed bonus | Based on total sim time | Based on total sim time |

### Additional Story Mode Scoring

| Bonus | Points | Condition |
|-------|--------|-----------|
| Exploration bonus | +50 per unique location visited | Visiting a location for the first time |
| Path diversity | +200 | Visited ≥ 80% of locations |
| Town rest bonus | +25 per town rest | Resting at a tavern |
| Ambush survival | +100 per ambush survived | Defending a night ambush without deaths |
| Final destination reached | +500 | Reaching the Final Destination |
| Lord Vexar defeated | Same as fight mode | Defeating the final boss |

These bonuses are tracked in the `StoryScore` component (see Components below).

---

## Components

### `StoryConfig`

Attached to: the game-state entity (only in story mode runs).

| Field | Type | Description |
|-------|------|-------------|
| `totalDays` | integer | Total journey length (default 30) |
| `hoursPerDay` | integer | Usable hours per day (default 12) |
| `currentDay` | integer | Current simulation day (starts at 1) |
| `currentHour` | integer | Current hour within the day (0–11) |
| `encounterCount` | integer | Total encounters triggered this run |
| `runType` | string | `"story"` — identifies this as a story mode run |

### `MapGraph`

Attached to: the game-state entity.

| Field | Type | Description |
|-------|------|-------------|
| `locationCount` | integer | Number of locations in the map |
| `mapSeed` | integer | Seed used for map generation |

### `MapLocation`

Attached to: one entity per location.

| Field | Type | Description |
|-------|------|-------------|
| `locationId` | integer | Unique location index (0 = start, locationCount−1 = final) |
| `name` | string | Generated location name |
| `locationType` | string | `"town"` or `"wilderness"` |
| `layer` | integer | Layer in the map graph (0–4) |
| `visited` | boolean | Whether the party has visited this location |
| `isStarting` | boolean | Whether this is the starting town |
| `isFinal` | boolean | Whether this is the final destination |

### `MapRoute`

Attached to: one entity per route.

| Field | Type | Description |
|-------|------|-------------|
| `fromLocationId` | integer | Origin location index |
| `toLocationId` | integer | Destination location index |
| `travelHours` | integer | Hours required to traverse |
| `dangerRating` | integer | Danger level (1–5) |
| `terrain` | string | Terrain type (`forest`, `mountain`, `swamp`, `plains`, `ruins`, `cave`) |

### `PartyPosition`

Attached to: the game-state entity.

| Field | Type | Description |
|-------|------|-------------|
| `currentLocationId` | integer | Location the party is currently at |
| `isTravelling` | boolean | Whether the party is currently on a route |
| `travelProgress` | integer | Hours completed on the current route |
| `currentRouteFrom` | integer | Origin location of current route (if travelling) |
| `currentRouteTo` | integer | Destination location of current route (if travelling) |

### `StoryScore`

Attached to: the run-stats entity (only in story mode).

| Field | Type | Description |
|-------|------|-------------|
| `locationsVisited` | integer | Unique locations visited |
| `totalLocations` | integer | Total locations in the map |
| `townsRested` | integer | Number of town rests |
| `ambushesSurvived` | integer | Night ambushes survived without deaths |
| `finalDestinationReached` | boolean | Whether the party reached the final location |
| `explorationBonus` | integer | Score from exploration |
| `pathDiversityBonus` | integer | Score from path diversity |

### `NarrativeEntry`

(Defined above.) Represents a single narrative log message.

| Field | Type | Description |
|-------|------|-------------|
| `day` | integer | Day the message was generated |
| `hour` | integer | Hour the message was generated |
| `level` | integer | Verbosity level (1–3) |
| `text` | string | The narrative text |

### `NarrativeLog`

Attached to: the game-state entity.

| Field | Type | Description |
|-------|------|-------------|
| `entries` | list\<NarrativeEntry\> | All narrative entries for the current run |

### `HeroVote`

Transient component used during decision-making, attached to each hero entity.

| Field | Type | Description |
|-------|------|-------------|
| `votedLocationId` | integer | The location this hero voted for |
| `preferenceScore` | decimal | The hero's score for their chosen location |

---

## Events

| Event | Fields | Description |
|-------|--------|-------------|
| `StoryStart` | — | Initialises the story mode run: generates map, places party at starting town |
| `GenerateMap` | `seed` | Triggers map generation from the seed |
| `DayStart` | `day` | Begins a new day; triggers party vote |
| `PartyVote` | `day` | Heroes vote on the next destination |
| `VoteResolved` | `destinationId`, `voteCount` | The vote result; party moves toward the winning destination |
| `TravelStart` | `fromId`, `toId`, `hours`, `terrain` | Party begins travelling a route |
| `TravelSegment` | `hour`, `terrain`, `dangerRating` | One hour of travel; may trigger an encounter |
| `TravelEncounter` | `tier`, `terrain`, `enemyCount` | An encounter is triggered during travel |
| `TravelArrival` | `locationId` | Party arrives at a destination |
| `TownRest` | `locationId` | Party rests at a town tavern (full heal) |
| `CampStart` | `locationId` | Party camps in the wilderness |
| `NightAmbush` | `locationId`, `tier`, `enemyCount` | Night ambush encounter |
| `DayEnd` | `day` | Day ends; snapshot recorded |
| `StoryComplete` | `finalScore` | Story mode run is complete (day 30 reached) |
| `NarrativeMessage` | `day`, `hour`, `level`, `text` | A narrative entry is added to the log |

---

## Rules (Logical Design)

These rules describe the logical flow. They will be implemented as BRL `rule` blocks.

### `story_init` — on `StoryStart`

1. Compute `mapSeed` from adventure traits.
2. Schedule `GenerateMap` event.
3. Initialise `StoryConfig`, `PartyPosition` (at location 0), `StoryScore`, `NarrativeLog`.
4. Emit narrative: "The adventure begins at {startingTown}." (Level 1)

### `generate_map` — on `GenerateMap`

1. Determine location count (12–18) from seed.
2. Generate locations across 5 layers with town/wilderness assignment.
3. Generate location names from themed word banks.
4. Generate routes between adjacent layers (2–3 per location).
5. Assign route properties (travel hours, danger rating, terrain).
6. Create entity for each location and route with the relevant components.
7. Schedule `DayStart` for day 1.

### `day_start` — on `DayStart`

1. Emit narrative: "Day {day} begins." (Level 1)
2. If party is at a town, emit town description (Level 3).
3. If party is at wilderness, emit wilderness description (Level 3).
4. Schedule `PartyVote`.

### `party_vote` — on `PartyVote`

1. Find all routes from the current location.
2. For each hero, compute preference scores for each reachable destination.
3. Each hero votes for their top-scored destination.
4. Tally votes. Break ties using the hero with highest `trait_co` (secondary: lowest entity ID).
5. Emit narrative about the vote (Level 2): who voted for what, who won.
6. Schedule `VoteResolved` with the winning destination.

### `vote_resolved` — on `VoteResolved`

1. If winning destination requires travel, schedule `TravelStart`.
2. If party votes to stay/camp (only possible in wilderness), schedule `CampStart`.

### `travel_start` — on `TravelStart`

1. Set `PartyPosition.isTravelling = true`.
2. Emit narrative: travel departure (Level 2).
3. Schedule first `TravelSegment` (hour 0).

### `travel_segment` — on `TravelSegment`

1. Advance `StoryConfig.currentHour` by 1.
2. Roll for encounter based on danger rating.
3. If encounter: schedule `TravelEncounter`.
4. If no encounter: emit terrain description (Level 3).
5. If more hours remain on this route, schedule next `TravelSegment`.
6. If route completed, schedule `TravelArrival`.

### `travel_encounter` — on `TravelEncounter`

1. Determine enemy tier from current day.
2. Determine enemy count (party size ± 1).
3. Filter enemy pool by terrain type + tier.
4. Spawn enemies (reusing fight-mode spawn rules).
5. Emit encounter narrative (Level 2).
6. Run combat to completion (reuses all fight-mode combat rules).
7. On combat end:
   - Increment `StoryConfig.encounterCount`.
   - Check for mini-boss trigger (every 5th encounter).
   - Emit combat outcome narrative (Level 3).
   - Continue travel (resume `TravelSegment` scheduling).

### `travel_arrival` — on `TravelArrival`

1. Set `PartyPosition.currentLocationId` to destination.
2. Set `PartyPosition.isTravelling = false`.
3. Mark location as visited.
4. Increment `StoryScore.locationsVisited` if first visit.
5. Award exploration bonus (+50 points).
6. Emit arrival narrative (Level 1).
7. If destination is a town, schedule `TownRest`.
8. If destination is wilderness and hours remain, vote to camp or press on.
9. If destination is final and it's the last day, trigger final boss.

### `town_rest` — on `TownRest`

1. Heal all heroes to full HP and mana.
2. Increment `StoryScore.townsRested`.
3. Award town rest bonus (+25 points).
4. Consume 2 hours.
5. Emit town narrative (Level 2).
6. If hours remain, the party may vote on next destination.
7. If no hours remain, schedule `DayEnd`.

### `camp_start` — on `CampStart`

1. Heal all heroes by 50% of missing HP and mana.
2. Consume remaining day hours.
3. Emit camping narrative (Level 2).
4. Roll for night ambush.
5. If ambush: schedule `NightAmbush`.
6. If no ambush: schedule `DayEnd`.

### `night_ambush` — on `NightAmbush`

1. Set all heroes' HP to 75% of their maximum HP (ambush catches them resting).
2. Spawn encounter (same rules as travel encounter).
3. Emit ambush narrative (Level 2).
4. On combat end:
   - If survived with no deaths: increment `StoryScore.ambushesSurvived`, award +100 points.
   - Award bonus XP (+25%).
   - Emit outcome narrative (Level 3).
5. Schedule `DayEnd`.

### `day_end` — on `DayEnd`

1. Record day snapshot (same format as fight-mode checkpoint).
2. Emit day summary narrative (Level 1).
3. If `currentDay >= totalDays`, schedule `StoryComplete`.
4. Else advance `currentDay`, reset `currentHour`, schedule next `DayStart`.

### `story_complete` — on `StoryComplete`

1. Check path diversity: if `locationsVisited / totalLocations >= 0.8`, award +200.
2. Check final destination: if reached, award +500.
3. Compute final score (reuses fight-mode score formula + story bonuses).
4. Emit narrative: "The journey ends." (Level 1).
5. Fire `RunEnded` event.

---

## Map Layout Example

Below is an example map generated for a fire-heavy, normal-mode, 4-hero adventure:

```
Layer 0          Layer 1          Layer 2          Layer 3          Layer 4
─────────        ─────────        ─────────        ─────────        ─────────
                 ┌─ Ember         ┌─ Cindervale ─┐
Ashfall    ──────┤  Hollow ───────┤  (wilderness) ├── Scorched  ─── Vexar's
(town)           │  (wilder.)     │               │   Rest          Crater
[START]          │                └─ Blazeheart ──┘   (town)        (wilder.)
                 └─ Ironhold ──────  (wilderness)                   [FINAL]
                    (town)      ─── Firewatch ────── Obsidian
                                    (town)           Reach
                                                     (wilder.)
```

Routes shown as `───`. Each route has a travel time (2–6 hours) and danger rating (1–5). The party starts at Ashfall and must reach Vexar's Crater by day 30.

---

## Integration with Existing Systems

### AdventureDefinition

Add `runType` field:

```typescript
export interface AdventureDefinition {
  // ... existing fields ...
  runType: 'fight' | 'story';  // default: 'fight'
}
```

### Share Links

Add `rt` parameter for run type:

```
rt=f   → fight mode (default, can be omitted)
rt=s   → story mode
```

### UI Changes

| Screen | Change |
|--------|--------|
| Adventure Manager | Add run type toggle (Fight / Story) |
| Party Select | No change |
| Loading | No change |
| Battle Screen | Add scrollable narrative log panel with verbosity toggle. Day-by-day playback (1 day/sec) instead of encounter-based. |
| Results Screen | Add narrative log viewer. Show story-specific KPIs (locations visited, towns rested, ambushes survived). |

### Run History

Story mode runs are stored in run history like fight mode runs. The `NarrativeLog` is **not** persisted — it is available only for the current run. The run history entry stores the final score, KPIs, and party composition as usual.

### BRL File Organization

| File | Purpose |
|------|---------|
| `story-mode.brl` | Story mode components, map generation, travel, camping, voting rules |
| `story-narrative.brl` | Narrative template banks and text generation rules |
| `story-encounters.brl` | Story mode encounter triggering and terrain-based enemy selection |
| `story-scoring.brl` | Story mode scoring bonuses and final score computation |

These files will be compiled alongside the existing `classic-rpg.brl` rules. Story mode rules are guarded by a `StoryConfig` component check — they only fire when the run is in story mode.

---

## Design Notes

- **Encounter count is variable**: Unlike fight mode's fixed 3000, story mode produces ~60–120 encounters depending on route choices and PRNG rolls. Scoring is calibrated so that story mode scores are comparable to fight mode scores.
- **Reuse of combat**: The actual fight mechanics are identical — story mode is a different *structure* around the same combat engine.
- **Narrative is ephemeral**: The log can be large (hundreds of entries). Persisting it for every run would bloat storage. Instead, it's available during and immediately after the current run only.
- **Map is small and playable**: 12–18 locations with 5 layers keeps decisions meaningful without overwhelming the autonomous simulation. Most runs visit 8–12 locations.
- **Hero personality shines**: The voting system makes hero traits visible in a new way — a reckless rogue might drag the party into danger, while a cautious paladin argues for the safe route. This creates emergent stories.
- **Balance target**: Story mode should produce scores in the same general range as fight mode for the same difficulty. Initial playtesting should compare mean scores and adjust encounter frequency / bonus values accordingly.
- **Future extensions**:
  - **Named NPCs** in towns that give quests (bonus encounters with extra rewards).
  - **Branching events**: Random events during travel (find treasure, rescue NPC, discover shortcut).
  - **Weather system**: Weather effects that modify travel time and encounter difficulty.
  - **Party morale**: A morale component affected by decisions and outcomes, influencing voting weights.
