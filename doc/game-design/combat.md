# Combat — Game Design

This document covers the combat system: the turn loop, damage formula, targeting, critical hits, and the components needed to represent combat state.

## Design Goals

- Combat is fully automatic; no player input is required during a fight.
- The system is event-driven: each attack schedules the next one at a time offset determined by `attackSpeed`.
- Damage is deterministic given a fixed random seed, enabling reproducible playtests.
- All formulas use integer arithmetic where possible to avoid floating-point drift between engine implementations.

---

## Combat Loop

```
GameStart
  └─ Each hero schedules DoAttack (staggered by 1 / attackSpeed seconds)

DoAttack (entity, target)
  ├─ Condition: entity.Health.current > 0 AND target is alive
  ├─ Compute damage (see formula below)
  ├─ Apply damage to target.Health.current
  ├─ Fire AfterAttack (for reactive effects, skill procs, status application)
  └─ Schedule next DoAttack (delay = 1.0 / attackSpeed)

AfterAttack
  ├─ Check for status effect application (crit → chance-based effects)
  ├─ Check skill procs (see skills.md)
  └─ Check if target is dead → fire Death event

Death (entity)
  ├─ If entity is hero → fire HeroDeath
  │     └─ Apply death penalties to `RunStats`. If all heroes are dead at once, record a party wipeout and apply configured party-wipe penalties; do NOT end the run.
  └─ If entity is enemy → fire EnemyDefeated
        └─ Award XP, update score, check wave clear

CheckAllTargets (every retargetInterval seconds)
  └─ For each entity with a Target component:
       If target is null OR target.Health.current ≤ 0 → fire FindNewTarget

FindNewTarget (entity)
  └─ Run entity's select_attack_target choice function
       → assign Target.entity
       → schedule DoAttack if not already scheduled
```

---

## Kill System

- `EnemyDefeated` is emitted when an enemy's HP reaches zero. The event includes the `enemy` entity and a `killedBy` field that records the entity (or `null`) that delivered the killing blow.
- On `EnemyDefeated`:
  - Increment `GameState.enemiesDefeated` (global run-wide kill count) and update `RunStats` counters.
  - Award experience equal to the defeated enemy's `Enemy.expReward` split evenly among all living player heroes at the moment of death. If there are no living heroes, XP is not awarded.
  - Record kill credit: the `killedBy` entity receives explicit kill credit for loot/achievement attribution; assists are acknowledged via XP share.
  - Apply scoring and time-based effects according to the selected `GameMode`'s `ScoringRules`.

- Boss spawns and tier progression:
  - When `GameState.enemiesDefeated` reaches a multiple of `SpawnConfig.bossEveryKills`, the next scheduled wave will include a boss spawn.
  - When `GameState.enemiesDefeated` reaches a multiple of `SpawnConfig.tierProgressionKills`, increment `GameState.currentTier` (capped by `SpawnConfig.maxTier`) and reset `waveInTier`.

- Edge cases:
  - Simultaneous deaths (e.g., AoE) produce multiple `EnemyDefeated` events; XP shares are computed against the set of living heroes at the time each death is processed.
  - If `killedBy` is `null` or environmental, the party still receives shared XP but killer-specific rewards are not awarded.

## Damage Formula

```
rawDamage     = attacker.Combat.damage + attacker.Buffs.damageBonus
netDamage     = max(1, rawDamage - defender.Combat.defense - defender.Buffs.defenseBonus)
isCrit        = random() < attacker.Combat.critChance
finalDamage   = isCrit ? floor(netDamage * attacker.Combat.critMultiplier) : netDamage
shieldAbsorb  = min(finalDamage, defender.Buffs.shieldAmount)
appliedDamage = finalDamage - shieldAbsorb
defender.Health.current -= appliedDamage
defender.Buffs.shieldAmount -= shieldAbsorb
```

- Minimum damage is always **1** (armour cannot fully negate damage).
- Shield absorb is consumed first before HP is reduced.
- Status effects may add a `damageTypeBonus` on top of `netDamage` (see [status-effects.md](status-effects.md)).

---

## Targeting Rules

Each entity has exactly one active target at a time (`Target.entity`). Target selection runs via the entity's **bound choice function** `select_attack_target`, which is defined per hero class or enemy type in BRL.

Default fallback (no choice function defined):
- **Heroes**: target the first living enemy in the encounter list.
- **Enemies**: target the first living hero in the party.

Target is re-evaluated:
- When the current target dies (`FindNewTarget` event).
- Periodically by the retargeting system (`CheckAllTargets`).
- When a skill or status effect forces a target change.

---

## Flee / Retreat Mechanic

Heroes may retreat from an encounter, incurring a time penalty:

```
timePenalty = FleeConfig.retreatTimePenalty
```

After retreating, a cooldown prevents immediate re-use:

```
canFlee = (currentTime - lastFleeTime) >= FleeConfig.fleeCooldown
```

On hero death:

```
deathPenalty = FleeConfig.retreatTimePenalty * FleeConfig.deathTimePenaltyMultiplier
```

These penalties are added to `RunStats` and feed directly into the score calculation (see [scoring.md](scoring.md)).

Run completion and snapshots

- Runs are not ended by hero deaths or party wipeouts. Instead, a run completes only when a fixed number of encounters have been played.
- `GameState.totalEncounters` defines the run length (example default: 3000). `GameState.encountersPlayed` increments when an encounter finishes.
- Run data is snapshotted every `GameState.snapshotInterval` encounters (example: 100). Snapshots are recorded to `RunStats.snapshots` for later analysis.

- When `GameState.encountersPlayed >= GameState.totalEncounters`, emit a `RunComplete` event to finalize scoring and persist the final snapshot.
- Hero deaths and party wipeouts apply score/time penalties but do not stop the run.

---

## Components

### `Target`
Attached to: all combatants.

| Field | Type | Description |
|-------|------|-------------|
| `entity` | id? | The current attack target; `null` if no target |

### `GameState`
Attached to: a single global game-state entity.

| Field | Type | Description |
|-------|------|-------------|
| `currentWave` | integer | Current wave number |
| `enemiesDefeated` | integer | Total enemies defeated this run |
| `playerDeaths` | integer | Total hero deaths this run |
| `bossDefeated` | boolean | Whether the current boss has been defeated |
| `encountersPlayed` | integer | Number of encounters completed in this run |
| `totalEncounters` | integer | Number of encounters that define run completion (e.g., 3000) |
| `snapshotInterval` | integer | Number of encounters between data snapshots (e.g., 100) |
| `partyWipeoutOccurred` | boolean | Whether a full-party wipeout has occurred since last snapshot |
| `retargetingActive` | boolean | Whether the periodic retarget loop is running |
| `currentTier` | integer | Current enemy tier |
| `waveInTier` | integer | Wave counter within the current tier |
| `bossSpawned` | boolean | Whether a boss has been spawned this tier |

### `SpawnConfig`
Attached to: the game-state entity (combined for rule access simplicity).

| Field | Type | Description |
|-------|------|-------------|
| `bossEveryKills` | integer | Number of enemy kills before a boss spawns |
| `tierProgressionKills` | integer | Kills needed to advance to the next tier |
| `maxTier` | integer | Maximum enemy tier |
| `wavesPerTier` | integer | Waves played per tier |
| `healthScaleRate` | integer | Per-wave HP scaling rate (per-mille) |
| `damageScaleRate` | integer | Per-wave damage scaling rate (per-mille) |
| `initialEnemyCount` | integer | Number of enemies in the first wave |

### `RunStats`
Attached to: a single global run-stats entity.

| Field | Type | Description |
|-------|------|-------------|
| `simulationTime` | float | Elapsed in-simulation time (seconds) |
| `retreatCount` | integer | Number of retreats this run |
| `retreatPenalty` | float | Total retreat time penalties accumulated |
| `deathPenalty` | float | Total death time penalties accumulated |
| `totalTime` | float | `simulationTime + retreatPenalty + deathPenalty` |
| `canFlee` | boolean | Whether the party can currently flee |
| `lastFleeTime` | float | Simulation time of the last retreat |
| `encountersCompleted` | integer | Number of encounters finished (mirrors `GameState.encountersPlayed`) |
| `snapshots` | list | Stored snapshot metadata recorded every `GameState.snapshotInterval` encounters |

### `FleeConfig`
Attached to: a single global flee-config entity.

| Field | Type | Description |
|-------|------|-------------|
| `retreatTimePenalty` | float | Time penalty (seconds) per retreat |
| `deathTimePenaltyMultiplier` | float | Multiplier applied to retreat penalty on death |
| `fleeCooldown` | float | Minimum seconds between retreats |

---

## Events (Combat-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `DoAttack` | `attacker`, `target` | Initiates one attack |
| `AfterAttack` | `attacker`, `target`, `damage`, `isCrit` | Post-attack hook for effects and procs |
| `Death` | `entity` | Entity's HP has reached 0 |
| `HeroDeath` | `hero` | A hero has died |
| `EnemyDefeated` | `enemy`, `killedBy` | An enemy has been killed |
| `FindNewTarget` | `seeker` | Asks a combatant to acquire a new target |
| `CheckAllTargets` | — | Periodic retargeting check for all combatants |
| `GameOver` | `reason` | Emitted when the run reaches `GameState.totalEncounters`. Hero deaths and party wipeouts do not trigger game over; they only apply penalties. |
| `Victory` | — | Final boss is defeated |
| `Flee` | `party` | Party retreats from the current encounter |

---

## Design Notes

- The minimum damage of 1 ensures combat always terminates (no stalemate from high armour).
- `attackSpeed` is stored as attacks-per-second; delay = `1.0 / attackSpeed`.
- AoE skills do not use the `DoAttack` path; they are fired as standalone events by the skill system (see [skills.md](skills.md)).
- Healing is treated as negative damage and uses the same `AfterAttack` hook.
