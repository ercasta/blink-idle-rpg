# Encounters — Game Design

This document covers how encounters are structured, how the party progresses through them, how difficulty scales, and the components needed to represent encounter state.

## Design Goals

- The game is a **series of encounters** of increasing difficulty; there is no open world.
- Each encounter is a fight against a random group of enemies from the current tier.
- The party may **retreat** from an encounter at the cost of a score penalty.
- Encounter difficulty scales via enemy tier and random group size.
- **Boss encounters** occur every N kills and include a mini-boss alongside regular enemies.
- A **final boss** (Lord Vexar) is spawned once when the party reaches the maximum tier.

---

## Encounter Structure

An **encounter** consists of:
1. A **random group of enemies** (size varies by `initialEnemyCount ± random`) from the current tier.
2. Optionally a **mini-boss** when `enemiesDefeated` reaches a multiple of `bossEveryKills`.
3. Enemies spawn with a small stagger delay (0.1 s each) and attack immediately.

After all enemies in the group are defeated, the next encounter spawns automatically after a 0.1 s delay.

---

## Progression

```
enemiesDefeated 0–499     → Tier 1 enemies
enemiesDefeated 500–999   → Tier 2 enemies
...
enemiesDefeated 2500+     → Tier 6 enemies (max)

Every bossEveryKills enemies → Boss encounter (mini-boss added to group)
```

The exact thresholds are controlled by `SpawnConfig` (`tierProgressionKills` and `bossEveryKills`) and can differ per game mode.

### Default Progression (Normal Mode)

| Enemies Defeated | Enemy Tier | Enemy Pool |
|-----------------|-----------|------------|
| 0–499 | 1 | Goblin, Skeleton |
| 500–999 | 2 | Orc, Zombie |
| 1000–1499 | 3 | Troll, Vampire |
| 1500–1999 | 4 | Ogre, Werewolf |
| 2000–2499 | 5 | Dragon, Demon Lord |
| 2500+ | 6 | Ancient Dragon, Lich King |
| Special | — | Lord Vexar (final boss, once) |

---

## Encounter Spawning Logic

The spawning system (in BRL `spawn_encounter` rule) works as follows:

1. **Determine encounter type**: if `enemiesDefeated >= nextBossThreshold`, it is a boss encounter. `nextBossThreshold` advances by `bossEveryKills` after each boss encounter.
2. **Determine enemy count**: `floor(random_range(max(1, initialEnemyCount-1), initialEnemyCount+3))`.
3. **Spawn regular enemies**: for each slot, a random non-boss template matching `currentTier` is cloned via `SpawnEnemy` events (staggered 0.1 s apart).
4. **Spawn mini-boss** (boss encounters only): one additional buffed enemy (2.5× HP, 1.5× damage) is appended via `SpawnMiniBoss`.
5. **Track `enemiesAlive`**: set to the total spawned count. Decremented by `encounter_tracking` on each `EnemyDefeated` event. When it reaches 0, the next encounter spawns.

Enemy selection from a tier pool is deterministic per-seed (uses the seeded PRNG). The component storage iterates entity IDs in sorted order to ensure full reproducibility.

---

## Boss Encounters

A **boss encounter** occurs every `bossEveryKills` enemies defeated (default: 100).

- A normal group of enemies is spawned **minus one**, then a **mini-boss** is added.
- The mini-boss is a clone of a random tier-appropriate template, buffed with 2.5× HP and 1.5× damage, and marked `isBoss = true`.
- Mini-boss kills award `bossScore` bonus points.

The **final boss (Lord Vexar)** is a separate entity spawned once when `currentTier` reaches `maxTier`. Lord Vexar is the true win condition of the run.

---

## Tier Advancement

Tier advances every `tierProgressionKills` enemies (default: 500). Rules:

```brl
if entity.GameState.enemiesDefeated >= entity.SpawnConfig.tierProgressionKills * entity.GameState.currentTier {
    if entity.GameState.currentTier < entity.SpawnConfig.maxTier {
        entity.GameState.currentTier += 1
    }
}
```

Each encounter spawns enemies from `currentTier`, so the party faces progressively tougher foes as the kill count increases.

---

## Retreat & Death Handling

- The party can **flee** between attacks (not mid-attack) if `canFlee == true`.
- On flee, `retreatPenalty` is increased and a `fleeCooldown` prevents immediate re-use.
- On hero death, the hero respawns after a brief delay and `playerDeaths` is incremented.

---

## Components

### `GameState` (encounter-related fields)

Attached to: the `game_state` entity.

| Field | Type | Description |
|-------|------|-------------|
| `encounterCount` | integer | Total encounters started |
| `enemiesAlive` | integer | Live enemies in the current encounter |
| `enemiesDefeated` | integer | Total enemies defeated across all encounters |
| `nextBossThreshold` | integer | Kill count that triggers the next boss encounter |
| `currentTier` | integer | Current enemy tier (1–6) |

### `SpawnConfig`

| Field | Type | Description |
|-------|------|-------------|
| `initialEnemyCount` | integer | Base group size per encounter |
| `bossEveryKills` | integer | Kills between boss encounters |
| `tierProgressionKills` | integer | Kills per tier (must equal `bossEveryKills * N` for correct alignment) |
| `maxTier` | integer | Maximum enemy tier |

---

## Events (Encounter-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `SpawnEncounter` | — | Triggers a new encounter to spawn |
| `SpawnEnemy` | `tier` | Spawns one random enemy from the tier pool |
| `SpawnMiniBoss` | — | Spawns a buffed enemy as a mini-boss |
| `SpawnLordVexar` | — | Spawns the final boss (once per run) |
| `EnemyDefeated` | `enemy`, `expReward`, `isBoss` | An enemy was killed; triggers scoring and encounter tracking |
| `GameOver` | `victory` | The run ends (all 3000 enemies defeated or Lord Vexar slain) |
| `Flee` | — | Party retreats; `retreatPenalty` is applied |

---

## Design Notes

- Encounter progression is intentionally simple: a continuous series of fights with no branching.
- The random group size (±2 from `initialEnemyCount`) creates natural variation in encounter difficulty.
- Boss encounters every 100 kills provide rhythm and reward checkpoints.
- All randomness is seeded per game; the same seed always produces the same run.
- Game modes may modify the encounter loop by changing `SpawnConfig` values (e.g., larger groups, more frequent bosses).
- Future extension: **elite encounters** (mid-boss mini-bosses) inserted between regular boss encounters.
- Future extension: **optional encounters** with higher difficulty but score multipliers, selectable by the player.
