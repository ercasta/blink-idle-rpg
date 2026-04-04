# Simulation & Playtesting — Game Design

This document describes the playtesting harness: how to run many simulation runs (in parallel), how to interpret results, and how to use the harness to validate balance changes.

## Design Goals

- **Fast iteration**: a designer should be able to test a balance change and see aggregate KPIs in seconds.
- **Parallel runs**: many independent simulations execute concurrently, each with a different random seed.
- **Reproducibility**: given the same seed and configuration, a run always produces the same result.
- **Scenario comparison**: the harness can run multiple game modes or parameter sets back-to-back and compare outcomes.
- **No UI required**: the harness is headless; results are printed as structured JSON or a summary table.

---

## Simulation Architecture

```
SimulationHarness
  ├── Load IR (compiled BRL + BDL)
  ├── For each (gameModeId, seed) pair:
  │     └── BlinkGame.create()
  │           ├── loadRulesFromObject(ir)
  │           ├── overrideEntities(gameModeConfig)
  │           ├── scheduleEvent('GameStart', 0)
  │           └── runToCompletion()  → SimulationResult
  └── Aggregate results → print KPI summary
```

Each `BlinkGame` instance is independent; runs can be executed in parallel using worker threads (Node.js workers or similar). Each instance is initialised with its own deterministic RNG seeded from `SimulationConfig.seed`, guaranteeing that the same seed always produces the same sequence of random outcomes (enemy selection, crit rolls, status effect procs).

---

## Running the Harness

```bash
# Run 100 simulations of the Normal mode, 8 in parallel
node tools/simulate.js \
  --mode normal \
  --runs 100 \
  --parallel 8 \
  --seed-start 1 \
  --output results/normal-100.json

# Compare Normal vs Hardcore across 50 runs
node tools/simulate.js \
  --mode normal,hardcore \
  --runs 50 \
  --parallel 8 \
  --output results/comparison.json
```

(These are illustrative CLI shapes; implementation targets are defined in the `tools/` directory.)

---

## Simulation Result Format

Each completed run produces a `SimulationResult` record:

```json
{
  "runId": 42,
  "gameModeId": "normal",
  "seed": 42,
  "finalScore": 12430,
  "deepestWave": 15,
  "deepestTier": 5,
  "totalKills": 87,
  "bossesDefeated": 2,
  "heroDeaths": 3,
  "retreatCount": 1,
  "totalTime": 142.5,
  "simulationTime": 130.0,
  "penaltyTime": 12.5,
  "survivingHeroes": 4,
  "partySize": 6,
  "partyComposition": ["Warrior", "Mage", "Cleric", "Ranger", "Paladin", "Rogue"],
  "outcomeReason": "GameOver"
}
```

---

## Aggregate KPIs

After N runs the harness computes:

| KPI | Meaning |
|-----|---------|
| `meanScore` | Average final score |
| `medianScore` | Median final score |
| `p10Score` / `p90Score` | 10th / 90th percentile scores |
| `winRate` | % of runs that ended in `Victory` (vs `GameOver`) |
| `meanDeepestWave` | Average deepest wave reached |
| `meanHeroDeaths` | Average hero deaths per run |
| `meanTotalTime` | Average total time (including penalties) |
| `stdevScore` | Score variance — high variance may indicate balance instability |

---

## Using the Harness for Balance Testing

### Workflow

1. **Baseline**: run 100 simulations of the target mode. Record aggregate KPIs.
2. **Change**: adjust a parameter (e.g., `healthScaleRate`, `pointsLostPerDeath`).
3. **Retest**: run 100 simulations with the same seeds.
4. **Compare**: check whether mean score, win rate, and deepest wave changed in the intended direction.
5. **Iterate** until the KPIs match the target experience.

### Balance Targets (Normal Mode)

| KPI | Target |
|-----|--------|
| `winRate` | 40–60% |
| `meanDeepestWave` | Wave 10–15 |
| `meanHeroDeaths` | 2–5 |
| `meanScore` | 5000–15000 |
| `stdevScore` | < 30% of mean |

These targets are starting points and should be revised after initial playtesting.

---

## Components

### `SimulationConfig`
Used by the harness (not stored in-game). Passed to each `BlinkGame` instance.

| Field | Type | Description |
|-------|------|-------------|
| `runId` | integer | Unique run identifier |
| `gameModeId` | string | Which game mode to use |
| `seed` | integer | Random seed for this run |
| `maxSimulationTime` | float | Hard cap on simulation seconds (safety timeout) |
| `partyComposition` | list\<string\> | Hero class list for this run |

### `SimulationResult`
Produced by the harness after a run completes.

| Field | Type | Description |
|-------|------|-------------|
| `runId` | integer | Matches `SimulationConfig.runId` |
| `gameModeId` | string | Mode used |
| `seed` | integer | Seed used |
| `finalScore` | integer | Final computed score |
| `deepestWave` | integer | Maximum wave reached |
| `deepestTier` | integer | Maximum tier reached |
| `totalKills` | integer | Total enemy kills |
| `bossesDefeated` | integer | Bosses killed |
| `heroDeaths` | integer | Total hero deaths |
| `retreatCount` | integer | Number of retreats |
| `totalTime` | float | `simulationTime + penaltyTime` |
| `simulationTime` | float | Raw in-game time |
| `penaltyTime` | float | Time added via penalties |
| `survivingHeroes` | integer | Heroes alive at run end |
| `partySize` | integer | Initial party size |
| `partyComposition` | list\<string\> | Hero classes used |
| `outcomeReason` | string | `"Victory"`, `"GameOver"`, or `"Timeout"` |

---

## Events (Simulation-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `RunEnded` | `reason`, `finalScore` | Fired on `Victory` or `GameOver`; triggers result collection |
| `ScoreSubmitted` | `runId`, `finalScore`, `kpis` | Emitted for harness consumption |
| `SimulationTimeout` | `runId`, `timeElapsed` | Safety event if `maxSimulationTime` is exceeded |

---

## Playtesting Tips

- **Fix the seed** when investigating a specific outcome — run the same seed with different parameters to isolate the effect of a change.
- **Vary party composition** systematically: run all single-class parties and all class pairs to identify outliers.
- **Use the Endless mode** to probe the scaling ceiling — if a party never dies, `healthScaleRate` or `damageScaleRate` may need adjustment.
- **Check `stdevScore`**: high variance often means a single random event (e.g., early boss spawn) dominates the outcome, which usually indicates an encounter balance issue rather than a scoring one.
- **Target KPIs before tuning numbers**: decide what experience you want (e.g., "50% win rate, average wave 12") and adjust until the harness matches, rather than tuning by feel.
