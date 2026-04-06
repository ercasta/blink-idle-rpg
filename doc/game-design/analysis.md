# Classic RPG Game Analysis

This document provides an in-depth analysis of how the classic RPG game is supposed to run for the first 10 enemy waves, including rules, choices, and events.

## Overview

The Classic RPG is an idle game where heroes automatically battle waves of enemies. The game progresses through tiers of increasing difficulty, with each tier containing multiple waves of enemies. The ultimate goal is to defeat the final boss, Lord Vexar.

## Game Configuration

From `game/brl/game-config.brl`:

| Parameter | Value | Description |
|-----------|-------|-------------|
| initialEnemyCount | 5 | Enemies per wave |
| wavesPerTier | 3 | Waves before tier advancement |
| maxTier | 3 | Maximum tier (boss tier) |
| retreatTimePenalty | 60.0 | Time penalty for retreating |

... (full analysis moved here)
