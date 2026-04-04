# Blink Languages Documentation

This folder contains the specification for the Blink language family.

## Overview

Blink uses two domain-specific languages:

| Language | Full Name | Purpose | Users |
|----------|-----------|---------|-------|
| **BRL** | Blink Rule Language | Define game rules, components, events | Game developers |
| **BDL** | Blink Data Language | Define game data (entities) | Content creators |

## Relationship Between Languages

BDL is a **subset** of BRL focused purely on data definition:

```
┌─────────────────────────────────────────────────────────┐
│                   BRL (Full Language)                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Game Developer Features:                         │ │
│  │  • Component definitions                          │ │
│  │  • Rules (triggered by events)                    │ │
│  │  • Functions and modules                          │ │
│  │  • Entity creation and mutation                   │ │
│  │  • Choice functions (bound to entities in BDL)   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  BDL (Data Subset)                                │ │
│  │  • Entity creation with literal values            │ │
│  │  • Component value initialization                 │ │
│  │  • Bound choice functions (inline BRL fragments)  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Documents in This Folder

### Reference Documentation

| Document | Description | Status |
|----------|-------------|--------|
| [brl-specification.md](brl-specification.md) | Complete BRL language spec | Draft |
| [brl-user-guide.md](brl-user-guide.md) | BRL User Guide - Tutorials and examples | Draft |
| [bdl-specification.md](bdl-specification.md) | BDL language spec (data subset) | Draft |

### Examples

| Document | Description | Status |
|----------|-------------|--------|
| [examples/](examples/) | Code examples | Planned |

## Quick Start

### For Game Developers (BRL)

Creating game rules? Start here:

1. Read the [BRL User Guide](brl-user-guide.md)
2. Check out [BRL examples](../../game/brl/)
3. Reference the [BRL Specification](brl-specification.md) when needed

### For Content Creators (BDL)

Defining game data? Start here:

1. Read the [BDL Specification](bdl-specification.md)
2. Check out [BDL examples](../../game/bdl/)
3. Define heroes, enemies, and configuration
4. BDL is simple — only entity creation with literal values and optional bound functions

## Core Concepts

### Entity-Component System (ECS)
Both languages operate on an ECS architecture:
- **Entities**: Unique identifiers (ids) representing game objects
- **Components**: Data structures attached to entities
- **Rules**: BRL rules triggered by events that process entities

### Type System
Base types supported:
- `string` - Text values
- `boolean` - True/false values
- `integer` - Whole numbers
- `float` - Floating-point numbers
- `decimal` - Fixed-precision decimal numbers
- `id` - Reference to another entity

## Related Documentation

- [Engine Architecture](../engine/architecture.md) - How the engine executes BRL
- [Project Summary](../summary.md) - High-level project overview

1. **Consistency**: Ensure BCL remains a true subset of BRL
2. **Simplicity**: BCL should be accessible to players
3. **Expressiveness**: BRL must handle all game mechanics
4. **Performance**: Consider compilation/interpretation implications

## Related Documentation

- [Engine Architecture](../engine/architecture.md) - How the engine executes BRL/BCL
- [Project Summary](../summary.md) - High-level project overview
