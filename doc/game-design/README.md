# Blink Idle RPG — Game Design Documentation

This folder contains the game design documentation for Blink Idle RPG.

Each file covers a focused area of the game design and defines the **logical components** that will eventually be implemented in BRL. Components listed here are design-level concepts — not yet code.

## Design Philosophy

Blink Idle RPG is an **idle simulation RPG** in which:

- A party of heroes fights through an endless series of encounters of increasing difficulty.
- All combat is resolved automatically ("in a blink") — the player's role is configuration and strategy, not real-time input.
- The primary player-facing metric is a **score**, allowing fast comparison between runs, compositions, and strategies.
- **Game modes** change the scoring rules (and optionally game rules), enabling different play experiences without redesigning the simulation.
- The system is designed so that many simulation runs can be executed in parallel for playtesting and balance validation.

## Documentation Index

| File | Description |
|------|-------------|
| [characters.md](characters.md) | Hero classes, base stats, progression, and components |
| [enemies.md](enemies.md) | Enemy types, tiers, boss mechanics, and components |
| [combat.md](combat.md) | Combat loop, damage formulas, targeting, and components |
| [skills.md](skills.md) | Hero and enemy skills (active, passive, triggered) and components |
| [status-effects.md](status-effects.md) | Status effects (frozen, poisoned, etc.) and their components |
| [encounters.md](encounters.md) | Encounter selection, wave progression, difficulty scaling |
| [scoring.md](scoring.md) | Score system, KPIs, and scoring components |
| [game-modes.md](game-modes.md) | Game modes and their scoring rule configurations |
| [simulation.md](simulation.md) | Playtesting harness: parallel runs, KPIs, balance tooling |

## Component Naming Convention

Components are named in `PascalCase`. Each component definition lists:
- **Fields** with their type and meaning.
- **Purpose** — which entity/entities carry this component.
- **Related events** — events that read or modify this component.

## Relationship to BRL

This document does **not** define BRL rules or BRL data yet. It defines the logical model that BRL will eventually implement. When implementation begins:

- Components defined here → `component` declarations in BRL.
- Entity definitions here → entity initializations in BRL.
- Events listed here → event triggers in BRL rules.
