# Blink Idle RPG

An idle RPG where you complete the entire game in a blink... more or less!

## Overview

In Blink you define your RPG party and some decision rules, then the entire game runs without interaction. The system uses:

- **BRL (Blink Rule Language)**: Game developers define game rules, components, and events
- **BCL (Blink Choice Language)**: Players define choice strategies for their party
- **Multiple Engines**: Rust, JavaScript, and Batch engines execute compiled IR

## Project Status

**Latest Release:** [v0.1.0-combat-demo](RELEASE_NOTES.md) - Combat Demo with Windows build support!

This project is in early development with parallel work streams:

| Track | Status | Description |
|-------|--------|-------------|
| Language Design | 📝 Spec Draft | BRL/BCL specifications |
| **Compiler** | ✅ Scaffold | Lexer, Parser, IR Generator |
| Rust Engine | 📋 Planned | Native performance engine |
| **JS Engine** | ✅ Implemented | Browser-based engine |
| **Testing Framework** | ✅ Implemented | Integrated testing for BRL/BCL |
| Batch Engine | 📋 Planned | Balance testing engine |
| Dev Tools | 📋 Planned | LSP and VS Code extension |

## Quick Start

### Docker (Recommended for Quick Start)

The fastest way to get started without installing Rust, Node.js, or other dependencies:

```bash
# Start the project with Docker Compose
docker compose up --build

# Open http://localhost:3000 in your browser
```

> **Note:** Use `docker compose` (with space) for Docker Compose v2, or `docker-compose` (with hyphen) for v1.

**Volume Mapping:** The Docker setup maps local folders so you can edit BRL and BCL files on your host machine:
- Edit files in `./examples/brl/` and `./examples/bcl/`
- Recompile in the container: `docker compose exec blink-app blink-compiler compile -i /app/examples/brl/YOUR_FILE.brl -o /app/examples/ir/YOUR_FILE.ir.json --pretty`
- Refresh your browser to see changes

See the [Docker Setup Guide](DOCKER.md) for complete documentation on:
- Volume mapping and file editing workflow
- Running the compiler in the container
- Troubleshooting
- Advanced usage

### Local Development Pipeline

Use the `Makefile` to run the full build pipeline locally:

```bash
# See all available commands
make help

# Build everything (compiler, packages, compile BRL files)
make all

# Build and run all tests
make test

# Create a demo package for distribution
make demo-package
```

Available targets:
- `make build-compiler` - Build the Rust BRL compiler
- `make compile-brl` - Compile all BRL files to IR
- `make install-packages` - Install npm dependencies
- `make build-packages` - Build TypeScript packages
- `make test` - Run all tests (compiler + packages)
- `make test-compiler` - Run compiler tests only
- `make test-packages` - Run package tests only
- `make test-examples` - Run example tests
- `make demo-package` - Create demo distribution package
- `make clean` - Clean all build artifacts

### Try the Demo

To run the demos, serve them using a local web server:

```bash
cd examples/demos
npx serve .
# Open http://localhost:3000 in your browser
```

Alternatively, use Python:

```bash
cd examples/demos
python -m http.server 8000
# Open http://localhost:8000 in your browser
```

See [examples/demos/README.md](examples/demos/README.md) for more details.

### For JavaScript Engine Development

#### Prerequisites

**All Platforms:**
- Install Node.js from [https://nodejs.org/](https://nodejs.org/) (LTS version recommended)
- Verify installation: `node --version` and `npm --version`

#### Building

```bash
cd packages/blink-engine
npm install
npm run build

# Use the engine in your project
```

```typescript
import { BlinkGame } from '@blink/engine';

const game = await BlinkGame.create({ timeScale: 5.0 });
await game.loadRules('./game.ir.json');
game.start();
```

### For Compiler Development

#### Prerequisites

**Windows:**
- Install Rust from [https://rustup.rs/](https://rustup.rs/)
  - Download and run `rustup-init.exe`
  - Follow the installer prompts (default options work fine)
  - Restart your terminal after installation
- Verify installation: `cargo --version`

**Linux/macOS:**
- Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Verify installation: `cargo --version`

#### Building

```bash
cd src/compiler
cargo build
cargo test

# Compile a BRL file
cargo run -- compile -i ../../examples/brl/simple-clicker.brl --pretty
```

**Windows Note:** Use backslashes for paths or forward slashes in quotes:
```cmd
cargo run -- compile -i ..\..\examples\brl\simple-clicker.brl --pretty
rem OR
cargo run -- compile -i "../../examples/brl/simple-clicker.brl" --pretty
```

### For Testing Game Rules

#### Prerequisites

**All Platforms:**
- Node.js and npm (see JavaScript Engine Development section above)

#### Building

The `@blink/test` package provides an integrated testing framework for BRL and BCL:

```bash
cd packages/blink-test
npm install
npm run build
```

```typescript
import { createTest, expect, Scenario } from '@blink/test';

// Load your game rules and test them
const test = createTest().loadRules(myGameIR);

// Schedule events and step through the simulation
test.scheduleEvent('DoAttack', 0, { source: 0 });
test.step();

// Assert game state with fluent API
expect(test.getGame())
  .entity(1)
  .component('Health')
  .toHaveFieldLessThan('current', 100);

// Or use the scenario DSL for complex tests
const scenario = Scenario('Combat Test')
  .step('Attack enemy')
    .do(() => test.scheduleEvent('DoAttack', 0, { source: 0 }))
    .expectEntity(1).toHaveFieldLessThan('Health', 'current', 100)
  .build();
```

See [Testing Framework README](packages/blink-test/README.md) for full documentation.

### For Engine Development

Engines depend only on the IR specification. Example IR files are available:
- `examples/ir/simple-clicker.ir.json` - Minimal clicker game
- `examples/ir/simple-combat.ir.json` - Basic combat system

See the [IR Specification](doc/ir-specification.md) for format details.

## Documentation

### User Guides

- **[BRL User Guide](doc/language/brl-user-guide.md)** - Complete guide for game developers creating game rules
- **[BCL User Guide](doc/language/bcl-user-guide.md)** - Complete guide for players creating party strategies

### Reference Documentation

- [Project Overview](doc/summary.md) - High-level game concepts
- [Development Tracks](doc/DEVELOPMENT_TRACKS.md) - Parallel development guide
- [IR Specification](doc/ir-specification.md) - Central contract for engines
- [BRL Specification](doc/language/brl-specification.md) - BRL language reference
- [BCL Specification](doc/language/bcl-specification.md) - BCL language reference
- [Engine Architecture](doc/engine/architecture.md) - How engines work
- [Browser Engine](doc/engine/browser-engine.md) - JavaScript engine details
- [JS Engine README](packages/blink-engine/README.md) - Engine API documentation
- [Testing Framework](packages/blink-test/README.md) - Testing framework for BRL/BCL

## License

MIT License - see [LICENSE](LICENSE)
