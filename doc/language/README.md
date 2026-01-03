# Blink Languages Documentation

This folder contains the specification for the Blink language family.

## Overview

Blink uses three domain-specific languages:

| Language | Full Name | Purpose | Users |
|----------|-----------|---------|-------|
| **BRL** | Blink Rule Language | Define game rules, components, events | Game developers |
| **BCL** | Blink Choice Language | Define player choices and strategies | Players |
| **BDL** | Blink Data Language | Define game data (entities) | Content creators |

## Relationship Between Languages

Both BCL and BDL are **subsets** of BRL with different restrictions:

```
┌─────────────────────────────────────────────────────────┐
│                   BRL (Full Language)                   │
│  ┌────────────────────┐  ┌────────────────────────────┐ │
│  │  Game Developer    │  │  Content Creation         │ │
│  │  Features:         │  │  Features:                │ │
│  │  • Components      │  │  ┌──────────────────────┐ │ │
│  │  • Rules           │  │  │ BDL (Data Subset)    │ │ │
│  │  • Trackers        │  │  │ • Entity creation    │ │ │
│  │  • Events          │  │  │ • Component values   │ │ │
│  │  ┌──────────────┐  │  │  │ • Literal values     │ │ │
│  │  │BCL (Player   │  │  │  └──────────────────────┘ │ │
│  │  │Subset)       │  │  │                          │ │
│  │  │• Read data   │  │  └────────────────────────────┘ │
│  │  │• Choice fns  │  │                                 │
│  │  │• Pure fns    │  │                                 │
│  │  └──────────────┘  │                                 │
│  └────────────────────┘                                 │
└─────────────────────────────────────────────────────────┘
```

## Documents in This Folder

### Getting Started

| Document | Description | Audience |
|----------|-------------|----------|
| [brl-user-guide.md](brl-user-guide.md) | **BRL User Guide** - Tutorials, patterns, and examples | Game developers |
| [bcl-user-guide.md](bcl-user-guide.md) | **BCL User Guide** - Strategy creation for players | Players |

### Reference Documentation

| Document | Description | Status |
|----------|-------------|--------|
| [brl-specification.md](brl-specification.md) | Complete BRL language spec | Draft |
| [bcl-specification.md](bcl-specification.md) | BCL language spec (subset) | Draft |
| [bdl-specification.md](bdl-specification.md) | BDL language spec (subset) | Draft |

### Examples

| Document | Description | Status |
|----------|-------------|--------|
| [game/](game/) | Code examples | Planned |

## Quick Start

### For Game Developers (BRL)

Creating game rules? Start here:

1. Read the [BRL User Guide](brl-user-guide.md)
2. Follow the tutorials in order
3. Check out [BRL examples](../../game/brl/)
4. Reference the [BRL Specification](brl-specification.md) when needed

### For Players (BCL)

Customizing your party? Start here:

1. Read the [BCL User Guide](bcl-user-guide.md)
2. Copy and modify [BCL examples](../../game/bcl/)
3. Test your strategies in the game
4. Reference the [BCL Specification](bcl-specification.md) for syntax details

### For Content Creators (BDL)

Defining game data? Start here:

1. Read the [BDL Specification](bdl-specification.md)
2. Check out [BDL examples](../../game/bdl/)
3. Define heroes, enemies, and configuration
4. BDL is simple - only entity creation with literal values!

## Core Concepts

### Entity-Component System (ECS)
Both languages operate on an ECS architecture:
- **Entities**: Unique identifiers (ids) representing game objects
- **Components**: Data structures attached to entities
- **Systems**: Rules that process entities with specific components

### Type System
Base types supported:
- `string` - Text values
- `boolean` - True/false values  
- `integer` - Whole numbers
- `float` - Floating-point numbers
- `decimal` - Fixed-precision decimal numbers
- `id` - Reference to another entity

### Modularization
Both languages support:
- Functions for code reuse
- Modules for organization
- Curly bracket syntax for code blocks

## Development Guidelines

When contributing to language specification:

1. **Consistency**: Ensure BCL remains a true subset of BRL
2. **Simplicity**: BCL should be accessible to players
3. **Expressiveness**: BRL must handle all game mechanics
4. **Performance**: Consider compilation/interpretation implications

## Related Documentation

- [Engine Architecture](../engine/architecture.md) - How the engine executes BRL/BCL
- [Project Summary](../summary.md) - High-level project overview
