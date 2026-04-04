# Blink Idle RPG - Documentation

This folder contains the technical documentation for Blink Idle RPG development.

## Documentation Structure

```
doc/
├── README.md                    # This file
├── summary.md                   # Project overview
├── DEVELOPMENT_TRACKS.md        # Parallel development guide
├── ir-specification.md          # IR format specification (central contract)
├── language/                    # BRL & BDL Language Specification
│   ├── README.md                # Language overview
│   ├── brl-specification.md     # Blink Rule Language spec
│   ├── bdl-specification.md     # Blink Data Language spec
│   └── examples/                # Language examples
├── engine/                      # Engine & Toolchain
│   ├── README.md                # Engine overview
│   ├── architecture.md          # Core architecture
│   ├── browser-engine.md        # Browser implementation (TypeScript)
│   └── api/                     # API documentation
├── architecture/                # Architecture decisions
│   └── ir-decision.md           # IR vs WASM analysis
└── hie/                         # Hielements documentation
    ├── README.md                # Hielements overview
    ├── language-reference.md    # Hielements syntax
    ├── blink-architecture.md    # Blink architecture spec
    └── writing-specs.md         # How to write .hie files
```

## Source Code

```
src/
└── packages/blink-compiler-ts/  # Blink Compiler (TypeScript)
    ├── package.json            # Project configuration
    ├── README.md               # Compiler documentation
    └── src/                    # Source code
        ├── lexer/              # Tokenizer
        ├── parser/             # AST builder
        ├── analyzer/           # Semantic analysis
        └── ir/                 # IR generator

game/
├── brl/                        # BRL source examples
│   ├── simple-clicker.brl
│   └── simple-combat.brl
└── ir/                         # Pre-compiled IR examples for engine testing
    ├── simple-clicker.ir.json
    └── simple-combat.ir.json
```

## Development Tracks

The project is organized to allow parallel development with **IR as the central contract**:

| Track | Folder | Description | Dependencies |
|-------|--------|-------------|--------------|
| **Language Design** | `doc/language/` | BRL & BDL specification | None |
| **Compiler** | `packages/blink-compiler-ts/` | Parser, validator, IR gen | Language spec |
| **Rust Engine** | `src/engines/rust/` | Native Rust simulation | IR spec only |
| **JS Engine** | `packages/blink-engine/` | TypeScript implementation | IR spec only |
| **Batch Engine** | `src/engines/batch/` | Headless testing engine | IR spec only |
| **Dev Tools** | `tools/` | LSP, VSCode extension | Language spec |

All engines are **independent** - they depend only on the IR specification, not on each other.

See [DEVELOPMENT_TRACKS.md](DEVELOPMENT_TRACKS.md) for detailed coordination guidelines.  
See [architecture/ir-decision.md](architecture/ir-decision.md) for the architectural rationale.

## Game Design Documentation

The `game-design/` folder contains the full game design specification:

```
doc/game-design/
├── README.md            # Overview and index
├── characters.md        # Hero classes, stats, progression, components
├── enemies.md           # Enemy tiers, boss mechanics, components
├── combat.md            # Combat loop, damage formulas, targeting
├── skills.md            # Hero and enemy skills, components
├── status-effects.md    # Frozen, poisoned, stunned, etc. and their components
├── encounters.md        # Encounter structure, wave progression, scaling
├── scoring.md           # Score formula, KPIs, scoring components
├── game-modes.md        # Game modes and scoring rule configurations
└── simulation.md        # Playtesting harness: parallel runs, balance tooling
```

See [game-design/README.md](game-design/README.md) for the full index.

## Getting Started

- **Language Designers**: Start with [language/README.md](language/README.md)
- **Compiler Developers**: Start with [../packages/blink-compiler-ts/README.md](../packages/blink-compiler-ts/README.md)
- **Engine Developers**: Start with [ir-specification.md](ir-specification.md) and use examples in [../game/ir/](../game/ir/)
- **Game Designers**: Start with [game-design/README.md](game-design/README.md)
- **All Developers**: Read [hie/README.md](hie/README.md) to understand architecture enforcement
