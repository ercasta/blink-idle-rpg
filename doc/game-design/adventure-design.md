# Adventure Design — Story Mode Quest System

This document describes the **Adventure Design** system — a quest-driven layer on
top of Story Mode that gives each run a unique, seed-generated storyline with
objectives, milestones, events, NPCs, and items. The adventure composition system
draws from extensible pools of content to produce deterministic but varied
narratives.

All adventure logic is implemented in BRL. The UI's only addition is displaying
quest status text alongside the existing narrative log.

---

## Table of Contents

1. [Design Goals](#design-goals)
2. [Overview](#overview)
3. [Seed and Deterministic Generation](#seed-and-deterministic-generation)
4. [Objectives](#objectives)
5. [Milestones](#milestones)
6. [Events](#events)
7. [Pluggable Slots](#pluggable-slots)
8. [Bail-Out Mechanisms](#bail-out-mechanisms)
9. [Descriptive Passages](#descriptive-passages)
10. [Custom BRL Rules Per Event](#custom-brl-rules-per-event)
11. [Adventure Composition Algorithm](#adventure-composition-algorithm)
12. [BRL Components](#brl-components)
13. [BRL Events](#brl-events)
14. [BRL Rules (Logical Design)](#brl-rules-logical-design)
15. [Content Pools (Extensible Data)](#content-pools-extensible-data)
16. [Integration with Story Mode](#integration-with-story-mode)
17. [Scoring Integration](#scoring-integration)
18. [Extensibility Guide](#extensibility-guide)
19. [Example: Full Adventure Walkthrough](#example-full-adventure-walkthrough)

---

## Design Goals

- **Narrative variety**: Each story mode run follows a unique quest with goals,
  characters, and events — not just a random walk across the map.
- **Deterministic from seed**: The entire adventure (objective, milestones,
  events, NPCs, items) is generated deterministically from a single seed value.
  The same seed always produces the same adventure.
- **Bail-out safety net**: If the party fails to complete a milestone by a
  deadline, a bail-out mechanism triggers so the adventure always progresses.
- **Extensible content**: All objectives, milestones, events, NPC pools, and
  item pools are defined as data in BRL entity declarations. Adding new content
  requires only adding new entities — no rule changes needed.
- **Pluggable slots**: Names, descriptions, and characteristics of NPCs, items,
  and locations are drawn from pools and substituted into templates, keeping
  adventures fresh across seeds.
- **Custom event rules**: Individual events can activate custom BRL rules that
  modify combat or grant special conditions, using a standard activation and
  completion protocol.
- **Layered on Story Mode**: The adventure system extends — not replaces — the
  existing story mode map, travel, voting, and combat systems.

---

## Overview

The adventure composition system works in layers:

```
Seed
 └─► Objective (1 per adventure)
      └─► Milestones (5–6 per adventure, sequential)
           └─► Events (2–3 per milestone)
                └─► Pluggable Slots (NPCs, items, locations filled from pools)
 └─► Hero Encounters (5–7 per adventure, matched to party)
      └─► Best-match hero selection (by class or trait polarization)
           └─► Buff reward + narrative highlight
```

**Flow at runtime:**

1. On `StoryStart`, the adventure seed is computed from adventure traits.
2. The composition algorithm draws an **objective** from the objective pool.
3. It draws 5–6 **milestones** compatible with the objective, ordered sequentially.
4. For each milestone, it draws 2–3 **events** that the party encounters during
   travel. Completing event requirements unlocks the milestone.
5. **Pluggable slots** (NPC names, item names, characteristics) are filled from
   themed pools. Once drawn, they remain fixed for the entire adventure.
6. Each milestone has a **bail-out** deadline (measured in days). If the
   milestone isn't completed by the deadline, a bail-out event fires
   automatically to give the party what they need to progress.
7. The adventure completes when all milestones are done and the final objective
   condition is met.

---

## Seed and Deterministic Generation

### Adventure Seed

The adventure seed is a 32-bit unsigned integer derived from the adventure's
configuration. It is computed identically to the existing `mapSeed` (see
[story-mode.md](story-mode.md#map-generation)) but with an additional
`"quest"` salt to produce a different sequence:

```
adventureSeed = hash(adventureName + "|quest|" + mode + "|" + str(requiredHeroCount)
                     + "|" + sortedAllowedClasses.join(",")
                     + "|" + environmentSettingsString)
```

Here `adventureName` is the `AdventureDefinition.name` field (the same value
used for `mapSeed`). The `hash` function is the same DJB2/FNV-1a used for
`mapSeed`. The `adventureSeed` is stored in the `AdventureState` component and
used as the PRNG seed for all adventure composition decisions.

### PRNG Usage

All random choices during adventure composition use the runtime's deterministic
`Rng` (xoshiro256**), seeded with `adventureSeed`. The PRNG is advanced in a
fixed order:

1. Draw objective index
2. Draw milestone count (5 or 6)
3. For each milestone: draw milestone template index
4. For each milestone: draw event count (2 or 3), then event template indices
5. Draw NPC pool entries (names, traits)
6. Draw item pool entries (names, descriptions)
7. Draw descriptive passage variants
8. Draw hero-matched encounters (using separate RNG stream seeded with offset)

This fixed ordering ensures determinism — the same seed always produces the
same adventure regardless of execution timing.

---

## Objectives

An **objective** is the overarching goal of the adventure. It provides narrative
framing, determines which milestone templates are compatible, and defines the
final win condition.

### Objective Template Structure

Each objective template is defined as a BRL entity with an `ObjectiveTemplate`
component:

```brl
component ObjectiveTemplate {
    objectiveId: string          // Unique ID, e.g. "rescue_npc"
    category: string             // Category: "rescue", "retrieve", "defeat"
    title: string                // Display title, e.g. "Rescue the {npc_name}"
    description: string          // 2–3 sentence overview with slot tokens
    winCondition: string         // Condition type: "npc_rescued", "item_delivered", "boss_defeated"
    requiredSlots: string        // Comma-separated slot names, e.g. "npc_name,npc_role"
    milestoneCategories: string  // Comma-separated compatible milestone categories
}
```

### Built-In Objectives

| ID | Category | Title | Win Condition | Required Slots |
|----|----------|-------|---------------|----------------|
| `rescue_npc` | rescue | Rescue the {npc_name} | `npc_rescued` | `npc_name`, `npc_role`, `captor_name` |
| `retrieve_artifact` | retrieve | Retrieve the {item_name} | `item_delivered` | `item_name`, `item_origin`, `quest_giver` |
| `defeat_villain` | defeat | Stop {villain_name} | `boss_defeated` | `villain_name`, `villain_title`, `threat_desc` |
| `lift_curse` | rescue | Lift the Curse of {curse_name} | `curse_lifted` | `curse_name`, `cursed_location`, `npc_name` |
| `escort_caravan` | escort | Escort the {npc_name}'s Caravan | `destination_reached` | `npc_name`, `cargo_desc`, `destination_name` |
| `seal_portal` | defeat | Seal the {portal_name} | `portal_sealed` | `portal_name`, `portal_location`, `seal_item` |

**Extensibility**: New objectives are added by declaring new entities with an
`ObjectiveTemplate` component. The composition algorithm picks from all entities
having `ObjectiveTemplate`.

---

## Milestones

A **milestone** is a major quest checkpoint. The adventure has 5–6 milestones
arranged sequentially. Each milestone must be completed before the next one
activates. Milestones are tied to specific locations on the map — completing
them often requires visiting a particular location or achieving a condition
during travel.

### Milestone Template Structure

```brl
component MilestoneTemplate {
    milestoneId: string          // Unique ID, e.g. "gather_intel"
    category: string             // Category: "information", "combat", "exploration", "social"
    title: string                // Display title with slot tokens
    description: string          // 1–3 sentence description with slot tokens
    completionType: string       // How it completes: "item_found", "npc_talked", "area_cleared", "puzzle_solved"
    completionKey: string        // Key item/info ID produced on completion
    bailoutDay: integer          // Days after activation before bail-out triggers (0 = no bail-out)
    bailoutType: string          // Bail-out mechanism: "npc_hint", "item_discovered", "shortcut_revealed"
    bailoutDescription: string   // Narrative for the bail-out
    compatibleObjectives: string // Comma-separated objective categories this milestone works with
    suggestedLocation: string    // Location type hint: "town", "wilderness", "dungeon", "any"
    eventSlots: integer          // Number of events this milestone contains (2 or 3)
}
```

### Built-In Milestones

| ID | Category | Title | Completion Type | Bail-Out |
|----|----------|-------|-----------------|----------|
| `gather_intel` | information | Seek the {info_name} | `npc_talked` | Day +3: An old traveller reveals the information |
| `find_key_item` | exploration | Find the {item_name} | `item_found` | Day +3: Item washes up at the next town |
| `clear_dungeon` | combat | Clear the {dungeon_name} | `area_cleared` | Day +4: A cave-in reveals an alternate path |
| `win_duel` | combat | Defeat {rival_name} in Combat | `duel_won` | Day +3: Rival is distracted by another threat |
| `solve_riddle` | social | Solve the Riddle of {riddle_name} | `puzzle_solved` | Day +2: A scholar NPC provides the answer |
| `negotiate_passage` | social | Convince {npc_name} to Help | `npc_persuaded` | Day +3: A mutual threat forces cooperation |
| `survive_ambush` | combat | Survive the {threat_name} Ambush | `ambush_survived` | Day +2: Reinforcements arrive |
| `retrieve_fragment` | exploration | Recover a Fragment of {item_name} | `item_found` | Day +3: Fragment's magic pulls it toward the party |
| `escort_survivor` | social | Escort {npc_name} to Safety | `npc_escorted` | Day +3: Survivor finds their own way |
| `decipher_map` | information | Decipher the Ancient Map | `puzzle_solved` | Day +2: A mysterious figure translates it |

**Extensibility**: New milestones are added by declaring new entities with a
`MilestoneTemplate` component.

### Milestone Activation Flow

```
Adventure starts
  → Milestone 1 activates (tied to early-game locations)
     → Party completes events → Milestone 1 completes
        → Milestone 2 activates (tied to mid-game locations)
           → ... and so on
              → Final milestone completes → Objective win condition checked
```

Each milestone is mapped to a **target map layer** based on its position:

| Milestone Position | Target Map Layer | Typical Day Range |
|-------------------|-----------------|-------------------|
| 1st (of 5–6) | Layer 1 | Days 1–6 |
| 2nd (of 5–6) | Layer 1–2 | Days 4–12 |
| 3rd (of 5–6) | Layer 2 | Days 8–18 |
| 4th (of 5–6) | Layer 2–3 | Days 12–22 |
| 5th (of 5–6) | Layer 3 | Days 18–28 |
| 6th (if present) | Layer 3–4 | Days 22–30 |

The bail-out day is computed relative to the milestone's activation day:
`bailoutTriggerDay = milestoneActivationDay + milestoneTemplate.bailoutDay`.

---

## Events

An **event** is a specific encounter or activity within a milestone. Each
milestone contains 2–3 events. Events are triggered when the party enters a
specific location or meets specific conditions during travel. Completing all
events within a milestone (or the milestone's key event) completes the
milestone.

### Event Template Structure

```brl
component EventTemplate {
    eventId: string              // Unique ID, e.g. "duel_rival"
    category: string             // Category: "combat", "search", "social", "puzzle", "discovery"
    title: string                // Display title with slot tokens
    description: string          // 1–5 sentence narrative passage
    triggerType: string          // When it fires: "location_enter", "travel_segment", "camp_night", "town_visit"
    triggerLocation: string      // Location type requirement: "wilderness", "town", "dungeon", "any"
    isKeyEvent: boolean          // If true, completing this event completes the milestone
    rewardType: string           // What completing gives: "quest_item", "quest_info", "stat_buff", "score_bonus"
    rewardKey: string            // The key/item/info ID produced (matches milestone completionKey)
    customRuleId: string         // If non-empty, activates a custom BRL rule during this event
    narrativeOnTrigger: string   // Narrative passage when event triggers (Level 1–2)
    narrativeOnComplete: string  // Narrative passage when event completes (Level 1–2)
    narrativeOnFail: string      // Narrative passage if event fails (Level 2)
    difficultyModifier: integer  // Encounter difficulty adjustment (-2 to +2)
}
```

### Built-In Events

| ID | Category | Title | Trigger | Key Event? |
|----|----------|-------|---------|------------|
| `duel_rival` | combat | Duel with {rival_name} | `location_enter` (wilderness) | Yes |
| `search_ruins` | search | Search the {ruin_name} | `location_enter` (wilderness) | Yes |
| `interrogate_prisoner` | social | Question the {npc_name} | `town_visit` | Yes |
| `decode_inscription` | puzzle | Decipher the {inscription_name} | `location_enter` (any) | Yes |
| `ambush_scouts` | combat | Intercept {enemy_name} Scouts | `travel_segment` | No (side) |
| `tavern_rumour` | social | Overhear a Rumour at {location_name} | `town_visit` | No (side) |
| `hidden_cache` | search | Discover a Hidden Cache | `travel_segment` | No (side) |
| `wounded_traveller` | social | Aid a Wounded Traveller | `travel_segment` | No (side) |
| `ancient_guardian` | combat | Face the Ancient Guardian | `location_enter` (wilderness) | Yes |
| `merchant_bargain` | social | Bargain with {npc_name} | `town_visit` | No (side) |
| `trap_corridor` | puzzle | Navigate the Trapped Passage | `location_enter` (wilderness) | No (side) |
| `ritual_site` | discovery | Investigate the Ritual Site | `location_enter` (wilderness) | Yes |
| `library_research` | puzzle | Research in the {location_name} Archives | `town_visit` | Yes |
| `beast_hunt` | combat | Hunt the {creature_name} | `travel_segment` | No (side) |
| `signal_fire` | discovery | Light the Signal Fire | `location_enter` (wilderness) | No (side) |

**Key events** vs **side events**: Each milestone has exactly 1 key event whose
completion unlocks the milestone. The remaining 1–2 events are side events that
provide bonus rewards (XP, score, narrative flavour) but are not required for
progression.

**Extensibility**: New events are added by declaring new entities with an
`EventTemplate` component.

---

## Pluggable Slots

Pluggable slots are named placeholders in template strings that are filled from
content pools during adventure composition. Once filled, the value persists for
the entire adventure.

### Slot Resolution

Slots are referenced in template text using `{slot_name}` syntax. During
adventure composition, each slot is resolved exactly once:

1. The composition algorithm collects all `requiredSlots` from the objective and
   all drawn milestones/events.
2. For each unique slot name, it draws a value from the corresponding pool using
   the PRNG.
3. Drawn values are stored in `SlotBinding` components on the `AdventureState`
   entity.
4. All template text is resolved by replacing `{slot_name}` tokens with their
   bound values.

### Slot Types and Pools

#### NPC Names (`npc_name`)

```brl
component NpcPool {
    name: string                 // "Eldara", "Brother Marek", "Captain Voss"
    role: string                 // "sage", "merchant", "guard_captain", "healer", "scholar"
    personality: string          // "gruff", "kind", "mysterious", "anxious", "stoic"
    greeting: string             // Short greeting line for narrative
}
```

> **World system integration**: With the world system (see
> [world-design.md](world-design.md)), NPCs are drawn from `WorldNpc` entities
> that include location binding, role eligibility flags, and character
> descriptions. The `NpcPool` component is superseded by `WorldNpc` but
> remains for backward compatibility. During adventure composition, `WorldNpc`
> entities are filtered by location availability and role exclusivity before
> being assigned to pluggable slots.

When an NPC is drawn, their `personality` influences narrative tone. For
example, a `gruff` NPC's dialogue uses curt phrasing ("Speak. What do you
want?"), while a `kind` NPC uses warmer text ("Welcome, travellers! How can I
help?"). The `greeting` field provides a pre-written line, and the `personality`
value is available as the `{npc_personality}` slot for use in event templates.

**Built-in pool** (20+ entries):

| Name | Role | Personality |
|------|------|-------------|
| Eldara | sage | mysterious |
| Brother Marek | healer | kind |
| Captain Voss | guard_captain | gruff |
| Lira Swiftfoot | scout | anxious |
| Theron the Grey | scholar | stoic |
| Mira Coalhand | blacksmith | gruff |
| Senna Brightleaf | herbalist | kind |
| Darvok Ironjaw | mercenary | stoic |
| Pip Thistlewick | innkeeper | kind |
| Zara Nightwhisper | spy | mysterious |
| Father Aldric | priest | kind |
| Kessa Dunewood | ranger | stoic |
| Grint Ashborn | miner | gruff |
| Lyssa Moonveil | enchantress | mysterious |
| Rowan Flint | caravan_master | anxious |
| Dagna Stonehelm | weaponsmith | gruff |
| Fenwick Holloway | diplomat | kind |
| Shara Embervine | alchemist | mysterious |
| Old Tormund | fisherman | stoic |
| Ylva Icemere | huntress | gruff |

#### Villain Names (`villain_name`)

```brl
component VillainPool {
    name: string                 // "Malachar", "The Hollow King"
    title: string                // "the Undying", "Scourge of the North"
    threatDesc: string           // Short description of the threat
}
```

**Built-in pool** (10+ entries):

| Name | Title | Threat |
|------|-------|--------|
| Malachar | the Undying | A lich who drains life from the land |
| The Hollow King | Scourge of the North | A spectral warlord raising an army of the dead |
| Xanthara | the Veiled | A shapeshifter who has infiltrated the kingdom |
| Gorthak | the Breaker | An ogre warchief uniting the wilds |
| Lady Seraphine | the Betrayer | A fallen paladin corrupted by dark magic |
| Vrynn | the Whisper | An assassin whose poison spreads like plague |
| The Iron Prophet | Herald of Ruin | A cult leader summoning an ancient evil |
| Draegon Ashclaw | the Last Flame | A dragon that burns entire regions |
| Nocturne | the Dreamwalker | A being that traps minds in endless nightmares |
| Grimjaw | the Devourer | A beast from the deep that consumes all light |

#### Quest Items (`item_name`)

```brl
component ItemPool {
    name: string                 // "Sunstone Amulet", "Everflame Lantern"
    origin: string               // Brief lore, e.g. "Forged in the First Age"
    description: string          // 1–2 sentence visual description
}
```

**Built-in pool** (15+ entries):

| Name | Origin |
|------|--------|
| Sunstone Amulet | Forged in the First Age by the Sun Priests |
| Everflame Lantern | A lantern that burns without fuel, guiding the lost |
| Ironheart Shield | Carried by the last Knight of the Silver Order |
| Tome of Whispers | Contains the spoken memories of a dying oracle |
| Crystal of Binding | A gem that can seal any portal between worlds |
| Serpent's Fang Dagger | Carved from the tooth of the Great Wyrm |
| Map of the Veil | Shows paths hidden from mortal eyes |
| Crown of Thorns | Worn by those who would command the wild |
| Emberstone Ring | Warm to the touch — said to ward off curses |
| Vial of Starlight | Collected at the peak of Mount Celeste |
| Rusted Compass | Always points toward the nearest danger |
| Bone Whistle | Summons a spectral ally when blown at midnight |
| Silvered Mirror | Reveals the true form of any who gaze into it |
| Cloak of Ashes | Renders the wearer invisible to the undead |
| Hearthstone Shard | A fragment of the world's first hearth |

#### Location Flavour (`dungeon_name`, `ruin_name`, etc.)

```brl
component LocationFlavorPool {
    name: string                 // "the Sunken Crypt", "Ashveil Tower"
    locType: string              // "dungeon", "ruin", "shrine", "cave"
    description: string          // 1–2 sentence description
}
```

#### Creature Names (`creature_name`)

```brl
component CreaturePool {
    name: string                 // "the Razorback Wyvern", "a Shadowstalker"
    difficulty: string           // "easy", "medium", "hard"
    description: string          // Short appearance description
}
```

### Slot Binding Component

```brl
component SlotBinding {
    slotName: string             // The slot key, e.g. "npc_name"
    slotValue: string            // The resolved value, e.g. "Eldara"
}
```

At generation time, one `SlotBinding` entity is created for each unique slot.
Template resolution iterates over all `SlotBinding` entities to substitute
tokens.

---

## Bail-Out Mechanisms

Bail-outs prevent the adventure from stalling if the party cannot complete a
milestone. Each milestone template specifies:

- **`bailoutDay`**: Number of days after activation before the bail-out triggers.
  Typical values are 2–4 days.
- **`bailoutType`**: The mechanism used:
  - `npc_hint` — A helpful NPC appears and provides the missing information.
  - `item_discovered` — The quest item is found in an unexpected location.
  - `shortcut_revealed` — An alternate path bypasses the blocked milestone.
- **`bailoutDescription`**: Narrative text for the bail-out event.

### Bail-Out Flow

```
Milestone activates on day D
  └─► Party attempts events during days D to D + bailoutDay
       ├─► Events completed → Milestone completes normally
       └─► Day D + bailoutDay reached, milestone still incomplete:
            └─► BailoutTriggered event fires
                 ├─► Milestone marked as complete (with bail-out flag)
                 ├─► Narrative: bailoutDescription
                 ├─► Quest key item/info granted automatically
                 └─► Next milestone activates
```

### Bail-Out Scoring

Completing a milestone via bail-out gives **reduced** score bonuses:

| Completion Type | Milestone Score Bonus |
|----------------|----------------------|
| Normal completion | +150 |
| Bail-out completion | +50 |

This incentivises the party to solve milestones naturally while ensuring the
adventure always progresses.

### Bail-Out Component

```brl
component BailoutTimer {
    milestoneEntity: id          // The milestone this timer tracks
    triggerDay: integer          // The day the bail-out fires
    hasTriggered: boolean        // Whether the bail-out has already fired
}
```

A `BailoutTimer` entity is created alongside each active milestone. The
`day_end` rule checks all active bail-out timers and fires `BailoutTriggered`
for any whose `triggerDay <= currentDay` and `hasTriggered == false`.

---

## Descriptive Passages

Each adventure element (objective, milestone, event) has associated narrative
text — short descriptive passages of 1–5 sentences. These passages are stored
in template fields and resolved via pluggable slots.

### Passage Types

| Element | When Displayed | Length | Narrative Level |
|---------|---------------|--------|-----------------|
| Objective introduction | Adventure start | 3–5 sentences | Level 1 |
| Milestone activation | When milestone becomes active | 2–3 sentences | Level 1 |
| Milestone completion | When milestone completes | 1–2 sentences | Level 1 |
| Event trigger | When event fires | 2–4 sentences | Level 2 |
| Event completion | When event resolves | 1–3 sentences | Level 2 |
| Event failure | If event is failed | 1–2 sentences | Level 2 |
| Bail-out narrative | When bail-out triggers | 2–3 sentences | Level 1 |
| Objective completion | Adventure end | 3–5 sentences | Level 1 |
| Side event flavour | When optional event fires | 1–2 sentences | Level 3 |

### Example Passages

**Objective introduction** (rescue):
> *"Rumours have reached the party that {npc_name}, the {npc_role} of
> {cursed_location}, has been captured by {captor_name}'s forces. Without
> {npc_name}'s guidance, the region will fall to darkness. The party must
> find and rescue {npc_name} before it is too late."*

**Milestone activation** (gather intel):
> *"To find where {npc_name} is being held, the party must seek information.
> Travellers on the road may know something, or perhaps the archives of a
> nearby town hold clues."*

**Event trigger** (tavern rumour):
> *"At the tavern in {location_name}, a hooded stranger leans close and
> whispers: 'I saw them take the {npc_role} through the {ruin_name}
> three nights past.'"*

**Bail-out narrative** (npc hint):
> *"As hope begins to fade, an old traveller approaches the party's camp.
> 'You seek {npc_name}? I can tell you where they are held — but you must
> hurry. {captor_name}'s patience is running thin.'"*

### Passage Variants

Each template field may contain multiple variants separated by `|`. The
composition algorithm selects one variant per seed using the PRNG:

```brl
let obj: id = new entity {
    ObjectiveTemplate {
        objectiveId: "rescue_npc"
        description: "Rumours say {npc_name} has been captured by {captor_name}. The party must mount a rescue.|Word has come that {captor_name} holds {npc_name} prisoner. Only the party can save them.|{npc_name}, beloved {npc_role}, has vanished. {captor_name} is surely behind it."
    }
}
```

The `|`-separated variants allow narrative variety across different seeds
without requiring additional templates.

---

## Custom BRL Rules Per Event

Some events need to modify gameplay — for example, a duel event might disable
party assistance, or a search event might grant a temporary perception buff.
The adventure system supports this through a standard **rule activation
protocol**.

### Activation Protocol

1. **Event template declares a `customRuleId`** — a string identifier matching
   a guarded BRL rule.
2. **When the event triggers**, the `EventTriggered` BRL event includes the
   `customRuleId` field.
3. **The custom rule** is a standard BRL rule guarded by a `when` clause that
   checks for an `ActiveEventRule` component on the game state entity:

```brl
// Standard component placed on the game state entity to activate custom rules
component ActiveEventRule {
    ruleId: string               // Matches EventTemplate.customRuleId
    eventEntity: id              // Reference to the active event entity
    params: string               // Comma-separated key=value parameters
}
```

4. **When the event completes or fails**, the `ActiveEventRule` component is
   removed, deactivating the custom rule.

### Example: Duel Event Custom Rule

The duel event (`duel_rival`) disables party assistance — only one hero fights:

```brl
// In story-adventure-rules.brl:

// Custom rule: during a duel, only the strongest hero may attack
rule duel_single_combat on DoAttack(atk: id)
    when atk.DoAttack.source.Team.isPlayer
{
    // Check if duel mode is active
    let gs: id = entities having StoryConfig
    if gs.has(ActiveEventRule) {
        if gs.ActiveEventRule.ruleId == "duel_single_combat" {
            // Only the hero with the highest Combat.damage attacks
            let heroes: list = entities having Team
            let strongest: id = null
            for h in heroes {
                if h.Team.isPlayer && h.Health.current > 0 {
                    if strongest == null || h.Combat.damage > strongest.Combat.damage {
                        strongest = h
                    }
                }
            }
            // Cancel attack if this hero is not the strongest
            if atk.DoAttack.source != strongest {
                cancel atk
                return
            }
        }
    }
}
```

### Example: Search Event Custom Rule

A search event might grant a temporary perception buff that helps find hidden
things:

```brl
// Custom rule: during a search, heroes get a bonus to finding items
rule search_perception_buff on TravelArrival(arr: id)
    when arr.TravelArrival.locationId >= 0
{
    let gs: id = entities having StoryConfig
    if gs.has(ActiveEventRule) {
        if gs.ActiveEventRule.ruleId == "search_perception_buff" {
            // Grant +50 score bonus for thorough searching
            let stats: id = entities having StoryScore
            stats.StoryScore.explorationBonus += 50
        }
    }
}
```

### Communication Back to Main Quest

Custom rules communicate results back to the main quest system through the
**`EventOutcome`** component:

```brl
component EventOutcome {
    eventEntity: id              // The event this outcome belongs to
    succeeded: boolean           // Whether the custom rule's condition was met
    resultKey: string            // The reward key produced (matches milestone completionKey)
    resultDescription: string    // Narrative description of the outcome
}
```

When a custom rule completes its work, it creates an `EventOutcome` entity.
The main adventure rules watch for `EventOutcome` entities and use them to:

1. Mark the event as complete.
2. Grant the reward (quest item, quest info, score bonus).
3. Check if the milestone is now complete.
4. Remove the `ActiveEventRule` component.

This decoupled design means custom rules don't need to know about the
milestone/objective structure — they just produce an `EventOutcome`.

---

## Adventure Composition Algorithm

The composition algorithm runs once during `StoryStart` and produces the full
adventure structure. It is implemented as a BRL rule.

### Algorithm Steps

```
adventure_compose(seed):
    rng = Rng(seed)
    
    // 1. Draw objective
    objectives = entities having ObjectiveTemplate
    objective = objectives[rng.random_int_range(0, len(objectives) - 1)]
    
    // 2. Determine milestone count
    milestoneCount = rng.random_int_range(3, 4)
    
    // 3. Draw milestones compatible with objective
    allMilestones = entities having MilestoneTemplate
    compatibleMilestones = filter(allMilestones, m =>
        objective.ObjectiveTemplate.milestoneCategories contains m.MilestoneTemplate.category
    )
    // Shuffle and pick milestoneCount unique milestones
    selectedMilestones = shuffle_and_pick(compatibleMilestones, milestoneCount, rng)
    
    // 4. For each milestone, draw events
    allEvents = entities having EventTemplate
    for each milestone in selectedMilestones:
        eventCount = milestone.MilestoneTemplate.eventSlots  // 2 or 3
        compatibleEvents = filter(allEvents, e =>
            e.EventTemplate.category matches milestone.MilestoneTemplate.category
            OR e.EventTemplate.category == "discovery"  // discovery events are universal
        )
        // Must include exactly 1 key event
        keyEvents = filter(compatibleEvents, e => e.EventTemplate.isKeyEvent)
        sideEvents = filter(compatibleEvents, e => !e.EventTemplate.isKeyEvent)
        
        milestone.keyEvent = keyEvents[rng.random_int_range(0, len(keyEvents) - 1)]
        milestone.sideEvents = shuffle_and_pick(sideEvents, eventCount - 1, rng)
    
    // 5. Collect and fill pluggable slots
    allSlots = collect_required_slots(objective, selectedMilestones, selectedEvents)
    for each slotName in allSlots:
        pool = get_pool_for_slot(slotName)
        value = pool[rng.random_int_range(0, len(pool) - 1)]
        create SlotBinding { slotName: slotName, slotValue: value }
    
    // 6. Resolve all template text
    for each template in [objective, milestones, events]:
        template.resolved_text = replace_slots(template.text, slotBindings)
    
    // 7. Map milestones to map layers
    for i in 0..milestoneCount:
        milestone[i].targetLayer = 1 + floor(i * 3.0 / milestoneCount)
    
    // 8. Create runtime entities
    create AdventureState entity with resolved objective
    create QuestMilestone entities (initially only milestone 0 is active)
    create QuestEvent entities for milestone 0
    create BailoutTimer for milestone 0
    
    // 9. Activate first milestone
    schedule MilestoneActivated { milestoneIndex: 0 }
```

### Milestone-to-Location Binding

Each milestone is associated with a **target map layer**. The milestone's key
event triggers when the party visits a location in that layer (or the next layer
if the specific layer has been traversed). This connects the quest to the map
exploration without forcing a single path.

The story mode map has **5 layers** (0–4), where layer 0 is the starting town
and layer 4 is the final destination. Milestones target layers 1–3, which
are the traversal layers containing mixed towns and wilderness locations.

```
milestoneTargetLayer(index, total):
    return 1 + floor(index * 3.0 / total)
```

| Milestone Index | Target Layer (3 milestones) | Target Layer (4 milestones) |
|----------------|---------------------------|---------------------------|
| 0 | 1 | 1 |
| 1 | 2 | 1 |
| 2 | 3 | 2 |
| 3 | — | 3 |

---

## BRL Components

### `AdventureState`

Attached to: the game-state entity (alongside `StoryConfig`).

| Field | Type | Description |
|-------|------|-------------|
| `adventureSeed` | integer | The seed used for adventure composition |
| `objectiveId` | string | ID of the active objective |
| `objectiveTitle` | string | Resolved title text |
| `objectiveDescription` | string | Resolved description text |
| `objectiveWinCondition` | string | Win condition type |
| `totalMilestones` | integer | Number of milestones (5 or 6) |
| `currentMilestoneIndex` | integer | Index of the currently active milestone (0-based) |
| `milestonesCompleted` | integer | Number of milestones completed |
| `adventureComplete` | boolean | Whether the objective has been achieved |

### `QuestMilestone`

One entity per milestone.

| Field | Type | Description |
|-------|------|-------------|
| `milestoneIndex` | integer | Position in the sequence (0-based) |
| `milestoneId` | string | Template ID used |
| `title` | string | Resolved title text |
| `description` | string | Resolved description |
| `completionType` | string | How it completes |
| `completionKey` | string | Key produced on completion |
| `targetLayer` | integer | Map layer where the key event is likely to trigger |
| `isActive` | boolean | Whether this milestone is currently active |
| `isCompleted` | boolean | Whether this milestone has been completed |
| `completedViaBailout` | boolean | Whether it was completed via bail-out |
| `activationDay` | integer | Day this milestone was activated |
| `totalEvents` | integer | Number of events in this milestone |
| `eventsCompleted` | integer | Number of events completed |

### `QuestEvent`

One entity per event within a milestone.

| Field | Type | Description |
|-------|------|-------------|
| `milestoneIndex` | integer | Which milestone this event belongs to |
| `eventId` | string | Template ID used |
| `title` | string | Resolved title text |
| `description` | string | Resolved description |
| `triggerType` | string | When it fires |
| `triggerLocation` | string | Location type requirement |
| `isKeyEvent` | boolean | Whether this is the milestone's key event |
| `isTriggered` | boolean | Whether this event has been triggered |
| `isCompleted` | boolean | Whether this event has been completed |
| `rewardType` | string | Reward type |
| `rewardKey` | string | Reward key |
| `customRuleId` | string | Custom rule to activate (empty = none) |
| `narrativeOnTrigger` | string | Resolved trigger narrative |
| `narrativeOnComplete` | string | Resolved completion narrative |

### `ActiveEventRule`

Attached to: the game-state entity while a custom event rule is active.

| Field | Type | Description |
|-------|------|-------------|
| `ruleId` | string | The custom rule ID |
| `eventEntity` | id | Reference to the `QuestEvent` entity |
| `params` | string | Rule-specific parameters |

### `EventOutcome`

Created by custom rules to signal completion back to the quest system.

| Field | Type | Description |
|-------|------|-------------|
| `eventEntity` | id | The event this outcome belongs to |
| `succeeded` | boolean | Whether the event succeeded |
| `resultKey` | string | The reward key produced |
| `resultDescription` | string | Narrative for the result |

### `BailoutTimer`

One entity per active milestone.

| Field | Type | Description |
|-------|------|-------------|
| `milestoneEntity` | id | The milestone entity |
| `triggerDay` | integer | Day the bail-out fires |
| `hasTriggered` | boolean | Whether it has already fired |

### `SlotBinding`

One entity per resolved slot.

| Field | Type | Description |
|-------|------|-------------|
| `slotName` | string | Slot key (e.g., `"npc_name"`) |
| `slotValue` | string | Resolved value (e.g., `"Eldara"`) |

### `QuestInventory`

Attached to: the game-state entity. Tracks quest items and information acquired.

| Field | Type | Description |
|-------|------|-------------|
| `itemCount` | integer | Number of quest items acquired |
| `itemKeys` | string | Comma-separated list of acquired item keys |
| `infoCount` | integer | Number of quest info pieces acquired |
| `infoKeys` | string | Comma-separated list of acquired info keys |

---

## BRL Events

| Event | Fields | Description |
|-------|--------|-------------|
| `AdventureCompose` | `seed` | Triggers adventure composition from the seed |
| `MilestoneActivated` | `milestoneIndex` | A milestone becomes active |
| `MilestoneCompleted` | `milestoneIndex`, `viaBailout` | A milestone is completed |
| `QuestEventTriggered` | `milestoneIndex`, `eventEntity` | A quest event fires |
| `QuestEventCompleted` | `eventEntity`, `succeeded` | A quest event resolves |
| `BailoutTriggered` | `milestoneEntity`, `milestoneIndex` | A bail-out fires for a stalled milestone |
| `QuestItemAcquired` | `itemKey`, `itemName` | Party acquires a quest item |
| `QuestInfoAcquired` | `infoKey`, `infoDescription` | Party acquires quest information |
| `ObjectiveCompleted` | `objectiveId` | The adventure's objective is achieved |
| `CustomRuleActivated` | `ruleId`, `eventEntity` | A custom event rule is turned on |
| `CustomRuleDeactivated` | `ruleId` | A custom event rule is turned off |

---

## BRL Rules (Logical Design)

### `adventure_compose` — on `AdventureCompose`

1. Draw objective from `ObjectiveTemplate` entities using seed.
2. Draw 3–4 milestones from compatible `MilestoneTemplate` entities.
3. For each milestone, draw 2–3 events from `EventTemplate` entities.
4. Collect all required slots and draw values from pool entities.
5. Create `SlotBinding` entities for each slot.
6. Resolve all template text by substituting slot values.
7. Create `AdventureState`, `QuestMilestone`, `QuestEvent` entities.
8. Create `QuestInventory` on the game-state entity.
9. Emit objective introduction narrative (Level 1).
10. Schedule `MilestoneActivated` for milestone 0.

### `milestone_activated` — on `MilestoneActivated`

1. Find the `QuestMilestone` entity for the given index.
2. Set `isActive = true`, `activationDay = currentDay`.
3. Create `BailoutTimer` with `triggerDay = currentDay + milestoneTemplate.bailoutDay`.
4. Emit milestone activation narrative (Level 1).
5. Activate the milestone's events (create `QuestEvent` entities if deferred, or
   mark existing ones as eligible for triggering).

### `check_quest_events` — on `TravelArrival`, `TravelSegment`, `CampStart`, `TownRest`

This rule fires on existing story mode events and checks whether any active
quest event's trigger conditions are met:

1. Get the current milestone's active events.
2. For each untriggered event, check:
   - Does the `triggerType` match the current story event?
   - Does the `triggerLocation` match the current location type?
3. If conditions match, schedule `QuestEventTriggered`.

### `quest_event_triggered` — on `QuestEventTriggered`

1. Mark the event as triggered (`isTriggered = true`).
2. Emit the event's trigger narrative (Level 2).
3. If the event has a `customRuleId`:
   - Add `ActiveEventRule` component to the game-state entity.
   - Schedule `CustomRuleActivated`.
4. If the event is a combat event, spawn appropriate enemies (using the event's
   `difficultyModifier` to adjust tier).
5. If the event is a social/puzzle event, auto-resolve after a trait-based check
   (using party trait averages) and schedule `QuestEventCompleted`.

### `quest_event_completed` — on `QuestEventCompleted`

1. Mark the event as completed (`isCompleted = true`).
2. If `succeeded`:
   - Grant the event's reward (`quest_item`, `quest_info`, `stat_buff`, or
     `score_bonus`).
   - If `quest_item`: add to `QuestInventory.itemKeys`, schedule `QuestItemAcquired`.
   - If `quest_info`: add to `QuestInventory.infoKeys`, schedule `QuestInfoAcquired`.
   - Emit completion narrative (Level 2).
3. If the event is the milestone's **key event** and it succeeded:
   - Schedule `MilestoneCompleted` for the current milestone.
4. If `!succeeded`:
   - Emit failure narrative (Level 2).
5. If `ActiveEventRule` is present for this event, remove it and schedule
   `CustomRuleDeactivated`.

### `milestone_completed` — on `MilestoneCompleted`

1. Mark the milestone as completed (`isCompleted = true`).
2. If `viaBailout`, set `completedViaBailout = true`.
3. Award milestone score bonus (150 normal, 50 bail-out).
4. Increment `AdventureState.milestonesCompleted`.
5. Remove the milestone's `BailoutTimer`.
6. Emit milestone completion narrative (Level 1).
7. If more milestones remain:
   - Advance `AdventureState.currentMilestoneIndex`.
   - Schedule `MilestoneActivated` for the next milestone.
8. If all milestones are complete:
   - Check the objective's win condition.
   - If met, schedule `ObjectiveCompleted`.

### `bailout_check` — on `DayEnd`

1. For each active `BailoutTimer`:
   - If `currentDay >= triggerDay` and `!hasTriggered`:
     - Check if the associated milestone is still incomplete.
     - If incomplete:
       - Set `hasTriggered = true`.
       - Schedule `BailoutTriggered`.
       - Emit bail-out narrative (Level 1).

### `bailout_triggered` — on `BailoutTriggered`

1. Auto-complete the milestone's key event with the bail-out reward.
2. Schedule `MilestoneCompleted` with `viaBailout = true`.
3. Grant the completion key item/info automatically.
4. Emit bail-out description narrative (Level 1).

### `objective_completed` — on `ObjectiveCompleted`

1. Set `AdventureState.adventureComplete = true`.
2. Award objective completion score bonus (+300).
3. Emit objective completion narrative (Level 1).
4. The adventure continues (travel, combat, etc.) until `StoryComplete` fires
   at day 30. The objective completion is a narrative and scoring milestone,
   not the end of the run.

---

## Content Pools (Extensible Data)

All content pools are defined as BRL entity declarations in dedicated files.
The composition algorithm discovers pools dynamically using
`entities having <PoolComponent>`.

### File Organization

| File | Content |
|------|---------|
| `story-adventure.brl` | Adventure components (`AdventureState`, `QuestMilestone`, etc.) and composition rules |
| `story-adventure-templates.brl` | All `ObjectiveTemplate`, `MilestoneTemplate`, `EventTemplate` entities |
| `story-adventure-pools.brl` | All pool entities (`NpcPool`, `VillainPool`, `ItemPool`, etc.) |
| `story-adventure-rules.brl` | Custom event rules (duel, search, etc.) |
| `story-world.brl` | World system components (`WorldLocation`, `WorldPath`, `WorldNpc`, etc.) — see [world-design.md](world-design.md) |
| `story-world-data.brl` | World entity data: named locations, paths, NPCs, hero comments, blocking encounters |

### Adding New Content

#### Adding a New Objective

1. Create a new entity with `ObjectiveTemplate` in `story-adventure-templates.brl`:

```brl
let obj_new: id = new entity {
    ObjectiveTemplate {
        objectiveId: "defend_fortress"
        category: "defend"
        title: "Defend {location_name} from {villain_name}"
        description: "{villain_name} marches on {location_name}. The party must prepare defenses and hold the line."
        winCondition: "fortress_defended"
        requiredSlots: "location_name,villain_name,villain_title"
        milestoneCategories: "combat,information,social"
    }
}
```

2. No rule changes needed — the composition algorithm automatically includes
   new objectives.

#### Adding a New NPC

1. **Preferred**: Add a new entity with `WorldNpc` in `story-world-data.brl`
   (see [world-design.md](world-design.md#adding-a-new-world-npc)). This
   places the NPC in the persistent world with location binding and role
   eligibility.

2. **Legacy**: Add a new entity with `NpcPool` in `story-adventure-pools.brl`:

```brl
let npc_new: id = new entity {
    NpcPool {
        name: "Kaelen Brightforge"
        role: "artificer"
        personality: "eccentric"
        greeting: "Ah, adventurers! Come, come — I have just the thing."
    }
}
```

#### Adding a New Event

1. Add a new entity with `EventTemplate` in `story-adventure-templates.brl`.
2. If the event uses a custom rule, also add the rule in
   `story-adventure-rules.brl`.

---

## Integration with Story Mode

### Hook Points

The adventure system integrates with the existing story mode rules at these
points:

| Existing Event | Adventure Hook |
|---------------|---------------|
| `StoryStart` | After map generation, schedule `AdventureCompose` |
| `TravelArrival` | `check_quest_events` rule checks for location-triggered events |
| `TravelSegment` | `check_quest_events` rule checks for travel-triggered events |
| `TownRest` | `check_quest_events` rule checks for town-triggered events |
| `CampStart` | `check_quest_events` rule checks for camp-triggered events |
| `DayEnd` | `bailout_check` rule checks bail-out timers |
| `StoryComplete` | If `AdventureState.adventureComplete`, award bonus; else note incomplete |

### Narrative Integration

Quest-related narrative entries use the same `NarrativeEntry` component and
verbosity levels as the rest of story mode. Quest narratives are distinguished
by their content, not by a separate log.

| Quest Event | Narrative Level |
|------------|----------------|
| Objective intro/complete | 1 (Headlines) |
| Milestone activate/complete/bailout | 1 (Headlines) |
| Quest event trigger/complete | 2 (Standard) |
| Side event flavour | 3 (Detailed) |
| Custom rule effects | 3 (Detailed) |

### Minimal UI Change

The adventure quest status can be displayed as a brief **quest line** at the top
of the narrative log panel:

```
🗡️ Rescue Eldara — Milestone 2/3: Find the Sunstone Amulet [Day 12]
```

This is derived from `AdventureState` and the active `QuestMilestone` and does
not require new UI components — it is rendered as a special pinned narrative
entry.

---

## Scoring Integration

The adventure system adds these score bonuses alongside the existing story mode
scoring:

| Bonus | Points | Condition |
|-------|--------|-----------|
| Milestone completed (normal) | +150 | Completing a milestone via events |
| Milestone completed (bail-out) | +50 | Completing a milestone via bail-out |
| Side event completed | +75 | Completing a non-key event |
| Objective completed | +300 | Achieving the adventure's objective |
| All milestones normal | +200 | Completing all milestones without bail-outs |
| Quest items collected | +25 each | Acquiring quest items |

These are tracked in a new `QuestScore` component:

```brl
component QuestScore {
    milestoneBonus: integer      // Sum of milestone completion bonuses
    sideEventBonus: integer      // Sum of side event bonuses
    objectiveBonus: integer      // Objective completion bonus
    allNormalBonus: integer      // Bonus for no bail-outs
    questItemBonus: integer      // Quest item collection bonus
    totalQuestScore: integer     // Sum of all quest bonuses
}
```

The `totalQuestScore` is added to the final score in the existing
`story_complete` rule.

---

## Hero-Matched Encounters (Expansion Set 1)

The adventure expansion system adds **hero-matched encounters** — events that
are particularly well-suited for specific hero classes or trait polarizations.
When a hero encounter triggers, the system selects the "best match" hero from
the party and generates narrative text explaining *why* that hero's class or
traits were instrumental in the encounter's success. Completing a hero encounter
grants a **stat buff** for the rest of the adventure.

### Design Goals

- **30 hero-matched encounter templates**: 6 class-specific (one per class) +
  24 trait-polarization (one per pole of each of 12 trait axes).
- **At least 5 hero encounters per adventure** run, deterministically selected.
- **Best-match hero selection**: The hero with the highest match score is chosen.
  For class encounters, only heroes of the required class match. For trait
  encounters, the hero with the most extreme trait value in the correct polarity
  wins.
- **Narrative highlighting**: Each encounter includes text explaining why the
  chosen hero's abilities were decisive (e.g., "The shrine recognizes a true
  paladin's faith").
- **Buff rewards**: Each completed encounter grants a party-wide buff (attack,
  defense, speed, crit, healing, or XP) that lasts for the rest of the adventure.
- **Pluggable slots**: All encounter text uses the same `{slot_name}` system as
  other adventure content.

### BRL Components

Defined in `adventure-expansion-set-1.brl`:

| Component | Description |
|-----------|-------------|
| `HeroEncounterTemplate` | Template for a class- or trait-matched encounter |
| `HeroEncounterBuff` | Active buff granted by a completed encounter |
| `HeroEncounterOutcome` | Narrative record of a completed encounter |

### Hero Matching Algorithm

```
For each encounter template:
  If category == "class":
    Score = 100 if hero.class matches preferredClass, else 0
  If category == "trait":
    If traitPolarity == "negative":
      Score = max(0, -hero.traits[traitAxis])   // more negative = better
    If traitPolarity == "positive":
      Score = max(0, hero.traits[traitAxis])     // more positive = better

  Best match = hero with highest score
```

### Encounter Selection

The composition algorithm selects 5–7 hero encounters per adventure:

1. **First pass**: Select one encounter per hero to ensure party coverage.
2. **Second pass**: Fill remaining slots with the best-matching encounters.
3. **Distribution**: Encounters are spread evenly across the 30-day adventure.

### Scoring

| Bonus | Points | Condition |
|-------|--------|-----------|
| Hero encounter completed | +100 | Completing a hero-matched encounter |

### Buff Types

| Buff | Effect |
|------|--------|
| `attack` | +N% damage for the party |
| `defense` | +N% defense for the party |
| `speed` | +N% attack speed for the party |
| `crit` | +N% critical hit chance for the party |
| `healing` | +N% healing effectiveness |
| `xp` | +N% experience gain |

### Extensibility

New hero encounters are added by declaring new entities with a
`HeroEncounterTemplate` component in `adventure-expansion-set-1.brl` (or
additional expansion files). No rule changes are needed.

---

## Extensibility Guide

The adventure system is designed for easy extension. Here is a summary of how
to add new content without modifying any rules:

| To Add... | File | Component | Rule Changes? |
|-----------|------|-----------|---------------|
| New objective | `story-adventure-templates.brl` | `ObjectiveTemplate` | No |
| New milestone type | `story-adventure-templates.brl` | `MilestoneTemplate` | No |
| New event type | `story-adventure-templates.brl` | `EventTemplate` | Only if custom rule needed |
| New NPC | `story-adventure-pools.brl` | `NpcPool` | No |
| New villain | `story-adventure-pools.brl` | `VillainPool` | No |
| New quest item | `story-adventure-pools.brl` | `ItemPool` | No |
| New location flavour | `story-adventure-pools.brl` | `LocationFlavorPool` | No |
| New creature | `story-adventure-pools.brl` | `CreaturePool` | No |
| New custom event rule | `story-adventure-rules.brl` | (BRL rule) | Yes (add rule) |
| New bail-out type | `story-adventure-templates.brl` | Update `MilestoneTemplate` | No |
| New hero encounter | `adventure-expansion-set-1.brl` | `HeroEncounterTemplate` | No |
| New world location | `story-world-data.brl` | `WorldLocation` | No |
| New world path | `story-world-data.brl` | `WorldPath` | No |
| New world NPC | `story-world-data.brl` | `WorldNpc` | No |
| New hero comment | `story-world-data.brl` | `HeroArrivalComment` | No |
| New blocking encounter | `story-world-data.brl` | `BlockingEncounter` | No |

> **World system**: For the full world extension guide including adding
> locations, paths, NPCs, hero comments, and blocking encounters, see
> [world-design.md — Extension Guide](world-design.md#extension-guide).

The general pattern is:
1. **Data = entities with template/pool components**. Add new entities to extend content.
2. **Logic = rules that query entities dynamically**. Rules use
   `entities having <Component>` to discover all available templates/pools at
   runtime.
3. **Custom behaviour = guarded rules** activated via `ActiveEventRule`. Add new
   rules guarded by their `ruleId` string.

---

## Example: Full Adventure Walkthrough

This example shows a complete adventure generated from seed `0xA3B7C1D2`.

### Composition Result

- **Objective**: *Rescue the Eldara* (rescue category)
  - *"Rumours say Eldara, the sage, has been captured by Malachar the Undying's
    forces. The party must find and rescue Eldara before it is too late."*
- **Milestones** (3):
  1. **Gather Intel** — Seek the whereabouts of Eldara
     - Key event: *Tavern Rumour* (town, social)
     - Side event: *Wounded Traveller* (travel, social)
     - Bail-out: Day 3 — *Old traveller reveals location*
  2. **Find the Sunstone Amulet** — Recover the amulet needed to enter Malachar's lair
     - Key event: *Search the Sunken Crypt* (wilderness, search)
     - Side event: *Ambush Scouts* (travel, combat)
     - Side event: *Hidden Cache* (travel, search)
     - Bail-out: Day 3 — *Amulet's magic pulls it toward the party*
  3. **Storm the Lair** — Confront Malachar and free Eldara
     - Key event: *Face the Ancient Guardian* (wilderness, combat)
     - Side event: *Trap Corridor* (wilderness, puzzle)
     - Bail-out: Day 4 — *A cave-in reveals an alternate path*
- **Slot Bindings**:
  - `npc_name` → "Eldara"
  - `npc_role` → "sage"
  - `captor_name` → "Malachar the Undying"
  - `item_name` → "Sunstone Amulet"
  - `dungeon_name` → "the Sunken Crypt"

### Runtime Timeline

| Day | Event | Quest Action |
|-----|-------|-------------|
| 1 | Adventure starts at Ashfall (town) | Objective narrative displayed. Milestone 1 activates. |
| 2 | Party travels to Ember Hollow (wilderness) | Side event: *Wounded Traveller* triggers on travel segment. Party helps → +75 score. |
| 3 | Party arrives at Ironhold (town) | Key event: *Tavern Rumour* triggers at town. Eldara's location revealed → Milestone 1 complete (+150). Milestone 2 activates. |
| 5 | Party travels toward Cindervale | Side event: *Ambush Scouts* triggers. Combat encounter with +1 difficulty. |
| 7 | Party arrives at Blazeheart (wilderness) | Key event: *Search the Sunken Crypt* triggers. Party searches → Sunstone Amulet found → Milestone 2 complete (+150). Milestone 3 activates. |
| 10 | Party travels toward Scorched Rest | Side event: *Hidden Cache* was skipped (party took different route). |
| 14 | Party arrives at Vexar's Crater (wilderness) | Key event: *Face the Ancient Guardian* triggers. Boss combat. Guardian defeated → Milestone 3 complete (+150). Objective win condition met → Objective complete (+300). |
| 15–30 | Party continues exploring | Normal story mode travel/combat. Quest already complete. Final score includes quest bonuses. |

### Bail-Out Example (Alternate Timeline)

If the party doesn't visit a town by day 4 (Milestone 1 has 3-day bail-out):

| Day | Event | Quest Action |
|-----|-------|-------------|
| 4 | `DayEnd` fires | `bailout_check` sees Milestone 1 still active past deadline. `BailoutTriggered` fires. *"An old traveller approaches the camp and reveals Eldara's location."* Milestone 1 completes via bail-out (+50 instead of +150). Milestone 2 activates. |

---

## Design Notes

1. **Adventure vs. Map**: The adventure system generates **quest structure**
   (objectives, milestones, events). It does not generate the map — that is
   handled by the existing story mode map generation. With the **world system**
   (see [world-design.md](world-design.md)), the map is selected from a
   persistent set of named locations and paths rather than generated
   procedurally. The two systems are connected by milestone-to-location
   mapping and event trigger conditions.

2. **Event triggering is opportunistic**: Quest events trigger when conditions
   are met naturally through story mode exploration. The party does not receive
   explicit "go to location X" directives — they discover events as they travel.
   This preserves the trait-driven voting system as the primary navigation
   mechanism.

3. **Bail-out ensures completion**: Every milestone has a bail-out. This
   guarantees the adventure always progresses, even if the party's trait-based
   decisions lead them away from quest locations. The scoring penalty for
   bail-outs incentivises natural completion.

4. **Custom rules are opt-in**: Most events resolve through the standard
   system (combat or trait-based checks). Custom BRL rules are only needed for
   events with special mechanics. The `ActiveEventRule` pattern keeps custom
   rules cleanly separated.

5. **Side events are bonus content**: Only the key event matters for milestone
   progression. Side events add narrative variety and score bonuses. Missing
   side events has no penalty.

6. **One active milestone at a time**: Milestones are strictly sequential. This
   simplifies state management and creates a clear narrative arc. Future
   extensions could allow parallel milestones.

7. **Template text uses `|` for variants**: Multiple description variants in a
   single field keep the template entity count low while providing narrative
   variety.

8. **The quest overlay is lightweight**: The adventure system adds ~10
   components, ~10 events, and ~10 rules. It hooks into existing story mode
   events rather than replacing them.

9. **World integration**: The adventure composition algorithm is designed to
   work with the world system (see [world-design.md](world-design.md)).
   NPCs are drawn from the world pool with location awareness and role
   exclusivity. Milestones target specific world locations. Blocking encounters
   on world paths halt travel until resolved. Location-based buffs/debuffs
   and hero arrival comments add depth to world exploration.
