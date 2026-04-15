# Learning Path: Engine Developer

This guide is for developers working on the **Blink engine itself** — the
compiler, runtime, WASM integration, build tooling, or the React web
application.

---

## Prerequisites

- Proficiency with **TypeScript** and **Node.js**
- Familiarity with **Rust** (for runtime / WASM work)
- Basic understanding of ECS (Entity Component System) architecture

## Getting Started

1. **[INTRODUCTION.md](INTRODUCTION.md)** — High-level overview of the project
2. **[WORKFLOW.md](WORKFLOW.md)** — End-to-end architecture, build pipeline,
   and practical workflows
3. **[RESPONSIBILITIES.md](RESPONSIBILITIES.md)** — What logic belongs in BRL
   vs TypeScript

## Deep Dives

### Compiler

| Document | What You'll Learn |
|----------|-------------------|
| [brl/brl-specification.md](brl/brl-specification.md) | The BRL language grammar and semantics |
| [ir-specification.md](ir-specification.md) | The IR format — the contract between compiler and engines |
| [architecture/ir-decision.md](architecture/ir-decision.md) | Why IR was chosen as the central contract |

The compiler source lives in `packages/blink-compiler-ts/`.  Build and test:
```bash
npm run build:compiler:ts    # Build the compiler
npm run test:compiler        # Run compiler tests
```

### Runtime / WASM

| Document | What You'll Learn |
|----------|-------------------|
| [architecture/engine-architecture.md](architecture/engine-architecture.md) | ECS, Timeline, event dispatch |
| [architecture/wasm-integration-design.md](architecture/wasm-integration-design.md) | WASM memory model, JS ↔ Rust bridge |

The runtime source lives in `packages/blink-runtime/` (Rust).  Build:
```bash
npm run build:wasm           # BRL → Rust → WASM
npm run install:wasm         # Copy WASM artefacts to web app
npm run test:harness         # E2E tests (BRL → native binary)
```

### Web Application

| Document | What You'll Learn |
|----------|-------------------|
| [web-interface-design.md](web-interface-design.md) | UI screens, components, state management |
| [RESPONSIBILITIES.md](RESPONSIBILITIES.md) | What should be in TypeScript vs BRL |

The React app lives in `game/app/`.  Build and run:
```bash
npm run dev:app              # Start local dev server
npm run build:app            # Production build
npm --prefix game/app run lint   # Lint check
```

### Build Pipeline

| Script | Purpose |
|--------|---------|
| `scripts/compile-game-data.js` | Compile BRL entity data to JSON for the web app |
| `scripts/copy-game-files.js` | Copy BCL files to web app public dir |
| `scripts/install-wasm.js` | Copy WASM artefacts to web app public dir |

Full production build: `npm run build`

## Key Concepts

- **BRL files** in `game/brl/` are the source of truth for game rules and data
- **WASM binary** embeds compiled rules; entity data is injected at runtime
- **game-data/** in the web app public dir contains pre-compiled JSON from BRL entity data
  (see `scripts/compile-game-data.js`)
- **game-files/** in the web app public dir contains BCL files
  (see `scripts/copy-game-files.js`)
