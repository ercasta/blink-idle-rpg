# Blink Idle RPG

An idle RPG where you complete the entire game in a blink... more or less!

## Overview

In Blink you define your RPG party and some decision rules, then the entire game runs without interaction. The system uses:

- **BRL (Blink Rule Language)**: Game developers define game rules, components, and events
- **BCL (Blink Choice Language)**: Players define choice strategies for their party
- **Multiple Engines**: Rust, JavaScript, and Batch engines execute compiled IR

## Project Status

This project is in early development with parallel work streams:

| Track | Status | Description |
|-------|--------|-------------|
| Language Design | 📝 Spec Draft | BRL/BCL specifications |
| **Compiler** | ✅ Scaffold | Lexer, Parser, IR Generator |
| Rust Engine | 📋 Planned | Native performance engine |
| **JS Engine** | ✅ Implemented | Browser-based engine |
| Batch Engine | 📋 Planned | Balance testing engine |
| Dev Tools | 📋 Planned | LSP and VS Code extension |

## Quick Start

### Try the Demo

#### Option 1: Open directly in your browser (No setup required!)

Simply open the demo file directly - works on mobile and desktop:

1. Navigate to `packages/demo/`
2. Open `demo.html` in your browser (double-click or right-click → Open with browser)
3. Choose a demo and start playing!

#### Option 2: Use a local web server

If you prefer using a web server:

```bash
cd packages/demo
npx serve .
# Open http://localhost:3000 in your browser
```

### For JavaScript Engine Development

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

```bash
cd src/compiler
cargo build
cargo test

# Compile a BRL file
cargo run -- compile -i ../../examples/brl/simple-clicker.brl --pretty
```

### For Engine Development

Engines depend only on the IR specification. Example IR files are available:
- `examples/ir/simple-clicker.ir.json` - Minimal clicker game
- `examples/ir/simple-combat.ir.json` - Basic combat system

See the [IR Specification](doc/ir-specification.md) for format details.

## Documentation

- [Project Overview](doc/summary.md) - High-level game concepts
- [Development Tracks](doc/DEVELOPMENT_TRACKS.md) - Parallel development guide
- [IR Specification](doc/ir-specification.md) - Central contract for engines
- [BRL Specification](doc/language/brl-specification.md) - Game rule language
- [Engine Architecture](doc/engine/architecture.md) - How engines work
- [Browser Engine](doc/engine/browser-engine.md) - JavaScript engine details
- [JS Engine README](packages/blink-engine/README.md) - Engine API documentation

## License

MIT License - see [LICENSE](LICENSE)
