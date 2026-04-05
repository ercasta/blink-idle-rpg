# Game Modes — Game Design

This document describes the game mode system: how modes are defined, how they alter scoring rules, and how they may change encounter parameters.

## Design Goals

- **Game modes are the primary configurability lever** for the player at run start.
- Each mode is a named bundle of `ScoringRules` and `SpawnConfig` values — no new BRL rules are needed per mode.
- Modes are selected once at the start of a run; they cannot change mid-run.
- The system is open for extension: new modes can be added without touching the simulation engine.

---

## Mode Selection

At game start, the player (or the simulation harness) selects exactly one game mode. The selected mode's `ScoringRules` and `SpawnConfig` override the defaults defined in `game-config.brl`.

Note: boss spawns and tier progression are driven by the global kill count (`GameState.enemiesDefeated`) — see the Combat Kill System for exact behaviour.

---

## Predefined Game Modes

### 1. Casual (`casual`)
**Intent**: New players, low pressure, relaxed scoring.

| Parameter | Value | Default (Normal) |
|-----------|-------|-----------------|
| `pointsPerKill` | 5 | 10 |
| `pointsPerWave` | 25 | 50 |
| `pointsPerBoss` | 200 | 500 |
| `pointsLostPerDeath` | 0 | 100 |
| `pointsLostPerRetreat` | 0 | 50 |
| `pointsLostPerPenaltySecond` | 0 | 2 |
| `timeBonusPoints` | 0 | 1000 |
| `initialEnemyCount` | 3 | 5 |
| `healthScaleRate` | 100 | 200 |
| `damageScaleRate` | 150 | 300 |
| `retreatTimePenalty` | 5.0 | 10.0 |
| `deathTimePenaltyMultiplier` | 2.0 | 5.0 |

---

### 2. Normal (`normal`)
**Intent**: Default balanced experience.

| Parameter | Value |
|-----------|-------|
| `pointsPerKill` | 10 |
| `pointsPerWave` | 50 |
| `pointsPerBoss` | 500 |
| `pointsLostPerDeath` | 100 |
| `pointsLostPerRetreat` | 50 |
| `pointsLostPerPenaltySecond` | 2 |
| `timeBonusPoints` | 1000 |
| `timeBonusInterval` | 10.0 |
| `initialEnemyCount` | 5 |
| `healthScaleRate` | 200 |
| `damageScaleRate` | 300 |
| `retreatTimePenalty` | 10.0 |
| `deathTimePenaltyMultiplier` | 5.0 |
| `fleeCooldown` | 5.0 |

---

### 3. Hardcore (`hardcore`)
**Intent**: High-stakes, punishing deaths; rewards no-death runs.

| Parameter | Value | Change vs Normal |
|-----------|-------|-----------------|
| `pointsPerKill` | 15 | +50% |
| `pointsPerWave` | 75 | +50% |
| `pointsPerBoss` | 1000 | +100% |
| `pointsLostPerDeath` | 500 | +400% |
| `pointsLostPerRetreat` | 200 | +300% |
| `pointsLostPerPenaltySecond` | 5 | +150% |
| `timeBonusPoints` | 2000 | +100% |
| `timeBonusInterval` | 5.0 | Decays faster |
| `healthScaleRate` | 250 | Harder scaling |
| `damageScaleRate` | 400 | Harder scaling |
| `retreatTimePenalty` | 20.0 | +100% |
| `deathTimePenaltyMultiplier` | 10.0 | +100% |
| `fleeCooldown` | 15.0 | Longer cooldown |

---

### 4. Speed Run (`speedrun`)
**Intent**: Rewards clearing encounters as fast as possible; deaths are less penalised.

| Parameter | Value | Change vs Normal |
|-----------|-------|-----------------|
| `pointsPerKill` | 5 | -50% |
| `pointsPerWave` | 100 | +100% (fast clears rewarded) |
| `pointsPerBoss` | 750 | +50% |
| `pointsLostPerDeath` | 25 | -75% |
| `pointsLostPerRetreat` | 100 | +100% |
| `pointsLostPerPenaltySecond` | 10 | +400% (time is expensive) |
| `timeBonusPoints` | 5000 | +400% |
| `timeBonusInterval` | 2.0 | Very fast decay |
| `initialEnemyCount` | 5 | Same |
| `healthScaleRate` | 200 | Same |
| `damageScaleRate` | 300 | Same |

---

## Run Structure — Fixed Steps and Encounters

The game uses a deliberate, fixed-run structure rather than an open-ended "endless" run. Each run is composed of a configurable number of *steps* (N), and each step contains a configurable number of *encounters* (M). The run completes when the player has progressed through all N steps (i.e., after N × M encounters), at which point the `Victory` condition is evaluated and a final score is produced.

Key parameters (set per mode or scenario):

- `stepsPerRun` (integer): Number of high-level steps in the run (N).
- `encountersPerStep` (integer): Number of encounters inside each step (M).
- `totalEncounters` (derived): `stepsPerRun * encountersPerStep`.
- `hasVictoryCondition` (boolean): `true` for fixed-step runs; the run has an explicit end.

Behavioural notes:

- After every `encountersPerStep` encounters the game advances the `currentStep` counter and may apply step-specific changes (difficulty bump, loot tier, UI milestone). 
- When the `currentStep` exceeds `stepsPerRun`, the run ends and the `Victory` condition is evaluated. Final scoring aggregates across all encounters and steps.
- Modes that previously used an open-ended playstyle should be implemented as high-`stepsPerRun` scenarios or replaced by a dedicated scenario that mimics long runs while preserving a final victory condition.

This structure focuses player goals on achieving the highest possible score within a bounded run and simplifies UI progress indicators and replay analysis.
---

## Adding a New Game Mode

To add a new mode:
1. Create a new BRL file (e.g., `game/brl/scenario-mymode.brl`) that initialises a `GameMode` entity and overrides `ScoringRules`, `SpawnConfig`, and `FleeConfig` entities.
2. Register the mode ID in the `GameModeRegistry`.
3. No BRL rule changes are required unless the mode needs new events or behaviours.

---

## Components

### `GameMode`
Attached to: a single global game-mode entity (set at run start).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique mode identifier (e.g., `"normal"`, `"hardcore"`) |
| `name` | string | Display name |
| `description` | string | Short description shown in mode selection UI |
| `difficulty` | string | Label: `"Easy"`, `"Normal"`, `"Hard"`, `"Expert"` |
| `hasVictoryCondition` | boolean | `false` for Endless mode |

### `ScoringRules`
(Defined in [scoring.md](scoring.md).) All fields set by the chosen game mode.

### `ScenarioInfo`
Attached to: the scenario info entity (used by the UI).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Mode identifier |
| `name` | string | UI display name |
| `description` | string | UI description |
| `difficulty` | string | Difficulty label |
| `respawnTime` | string | Human-readable retreat penalty description |
| `deathPenalty` | string | Human-readable death penalty description |
| `enemiesPerWave` | string | Human-readable enemy count |
| `bossFrequency` | string | Human-readable boss spawn frequency |

### `GameModeRegistry`
Attached to: a single global registry entity.

| Field | Type | Description |
|-------|------|-------------|
| `availableModes` | list\<string\> | List of all registered mode IDs |
| `selectedMode` | string | The mode chosen for the current run |

---

## Player Run Workflow

This is the canonical player flow when starting a run.

1. **Select Game Mode**: Choose one of the predefined modes or pick "Custom" to tweak `ScoringRules`, `SpawnConfig`, and related parameters. The UI should show a quick summary of how scoring and penalties will change for the run.
	- Custom modes may be saved locally as a named mode for reuse.
	- Provide a preview of the expected difficulty and a sample score breakdown.

2. **Export / Import Game Mode (QR Figurine)**: Allow players to export a game mode as a compact JSON bundle encoded into a QR code that can be printed or saved as a figurine.
	- The QR bundle should include a `modeId` (optional for anonymous custom modes), a `version` field, and the full `ScoringRules` and `SpawnConfig` payload.
	- Importing (scanning) a QR restores the mode into the local registry (optionally prompting to save it under a name) and marks it selected for the next run.
	- Keep the QR format stable and versioned so future engine updates can migrate old exports.

3. **Select Heroes**: After the mode is selected, the player picks heroes/party composition. The UI should validate any mode-specific constraints (e.g., banned classes or forced party size).

4. **Run the Game**: Start the run with the chosen mode and heroes. The selected mode's `ScoringRules` and `SpawnConfig` are applied at initialisation and remain fixed for that run.

Notes:
- Modes are applied at run initialisation only — no mid-run mode switching.
- Consider adding a "Test Run" or "Simulate" option in the mode editor that runs a short simulated encounter to preview scoring behaviour.
- When exporting to QR, keep the bundle minimal (only fields required to reproduce the mode) and sign or checksum the payload if you want to detect tampering.

## Events (Game Mode-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `GameModeSelected` | `modeId` | Player has selected a game mode; apply its configuration |
| `VictoryConditionMet` | `modeId`, `finalScore` | Victory detected (skipped in Endless mode) |
