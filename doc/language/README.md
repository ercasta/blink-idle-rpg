# Blink Languages Documentation

This folder contains the specification for the Blink language family.

## Overview

Blink uses two domain-specific languages:

| Language | Full Name | Purpose | Users |
|----------|-----------|---------|-------|
| **BRL** | Blink Rule Language | Define game rules, components, events | Game developers |
| **BCL** | Blink Choice Language | Define player choices and strategies | Players |

## Relationship Between Languages

BCL is a **subset** of BRL. The key differences:

```
┌─────────────────────────────────────────────┐
│               BRL (Full Language)           │
│  ┌───────────────────────────────────────┐  │
│  │  • Component definitions              │  │
│  │  • Event scheduling                   │  │
│  │  • Entity creation                    │  │
│  │  • Component modification             │  │
│  │  • Recurring events                   │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │      BCL (Subset)               │  │  │
│  │  │  • Read components/entities     │  │  │
│  │  │  • Return values (choices)      │  │  │
│  │  │  • Functions & modules          │  │  │
│  │  │  • Expressions & conditions     │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Documents in This Folder

| Document | Description | Status |
|----------|-------------|--------|
| [brl-specification.md](brl-specification.md) | Complete BRL language spec | Draft |
| [bcl-specification.md](bcl-specification.md) | BCL language spec (subset) | Draft |
| [examples/](examples/) | Code examples | Planned |

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
