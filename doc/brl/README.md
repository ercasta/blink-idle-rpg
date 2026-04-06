# Blink Languages Documentation

This folder contains the specification for the Blink language family.

## Overview

Blink uses two domain-specific languages:

| Language | Full Name | Purpose | Users |
|----------|-----------|---------|-------|
| **BRL** | Blink Rule Language | Define game rules, components, events, and game data (entities) | Game developers and content creators |
| **BCL** | Blink Choice Language | Customize AI choice functions | Players |

## BRL: One Language for Everything

BRL handles both game logic and game data in a single, unified language:

- **Game rules**: Component definitions, rules triggered by events, functions
- **Game data**: Entity creation with component initialization and bound choice functions
- **Choice functions**: Decision-making logic that can be bound to individual entities

## Documents in This Folder

### Reference Documentation

| Document | Description | Status |
|----------|-------------|--------|
| [brl-specification.md](brl-specification.md) | Complete BRL language spec | Draft |
| [brl-user-guide.md](brl-user-guide.md) | BRL User Guide - Tutorials and examples | Draft |

### Examples

| Document | Description | Status |
|----------|-------------|--------|
| [examples/](examples/) | Code examples | Planned |

## Quick Start

### For Game Developers

Creating game rules and data? Start here:

1. Read the [BRL User Guide](brl-user-guide.md)
2. Check out [BRL examples](../../game/brl/)
3. Reference the [BRL Specification](brl-specification.md) when needed
