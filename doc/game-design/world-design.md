# World Design — Story Mode World System

This document describes the **World System** — a structured, authored layer that
replaces procedurally generated locations and anonymous NPCs with a persistent,
lore-rich world. Adventures draw from this world when generating quests, ensuring
narrative coherence: locations have descriptions, NPCs have names and home
locations, paths have specific characteristics, and hero interactions are
consistent with the world context.

All world data is defined in BRL entity declarations, making it easy for game
designers to extend the world without touching rules or code.

---

## Table of Contents

1. [Design Goals](#design-goals)
2. [Overview](#overview)
3. [World Locations](#world-locations)
4. [World Paths](#world-paths)
5. [World NPCs](#world-npcs)
6. [Location Descriptions and Arrival Narrative](#location-descriptions-and-arrival-narrative)
7. [Hero Arrival Comments](#hero-arrival-comments)
8. [Location-Based Buffs and Debuffs](#location-based-buffs-and-debuffs)
9. [Blocking Encounters](#blocking-encounters)
10. [NPC Role Exclusivity](#npc-role-exclusivity)
11. [Adventure Generation from the World](#adventure-generation-from-the-world)
12. [Pluggable Slot Integration](#pluggable-slot-integration)
13. [BRL Components](#brl-components)
14. [BRL Events](#brl-events)
15. [Adventure Composition Changes](#adventure-composition-changes)
16. [Scoring Integration](#scoring-integration)
17. [Migration Guide](#migration-guide)
18. [Extension Guide](#extension-guide)
19. [Example: World-Driven Adventure Walkthrough](#example-world-driven-adventure-walkthrough)

---

## Design Goals

- **Authored lore**: The world has a fixed set of named locations, paths, and
  NPCs that form a consistent setting. Every adventure draws from this world,
  so players gradually learn the world's geography and characters.
- **Location identity**: Each location has a unique description (shown at
  verbosity level 3) and elemental affinity that affects gameplay through
  buffs, debuffs, and enemy selection.
- **Named NPCs with homes**: NPCs are authored characters with names, roles,
  personalities, and home locations. Some NPCs are bound to a single location;
  others may appear at multiple locations (their exact location in a given
  adventure is determined during generation).
- **Path characteristics**: Paths between locations have specific types
  (mountain pass, imperial road, forest trail, etc.) that determine travel time,
  encounter types, and narrative flavour.
- **Consistent encounters**: Hero encounters respect the location context.
  Blocking encounters (e.g., a giant blocking the path) halt travel until
  resolved. Location affinity determines which enemies appear.
- **Hero comments**: When arriving at locations, heroes occasionally make
  comments based on their class and traits, providing personality-driven flavour
  (shown at verbosity level 3).
- **NPC role exclusivity**: Once an NPC is assigned a role (ally, villain,
  quest-giver) in an adventure, they cannot be reused in a conflicting role.
- **Extensible via BRL**: All world data is BRL entity declarations. Adding a
  new location, NPC, or path requires only adding new entities.
- **Backward compatible**: The world system extends the existing story mode and
  adventure systems. Existing adventures continue to work; the world system
  adds a richer layer on top.

---

## Overview

The world system introduces three core entity types:

```
World
 ├─► WorldLocation (15+ named locations with descriptions and elemental affinity)
 │    ├─► LocationDescription (level 3 narrative shown on arrival)
 │    ├─► LocationBuff (buffs/debuffs applied to heroes based on traits)
 │    └─► HeroArrivalComment (class/trait-based hero comments)
 ├─► WorldPath (25+ connections between locations with path types)
 │    ├─► PathEncounterPool (enemies/NPCs that can be encountered on this path)
 │    └─► BlockingEncounter (encounters that halt travel)
 └─► WorldNpc (20+ named NPCs with home locations and roles)
      └─► NpcRoleAssignment (per-adventure role lock)
```

**Flow at runtime:**

1. During `AdventureCompose`, the world map is **selected** (not generated) —
   a subset of world locations and paths form the adventure's map.
2. NPCs are assigned roles from the world pool. Once assigned, the NPC's role
   is locked for the entire adventure via `NpcRoleAssignment`.
3. When the party arrives at a location, the location description is emitted
   (level 3), location-based buffs/debuffs are applied, and hero comments
   may trigger.
4. When travelling a path, encounters are drawn from the path's encounter pool.
   Blocking encounters halt travel until resolved.
5. Quest milestones, events, and objectives reference world locations and NPCs
   via pluggable slots.

---

## World Locations

Each world location is an authored, named place with persistent identity.
Locations replace the procedurally generated `MapLocation` entities from the
current story mode system.

### Location Properties

| Property | Type | Description |
|----------|------|-------------|
| `locationId` | string | Unique identifier, e.g. `"ironhold"` |
| `name` | string | Display name, e.g. `"Ironhold"` |
| `locationType` | string | `"town"`, `"wilderness"`, `"dungeon"`, `"shrine"`, `"ruins"`, `"fortress"` |
| `region` | string | World region, e.g. `"northern_highlands"`, `"eastern_coast"` |
| `description` | string | 2–4 sentence description shown at verbosity level 3 |
| `elementalAffinity` | string | Dominant element: `"fire"`, `"water"`, `"wind"`, `"earth"`, `"light"`, `"darkness"`, `"neutral"` |
| `dangerLevel` | integer | Base danger (1–5) |
| `tags` | string | Comma-separated location tags for encounter filtering, e.g. `"mountain,cold,ancient"` |

### Elemental Affinity

Each location has a dominant elemental affinity that:

1. **Influences enemy selection**: Enemies matching the location's element are
   preferred when spawning encounters.
2. **Grants buffs/debuffs**: Heroes with traits aligned or opposed to the
   element receive temporary modifiers (see [Location-Based Buffs and
   Debuffs](#location-based-buffs-and-debuffs)).
3. **Flavours narrative**: Location descriptions and hero comments reference the
   elemental theme.

### Built-In Locations (15)

| ID | Name | Type | Region | Element | Danger | Tags |
|----|------|------|--------|---------|--------|------|
| `ashfall_town` | Ashfall | town | volcanic_wastes | fire | 1 | volcanic,warm,trade |
| `ironhold` | Ironhold | town | northern_highlands | earth | 2 | mountain,mining,fortified |
| `mistshore` | Mistshore | town | eastern_coast | water | 1 | coastal,fishing,fog |
| `dawnspire` | Dawnspire | town | central_plains | light | 1 | holy,pilgrimage,archives |
| `thornfield` | Thornfield | town | western_forest | neutral | 2 | forest,market,border |
| `ember_hollow` | Ember Hollow | wilderness | volcanic_wastes | fire | 3 | volcanic,caverns,sulfur |
| `galeridge` | Galeridge | wilderness | northern_highlands | wind | 3 | mountain,exposed,windy |
| `deeproot` | Deeproot | wilderness | western_forest | earth | 3 | forest,ancient,overgrown |
| `shadowmere` | Shadowmere | wilderness | eastern_coast | darkness | 4 | swamp,cursed,fog |
| `radiant_glade` | Radiant Glade | shrine | central_plains | light | 2 | holy,clearing,healing |
| `sunken_crypt` | The Sunken Crypt | dungeon | eastern_coast | darkness | 4 | underground,flooded,undead |
| `stormcrest` | Stormcrest | ruins | northern_highlands | wind | 4 | mountain,ruined,exposed |
| `obsidian_reach` | Obsidian Reach | fortress | volcanic_wastes | fire | 5 | volcanic,fortified,final |
| `glimmer_falls` | Glimmer Falls | wilderness | eastern_coast | water | 2 | waterfall,peaceful,hidden |
| `murks_end` | Murk's End | ruins | western_forest | darkness | 5 | swamp,ruined,cursed |

### Location Regions

Locations are grouped into four regions. Region membership determines which
locations can appear together on an adventure's map:

| Region | Theme | Locations |
|--------|-------|-----------|
| `volcanic_wastes` | Fire, ash, magma | Ashfall, Ember Hollow, Obsidian Reach |
| `northern_highlands` | Mountains, wind, stone | Ironhold, Galeridge, Stormcrest |
| `eastern_coast` | Water, fog, shores | Mistshore, Shadowmere, Sunken Crypt, Glimmer Falls |
| `western_forest` | Trees, earth, darkness | Thornfield, Deeproot, Murk's End |
| `central_plains` | Light, open, holy | Dawnspire, Radiant Glade |

An adventure map draws 8–12 locations from overlapping regions, ensuring
geographic coherence. The map generation algorithm (see [Adventure Generation
from the World](#adventure-generation-from-the-world)) selects a **starting
region** based on the adventure seed and expands outward.

---

## World Paths

Paths connect locations and have specific characteristics that affect gameplay.
Each path has a **path type** — a named category that determines travel time,
encounter likelihood, and narrative flavour.

### Path Properties

| Property | Type | Description |
|----------|------|-------------|
| `pathId` | string | Unique identifier, e.g. `"ashfall_to_ember_hollow"` |
| `fromLocationId` | string | Origin world location ID |
| `toLocationId` | string | Destination world location ID |
| `pathType` | string | Category: `"imperial_road"`, `"mountain_pass"`, `"forest_trail"`, `"coastal_path"`, `"underground_tunnel"`, `"river_crossing"`, `"marsh_track"` |
| `travelHours` | integer | Base travel time in hours (2–8) |
| `dangerRating` | integer | Base danger (1–5), modified by path type |
| `description` | string | 1–2 sentence path description for narrative |
| `encounterTags` | string | Comma-separated tags filtering which enemies/NPCs may be encountered |
| `bidirectional` | boolean | Whether travel is possible in both directions (default: true) |

### Path Types

| Path Type | Travel Modifier | Danger Modifier | Description | Encounter Flavour |
|-----------|----------------|-----------------|-------------|-------------------|
| `imperial_road` | −1 hour | −1 danger | A well-maintained road with patrols | Bandits, merchants, patrols |
| `mountain_pass` | +2 hours | +1 danger | A narrow, winding path through high peaks | Ogres, dragons, rock elementals |
| `forest_trail` | +0 hours | +0 danger | A winding trail through dense woodland | Goblins, wolves, treants |
| `coastal_path` | −1 hour | +0 danger | A path along the shore with ocean views | Pirates, sea creatures, smugglers |
| `underground_tunnel` | +1 hour | +2 danger | A dark passage beneath the earth | Undead, demons, cave dwellers |
| `river_crossing` | +1 hour | +1 danger | A ford or bridge over a river | Water elementals, river trolls |
| `marsh_track` | +2 hours | +1 danger | A treacherous path through bog and mire | Zombies, swamp creatures, will-o-wisps |

Travel time is computed as: `effectiveHours = max(1, baseTravelHours + pathTypeModifier)`.

Danger rating is computed as: `effectiveDanger = clamp(baseDanger + pathTypeModifier, 1, 5)`.

### Built-In Paths (25)

| Path ID | From → To | Type | Base Hours | Base Danger |
|---------|-----------|------|-----------|-------------|
| `ashfall_ember` | Ashfall → Ember Hollow | imperial_road | 3 | 2 |
| `ashfall_ironhold` | Ashfall → Ironhold | mountain_pass | 5 | 3 |
| `ashfall_thornfield` | Ashfall → Thornfield | forest_trail | 4 | 2 |
| `ember_obsidian` | Ember Hollow → Obsidian Reach | underground_tunnel | 4 | 4 |
| `ember_galeridge` | Ember Hollow → Galeridge | mountain_pass | 5 | 3 |
| `ironhold_galeridge` | Ironhold → Galeridge | mountain_pass | 3 | 3 |
| `ironhold_dawnspire` | Ironhold → Dawnspire | imperial_road | 4 | 1 |
| `ironhold_stormcrest` | Ironhold → Stormcrest | mountain_pass | 4 | 4 |
| `dawnspire_radiant` | Dawnspire → Radiant Glade | imperial_road | 2 | 1 |
| `dawnspire_thornfield` | Dawnspire → Thornfield | imperial_road | 3 | 1 |
| `dawnspire_mistshore` | Dawnspire → Mistshore | imperial_road | 4 | 1 |
| `thornfield_deeproot` | Thornfield → Deeproot | forest_trail | 3 | 3 |
| `thornfield_murks` | Thornfield → Murk's End | marsh_track | 5 | 4 |
| `mistshore_shadowmere` | Mistshore → Shadowmere | coastal_path | 3 | 3 |
| `mistshore_glimmer` | Mistshore → Glimmer Falls | coastal_path | 2 | 1 |
| `mistshore_sunken` | Mistshore → Sunken Crypt | underground_tunnel | 3 | 4 |
| `galeridge_stormcrest` | Galeridge → Stormcrest | mountain_pass | 3 | 4 |
| `galeridge_obsidian` | Galeridge → Obsidian Reach | mountain_pass | 5 | 5 |
| `deeproot_murks` | Deeproot → Murk's End | marsh_track | 4 | 4 |
| `deeproot_shadowmere` | Deeproot → Shadowmere | forest_trail | 4 | 3 |
| `shadowmere_sunken` | Shadowmere → Sunken Crypt | marsh_track | 3 | 4 |
| `shadowmere_murks` | Shadowmere → Murk's End | marsh_track | 4 | 5 |
| `glimmer_radiant` | Glimmer Falls → Radiant Glade | forest_trail | 3 | 2 |
| `stormcrest_obsidian` | Stormcrest → Obsidian Reach | mountain_pass | 4 | 5 |
| `radiant_deeproot` | Radiant Glade → Deeproot | forest_trail | 3 | 2 |

### Path Map Visualization

```
                    ┌── Galeridge ──── Stormcrest ──┐
                    │   (wind,w)       (wind,r)     │
                    │                               │
Ashfall ─── Ember Hollow ──────────────────── Obsidian Reach
(fire,t)    (fire,w)                          (fire,f)
  │                                               ▲
  ├──── Ironhold ─── Dawnspire ─── Mistshore      │
  │     (earth,t)    (light,t)     (water,t)      │
  │         │            │             │           │
  │         │        Radiant       Glimmer         │
  │         │        Glade         Falls           │
  │         │        (light,s)     (water,w)       │
  │         │            │                         │
  │     Stormcrest   Deeproot ──── Shadowmere ─── Sunken Crypt
  │                  (earth,w)     (dark,w)        (dark,d)
  │                      │             │
  └──── Thornfield ──────┘         Murk's End
        (neutral,t)                (dark,r)

Legend: (element, t=town/w=wilderness/d=dungeon/s=shrine/r=ruins/f=fortress)
```

---

## World NPCs

NPCs are authored characters with names, roles, and home locations. They form
the cast of characters that populate the world. Adventures draw from this pool
when assigning roles to quest objectives, milestones, and events.

### NPC Properties

| Property | Type | Description |
|----------|------|-------------|
| `npcId` | string | Unique identifier, e.g. `"eldara"` |
| `name` | string | Display name, e.g. `"Eldara"` |
| `role` | string | Primary role: `"sage"`, `"merchant"`, `"guard_captain"`, `"healer"`, etc. |
| `personality` | string | `"gruff"`, `"kind"`, `"mysterious"`, `"anxious"`, `"stoic"` |
| `homeLocationId` | string | Primary home location ID |
| `additionalLocationIds` | string | Comma-separated additional location IDs (may appear at these too) |
| `greeting` | string | Short greeting line for narrative |
| `description` | string | 1–2 sentence character description |
| `canBeVillain` | boolean | Whether this NPC can be assigned a villain role |
| `canBeAlly` | boolean | Whether this NPC can be assigned an ally role |
| `canBeQuestGiver` | boolean | Whether this NPC can be assigned a quest-giver role |

### NPC Location Binding

NPCs are bound to one or more locations:

- **Single-location NPCs**: Always found at their `homeLocationId`. They are
  reliable fixtures of that location (e.g., the blacksmith of Ironhold).
- **Multi-location NPCs**: Have a `homeLocationId` and one or more
  `additionalLocationIds`. During adventure generation, the composition
  algorithm assigns them to one specific location from their pool. This allows
  NPCs like a travelling merchant or a wandering scholar to appear at different
  locations across different adventures.

### Built-In NPCs (20)

| ID | Name | Role | Personality | Home | Additional Locations |
|----|------|------|-------------|------|---------------------|
| `eldara` | Eldara | sage | mysterious | dawnspire | radiant_glade |
| `brother_marek` | Brother Marek | healer | kind | dawnspire | radiant_glade |
| `captain_voss` | Captain Voss | guard_captain | gruff | ironhold | — |
| `lira_swiftfoot` | Lira Swiftfoot | scout | anxious | thornfield | deeproot, galeridge |
| `theron_grey` | Theron the Grey | scholar | stoic | dawnspire | mistshore |
| `mira_coalhand` | Mira Coalhand | blacksmith | gruff | ironhold | — |
| `senna_brightleaf` | Senna Brightleaf | herbalist | kind | deeproot | thornfield |
| `darvok_ironjaw` | Darvok Ironjaw | mercenary | stoic | ashfall_town | ember_hollow |
| `pip_thistlewick` | Pip Thistlewick | innkeeper | kind | thornfield | — |
| `zara_nightwhisper` | Zara Nightwhisper | spy | mysterious | shadowmere | mistshore |
| `father_aldric` | Father Aldric | priest | kind | radiant_glade | dawnspire |
| `kessa_dunewood` | Kessa Dunewood | ranger | stoic | deeproot | glimmer_falls |
| `grint_ashborn` | Grint Ashborn | miner | gruff | ember_hollow | ironhold |
| `lyssa_moonveil` | Lyssa Moonveil | enchantress | mysterious | mistshore | shadowmere |
| `rowan_flint` | Rowan Flint | caravan_master | anxious | ashfall_town | ironhold, thornfield |
| `dagna_stonehelm` | Dagna Stonehelm | weaponsmith | gruff | ironhold | ashfall_town |
| `fenwick_holloway` | Fenwick Holloway | diplomat | kind | dawnspire | mistshore |
| `shara_embervine` | Shara Embervine | alchemist | mysterious | ember_hollow | ashfall_town |
| `old_tormund` | Old Tormund | fisherman | stoic | mistshore | glimmer_falls |
| `ylva_icemere` | Ylva Icemere | huntress | gruff | galeridge | stormcrest |

---

## Location Descriptions and Arrival Narrative

When the party arrives at a world location, a **location description** is
emitted at verbosity level 3. This description is authored per-location and
stored in the `WorldLocation.description` field.

### Description Format

Each location description is 2–4 sentences that:
1. Set the visual scene (what the party sees).
2. Reference the elemental affinity (smoke, mist, wind, etc.).
3. Hint at the location's significance or danger.

### Example Descriptions

| Location | Description |
|----------|-------------|
| Ashfall | *"The trading town of Ashfall sits at the edge of the volcanic wastes, its stone buildings streaked with soot. The air is thick with the smell of sulfur, and the distant glow of lava lights the southern sky. Merchants hawk fire-resistant cloaks and dragonglass trinkets in the market square."* |
| Ironhold | *"Ironhold clings to the mountainside like a fortress carved from the rock itself. The rhythmic clang of hammers echoes from the forges below, and the air tastes of iron and cold stone. The town's walls have never been breached."* |
| Shadowmere | *"A perpetual twilight hangs over Shadowmere. The twisted trees rise from dark, still water, their branches draped with pale moss. Something watches from the fog — the party can feel it."* |
| Radiant Glade | *"Shafts of golden light pierce the canopy, illuminating a clearing of impossible beauty. The shrine at the centre hums with a gentle warmth, and the grass here grows thick and green. Even the most hardened warrior feels a moment of peace."* |
| Stormcrest | *"Once a proud watchtower, Stormcrest is now a ruin battered by endless wind. The stones are worn smooth, and the remaining walls groan with each gust. Lightning scars mark every surface. The view from the summit stretches to the horizon."* |

### Narrative Integration

Location descriptions are emitted as `NarrativeEntry` at level 3 when the
party arrives via `TravelArrival`:

```
[Level 1] Day 5 — The party arrives at Shadowmere.
[Level 3] A perpetual twilight hangs over Shadowmere. The twisted trees rise
          from dark, still water, their branches draped with pale moss.
          Something watches from the fog — the party can feel it.
```

---

## Hero Arrival Comments

When the party arrives at a location, one hero may make a **comment** based on
their class and traits, reacting to the location's characteristics. These
comments are shown at verbosity level 3 and are authored alongside the world
data.

### Comment Selection

1. For each hero in the party, compute a **reaction score** based on the
   location's elemental affinity and the hero's traits/class.
2. The hero with the strongest reaction (positive or negative) makes the
   comment.
3. Comments trigger on ~60% of arrivals (controlled by PRNG) to avoid
   repetition.

### Reaction Scoring

```
reactionScore(hero, location) =
    classReaction(hero.class, location.elementalAffinity)
  + traitReaction(hero.traits, location.elementalAffinity)
  + tagReaction(hero.class, location.tags)
```

**Class reactions**: Some classes have natural affinity or aversion to certain
elements:

| Class | Positive Elements | Negative Elements |
|-------|-------------------|-------------------|
| Warrior | earth, neutral | — |
| Mage | fire, wind | — |
| Ranger | earth, wind | darkness |
| Paladin | light | darkness |
| Guardian | earth, light | fire |
| Cleric | light, water | darkness |

**Trait reactions**: Hero traits interact with elemental affinity:

| Trait Axis | Positive Pole Reacts To | Negative Pole Reacts To |
|------------|------------------------|------------------------|
| `pm` (physical/magical) | earth, fire (physical) | wind, light (magical) |
| `od` (offensive/defensive) | fire, darkness (aggressive) | light, water (calm) |
| `rc` (risky/cautious) | darkness, fire (thrill) | light, earth (safe) |
| `sa` (supportive/attacker) | light, water (supportive) | fire, darkness (attack) |

### Comment Templates

Comments are authored per class-element and per trait-element combination. Each
comment template is stored as a `HeroArrivalComment` entity:

```brl
component HeroArrivalComment {
    commentId: string           // Unique ID
    triggerClass: string        // Hero class ("" if trait-based)
    triggerTrait: string        // Trait axis ("" if class-based)
    triggerPolarity: string     // "positive" or "negative" ("" if class-based)
    elementalAffinity: string   // Location element this comment reacts to
    locationTags: string        // Comma-separated location tags (any match triggers)
    comment: string             // The comment text with {hero_name} token
    sentiment: string           // "positive", "negative", "neutral"
}
```

### Example Comments

| Trigger | Element | Comment | Sentiment |
|---------|---------|---------|-----------|
| Cleric (class) | darkness | *"{hero_name} shudders. 'I hate this darkness. The light of the divine feels so distant here.'"* | negative |
| Paladin (class) | light | *"{hero_name} breathes deeply. 'I can feel the grace of the divine in this place. We are protected here.'"* | positive |
| Ranger (class) | earth | *"{hero_name} kneels to touch the earth. 'The ground remembers old paths. We are not the first to walk here.'"* | positive |
| Mage (class) | fire | *"{hero_name} smiles. 'Such raw elemental power... I could study this place for years.'"* | positive |
| Warrior (class) | wind | *"{hero_name} braces against the wind. 'This gale would knock a lesser fighter off their feet.'"* | neutral |
| Guardian (class) | fire | *"{hero_name} eyes the molten ground warily. 'This is no place to make a stand. We should move quickly.'"* | negative |
| `od` negative (defensive) | darkness | *"{hero_name} moves to the front. 'Stay close. I'll shield us from whatever lurks in these shadows.'"* | negative |
| `rc` negative (cautious) | fire | *"{hero_name} hesitates at the edge of the volcanic basin. 'Perhaps we should find another way around...'"* | negative |
| `sa` negative (attacker) | fire | *"{hero_name} grins at the hellish landscape. 'Fitting place for a battle. Let them come.'"* | positive |
| `pm` positive (physical) | earth | *"{hero_name} flexes. 'Solid ground beneath my feet. This is where I fight best.'"* | positive |

### Narrative Integration

Hero comments appear at level 3, immediately after the location description:

```
[Level 3] A perpetual twilight hangs over Shadowmere...
[Level 3] 💬 Alaric shudders. "I hate this darkness. The light of the divine
          feels so distant here."
```

---

## Location-Based Buffs and Debuffs

Locations apply temporary buffs or debuffs to heroes based on the interaction
between the location's elemental affinity and the hero's traits. These effects
last while the party is at the location and during encounters fought there.

### Buff/Debuff Calculation

For each hero, when arriving at a location:

```
elementalMatch = matchScore(hero.traits, location.elementalAffinity)

If elementalMatch > threshold:
    Apply buff: +10% to relevant stat
If elementalMatch < -threshold:
    Apply debuff: -10% to relevant stat
```

### Element-Trait Interactions

| Location Element | Buffed Trait (positive) | Debuffed Trait (negative) | Affected Stat |
|-----------------|------------------------|--------------------------|---------------|
| fire | `pm` positive (physical power) | `rc` negative (cautious, fears fire) | attack |
| water | `sa` positive (supportive, healing) | `pm` positive (physical, weakened) | defense |
| wind | `od` negative (offensive, swift) | `od` positive (defensive, slow in wind) | speed |
| earth | `rc` negative (cautious, grounded) | `co` negative (chaotic, unsettled) | defense |
| light | `sh` positive (honorable, blessed) | `sh` negative (sly, exposed) | healing |
| darkness | `sh` negative (sly, shadow-affinity) | `sh` positive (honorable, weakened) | crit |

### Buff Magnitude

The buff or debuff magnitude scales with the hero's trait value:

```
magnitude = floor(abs(traitValue) / 4) × 5    // +5%, +10%, or +15%
```

Since trait values range from −16 to +16:
- |trait| 0–3: no effect
- |trait| 4–7: ±5%
- |trait| 8–11: ±10%
- |trait| 12–16: ±15%

### BRL Component

```brl
component LocationBuff {
    heroName: string            // Which hero is affected
    locationId: string          // Which location triggered this
    statAffected: string        // "attack", "defense", "speed", "crit", "healing"
    magnitude: integer          // Percentage modifier (positive = buff, negative = debuff)
    isActive: boolean           // True while at this location
}
```

### Narrative Integration

Buffs and debuffs are mentioned at verbosity level 3:

```
[Level 3] 🔥 The volcanic energy strengthens Kael's attacks (+10% attack).
[Level 3] 🔥 The intense heat unsettles Mira's cautious nature (-5% attack).
```

---

## Blocking Encounters

Blocking encounters are special encounters triggered on paths or at location
entrances that **halt travel until resolved**. This addresses the current
inconsistency where a "giant blocks your path" but the hero continues
travelling.

### Blocking Encounter Properties

| Property | Type | Description |
|----------|------|-------------|
| `blockingId` | string | Unique identifier |
| `pathId` | string | Path where this encounter can trigger (or `""` for location entry) |
| `locationId` | string | Location where this encounter can trigger (or `""` for path) |
| `encounterType` | string | `"combat"`, `"social"`, `"puzzle"` |
| `description` | string | Narrative description of the blockage |
| `resolutionType` | string | How to resolve: `"defeat"`, `"persuade"`, `"solve"`, `"pay_toll"` |
| `enemies` | string | Comma-separated enemy types (for combat encounters) |
| `difficultyModifier` | integer | Difficulty adjustment |
| `narrativeOnBlock` | string | Text when the party is blocked |
| `narrativeOnResolve` | string | Text when the block is resolved |

### Blocking Behaviour

When a blocking encounter triggers during travel:

1. **Travel pauses**: The party stops at the current point on the path.
2. **Block narrative emits** (level 2): *"A massive troll blocks the mountain
   pass, demanding tribute."*
3. **Resolution occurs**:
   - **Combat**: The party fights the blocking enemy. Travel resumes on victory.
   - **Social**: A trait-based check determines if the party can talk their way
     past. On failure, falls back to combat.
   - **Puzzle**: A trait-based check with a different set of traits.
   - **Pay toll**: The party loses score points but passes without combat.
4. **On resolution**, travel resumes from where it paused.
5. **On party defeat in combat**: The party is forced to retreat to the previous
   location. They may attempt the path again next day.

### BRL Component

```brl
component BlockingEncounter {
    blockingId: string
    pathId: string
    locationId: string
    encounterType: string
    description: string
    resolutionType: string
    enemies: string
    difficultyModifier: integer
    narrativeOnBlock: string
    narrativeOnResolve: string
    triggerChance: decimal       // 0.0-1.0, probability of triggering per traversal
    isResolved: boolean
}
```

### Built-In Blocking Encounters

| ID | Path/Location | Type | Description |
|----|--------------|------|-------------|
| `troll_bridge` | river crossings | combat | A river troll demands tribute or blood |
| `bandit_toll` | imperial roads | social/combat | Bandits set up a toll checkpoint |
| `rockslide` | mountain passes | puzzle | A rockslide blocks the narrow pass |
| `haunted_crossing` | marsh tracks | combat | Restless spirits bar passage through the marsh |
| `guardian_gate` | dungeon/fortress entries | combat | An ancient guardian protects the entrance |
| `enchanted_wall` | underground tunnels | puzzle | A magical barrier seals the tunnel |

### Narrative Example

```
[Level 2] ⛔ The path ahead is blocked! A massive troll emerges from beneath
          the bridge, bellowing a challenge. The party must fight to pass.
[Level 2] ⚔️ The party engages the River Troll!
  ... (combat) ...
[Level 2] ✅ The troll falls, and the path is clear. The party continues
          toward Galeridge.
```

---

## NPC Role Exclusivity

During adventure generation, NPCs are assigned specific roles. Once assigned,
an NPC cannot be reused in a conflicting role within the same adventure. This
prevents narrative inconsistencies like an NPC being both the villain and a
helpful quest-giver.

### Role Categories

| Role | Description | Conflicts With |
|------|-------------|---------------|
| `ally` | Helps the party, provides information or items | `villain`, `traitor` |
| `villain` | The adventure's antagonist | `ally`, `quest_giver` |
| `quest_giver` | Assigns the quest objective to the party | `villain`, `traitor` |
| `captive` | NPC that needs rescuing | `villain` |
| `traitor` | Appears to be an ally but betrays the party | `ally`, `quest_giver` |
| `bystander` | Background NPC, no active role | — (no conflicts) |

### Assignment Protocol

During `adventure_compose`:

1. **Draw NPCs for required slots** (e.g., `npc_name`, `villain_name`,
   `quest_giver`).
2. For each drawn NPC, create an `NpcRoleAssignment` entity.
3. Before assigning a new NPC to a role, check existing `NpcRoleAssignment`
   entities:
   - If the NPC already has a role that conflicts with the new role, **skip**
     and draw the next NPC from the pool.
   - If the NPC has no assignment or a compatible role, proceed.
4. NPC eligibility is also checked against `canBeVillain`, `canBeAlly`, and
   `canBeQuestGiver` flags.

### BRL Component

```brl
component NpcRoleAssignment {
    npcId: string               // World NPC ID
    role: string                // Assigned role: "ally", "villain", "quest_giver", etc.
    adventureSeed: integer      // Which adventure this assignment belongs to
}
```

### Example

If the adventure objective is "Rescue Eldara" (Eldara = captive):
- Eldara is assigned role `captive`.
- When drawing a villain, the pool skips Eldara.
- When drawing a quest-giver, the pool may assign Captain Voss as `quest_giver`.
- Captain Voss cannot later be assigned as `villain` or `traitor`.

---

## Adventure Generation from the World

The adventure composition algorithm is updated to draw from the world rather
than from anonymous pools. This replaces the existing procedural map generation
with a world-aware selection process.

### Map Selection (replaces Map Generation)

Instead of generating location names from word banks, the algorithm:

1. **Select starting region**: Use `adventureSeed % regionCount` to pick a
   starting region.
2. **Select starting location**: Pick a town from the starting region.
3. **Expand map**: From the starting location, follow world paths to discover
   reachable locations. Select 8–12 locations that form a connected subgraph.
4. **Assign layers**: Locations are assigned to layers 0–4 based on their
   distance (in path hops) from the starting location.
5. **Select final destination**: The most distant high-danger location becomes
   the final destination.

### NPC Placement

1. **Fixed NPCs**: NPCs with `homeLocationId` matching a selected location are
   automatically placed at that location.
2. **Roaming NPCs**: NPCs with `additionalLocationIds` overlapping the selected
   locations are placed at one of their possible locations (chosen by PRNG).
3. **Quest NPCs**: NPCs assigned quest roles (ally, villain, captive) are
   verified to be placed at a location on the adventure map.

### Quest Integration

The composition algorithm uses world locations and NPCs directly in quest
templates:

- **`{location_name}`** resolves to a world location's `name`.
- **`{npc_name}`** resolves to a world NPC's `name`.
- **Milestone target layers** map to specific world locations rather than
  generic layer numbers.
- **Event trigger conditions** reference specific world location IDs rather than
  generic location types.

### Critical Object Placement

Quest-critical objects (items, information) are placed at specific world
locations:

1. During composition, each milestone's key event is bound to a specific world
   location.
2. The binding is stored as a `SlotBinding`: `{milestone_location}` →
   `"Shadowmere"`.
3. Template text references the location: *"The {item_name} is hidden in
   {milestone_location}."*
4. This creates narrative coherence: players know they need to reach a specific
   place.

---

## Pluggable Slot Integration

The existing pluggable slot system is extended to support world-aware slots:

### New Slot Types

| Slot | Source | Description |
|------|--------|-------------|
| `{world_location}` | `WorldLocation` pool | A named world location |
| `{world_npc}` | `WorldNpc` pool | A named world NPC |
| `{path_description}` | `WorldPath` pool | Description of the path between locations |
| `{location_description}` | `WorldLocation.description` | Full location description |
| `{npc_greeting}` | `WorldNpc.greeting` | NPC's greeting line |
| `{npc_role}` | `WorldNpc.role` | NPC's role title |
| `{location_element}` | `WorldLocation.elementalAffinity` | Location's elemental affinity |

### Slot Resolution Order

World-aware slots are resolved **after** standard slots but **before** template
text rendering:

1. Resolve standard slots (existing: `{npc_name}`, `{villain_name}`, etc.)
2. Resolve world slots (new: `{world_location}`, `{world_npc}`, etc.)
3. Render final template text

World slots may reference other world data. For example, `{npc_greeting}` is
resolved by looking up the NPC already bound to `{npc_name}` and reading their
`greeting` field.

---

## BRL Components

### `WorldLocation`

One entity per world location (defined in `story-world-data.brl`).

| Field | Type | Description |
|-------|------|-------------|
| `locationId` | string | Unique location identifier |
| `name` | string | Display name |
| `locationType` | string | `"town"`, `"wilderness"`, `"dungeon"`, `"shrine"`, `"ruins"`, `"fortress"` |
| `region` | string | World region identifier |
| `description` | string | 2–4 sentence description (level 3) |
| `elementalAffinity` | string | Dominant element |
| `dangerLevel` | integer | Base danger rating (1–5) |
| `tags` | string | Comma-separated tags |

### `WorldPath`

One entity per path (defined in `story-world-data.brl`).

| Field | Type | Description |
|-------|------|-------------|
| `pathId` | string | Unique path identifier |
| `fromLocationId` | string | Origin location ID |
| `toLocationId` | string | Destination location ID |
| `pathType` | string | Path type category |
| `travelHours` | integer | Base travel hours |
| `dangerRating` | integer | Base danger rating |
| `description` | string | 1–2 sentence path description |
| `encounterTags` | string | Comma-separated encounter filter tags |
| `bidirectional` | boolean | Whether path works both ways |

### `WorldNpc`

One entity per NPC (defined in `story-world-data.brl`).

| Field | Type | Description |
|-------|------|-------------|
| `npcId` | string | Unique NPC identifier |
| `name` | string | Display name |
| `role` | string | Primary role |
| `personality` | string | Personality type |
| `homeLocationId` | string | Home location ID |
| `additionalLocationIds` | string | Comma-separated additional location IDs |
| `greeting` | string | Greeting line |
| `description` | string | 1–2 sentence character description |
| `canBeVillain` | boolean | Whether NPC can be a villain |
| `canBeAlly` | boolean | Whether NPC can be an ally |
| `canBeQuestGiver` | boolean | Whether NPC can give quests |

### `HeroArrivalComment`

One entity per comment template (defined in `story-world-data.brl`).

| Field | Type | Description |
|-------|------|-------------|
| `commentId` | string | Unique identifier |
| `triggerClass` | string | Hero class trigger (`""` if trait-based) |
| `triggerTrait` | string | Trait axis trigger (`""` if class-based) |
| `triggerPolarity` | string | `"positive"` or `"negative"` |
| `elementalAffinity` | string | Location element this reacts to |
| `locationTags` | string | Location tags this reacts to |
| `comment` | string | Comment text with `{hero_name}` token |
| `sentiment` | string | `"positive"`, `"negative"`, `"neutral"` |

### `LocationBuff`

Transient component, created when party arrives at a location.

| Field | Type | Description |
|-------|------|-------------|
| `heroName` | string | Affected hero |
| `locationId` | string | Triggering location |
| `statAffected` | string | `"attack"`, `"defense"`, `"speed"`, `"crit"`, `"healing"` |
| `magnitude` | integer | Percentage modifier |
| `isActive` | boolean | Whether currently active |

### `BlockingEncounter`

One entity per blocking encounter template (defined in `story-world-data.brl`).

| Field | Type | Description |
|-------|------|-------------|
| `blockingId` | string | Unique identifier |
| `pathId` | string | Path where this can trigger |
| `locationId` | string | Location where this can trigger |
| `encounterType` | string | `"combat"`, `"social"`, `"puzzle"` |
| `description` | string | Narrative description |
| `resolutionType` | string | `"defeat"`, `"persuade"`, `"solve"`, `"pay_toll"` |
| `enemies` | string | Comma-separated enemy types |
| `difficultyModifier` | integer | Difficulty adjustment |
| `narrativeOnBlock` | string | Block narrative |
| `narrativeOnResolve` | string | Resolution narrative |
| `triggerChance` | decimal | Trigger probability (0.0–1.0) |
| `isResolved` | boolean | Whether resolved this adventure |

### `NpcRoleAssignment`

Transient component, created during adventure composition.

| Field | Type | Description |
|-------|------|-------------|
| `npcId` | string | World NPC ID |
| `role` | string | Assigned role |
| `adventureSeed` | integer | Adventure this belongs to |

---

## BRL Events

| Event | Fields | Description |
|-------|--------|-------------|
| `LocationDescriptionShown` | `locationId` | Location description emitted on arrival |
| `HeroCommentTriggered` | `heroName`, `locationId`, `commentId` | A hero makes an arrival comment |
| `LocationBuffApplied` | `heroName`, `locationId`, `statAffected`, `magnitude` | Buff/debuff applied |
| `LocationBuffRemoved` | `heroName`, `locationId` | Buff/debuff removed (left location) |
| `BlockingEncounterTriggered` | `blockingId`, `pathId` | Travel blocked by encounter |
| `BlockingEncounterResolved` | `blockingId`, `succeeded` | Blocking encounter resolved |
| `NpcRoleAssigned` | `npcId`, `role` | NPC assigned a role in adventure |

---

## Adventure Composition Changes

The `adventure_compose` algorithm is updated with these additional steps:

### Updated Algorithm

```
adventure_compose(seed):
    rng = Rng(seed)

    // NEW: World map selection (replaces procedural generation)
    // 1. Select starting region and town
    regions = unique regions from entities having WorldLocation
    startRegion = regions[rng.random_int_range(0, len(regions) - 1)]
    startTown = pick town from startRegion

    // 2. Expand map from starting town via world paths
    selectedLocations = expand_map(startTown, 8-12 locations, rng)
    selectedPaths = paths connecting selectedLocations

    // 3. Assign layers based on distance from start
    assign_layers(selectedLocations, startTown)

    // 4. Place NPCs at locations
    for each npc in entities having WorldNpc:
        if npc.homeLocationId in selectedLocations:
            place npc at homeLocationId
        elif any of npc.additionalLocationIds in selectedLocations:
            place npc at random matching location (rng)

    // EXISTING: Draw objective (unchanged)
    objectives = entities having ObjectiveTemplate
    objective = objectives[rng.random_int_range(0, len(objectives) - 1)]

    // NEW: NPC role assignment with exclusivity
    // 5. Draw NPCs for quest roles, checking conflicts
    usedNpcs = {}  // npcId -> role
    for each required role in objective.requiredSlots:
        pool = eligible NPCs at selected locations
        pool = filter(pool, npc =>
            npc not in usedNpcs with conflicting role
            AND npc.canBe<Role> == true
        )
        drawn = pool[rng.random_int_range(0, len(pool) - 1)]
        usedNpcs[drawn.npcId] = role
        create NpcRoleAssignment { npcId: drawn.npcId, role: role }
        bindings[role + "_name"] = drawn.name

    // EXISTING: Draw milestones, events, etc. (unchanged)
    // ...

    // NEW: Bind milestones to world locations
    // 6. Each milestone targets a specific world location
    for each milestone:
        targetLocation = selectedLocations in target layer
        bindings["milestone_location_" + idx] = targetLocation.name

    // NEW: Place critical objects at locations
    // 7. Quest items/info bound to specific world locations
    for each key event:
        bindings["event_location"] = matching world location name

    // EXISTING: Resolve slots, create entities, etc. (unchanged)
    // ...
```

---

## Scoring Integration

The world system adds these score adjustments:

| Bonus | Points | Condition |
|-------|--------|-----------|
| Location buff bonus | +25 | Hero receives a location buff (aligned element) |
| Blocking encounter defeated | +100 | Defeating a blocking encounter without retreat |
| Blocking encounter bypassed | +25 | Paying a toll or persuading past a block |
| World NPC interaction | +50 | Interacting with an NPC at their home location |
| All regions visited | +200 | Visiting locations in ≥3 different regions |

---

## Migration Guide

This section describes how to migrate from the current procedural system to
the world-based system.

### Phase 1: Data Layer (No Logic Changes)

1. **Create `story-world.brl`**: Define `WorldLocation`, `WorldPath`,
   `WorldNpc`, `HeroArrivalComment`, `LocationBuff`, `BlockingEncounter`,
   and `NpcRoleAssignment` components.
2. **Create `story-world-data.brl`**: Populate world data — all 15 locations,
   25 paths, 20 NPCs, ~40 hero comments, and 6 blocking encounters.
3. **Update `game/brl/README.md`**: Add entries for the new files.
4. **No rule changes yet**: The existing procedural system continues to work.

### Phase 2: Map Selection (Replace Procedural Map)

1. **Update `adventure_compose` rule**: Replace the procedural map generation
   with world map selection. Use `entities having WorldLocation` and
   `entities having WorldPath` to build the adventure map.
2. **Update `generate_map` rule**: Map generation now selects a subset of world
   locations and paths instead of creating new ones.
3. **Maintain backward compatibility**: The `MapLocation` and `MapRoute`
   components continue to be created, but their data comes from `WorldLocation`
   and `WorldPath` entities.
4. **Update `TypeScript` layer** (`WasmSimEngine.ts`): The narrative log
   generation uses world location names and descriptions instead of generated
   names.

### Phase 3: NPC Integration

1. **Update NPC pool resolution**: Replace anonymous `NpcPool` draws with
   `WorldNpc` draws that respect location binding.
2. **Implement role exclusivity**: Add `NpcRoleAssignment` creation during
   composition and conflict checking before each NPC draw.
3. **Update `SlotBinding` resolution**: World NPC slots resolve to full NPC data
   (name, role, greeting, personality).

### Phase 4: Location Features

1. **Implement location descriptions**: Add description emission at level 3 in
   the `travel_arrival` rule.
2. **Implement hero comments**: Add comment selection and emission at level 3
   after arrival.
3. **Implement location buffs/debuffs**: Add buff calculation and application
   on arrival; removal on departure.

### Phase 5: Path Features

1. **Implement path type modifiers**: Path type adjusts travel time and danger.
2. **Implement blocking encounters**: Add blocking logic to `travel_segment`
   rule — check for blocking encounters, halt travel, resolve, then resume.
3. **Implement path-specific encounters**: Filter encounter pools by path
   `encounterTags`.

### File Changes Summary

| File | Change | Phase |
|------|--------|-------|
| `game/brl/story-world.brl` | **New** — World components | 1 |
| `game/brl/story-world-data.brl` | **New** — World entity data | 1 |
| `game/brl/README.md` | Add entries for new files | 1 |
| `doc/game-design/world-design.md` | **New** — This document | 1 |
| `doc/game-design/story-mode.md` | Reference world system | 1 |
| `doc/game-design/adventure-design.md` | Reference world system, update composition | 1 |
| `game/brl/story-adventure.brl` | Add `NpcRoleAssignment` component | 2–3 |
| `game/app/src/data/adventureQuest.ts` | Update composition to use world data | 2–3 |
| `game/app/src/engine/WasmSimEngine.ts` | Update narrative generation | 2–4 |
| `game/brl/story-mode.brl` | Update `MapLocation`, add world hooks | 2 |

### Backward Compatibility

During migration, both systems can coexist:

- Adventures created **before** the world system use procedural generation as
  before. The `AdventureDefinition` gains an optional `useWorldMap: boolean`
  field (default: `false` during migration, `true` after Phase 2).
- Adventures created **after** Phase 2 use the world map. The procedural system
  remains as a fallback for custom adventures that want random maps.
- The `WorldLocation` entities include all data needed to create `MapLocation`
  entities, ensuring the existing `MapLocation`-based rules work without
  modification.

---

## Extension Guide

### Adding a New World Location

1. Add a new entity with `WorldLocation` in `story-world-data.brl`:

```brl
crystal_caverns = new entity {
    WorldLocation {
        locationId: "crystal_caverns"
        name: "Crystal Caverns"
        locationType: "dungeon"
        region: "northern_highlands"
        description: "Vast underground chambers glitter with crystalline formations. The air hums with latent magic, and the crystals pulse with a soft blue light. Ancient dwarven carvings line the entrance."
        elementalAffinity: "earth"
        dangerLevel: 3
        tags: "underground,crystal,ancient,mining"
    }
}
```

2. Add paths connecting the new location to existing locations:

```brl
ironhold_crystal = new entity {
    WorldPath {
        pathId: "ironhold_crystal"
        fromLocationId: "ironhold"
        toLocationId: "crystal_caverns"
        pathType: "underground_tunnel"
        travelHours: 3
        dangerRating: 3
        description: "A narrow mining tunnel descends from Ironhold's deepest forge into the crystal-studded darkness below."
        encounterTags: "underground,dwarf,crystal"
        bidirectional: true
    }
}
```

3. Optionally add hero comments and blocking encounters for the new location.

### Adding a New World NPC

1. Add a new entity with `WorldNpc` in `story-world-data.brl`:

```brl
kaelen_brightforge = new entity {
    WorldNpc {
        npcId: "kaelen_brightforge"
        name: "Kaelen Brightforge"
        role: "artificer"
        personality: "eccentric"
        homeLocationId: "ironhold"
        additionalLocationIds: "crystal_caverns"
        greeting: "Ah, adventurers! Come, come — I have just the thing."
        description: "A wild-haired dwarf with oil-stained fingers and a permanent grin. His workshop is a chaos of half-finished contraptions."
        canBeVillain: false
        canBeAlly: true
        canBeQuestGiver: true
    }
}
```

### Adding a New Path Type

1. Add the new path type to the path type table in this document.
2. Add travel and danger modifiers to the composition rules.
3. Create world path entities using the new type.

### Adding a New Hero Comment

1. Add a new entity with `HeroArrivalComment` in `story-world-data.brl`:

```brl
cleric_crystal_comment = new entity {
    HeroArrivalComment {
        commentId: "cleric_earth_crystal"
        triggerClass: "Cleric"
        triggerTrait: ""
        triggerPolarity: ""
        elementalAffinity: "earth"
        locationTags: "crystal,underground"
        comment: "{hero_name} gazes at the glowing crystals. 'The divine light is refracted here in beautiful ways. Perhaps there is holiness even beneath the earth.'"
        sentiment: "positive"
    }
}
```

### Adding a New Blocking Encounter

1. Add a new entity with `BlockingEncounter` in `story-world-data.brl`:

```brl
crystal_guardian = new entity {
    BlockingEncounter {
        blockingId: "crystal_guardian"
        pathId: "ironhold_crystal"
        locationId: ""
        encounterType: "combat"
        description: "A crystalline golem stands sentinel at the cavern entrance, its eyes glowing with ancient magic."
        resolutionType: "defeat"
        enemies: "Crystal Golem"
        difficultyModifier: 1
        narrativeOnBlock: "A towering construct of living crystal bars the tunnel entrance. Its faceted eyes track the party's every move."
        narrativeOnResolve: "The crystal golem shatters into a thousand shimmering fragments. The tunnel ahead is clear."
        triggerChance: 0.6d
        isResolved: false
    }
}
```

### Summary Table

| To Add... | File | Component | Rule Changes? |
|-----------|------|-----------|---------------|
| New world location | `story-world-data.brl` | `WorldLocation` | No |
| New world path | `story-world-data.brl` | `WorldPath` | No |
| New world NPC | `story-world-data.brl` | `WorldNpc` | No |
| New hero comment | `story-world-data.brl` | `HeroArrivalComment` | No |
| New location buff rule | `story-world-data.brl` | `LocationBuff` | No (data-driven) |
| New blocking encounter | `story-world-data.brl` | `BlockingEncounter` | No |
| New path type | This document + rules | — | Yes (add modifiers) |
| New NPC role | This document + rules | `NpcRoleAssignment` | Yes (add conflict rules) |

---

## Example: World-Driven Adventure Walkthrough

This example shows a complete adventure using the world system, generated from
seed `0xA3B7C1D2`.

### Map Selection

- **Starting region**: `volcanic_wastes`
- **Starting town**: Ashfall
- **Selected locations** (10): Ashfall, Ember Hollow, Ironhold, Dawnspire,
  Thornfield, Galeridge, Deeproot, Radiant Glade, Stormcrest, Obsidian Reach
- **Final destination**: Obsidian Reach (danger 5, fire, fortress)

### NPC Placement

| NPC | Home | Placed At | Adventure Role |
|-----|------|-----------|---------------|
| Darvok Ironjaw | Ashfall | Ashfall | quest_giver |
| Shara Embervine | Ember Hollow | Ember Hollow | ally |
| Captain Voss | Ironhold | Ironhold | bystander |
| Mira Coalhand | Ironhold | Ironhold | bystander |
| Eldara | Dawnspire | Dawnspire | captive |
| Lira Swiftfoot | Thornfield | Galeridge | ally |
| Grint Ashborn | Ember Hollow | Ironhold | bystander |

**Villain**: Drawn from `VillainPool` (not a world NPC): Malachar the Undying.

**Role exclusivity in action**: Darvok Ironjaw is `quest_giver`, so he cannot
be assigned `villain` or `traitor`. Shara Embervine is `ally`, so she cannot
become `villain`.

### Quest Structure

- **Objective**: *Rescue Eldara* (captive is bound to Dawnspire)
- **Milestone 1**: Gather Intel at Ashfall (Darvok provides the quest)
  - Key event: *Talk to Darvok Ironjaw* at Ashfall
  - Side event: *Overhear a rumour* at Ashfall tavern
- **Milestone 2**: Find the Sunstone Amulet at Ember Hollow
  - Key event: *Search the volcanic caves* (blocking encounter: lava golem)
  - Side event: *Shara Embervine offers alchemical aid*
- **Milestone 3**: Cross the Mountain Pass to Stormcrest
  - Key event: *Survive the storm* (blocking: rockslide on mountain pass)
  - Side event: *Lira Swiftfoot scouts ahead* at Galeridge
- **Milestone 4**: Storm Obsidian Reach
  - Key event: *Defeat the Guardian Gate* (blocking: guardian at fortress)
  - Side event: *Ancient inscription reveals weakness*
- **Milestone 5**: Rescue Eldara
  - Key event: *Free Eldara from Malachar's prison*

### Runtime Timeline

| Day | Location | Events |
|-----|----------|--------|
| 1 | Ashfall (town) | Quest begins. Darvok says: *"Malachar's forces took Eldara three days past. I know where they went."* Milestone 1 activates. |
| 1 | Ashfall | 💬 Kael (Mage, fire affinity): *"Such raw elemental power... I could study this place for years."* 🔥 +10% attack buff. |
| 2 | Travel: Ashfall → Ember Hollow (imperial road) | Side event: merchant convoy encountered. No blocking. |
| 3 | Ember Hollow (wilderness) | Location description: *"The ground here seeps with volcanic heat..."* Key event: Search caves. ⛔ Lava Golem blocks entrance! Combat resolves. Sunstone Amulet found. Milestone 2 complete. |
| 5 | Travel: Ember Hollow → Galeridge (mountain pass) | ⛔ **Rockslide blocks the pass!** Puzzle check (trait-based). Party clears debris. |
| 5 | Galeridge (wilderness) | Lira Swiftfoot scouts ahead. 💬 Alaric (Paladin): *"This wind cuts to the bone, but we press on."* |
| 7 | Travel: Galeridge → Stormcrest (mountain pass) | Storm encounter. Party survives. Milestone 3 complete. |
| 9 | Travel: Stormcrest → Obsidian Reach (mountain pass) | ⛔ **Guardian Gate blocks fortress entrance!** Combat. Guardian defeated. Milestone 4 complete. |
| 10 | Obsidian Reach (fortress) | Final milestone: Rescue Eldara. Boss combat with Malachar's forces. Eldara freed! Objective complete (+300). |
| 11–30 | Exploration continues | Party explores remaining locations, fights encounters, earns bonuses. |

---

## Design Notes

1. **World is static, adventures are dynamic**: The world locations, paths, and
   NPCs never change between adventures. What changes is *which subset* is used
   and *what roles* NPCs play. This lets players build familiarity with the
   world over many runs.

2. **Backward compatibility is key**: The world system extends, not replaces,
   the existing procedural system. Migration can happen gradually across
   multiple releases.

3. **NPC count should grow**: 20 NPCs is a starting point. The system is
   designed for easy expansion — each NPC is a single BRL entity declaration.

4. **Location descriptions are authored, not generated**: This is intentional.
   Authored descriptions are higher quality and create a sense of place that
   procedural text cannot match. The trade-off is that adding new locations
   requires writing descriptions.

5. **Blocking encounters add tension**: The current system where "a giant
   blocks your path" but the hero walks past is a narrative inconsistency.
   Blocking encounters force resolution before travel continues, creating
   genuine decision points.

6. **Hero comments create personality**: A Cleric saying "I hate this darkness"
   at a dark location makes heroes feel like characters, not stat blocks. The
   comment system is lightweight (one comment per arrival, 60% trigger rate) to
   avoid spam.

7. **Elemental buffs are subtle**: ±5% to ±15% is noticeable but not
   game-breaking. The system rewards party composition diversity — a party of
   all fire-aligned heroes will struggle at water locations.

8. **The world is a shared resource**: All adventure generation draws from the
   same world data. This means adventures on different seeds will reference
   the same locations and NPCs, but in different configurations. This is a
   feature — it creates a persistent world feel.
