# Development Tracks

This document describes how different developers can work on Blink in parallel.

## Architecture Overview

The Blink system uses an **IR-centric architecture** where the compiler produces an Intermediate Representation that multiple independent engines can execute. This enables:
- **Parallel development**: Engine teams don't depend on each other
- **Centralized validation**: All errors caught at compile time
- **Engine diversity**: Each engine optimized for its platform

See [Architecture Decision: IR and Engine Independence](architecture/ir-decision.md) for detailed rationale.

## Track Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BLINK DEVELOPMENT TRACKS                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │ TRACK 1         │                                                        │
│  │ Language Design │                                                        │
│  │ (BRL/BCL Spec)  │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │ defines syntax & semantics                                      │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ TRACK 2         │                                                        │
│  │ Compiler        │                                                        │
│  │ (BRL → IR)      │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │ produces                                                        │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         BLINK IR                                     │   │
│  │  • Component definitions    • Rule instructions                      │   │
│  │  • Tracker definitions      • BCL choice functions                   │   │
│  │  • Format: JSON or Binary   • Versioned contract                     │   │
│  └────────┬─────────────────────────┬─────────────────────┬────────────┘   │
│           │                         │                     │                 │
│           │ (independent)           │ (independent)       │ (independent)   │
│           ▼                         ▼                     ▼                 │
│  ┌─────────────────┐      ┌─────────────────┐    ┌─────────────────┐       │
│  │ TRACK 3         │      │ TRACK 4         │    │ TRACK 5         │       │
│  │ Rust Engine     │      │ JS Engine       │    │ Batch Engine    │       │
│  │ (Native)        │      │ (Browser)       │    │ (Headless)      │       │
│  └─────────────────┘      └─────────────────┘    └─────────────────┘       │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │ TRACK 6         │◄─── Uses compiler AST                                  │
│  │ Dev Tools       │                                                        │
│  │ (LSP, VSCode)   │                                                        │
│  └─────────────────┘                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Insight: Engine Independence

**Engines do NOT depend on each other.** Each engine:
1. Takes IR as input (the contract)
2. Implements execution semantics
3. Provides platform-specific API

This means:
- Rust developers can build the Rust engine
- JavaScript developers can build the JS engine
- No blocking dependencies between engine teams
- Same compiled IR runs on all engines

## Track 1: Language Design

**Focus**: Define BRL and BCL specifications

### Owner Requirements
- Programming language design experience
- Good technical writing skills
- Understanding of game mechanics

### Deliverables
1. BRL specification document
2. BCL specification document  
3. Language examples
4. Grammar definition (EBNF)

### Files
- `doc/language/brl-specification.md`
- `doc/language/bcl-specification.md`
- `doc/language/game/`

### Dependencies
- None (can start immediately)

### Interfaces Provided
- Syntax definition for Track 2 (Compiler)
- Semantic rules for Track 3 (Engine)
- Feature requirements for Track 5 (Dev Tools)

### Getting Started
```bash
# Read current spec
cat doc/language/README.md

# Work on specifications
code doc/language/brl-specification.md
code doc/language/bcl-specification.md

# Add examples
mkdir -p doc/language/examples
```

---

## Track 2: Compiler

**Focus**: Parse BRL and generate IR

**Status**: Scaffold created ✓

### Owner Requirements
- Compiler/parser experience
- Rust proficiency
- Understanding of Track 1 output

### Deliverables
1. ✅ BRL lexer
2. ✅ BRL parser  
3. ✅ Semantic analyzer
4. ✅ IR generator
5. ✅ CLI tool (`blink-compiler`)

### Files
```
src/compiler/
├── Cargo.toml           # Project configuration
├── README.md            # Compiler documentation
├── src/
│   ├── lib.rs           # Library entry point
│   ├── main.rs          # CLI entry point
│   ├── lexer/           # Tokenizer (logos-based)
│   │   └── mod.rs
│   ├── parser/          # AST builder
│   │   └── mod.rs
│   ├── analyzer/        # Semantic analysis
│   │   └── mod.rs
│   └── ir/              # IR generator
│       └── mod.rs
```

### Dependencies
- Track 1: Language specification (can start with draft)

### Interfaces Provided
- **IR format specification**: The contract for all engines
- IR format for Track 3 (Rust Engine)
- IR format for Track 4 (JS Engine)
- IR format for Track 5 (Batch Engine)
- AST/Parse info for Track 6 (Dev Tools)

### Getting Started
```bash
# The compiler scaffold is already created!

# Build the compiler
cd src/compiler
cargo build

# Run tests
cargo test

# Use the CLI (after building)
cargo run -- compile -i ../../game/brl/simple-clicker.brl --pretty

# Or check a file for errors
cargo run -- check -i ../../game/brl/simple-combat.brl
```

### Next Steps
1. Review the [BRL Specification](language/brl-specification.md)
2. Enhance the lexer to handle all BRL tokens
3. Extend the parser for complete BRL syntax
4. Add comprehensive error messages
5. Implement optimization passes

---

## Track 3: Rust Engine

**Focus**: Native Rust implementation of the Blink engine

### Owner Requirements
- Rust proficiency
- ECS pattern knowledge
- Game engine experience helpful

### Deliverables
1. IR loader (JSON/binary)
2. Timeline implementation
3. ECS store
4. Event system
5. Rule executor
6. Tracker system
7. Core library (`blink-engine-rust`)

### Files
```
src/engines/rust/
├── ir/           # IR loader
├── timeline/
├── ecs/
├── events/
├── rules/
├── trackers/
└── lib.rs
```

### Dependencies
- **Track 2: IR specification only** (not the compiler implementation)
- Track 1: For semantic understanding (optional)

### Interfaces Provided
- Rust Engine API (can be used for dev server, batch processing)
- Optional WASM compilation (but JS Engine is preferred for browser)

### Getting Started
```bash
# Set up Rust project
cargo new blink-engine-rust --lib

# Read architecture doc
cat doc/engine/architecture.md

# Read IR specification
cat doc/ir-specification.md

# Use example IR files for testing
# game/ir/simple-clicker.ir.json - minimal test case
# game/ir/simple-combat.ir.json  - more complex test case

# Start with IR loader
mkdir -p src/engines/rust/src/ir
code src/engines/rust/src/ir/mod.rs
```

---

## Track 4: JavaScript Engine

**Focus**: Pure JavaScript/TypeScript implementation for browsers

**Why pure JS instead of WASM?**
- No dependency on Rust engine
- Better debugging (browser DevTools)
- Smaller bundle size
- JavaScript developers can contribute
- Framework integrations (React, Vue) are native

### Owner Requirements
- TypeScript proficiency
- Browser APIs knowledge
- Frontend development experience

### Deliverables
1. IR loader (JSON)
2. Timeline implementation
3. ECS store
4. Rule executor
5. Tracker system
6. NPM package (`@blink/engine`)
7. Example game client
8. React/Vue integration examples

### Files
```
packages/
├── blink-engine/           # TypeScript engine implementation
│   ├── src/
│   │   ├── ir/            # IR loader
│   │   ├── timeline/      # Event scheduling
│   │   ├── ecs/           # Entity-Component storage
│   │   ├── rules/         # Rule execution
│   │   └── trackers/      # Tracker output
│   └── package.json
├── blink-engine-react/     # React bindings (optional)
└── example-client/         # Demo application
```

### Dependencies
- **Track 2: IR specification only** (not the compiler implementation)
- No dependency on Track 3 (Rust Engine)

### Interfaces Provided
- JavaScript API for game developers
- React/Vue hooks
- Integration examples

### Getting Started
```bash
# Read browser engine doc
cat doc/engine/browser-engine.md

# Read IR specification
cat doc/ir-specification.md

# Use example IR files for testing
# game/ir/simple-clicker.ir.json - minimal test case
# game/ir/simple-combat.ir.json  - more complex test case

# Set up TypeScript project
mkdir -p packages/blink-engine/src
cd packages/blink-engine
npm init -y
npm install typescript
npx tsc --init

# Start with IR loader
code src/ir/loader.ts
```

---

## Track 5: Batch Engine

**Focus**: High-throughput headless engine for balance testing

### Owner Requirements
- Rust proficiency (or language of choice)
- Performance optimization
- Statistical analysis knowledge helpful

### Deliverables
1. Headless IR executor
2. No tracker overhead mode
3. Parallel simulation runner
4. Statistics collection
5. CLI tool (`blink-batch`)

### Files
```
src/engines/batch/
├── ir/
├── runner/
├── stats/
└── cli/
```

### Dependencies
- **Track 2: IR specification only**
- Can share code with Track 3 (Rust Engine) but not required

### Interfaces Provided
- Batch simulation API
- Statistics output (JSON, CSV)

### Getting Started
```bash
# Set up Rust project
mkdir -p src/engines/batch
cd src/engines/batch
cargo init --name blink-batch

# Read IR specification
cat doc/ir-specification.md

# Use example IR files for testing
# game/ir/simple-clicker.ir.json - minimal test case
# game/ir/simple-combat.ir.json  - more complex test case

# Start with runner
mkdir -p src/runner
code src/runner/mod.rs
```

---

## Track 6: Developer Tools

**Focus**: LSP server and VS Code extension

### Owner Requirements
- LSP protocol knowledge
- VS Code extension development
- Rust or TypeScript proficiency

### Deliverables
1. Language Server (LSP)
2. VS Code extension
3. Syntax highlighting
4. Error diagnostics
5. Autocomplete

### Files
```
tools/
├── blink-lsp/           # Language Server
└── vscode-blink/        # VS Code Extension
```

### Dependencies
- Track 1: Language specification
- Track 2: Parser/AST (can share code)

### Interfaces Provided
- IDE support for game developers

### Getting Started
```bash
# Read VSCode extension docs
# https://code.visualstudio.com/api

# Set up extension
cd tools/vscode-blink
yo code  # VSCode extension generator

# Set up LSP
cd ../blink-lsp
cargo new blink-lsp --bin
```

---

## Interface Contracts

### IR Format Contract (Track 2 → Tracks 3, 4, 5)

The IR is the **central contract** between compiler and all engines.
Engines do NOT depend on each other—each engine depends only on the IR specification.

```json
// IR Format (JSON)
// Specification: doc/ir-specification.md
{
  "version": "1.0",
  "module": "game",
  "components": [...],
  "rules": [...],
  "functions": [...],
  "trackers": [...]
}
```

All engines must implement identical semantics for the same IR.
Test suite in `tests/ir/` validates engine consistency.

### Engine Implementation (Conceptual Interface)

Each engine independently implements these concepts:

```
IR Loader       - Parse IR JSON, validate structure
Timeline        - Event scheduling at 1/100s precision  
ECS Store       - Entity-component storage
Rule Executor   - Execute rules on events
Tracker System  - Capture state changes for UI
```

Engines MAY share code (e.g., Rust Engine and Batch Engine)
but are NOT required to.

### LSP Contract (Track 2 ↔ Track 6)

Track 6 can use Track 2's parser crate:

```rust
// Track 2 exposes parsing for Track 6
pub fn parse(source: &str) -> Result<AST, Vec<ParseError>>;
pub fn get_completions(source: &str, position: Position) -> Vec<Completion>;
pub fn get_diagnostics(source: &str) -> Vec<Diagnostic>;
```

---

## Communication Guidelines

### Daily Sync Topics
1. Interface changes
2. Blockers
3. Timeline updates

### Interface Change Process
1. Propose change in `doc/interfaces/` 
2. Notify affected tracks
3. Get approval from track owners
4. Update shared definitions
5. Implement changes

### Shared Resources
- IR specification: `doc/ir-specification.md`
- IR test suite: `tests/ir/`
- Test fixtures: `tests/fixtures/`
- Example games: `game/`

---

## Milestone Coordination

### M1: Foundation (Week 1-2)
- Track 1: BRL spec v0.1
- Track 2: Basic parser + IR spec
- Track 3: Timeline + ECS skeleton (Rust)
- Track 4: Timeline + ECS skeleton (JS)
- Track 5: Batch runner scaffold
- Track 6: Extension scaffold

### M2: Integration (Week 3-4)
- Track 2: IR format finalized, test suite
- Track 3, 4, 5: Pass IR test suite
- Track 1 + 6: Syntax highlighting

### M3: MVP (Week 5-6)
- All tracks: Basic working flow
- End-to-end test: BRL → IR → Simulation
- All engines pass IR conformance tests

### M4: Polish (Week 7-8)
- BCL support
- Developer experience
- Documentation
- Examples
