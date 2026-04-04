# Characters — Game Design

This document covers hero character design: classes, base stats, progression, and the components needed to represent heroes in the simulation.

## Design Goals

- Heroes are persistent entities that carry a party through multiple encounters.
- Each hero has a **class** that determines starting stats, available skills, and targeting behaviour.
- Heroes gain experience and level up across encounters, improving their stats.
- A party of 1–6 heroes is selected at game start and remains for the entire run.

---

## Hero Classes

| Class | Role | Stat Emphasis | Playstyle Summary |
|-------|------|---------------|-------------------|
| Warrior | Tank / Melee DPS | STR, CON | High HP; targets the most dangerous enemy |
| Mage | Burst Caster | INT, WIS | Glass cannon; powerful spells, low defence |
| Ranger | Ranged DPS | DEX | High attack speed; targets lowest-HP enemy |
| Paladin | Support / Tank | STR, WIS | Heals allies; high survivability |
| Rogue | Burst Melee | DEX | High crit; targets lowest-defence enemy |
| Cleric | Healer | WIS, INT | Prioritises healing; supports the party |

### Stat Definitions

| Stat | Abbreviation | Effect |
|------|-------------|--------|
| Strength | STR | Increases melee damage |
| Dexterity | DEX | Increases attack speed and crit chance |
| Intelligence | INT | Increases spell / magic damage |
| Constitution | CON | Increases max HP |
| Wisdom | WIS | Increases max Mana; improves healing |

---

## Progression

- Heroes start at **level 1** and gain experience from defeating enemies.
- On level-up, each stat increases by an amount determined by the hero's class growth table.
- Maximum level is **20** (soft cap for balance; enemies scale beyond this point).
- Skill slots unlock at levels 1, 5, 10, and 15.

---

## Components

### `Character`
Attached to: every hero and enemy entity.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name |
| `class` | string | Class identifier (e.g., `"Warrior"`, `"Mage"`) |
| `level` | integer | Current level |
| `experience` | integer | Accumulated XP |
| `experienceToLevel` | integer | XP required for next level |

### `Health`
Attached to: heroes and enemies.

| Field | Type | Description |
|-------|------|-------------|
| `current` | integer | Current hit points |
| `max` | integer | Maximum hit points |

### `Mana`
Attached to: heroes and enemies that use mana.

| Field | Type | Description |
|-------|------|-------------|
| `current` | integer | Current mana |
| `max` | integer | Maximum mana |

### `Stats`
Attached to: heroes and enemies.

| Field | Type | Description |
|-------|------|-------------|
| `strength` | integer | Melee damage modifier |
| `dexterity` | integer | Speed and crit modifier |
| `intelligence` | integer | Magic damage modifier |
| `constitution` | integer | HP modifier |
| `wisdom` | integer | Mana and healing modifier |

### `Combat`
Derived combat values, attached to: heroes and enemies.

| Field | Type | Description |
|-------|------|-------------|
| `damage` | integer | Base damage per attack |
| `defense` | integer | Damage reduction |
| `attackSpeed` | float | Attacks per second |
| `critChance` | float | Probability of a critical hit (0–1) |
| `critMultiplier` | float | Damage multiplier on crit |

### `Team`
Attached to: every combatant.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Team identifier: `"player"` or `"enemy"` |
| `isPlayer` | boolean | True for hero entities |

### `HeroInfo`
Attached to: hero template entities (used by the party selection UI).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique hero class identifier |
| `description` | string | Flavour text shown in the UI |
| `difficulty` | string | Relative difficulty rating |
| `role` | string | Role label (e.g., `"Tank / Melee DPS"`) |
| `playstyle` | string | Short playstyle hint |

### `HeroTemplate`
Marker component, attached to: hero template entities (not spawned heroes).

| Field | Type | Description |
|-------|------|-------------|
| `isTemplate` | boolean | Always `true` |

### `Buffs`
Attached to: heroes and enemies. Tracks active numeric buff totals.

| Field | Type | Description |
|-------|------|-------------|
| `damageBonus` | integer | Additional damage added to each attack |
| `defenseBonus` | integer | Additional defence |
| `hasteBonus` | float | Additional attack speed |
| `shieldAmount` | integer | Absorb-shield hit points remaining |
| `regenAmount` | integer | HP regenerated per second |

---

## Events (Hero-related)

| Event | Description |
|-------|-------------|
| `GameStart` | Initialises all heroes and schedules the first encounter |
| `LevelUp` | Fired when a hero's XP reaches `experienceToLevel`; increases stats |
| `HeroDeath` | Fired when a hero's HP drops to 0 |
| `HeroRevived` | Fired if a revival mechanic (skill or item) brings a hero back |
| `GainExperience` | Awards XP to all living heroes after an enemy is defeated |

---

## Design Notes

- The **targeting behaviour** of each hero class is encoded as a bound choice function on the hero template (already used in the existing BDL). This allows per-class AI without conditional branching in shared rules.
- Stat scaling on level-up uses class-specific **growth tables** (to be defined per class in BDL).
- Revival mechanics (Paladin passive, Cleric skill) are handled via skill components — see [skills.md](skills.md).
