# Blink Idle RPG - Documentation

This folder contains the technical documentation for Blink Idle RPG development.

## Documentation Structure

```
doc/
├── README.md                    # This file
├── summary.md                   # Project overview
├── DEVELOPMENT_TRACKS.md        # Parallel development guide
├── ir-specification.md          # IR format specification (central contract)
├── language/                    # BRL & BCL Language Specification
│   ├── README.md                # Language overview
│   ├── brl-specification.md     # Blink Rule Language spec
│   ├── bcl-specification.md     # Blink Choice Language spec
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
└── compiler/                    # Blink Compiler (Rust)
    ├── Cargo.toml              # Project configuration
    ├── README.md               # Compiler documentation
    └── src/                    # Source code
        ├── lexer/              # Tokenizer
        ├── parser/             # AST builder
        ├── analyzer/           # Semantic analysis
        └── ir/                 # IR generator

examples/
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
| **Language Design** | `doc/language/` | BRL & BCL specification | None |
| **Compiler** | `src/compiler/` | Parser, validator, IR gen | Language spec |
| **Rust Engine** | `src/engines/rust/` | Native Rust simulation | IR spec only |
| **JS Engine** | `packages/blink-engine/` | TypeScript implementation | IR spec only |
| **Batch Engine** | `src/engines/batch/` | Headless testing engine | IR spec only |
| **Dev Tools** | `tools/` | LSP, VSCode extension | Language spec |

All engines are **independent** - they depend only on the IR specification, not on each other.

See [DEVELOPMENT_TRACKS.md](DEVELOPMENT_TRACKS.md) for detailed coordination guidelines.  
See [architecture/ir-decision.md](architecture/ir-decision.md) for the architectural rationale.

## Getting Started

- **Language Designers**: Start with [language/README.md](language/README.md)
- **Compiler Developers**: Start with [../src/compiler/README.md](../src/compiler/README.md)
- **Engine Developers**: Start with [ir-specification.md](ir-specification.md) and use examples in [../examples/ir/](../examples/ir/)
- **Game Designers**: See [summary.md](summary.md) for game concepts
- **All Developers**: Read [hie/README.md](hie/README.md) to understand architecture enforcement
