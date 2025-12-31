# Blink Idle RPG - Documentation

This folder contains the technical documentation for Blink Idle RPG development.

## Documentation Structure

```
doc/
├── README.md                    # This file
├── summary.md                   # Project overview
├── DEVELOPMENT_TRACKS.md        # Parallel development guide
├── language/                    # BRL & BCL Language Specification
│   ├── README.md                # Language overview
│   ├── brl-specification.md     # Blink Rule Language spec
│   ├── bcl-specification.md     # Blink Choice Language spec
│   └── examples/                # Language examples
├── engine/                      # Engine & Toolchain
│   ├── README.md                # Engine overview
│   ├── architecture.md          # Core architecture
│   ├── browser-engine.md        # Browser implementation
│   └── api/                     # API documentation
└── hie/                         # Hielements documentation
    ├── README.md                # Hielements overview
    ├── language-reference.md    # Hielements syntax
    ├── blink-architecture.md    # Blink architecture spec
    └── writing-specs.md         # How to write .hie files
```

## Development Tracks

The project is organized to allow parallel development:

| Track | Folder | Description | Dependencies |
|-------|--------|-------------|--------------|
| **Language Design** | `doc/language/` | BRL & BCL specification | None |
| **Engine Core** | `doc/engine/` | Timeline, ECS, simulation | Language spec |
| **Browser Runtime** | `doc/engine/browser-engine.md` | JS/WASM implementation | Engine core |
| **Toolchain** | `doc/engine/` | Compiler, LSP, VSCode | Language spec |
| **Architecture** | `doc/hie/` | Hielements specifications | None |

See [DEVELOPMENT_TRACKS.md](DEVELOPMENT_TRACKS.md) for detailed coordination guidelines.

## Getting Started

- **Language Designers**: Start with [language/README.md](language/README.md)
- **Engine Developers**: Start with [engine/README.md](engine/README.md)
- **Game Designers**: See [summary.md](summary.md) for game concepts
- **All Developers**: Read [hie/README.md](hie/README.md) to understand architecture enforcement
