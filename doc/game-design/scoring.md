# Scoring — Game Design

This document covers the scoring system: how a run produces a final score, what KPIs are tracked, and the components that store scoring state.

## Design Goals

- **Score is the primary player-facing KPI.** Everything the player does can be evaluated through its impact on the score.
- Scoring rewards efficiency: fast clears, fewer deaths, and deeper progression all improve the score.
- **Penalties** (death, retreat) are subtracted from the score, making conservative play a deliberate trade-off.
 - **Penalties** (death, retreat, party wipe) are subtracted from the score, making conservative play a deliberate trade-off. Runs complete after a fixed number of encounters; deaths and wipeouts only apply penalties and do not terminate the run.
- All scoring parameters are configurable per game mode (see [game-modes.md](game-modes.md)).

---

## Score Formula

```
score = (
    killScore
  + waveScore
  + bossScore
  + speedBonus
  - deathPenalty
  - retreatPenalty
  - timePenalty
)
```

### Component Formulas

| Component | Formula | Notes |
|-----------|---------|-------|
| `killScore` | `enemiesDefeated * pointsPerKill` | Counts normal enemies only |
| `waveScore` | `wavesCompleted * pointsPerWave` | Waves where all enemies died (not fled) |
| `bossScore` | `bossesDefeated * pointsPerBoss` | Each defeated boss |
| `speedBonus` | `max(0, timeBonusPoints - floor(totalTime / timeBonusInterval))` | Rewards fast runs |
| `deathPenalty` | `playerDeaths * pointsLostPerDeath` | Applied per hero death |
| `retreatPenalty` | `retreatCount * pointsLostPerRetreat` | Applied per retreat |
| `partyWipePenalty` | `partyWipeouts * pointsLostPerPartyWipe` | Applied per full-party wipeout |
| `timePenalty` | `floor(RunStats.deathPenalty + RunStats.retreatPenalty) * pointsLostPerPenaltySecond` | Time-based penalty converted to score |

All multipliers and thresholds are stored in the `ScoringRules` component (see below).

---

## KPIs Tracked

In addition to the final score, the following KPIs are tracked in `RunStats` and displayed post-run:

| KPI | Source | Description |
|-----|--------|-------------|
| Final Score | `Score.total` | The headline number |
| Deepest Wave | `GameState.currentWave` | Maximum wave reached |
| Deepest Tier | `GameState.currentTier` | Maximum tier reached |
| Total Kills | `GameState.enemiesDefeated` | Total enemies defeated |
| Bosses Killed | `Score.bossesDefeated` | Number of bosses cleared |
| Hero Deaths | `GameState.playerDeaths` | Total hero deaths |
| Retreat Count | `RunStats.retreatCount` | Number of retreats |
| Total Time | `RunStats.totalTime` | Simulation + penalty time |
| Survival Rate | computed | Living heroes / party size at run end |
| Encounters Played | `GameState.encountersPlayed` | Number of encounters completed in the run |
| Snapshots Recorded | `RunStats.snapshots` | Number of data snapshots saved during the run |

---

## Score Components

### `Score`
Attached to: the run-stats entity. Updated throughout the run.

| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Current total score |
| `killScore` | integer | Running kill-based score |
| `waveScore` | integer | Running wave-clear score |
| `bossScore` | integer | Running boss-kill score |
| `speedBonus` | integer | Bonus awarded at run end for fast completion |
| `deathPenaltyTotal` | integer | Total score lost to hero deaths |
| `partyWipePenaltyTotal` | integer | Total score lost to party wipeouts |
| `retreatPenaltyTotal` | integer | Total score lost to retreats |
| `timePenaltyTotal` | integer | Total score lost to time penalties |
| `bossesDefeated` | integer | Counter for boss kills |
| `wavesCompleted` | integer | Counter for fully-cleared waves |

### `ScoringRules`
Attached to: a global scoring-rules entity. Values are set by the selected game mode.

| Field | Type | Description |
|-------|------|-------------|
| `pointsPerKill` | integer | Score per normal enemy kill |
| `pointsPerWave` | integer | Score per fully-cleared wave |
| `pointsPerBoss` | integer | Score per boss kill |
| `pointsLostPerDeath` | integer | Score deducted per hero death |
| `pointsLostPerRetreat` | integer | Score deducted per retreat |
| `pointsLostPerPartyWipe` | integer | Score deducted per full-party wipeout |
| `pointsLostPerPenaltySecond` | integer | Score deducted per penalty-second in `RunStats` |
| `timeBonusPoints` | integer | Maximum speed bonus available |
| `timeBonusInterval` | float | Seconds per point of bonus decay |
| `encountersPerRun` | integer | Number of encounters in a run (e.g., 3000) |
| `snapshotInterval` | integer | Encounters between snapshots (e.g., 100) |

---

## Events (Scoring-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `UpdateScore` | `delta`, `reason` | Adds or subtracts from `Score.total` and the relevant sub-field |
| `RunEnded` | `reason`, `finalScore` | Fired on `RunComplete` (when `GameState.encountersPlayed >= GameState.totalEncounters`); computes final score and triggers final snapshot |
| `ScoreSubmitted` | `runId`, `finalScore`, `kpis` | Emitted for leaderboard / simulation harness consumption |

---

## Leaderboard

The leaderboard ranks completed runs by `Score.total`. Each entry records:
- `runId` — unique identifier for the run.
- `gameModeId` — which game mode was active.
- `finalScore` — headline score.
- All KPIs listed above.
- `partyComposition` — list of hero classes used.

---

## Design Notes

- Score is **additive during the run** (not computed only at the end), allowing live display.
- The speed bonus decays as the run takes longer, so slow-but-safe strategies naturally score lower.
- Game modes tune scoring rules to create different player experiences: a "hardcore" mode might double `pointsLostPerDeath`, while a "speed run" mode might triple `timeBonusPoints`.
- All scoring formulas use integer arithmetic to ensure consistent results across simulation runs.
