# Encounters — Game Design

This document covers how encounters are structured, how the party progresses through them, how difficulty scales, and the components needed to represent encounter state.

## Design Goals

- The game is a **series of 3 000 encounters** of increasing difficulty; there is no open world.
- Each encounter is a fight against a random group of enemies from the current tier.
- The **number of enemies per encounter equals the party size** (±1), keeping fights tactically fair regardless of party composition.
- The party is **fully healed** (HP and mana restored to max) after every encounter ends.
- Variability in score comes from heroes gaining XP → levelling up → facing stronger enemies → earning higher rewards.
- The party may **retreat** from an encounter at the cost of a score penalty.
- **Boss encounters** occur every N encounters and include a mini-boss alongside regular enemies.
- A **final boss** (Lord Vexar) is spawned once when the party reaches the maximum tier.

---

## Encounter Structure

An **encounter** consists of:
1. A **random group of enemies** (size = `partySize ± 1`, minimum 1) from the current tier.
2. Optionally a **mini-boss** when the encounter index is a multiple of `bossEveryKills`.
3. Enemies spawn with a small stagger delay (0.1 s each) and attack immediately.

After all enemies in the group are defeated:
- All heroes are **healed to full HP and mana**.
- The encounter counter increments.
- The next encounter spawns automatically after a 0.1 s delay.

---

## Progression

```
encountersCompleted 0–499     → Tier 1 enemies
encountersCompleted 500–999   → Tier 2 enemies
encountersCompleted 1000–1499 → Tier 3 enemies
encountersCompleted 1500–1999 → Tier 4 enemies
encountersCompleted 2000–2499 → Tier 5 enemies
encountersCompleted 2500+     → Tier 6 enemies (max)

Every bossEveryKills encounters → Boss encounter (mini-boss added to group)
```

The exact thresholds are controlled by `SpawnConfig` (`tierProgressionKills` and `bossEveryKills`) and can differ per game mode.

### Default Progression (Normal Mode)

| Encounters Completed | Enemy Tier | Enemy Pool |
|---------------------|-----------|------------|
| 0–499 | 1 | Goblin Scout |
| 500–999 | 2 | Orc Raider, Dark Wolf |
| 1000–1499 | 3 | Skeleton Warrior, Dark Mage |
| 1500–1999 | 4 | Troll Berserker |
| 2000–2499 | 5 | Demon Knight |
| 2500+ | 6 | Ancient Dragon, Dragon Lord Vexar |
| Special | — | Lord Vexar (final boss, once) |

---

## Encounter Spawning Logic

The spawning system (in BRL `spawn_encounter` rule) works as follows:

1. **Determine encounter type**: if `encounterCount + 1 >= nextBossThreshold`, it is a boss encounter. `nextBossThreshold` advances by `bossEveryKills` after each boss encounter.
2. **Determine enemy count**: count non-template player heroes; use `floor(random_range(max(1, partySize-1), partySize+2))` for a range of `partySize ± 1`.
3. **Spawn regular enemies**: for each slot, a random non-boss template matching `currentTier` is cloned via `SpawnEnemy` events (staggered 0.1 s apart).
4. **Spawn mini-boss** (boss encounters only): one additional buffed enemy (2.5× HP, 1.5× damage) is appended via `SpawnMiniBoss`.
5. **Track `enemiesAlive`**: set to the total spawned count. Decremented by `encounter_tracking` on each `EnemyDefeated` event. When it reaches 0, all heroes are healed and the next encounter spawns.

Enemy selection from a tier pool is deterministic per-seed (uses the seeded PRNG). The component storage iterates entity IDs in sorted order to ensure full reproducibility.

---

## Between-Encounter Healing

When `enemiesAlive` drops to 0, the `encounter_tracking` rule iterates all non-template player heroes and restores both `Health.current = Health.max` and `Mana.current = Mana.max`. This ensures every encounter starts with the party at full strength. Heroes do not gain a temporary advantage from between-encounter healing beyond the restoration.

Death during an encounter still counts as a death (hero respawns after the penalty delay), but by the time the next encounter starts any surviving heroes (and respawned heroes) are topped up.

---

## Score Variability

Each hero gains XP equal to the defeated enemy's `expReward` on every kill. When a hero levels up:
- Stats increase (HP max, damage, defense, mana max).
- Higher-tier enemies become accessible (once `currentTier` advances).
- Boss encounters award more `bossScore` points.

Because different PRNG seeds produce different encounter sizes, crit rolls, and enemy selections, two runs with the same party will produce different kill counts per encounter and therefore different score totals.

---

## Boss Encounters

A **boss encounter** occurs every `bossEveryKills` encounters (default: 100).

- A normal group of enemies is spawned **minus one**, then a **mini-boss** is added.
- The mini-boss is a clone of a random tier-appropriate template, buffed with 2.5× HP and 1.5× damage, and marked `isBoss = true`.
- Mini-boss kills award `bossScore` bonus points.

The **final boss (Lord Vexar)** is a separate entity spawned once when `currentTier` reaches `maxTier`. Lord Vexar is the true win condition of the run.

---

## Tier Advancement

Tier advances every `tierProgressionKills` **encounters completed** (default: 500). This is evaluated inside `encounter_tracking` after `encounterCount` is incremented:

```brl
let newTier: integer = (entity.GameState.encounterCount / entity.SpawnConfig.tierProgressionKills) + 1
if newTier > entity.SpawnConfig.maxTier {
    newTier = entity.SpawnConfig.maxTier
}
if newTier > entity.GameState.currentTier {
    entity.GameState.currentTier = newTier
}
```

Each encounter spawns enemies from `currentTier`, so the party faces progressively tougher foes as encounters accumulate.

---

## Retreat & Death Handling

- The party can **flee** between attacks (not mid-attack) if `canFlee == true`.
- On flee, `retreatPenalty` is increased and a `fleeCooldown` prevents immediate re-use.
- On hero death, the hero respawns after a brief delay and `playerDeaths` is incremented.
- Between-encounter healing does **not** negate death-penalty time already incurred.

---

## Components

### `GameState` (encounter-related fields)

Attached to: the `game_state` entity.

| Field | Type | Description |
|-------|------|-------------|
| `encounterCount` | integer | Total encounters **completed** (incremented after all enemies die) |
| `enemiesAlive` | integer | Live enemies in the current encounter |
| `enemiesDefeated` | integer | Total individual enemies killed across all encounters |
| `nextBossThreshold` | integer | Encounter count that triggers the next boss encounter |
| `currentTier` | integer | Current enemy tier (1–6) |

### `SpawnConfig`

| Field | Type | Description |
|-------|------|-------------|
| `initialEnemyCount` | integer | Fallback group size (used only if party size cannot be determined) |
| `bossEveryKills` | integer | Encounters between boss encounters |
| `tierProgressionKills` | integer | Encounters per tier (500 in Normal → tier 6 at encounter 2500) |
| `maxTier` | integer | Maximum enemy tier |

---

## Events (Encounter-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `SpawnEncounter` | — | Triggers a new encounter to spawn |
| `SpawnEnemy` | `tier` | Spawns one random enemy from the tier pool |
| `SpawnMiniBoss` | — | Spawns a buffed enemy as a mini-boss |
| `SpawnLordVexar` | — | Spawns the final boss (once per run) |
| `EnemyDefeated` | `enemy`, `expReward`, `isBoss` | An enemy was killed; triggers XP, scoring, and encounter tracking |
| `GameOver` | `victory` | The run ends (3000 encounters completed or campaign abandoned) |
| `Flee` | — | Party retreats; `retreatPenalty` is applied |

---

## Design Notes

- Encounter progression is intentionally simple: a continuous series of fights with no branching.
- Party-size-matched enemy counts keep encounters tactically fair and scale naturally with party composition.
- Between-encounter healing removes the need to manage long-term attrition; difficulty comes from the increasing tier and individual encounter pressure.
- XP-based levelling creates meaningful score variability: a party that crits and kills quickly gains levels faster, accesses higher-tier enemies sooner, and earns more boss score.
- Boss encounters every 100 encounters (Normal) provide rhythm and reward checkpoints.
- All randomness is seeded per game; the same seed always produces the same run.
- Game modes may modify the encounter loop by changing `SpawnConfig` values (e.g., more frequent bosses, faster tier progression).
- Future extension: **elite encounters** (mid-boss mini-bosses) inserted between regular boss encounters.
- Future extension: **optional encounters** with higher difficulty but score multipliers, selectable by the player.
- **Story Mode** offers an alternative encounter structure where encounters are triggered during travel between map locations. See [story-mode.md](story-mode.md) for full details.
