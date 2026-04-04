# Enemies — Game Design

This document covers enemy design: tiers, types, boss mechanics, and the components needed to represent enemies in the simulation.

## Design Goals

- Enemies are the sole source of challenge; no player-controlled real-time input is expected.
- Enemies scale in difficulty across **tiers**. Each tier introduces new enemy types with higher stats and new skills.
- **Bosses** appear at fixed intervals (configurable per game mode) and carry unique skills.
- Enemies follow the same component model as heroes; they are distinct only by their `Team` and `Enemy` components.

---

## Enemy Tiers

| Tier | Name | Stat Range | New Mechanics |
|------|------|------------|---------------|
| 1 | Early | Low HP/DMG | Basic melee attack only |
| 2 | Early-Mid | Medium HP/DMG | Pack tactics (minor haste when allies present) |
| 3 | Mid | Medium-High | Simple skills (e.g., a stun or poison) |
| 4 | Late | High HP/DMG | AoE skills; status effects on attack |
| 5 | End-Game | Very High | Combo skills; resistance to one damage type |
| 6 | Boss | Extreme | Full skill set; phase transitions at 50% HP |

---

## Enemy Types (by Tier)

### Tier 1
| Name | HP | Damage | Speed | Notes |
|------|-----|--------|-------|-------|
| Goblin Scout | 60 | 8 | 1.0 | Pure melee, no skills |

### Tier 2
| Name | HP | Damage | Speed | Notes |
|------|-----|--------|-------|-------|
| Orc Raider | 90 | 12 | 0.8 | High STR, slow |
| Dark Wolf | 75 | 14 | 1.2 | High DEX, fast |

### Tier 3
| Name | HP | Damage | Speed | Notes |
|------|-----|--------|-------|-------|
| Skeleton Warrior | 110 | 16 | 0.7 | Bone Shield passive |
| Dark Mage | 80 | 22 | 0.5 | Casts Frost Bolt (applies Frozen) |

### Tier 4
| Name | HP | Damage | Speed | Notes |
|------|-----|--------|-------|-------|
| Troll Berserker | 180 | 22 | 0.6 | Enrage below 50% HP |
| Stone Golem | 220 | 18 | 0.4 | Applies Petrified on hit (chance) |

### Tier 5
| Name | HP | Damage | Speed | Notes |
|------|-----|--------|-------|-------|
| Demon Knight | 250 | 30 | 0.7 | Hellfire AoE; fire resistance |
| Venomspitter | 160 | 20 | 1.0 | Poisons all heroes on attack |

### Tier 6 (Bosses)
| Name | HP | Damage | Speed | Notes |
|------|-----|--------|-------|-------|
| Ancient Dragon | 400 | 40 | 0.8 | Dragon Breath (AoE Burning) |
| Dragon Lord Vexar | 500 | 40 | 0.8 | Phase 2 at 50% HP; final boss |

---

## Boss Mechanics

Bosses are special enemies distinguished by the `Enemy.isBoss` flag. They may additionally carry:

- **Phase transitions**: at certain HP thresholds the boss gains new skills or stat changes. Implemented via a `BossPhase` component and triggered by a `BossPhaseChange` event.
- **Unique skills**: bosses have a full skill set (see [skills.md](skills.md)).
- **Scripted abilities**: abilities that fire on a timer regardless of targeting, implemented via `ScheduledAbility` component.

---

## Enemy AI

Enemy targeting uses the same bound choice function system as heroes. Default behaviours:

- **Melee enemies**: target the hero with the highest current HP (maximize damage absorbed).
- **Caster enemies**: target the hero with the lowest defence (maximize damage output).
- **Bosses**: may switch targets mid-combat based on phase and thresholds.

---

## Components

### `Enemy`
Attached to: all enemy entities (templates and spawned copies).

| Field | Type | Description |
|-------|------|-------------|
| `tier` | integer | Enemy tier (1–6) |
| `isBoss` | boolean | Whether this enemy is a boss |
| `expReward` | integer | Base XP granted on defeat |
| `wave` | integer | Wave number on which this enemy type first appears |

### `EnemyTemplate`
Marker component, attached to: enemy template entities in the compendium.

| Field | Type | Description |
|-------|------|-------------|
| `isTemplate` | boolean | Always `true`; prevents template entities from being targeted |

### `FinalBoss`
Attached to: the final boss entity.

| Field | Type | Description |
|-------|------|-------------|
| `isFinalBoss` | boolean | Triggers game-end sequence on defeat |

### `EnemyCompendium`
Attached to: a single global compendium entity.

| Field | Type | Description |
|-------|------|-------------|
| `entries` | list\<id\> | References to all enemy template entities |

### `BossPhase`
Attached to: boss entities that have phase transitions.

| Field | Type | Description |
|-------|------|-------------|
| `currentPhase` | integer | Current phase index (1 = initial) |
| `maxPhase` | integer | Total number of phases |
| `phaseThresholds` | list\<float\> | HP ratios that trigger each phase change (e.g., `[0.5, 0.25]`) |

### `ScheduledAbility`
Attached to: enemies or bosses with timed abilities.

| Field | Type | Description |
|-------|------|-------------|
| `abilityId` | string | Identifier for the ability to fire |
| `interval` | float | Seconds between ability uses |
| `lastUsed` | float | Simulation time of last use |

---

## Events (Enemy-related)

| Event | Description |
|-------|-------------|
| `SpawnEnemy` | Requests spawning of one enemy entity of a given tier |
| `EnemySpawned` | Fired after an enemy entity is created and ready |
| `EnemyDefeated` | Fired when an enemy's HP reaches 0; awards XP |
| `BossPhaseChange` | Fired when a boss crosses a phase-change HP threshold |
| `SpawnLordVexar` | Fires to spawn the final boss (game-mode configurable) |

---

## Scaling Formula

Enemy HP and damage scale with tier and wave using configurable rates (defined in `SpawnConfig`):

```
scaledHP    = baseHP    * (1 + healthScaleRate / 1000 * currentWave)
scaledDamage = baseDamage * (1 + damageScaleRate / 1000 * currentWave)
```

These rates are adjusted per game mode to control difficulty pacing (see [game-modes.md](game-modes.md)).
