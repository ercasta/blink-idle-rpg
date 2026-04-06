# Encounters — Game Design

This document covers how encounters are structured, how the party progresses through them, how difficulty scales, and the components needed to represent encounter state.

## Design Goals

- The game is a **series of encounters** of increasing difficulty; there is no open world.
- Each encounter is a fight against a fixed wave of enemies.
- The party may **retreat** from an encounter at the cost of a score penalty.
- Encounter difficulty scales via enemy tier, count, and stat multipliers.
- Boss encounters are special and use different selection logic.

---

## Encounter Structure

An **encounter** consists of:
1. A **set of enemies** determined by the current tier and wave number.
2. A **difficulty multiplier** applied to enemy HP and damage.
3. A **time budget**: completing the encounter quickly rewards bonus score.
4. A **boss flag**: if this is a boss encounter, the standard wave enemies are replaced by a single boss entity.

---

## Wave Progression

```
Wave 1..wavesPerTier        → Tier 1 enemies
Wave (wavesPerTier+1)..2*wavesPerTier → Tier 2 enemies
...
Wave N (every bossEveryKills kills) → Boss encounter
```

The exact thresholds are controlled by `SpawnConfig` and can differ per game mode.

### Default Progression (Normal Mode)
| Phase | Waves | Enemy Tier | Special |
|-------|-------|-----------|---------|
| Early Game | 1–3 | 1 | — |
| Early-Mid | 4–6 | 2 | — |
| Mid Game | 7–9 | 3 | — |
| Late Game | 10–12 | 4 | — |
| End Game | 13–15 | 5 | — |
| Boss | Every ~100 kills | 6 | Boss entity replaces wave |

---

## Encounter Selection Logic

The spawning system uses the following priority order:

1. **Boss Encounter**: if `enemiesDefeated % bossEveryKills == 0` and `!bossSpawned`, spawn the tier boss.
2. **Tier Advance**: if `enemiesDefeated % tierProgressionKills == 0`, increment `currentTier` (up to `maxTier`).
3. **Normal Wave**: spawn `initialEnemyCount` enemies from the current tier pool.

Enemy selection from a tier pool is random (seeded for reproducibility). Each tier pool contains all enemy templates registered for that tier in the `EnemyCompendium`.

---

## Difficulty Scaling

Enemy stats scale with the wave number:

```
scaledHP     = baseHP    * (1 + healthScaleRate / 1000 * currentWave)
scaledDamage = baseDamage * (1 + damageScaleRate / 1000 * currentWave)
```

Additionally, `initialEnemyCount` may increase by one for every N waves (configurable in `SpawnConfig`).

---

## Retreat & Death Handling

- The party can **flee** between attacks (not mid-attack) if `canFlee == true`.
- On flee, `retreatPenalty` is increased and a `fleeCooldown` prevents immediate re-use.
- On hero death, `deathPenalty` is accumulated.

---

## Components

### `EncounterState`
Attached to: the game-state entity for the duration of an encounter.

| Field | Type | Description |
|-------|------|-------------|
| `encounterId` | integer | Monotonically increasing encounter counter |
| `startTime` | float | Simulation time when the encounter started |
| `enemyCount` | integer | Total enemies in this encounter |
| `enemiesRemaining` | integer | Live enemies still in this encounter |
| `isBossEncounter` | boolean | Whether this is a boss encounter |
| `difficultyMultiplier` | float | Stat scaling applied to enemies in this encounter |

### `EncounterResult`
Attached to: the game-state entity after an encounter resolves (win or flee).

| Field | Type | Description |
|-------|------|-------------|
| `encounterId` | integer | Which encounter this result belongs to |
| `won` | boolean | `true` if all enemies were defeated |
| `timeElapsed` | float | Seconds taken to resolve the encounter |
| `heroDeaths` | integer | Hero deaths during this encounter |
| `retreated` | boolean | `true` if the party fled |

### `SpawnConfig`
(Defined in [combat.md](combat.md).) Controls wave composition and scaling rates.

---

## Events (Encounter-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `EncounterStart` | `encounterId`, `isBoss` | A new encounter begins; enemies are spawned |
| `EncounterEnd` | `encounterId`, `won`, `timeElapsed` | All enemies defeated or party fled |
| `SpawnEnemy` | `tier`, `waveNumber` | Requests creation of one enemy from the tier pool |
| `EnemySpawned` | `enemyId`, `tier` | Enemy entity is live and ready to fight |
| `NextWave` | `waveNumber` | Schedules the next wave |
| `Flee` | — | Party retreats; `retreatPenalty` is applied |

---

## Design Notes

- The encounter system is intentionally simple — "a series of fights" with no branching narrative.
- Game modes may modify the encounter loop by changing `SpawnConfig` values or overriding the boss spawn threshold.
- Future extension: **optional encounters** with higher difficulty but score multipliers, selectable by the player at run start. These would be represented as extra entries in a choice list before the next `EncounterStart`.
- Future extension: **elite encounters** (mid-boss mini-bosses) inserted between regular boss encounters.
