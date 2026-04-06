# Game Technical Design - Characters

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


BRL/IR integration:

- When compiling hero templates to IR, ensure `decision_values` are present on the template entity and are emitted as integer fields. The runtime rule-set should read and normalise them once per turn and cache the normalised weights in a transient component for that hero.

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

