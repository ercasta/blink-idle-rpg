# Development Tracks

This document describes how different developers can work on Blink in parallel.

## Track Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BLINK DEVELOPMENT TRACKS                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │ TRACK 1         │                                                    │
│  │ Language Design │ ──────────────────────────────────────────────┐    │
│  │ (BRL/BCL Spec)  │                                               │    │
│  └────────┬────────┘                                               │    │
│           │                                                        │    │
│           │ defines                                                │    │
│           ▼                                                        │    │
│  ┌─────────────────┐      ┌─────────────────┐                      │    │
│  │ TRACK 2         │      │ TRACK 3         │                      │    │
│  │ Compiler        │      │ Core Engine     │                      │    │
│  │ (BRL → IR)      │      │ (Rust)          │                      │    │
│  └────────┬────────┘      └────────┬────────┘                      │    │
│           │                        │                               │    │
│           │ produces               │ implements                    │    │
│           │                        │                               │    │
│           └──────────┬─────────────┘                               │    │
│                      │                                             │    │
│                      ▼                                             │    │
│             ┌─────────────────┐                                    │    │
│             │ IR (Shared)     │ ◄──────────────────────────────────┘    │
│             │ Interface       │   validates against                     │
│             └────────┬────────┘                                         │
│                      │                                                  │
│                      ▼                                                  │
│             ┌─────────────────┐      ┌─────────────────┐                │
│             │ TRACK 4         │      │ TRACK 5         │                │
│             │ Browser Runtime │      │ Dev Tools       │                │
│             │ (JS/WASM)       │      │ (LSP, VSCode)   │                │
│             └─────────────────┘      └─────────────────┘                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

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
- `doc/language/examples/`

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

### Owner Requirements
- Compiler/parser experience
- Rust proficiency
- Understanding of Track 1 output

### Deliverables
1. BRL lexer
2. BRL parser  
3. Semantic analyzer
4. IR generator
5. CLI tool (`blink-compiler`)

### Files
```
src/compiler/
├── lexer/
├── parser/
├── analyzer/
├── ir/
└── cli/
```

### Dependencies
- Track 1: Language specification (can start with draft)

### Interfaces Provided
- IR format for Track 3 (Engine)
- IR format for Track 4 (Browser Runtime)
- AST/Parse info for Track 5 (LSP)

### Getting Started
```bash
# Set up Rust project
cargo new blink-compiler --lib

# Read language spec
cat doc/language/brl-specification.md

# Start with lexer
code src/compiler/lexer/mod.rs
```

---

## Track 3: Core Engine

**Focus**: Implement simulation runtime in Rust

### Owner Requirements
- Rust proficiency
- ECS pattern knowledge
- Game engine experience helpful

### Deliverables
1. Timeline implementation
2. ECS store
3. Event system
4. Rule executor
5. Tracker system
6. Core library (`blink-core`)

### Files
```
src/engine/
├── timeline/
├── ecs/
├── events/
├── rules/
├── trackers/
└── lib.rs
```

### Dependencies
- Track 1: Semantic requirements (can start with draft)
- Track 2: IR format (co-design)

### Interfaces Provided
- Engine API for Track 4 (Browser Runtime)
- Engine API for batch/server runtimes

### Getting Started
```bash
# Set up Rust project
cargo new blink-engine --lib

# Read architecture doc
cat doc/engine/architecture.md

# Start with timeline
code src/engine/timeline/mod.rs
```

---

## Track 4: Browser Runtime

**Focus**: JavaScript/WASM implementation for browsers

### Owner Requirements
- TypeScript proficiency
- WASM experience (wasm-bindgen)
- Frontend development experience

### Deliverables
1. WASM bindings
2. TypeScript API
3. NPM package (`@blink/engine`)
4. Example game client

### Files
```
packages/
├── blink-engine-wasm/    # Rust → WASM
├── blink-engine/         # TypeScript API
└── example-client/       # Demo
```

### Dependencies
- Track 3: Core Engine (can develop in parallel with mocks)

### Interfaces Provided
- JavaScript API for game developers
- Integration examples

### Getting Started
```bash
# Read browser engine doc
cat doc/engine/browser-engine.md

# Set up WASM project
cd packages/blink-engine-wasm
wasm-pack build --target web

# Set up TypeScript API
cd ../blink-engine
npm init
```

---

## Track 5: Developer Tools

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

### IR Format Contract (Track 2 ↔ Track 3 ↔ Track 4)

```rust
// Shared IR definition
// Located in: src/ir/mod.rs

pub struct IRModule {
    pub name: String,
    pub version: String,
    pub components: Vec<IRComponent>,
    pub rules: Vec<IRRule>,
    pub functions: Vec<IRFunction>,
    pub trackers: Vec<IRTracker>,
}

// Full definition in doc/engine/architecture.md
```

### Engine API Contract (Track 3 ↔ Track 4)

```rust
// Shared engine trait
// Located in: src/engine/traits.rs

pub trait BlinkEngine {
    fn load_rules(&mut self, rules: IRModule) -> Result<()>;
    fn load_state(&mut self, state: GameState) -> Result<()>;
    fn step(&mut self) -> Option<StepResult>;
    fn get_state(&self) -> GameStateSnapshot;
    fn drain_tracker_output(&mut self) -> Vec<TrackerOutput>;
}
```

### LSP Contract (Track 2 ↔ Track 5)

Track 5 can use Track 2's parser crate:

```rust
// Track 2 exposes parsing for Track 5
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

### Shared Code
- IR definitions: `src/ir/`
- Type definitions: `src/types/`
- Test fixtures: `tests/fixtures/`

---

## Milestone Coordination

### M1: Foundation (Week 1-2)
- Track 1: BRL spec v0.1
- Track 2: Basic parser
- Track 3: Timeline + ECS skeleton
- Track 4: WASM build setup
- Track 5: Extension scaffold

### M2: Integration (Week 3-4)
- Track 2 + 3: IR format finalized
- Track 3 + 4: Engine API finalized
- Track 1 + 5: Syntax highlighting

### M3: MVP (Week 5-6)
- All tracks: Basic working flow
- End-to-end test: BRL → IR → Simulation → Browser

### M4: Polish (Week 7-8)
- BCL support
- Developer experience
- Documentation
- Examples
