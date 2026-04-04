# Status Effects — Game Design

This document covers all status effects in the game: their behaviour, stacking rules, and the components needed to track them on entities.

## Design Goals

- Status effects add tactical variety without requiring player input.
- Each effect is tracked as a dedicated component on the affected entity, making it easy to query in BRL rules.
- Effects that deal damage over time (DoT) fire periodic `TickEffect` events.
- Cleanses and immunities are also modelled as components.

---

## Status Effect Overview

| Effect | Category | Stackable | Source |
|--------|----------|-----------|--------|
| Frozen | Crowd Control | No (refreshes) | Frost Bolt, Frost Aura |
| Stunned | Crowd Control | No (refreshes) | Shield Bash, Stun Arrow |
| Petrified | Crowd Control | No | Stone Golem passive, Medusa Gaze |
| Silenced | Debuff | No | Silence Arrow |
| Blinded | Debuff | No | Shadowstep |
| Burning | DoT | No (refreshes, stacks damage) | Fireball, Dragon Breath |
| Poisoned | DoT | Yes (up to 5 stacks) | Poison Arrow, Poison Spit |
| Bleeding | DoT | Yes (up to 5 stacks) | Eviscerate, Slash passive |
| Weakened | Debuff | No | Curse skills |
| Blessed | Buff | No | Holy Strike |
| Hasted | Buff | No | Speed Potion, Haste skill |
| Shielded | Buff | No | Arcane Shield, Divine Shield |
| Regenerating | Buff | No | Cleric aura |
| Untargetable | Buff | No | Shadow Cloak |
| Enraged | Buff | No | Troll Berserker passive |
| Cursed | Debuff | No | Vexar's Curse |

---

## Individual Effect Descriptions

### Frozen
- The entity cannot act (no attacks, no skills) for the duration.
- Damage received while Frozen is increased by 25%.
- Does not stack; re-applying resets the duration.

### Stunned
- The entity cannot act for the duration.
- Unlike Frozen, there is no damage bonus.
- Does not stack; re-applying resets the duration.

### Petrified
- The entity cannot move or act.
- Damage received is increased by 50%.
- Lasts for a fixed duration regardless of how many times the entity is hit.
- Only one source can apply it at a time; re-applying resets the duration.

### Silenced
- The entity can still make basic attacks but cannot use skills.
- Does not affect passive skills.

### Blinded
- Reduces the entity's `critChance` to 0 and `attackSpeed` by 30%.

### Burning
- Deals fire damage per second equal to `damagePerSecond`.
- Duration refreshes on re-application; `damagePerSecond` is set to the higher of the existing or new value.

### Poisoned
- Deals nature damage per second per stack.
- Stacks up to 5; each stack applies independently when counting damage.
- Individual stacks expire when their duration ends; not all stacks expire together.

### Bleeding
- Deals physical damage per second per stack.
- Stacks up to 5 (same model as Poisoned).
- Can be cleansed by Purify.

### Weakened
- Reduces the entity's `defense` by a flat amount for the duration.

### Blessed
- Increases the entity's `damageBonus` and `defenseBonus` for the duration.

### Hasted
- Increases the entity's `attackSpeed` by a multiplier.

### Shielded
- Absorbs incoming damage up to `shieldAmount` before HP is reduced.
- See `Buffs.shieldAmount` in [combat.md](combat.md).

### Regenerating
- Restores `regenAmount` HP per second.

### Untargetable
- The entity cannot be selected as a valid attack target.
- Enemies with only one target will skip their attack if it becomes Untargetable.

### Enraged
- Grants a `damageBonus` increase.
- Typically triggered automatically by the Troll Berserker's passive at ≤ 50% HP.

### Cursed
- Reduces the entity's `max HP` by a percentage for the duration.
- Current HP is also reduced proportionally if above the new maximum.

---

## Stacking Rules

| Rule | Details |
|------|---------|
| **Refreshable** | Re-application resets duration but does not add a second instance (Frozen, Stunned, Petrified, Burning) |
| **Stackable** | Multiple instances exist simultaneously; each has its own duration (Poisoned, Bleeding) |
| **Non-stackable** | Only one instance at a time; re-application is ignored unless the current effect expires (Blinded, Silenced, Weakened) |
| **Unique** | Only one copy per caster, or source-restricted (Enraged, Cursed) |

---

## Immunity

Some entity types are immune to certain status effects (tracked via the `StatusImmunity` component):

| Enemy Type | Immune To |
|-----------|-----------|
| Demon Knight | Burning, Poisoned |
| Skeleton Warrior | Poisoned |
| Ancient Dragon | Frozen |
| Dragon Lord Vexar | Frozen, Stunned, Petrified |

---

## Components

### `Frozen`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |
| `damageMultiplier` | float | Damage multiplier while active (e.g., 1.25) |

### `Stunned`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |

### `Petrified`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |
| `damageMultiplier` | float | Damage multiplier while active (e.g., 1.5) |

### `Silenced`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |

### `Blinded`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |
| `attackSpeedReduction` | float | Fractional reduction to attackSpeed |

### `Burning`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |
| `damagePerSecond` | integer | Fire damage dealt each second |

### `PoisonStack`
One component instance per stack (multiple components of this type may exist on the same entity).

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining for this stack |
| `damagePerSecond` | integer | Nature damage per second for this stack |
| `sourceId` | id | Caster entity that applied this stack |

### `BleedStack`
One component instance per stack.

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining for this stack |
| `damagePerSecond` | integer | Physical damage per second for this stack |
| `sourceId` | id | Caster entity that applied this stack |

### `Weakened`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |
| `defenseReduction` | integer | Flat defense reduction |

### `Blessed`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |
| `damageBonus` | integer | Additional damage |
| `defenseBonus` | integer | Additional defense |

### `Hasted`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |
| `speedMultiplier` | float | Multiplier applied to attackSpeed |

### `Regenerating`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |
| `hpPerSecond` | integer | HP restored per second |

### `Untargetable`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |

### `Enraged`

| Field | Type | Description |
|-------|------|-------------|
| `damageBonus` | integer | Additional damage while enraged |
| `triggeredByHpRatio` | float | HP threshold that triggered this effect |

### `Cursed`

| Field | Type | Description |
|-------|------|-------------|
| `remainingTime` | float | Seconds remaining |
| `maxHpReductionPct` | float | Fractional reduction to `Health.max` |
| `sourceId` | id | Boss that applied the curse |

### `StatusImmunity`
Attached to: entities with innate immunities.

| Field | Type | Description |
|-------|------|-------------|
| `immuneEffects` | list\<string\> | List of status effect IDs this entity is immune to |

---

## Events (Status Effect-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `ApplyStatusEffect` | `target`, `effectType`, `magnitude`, `duration`, `source` | Applies or refreshes a status effect |
| `TickEffect` | `target`, `effectType`, `damage` | Periodic DoT damage tick |
| `RemoveStatusEffect` | `target`, `effectType` | Expires or cleanses a status effect |
| `StatusEffectExpired` | `target`, `effectType` | Notification after expiry (for triggered reactions) |
| `Purify` | `target` | Removes all negative status effects from target |
