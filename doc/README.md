# Blink Idle RPG - Documentation

This folder contains the technical documentation for Blink Idle RPG development.

## Documentation Structure

```
doc/
├── README.md                    # This file
├── summary.md                   # Project overview
├── language/                    # BRL & BCL Language Specification
│   ├── README.md               # Language overview
│   ├── brl-specification.md    # Blink Rule Language spec
│   ├── bcl-specification.md    # Blink Choice Language spec
│   └── examples/               # Language examples
├── engine/                      # Engine & Toolchain
│   ├── README.md               # Engine overview
│   ├── architecture.md         # Core architecture
│   ├── browser-engine.md       # Browser implementation
│   └── api/                    # API documentation
└── hie/                        # Hielements documentation
```

## Development Tracks

The project is organized to allow parallel development:

| Track | Folder | Description | Dependencies |
|-------|--------|-------------|--------------|
| **Language Design** | `doc/language/` | BRL & BCL specification | None |
| **Engine Core** | `doc/engine/` | Timeline, ECS, simulation | Language spec |
| **Browser Runtime** | `doc/engine/browser-engine.md` | JS/WASM implementation | Engine core |
| **Toolchain** | `doc/engine/` | Compiler, LSP, VSCode | Language spec |

## Getting Started

- **Language Designers**: Start with [language/README.md](language/README.md)
- **Engine Developers**: Start with [engine/README.md](engine/README.md)
- **Game Designers**: See [summary.md](summary.md) for game concepts
