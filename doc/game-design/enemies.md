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

The BRL source defines enemy templates as entities in `game/brl/classic-rpg.brl`. Each template has `EnemyTemplate.isTemplate = true` and is cloned at runtime when enemies spawn.

### Tier 1
| Name | HP | Damage | Defense | Speed | Notes |
|------|-----|--------|---------|-------|-------|
| Goblin | 45 | 8 | 2 | 1.0 | Weak, fast to kill |
| Skeleton | 55 | 10 | 3 | 0.9 | Slightly tougher |

### Tier 2
| Name | HP | Damage | Defense | Speed | Notes |
|------|-----|--------|---------|-------|-------|
| Orc | 70 | 14 | 4 | 0.8 | Balanced |
| Zombie | 85 | 12 | 5 | 0.7 | High HP, low speed |

### Tier 3
| Name | HP | Damage | Defense | Speed | Notes |
|------|-----|--------|---------|-------|-------|
| Troll | 120 | 18 | 6 | 0.6 | High HP |
| Vampire | 90 | 20 | 5 | 1.0 | High damage |

### Tier 4
| Name | HP | Damage | Defense | Speed | Notes |
|------|-----|--------|---------|-------|-------|
| Ogre | 160 | 22 | 8 | 0.5 | Tank |
| Werewolf | 130 | 25 | 6 | 1.1 | Fast and damaging |

### Tier 5
| Name | HP | Damage | Defense | Speed | Notes |
|------|-----|--------|---------|-------|-------|
| Dragon | 240 | 30 | 10 | 0.7 | High HP |
| Demon Lord | 200 | 35 | 8 | 0.8 | High damage |

### Tier 6
| Name | HP | Damage | Defense | Speed | Notes |
|------|-----|--------|---------|-------|-------|
| Ancient Dragon | 400 | 40 | 12 | 0.8 | Hardest regular enemy |
| Lich King | 300 | 45 | 10 | 0.9 | Fast and deadly |

### Final Boss
| Name | HP | Damage | Defense | Speed | Notes |
|------|-----|--------|---------|-------|-------|
| Dragon Lord Vexar | 2000 | 50 | 20 | 1.0 | Spawns once at tier 6; true win condition |

---

## Boss Mechanics

Bosses are special enemies distinguished by the `Enemy.isBoss` flag.

**Mini-bosses** appear in regular boss encounters (every `bossEveryKills` defeats). They are buffed clones of tier-appropriate templates:
- 2.5× base HP
- 1.5× base damage
- `isBoss = true` (awards boss kill score)

**Lord Vexar** is the unique final boss:
- Spawns once when `currentTier` reaches `maxTier` (tier 6)
- Has 2000 HP, 50 damage, 20 defense
- Defeating Lord Vexar sets `victory = true` and ends the run

---

## Enemy AI

Enemies target the first available living hero (determined by the `find_new_target` rule, which iterates hero entities in entity-ID order for reproducibility). Enemies retarget automatically when their current target dies.

---

## Components

### `Enemy`
Attached to: all enemy entities (templates and spawned copies).

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name |
| `tier` | integer | Enemy tier (1–6) |
| `isBoss` | boolean | Whether this enemy is a boss (mini-boss or Lord Vexar) |
| `expReward` | integer | Base XP granted on defeat |

### `EnemyTemplate`
Attached to: all enemy entities (templates and live copies).

| Field | Type | Description |
|-------|------|-------------|
| `isTemplate` | boolean | `true` for template entities (never targeted or killed); `false` for live spawned copies |

Live enemies are created by cloning a template entity with `isTemplate` set to `false`. The template entity itself is never modified or deleted.

### `FinalBoss`
Marker component attached to: the Lord Vexar template only.

| Field | Type | Description |
|-------|------|-------------|
| `isFinalBoss` | boolean | Marks this template as the final boss |

---

## Events (Enemy-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `SpawnEnemy` | `tier` | Spawns one random non-boss enemy of the given tier |
| `SpawnMiniBoss` | — | Spawns a buffed enemy as a mini-boss |
| `SpawnLordVexar` | — | Spawns the final boss entity |
| `EnemyDefeated` | `enemy`, `expReward`, `isBoss` | Fired after an enemy is killed and deleted; awards XP and score |

---

## Scaling Formula

Enemy HP and damage are defined per tier as static template stats. There is no wave-based scaling formula — the templates have fixed stats and difficulty increases come from higher-tier enemies replacing lower-tier ones as `enemiesDefeated` accumulates. Mini-boss multipliers (2.5× HP, 1.5× damage) provide the within-tier scaling.
