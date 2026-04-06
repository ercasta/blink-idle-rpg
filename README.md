# Blink Idle RPG

An idle RPG where you complete the entire game in a blink… more or less!

## Overview

In Blink you define your RPG party and some decision rules, then the entire game runs without interaction. Game rules are written in **BRL (Blink Rule Language)** and compiled to an Intermediate Representation (IR) that the engine executes.

## Prerequisites

All workflows require **Node.js** (LTS). Nothing else is needed for the browser demos.

- Download from [nodejs.org](https://nodejs.org/) (LTS version)
- Verify: `node --version` and `npm --version`

The WASM engine additionally requires **Rust** + **wasm-pack** (see [Level 4](#level-4-wasm-engine) below).

---

## Game Designer Quick Start (Windows & Linux/macOS)

All commands use `npm run` — no `make` or special shell required.

### Level 1 — Test game rules with the engine harness

Run BRL rules through the Rust engine natively, without a browser.  
Requires: Node.js + Rust (install Rust once via [rustup.rs](https://rustup.rs/)).

```
npm run setup
npm run test:harness
```

This compiles BRL → Rust → native binary and runs the test suite.  
Use this to quickly validate rule logic before going to the browser.

---

### Level 2 — Browser demos (HTML pages)

Serve the classic RPG demo in a browser using the JavaScript engine.  
Requires: Node.js only.

```
npm run setup
npm run build:demos
npm run serve:demos
```

Then open **http://localhost:3000** in your browser.

To rebuild after editing BRL files, re-run `npm run compile-brl` and reload the page.

---

### Level 3 — Full web app (React)

Run the complete React app with hot-reload during development.  
Requires: Node.js only. Must run `npm run build:demos` first (so the IR files exist).

```
npm run setup
npm run build:demos
cd game/app && npm install
npm run dev:app
```

Then open the local URL printed by Vite (usually **http://localhost:5173**).

---

### Level 4 — WASM engine

Compile game rules to WebAssembly for maximum performance.  
Requires: Node.js + Rust + wasm-pack.

**Windows — one-time setup:**

```powershell
.\scripts\install-rust-wasm-windows.ps1
```

**Linux/macOS — one-time setup:**

```bash
curl https://sh.rustup.rs -sSf | sh
rustup target add wasm32-unknown-unknown
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

**Build WASM and run the app:**

```
npm run build:wasm        # builds TS compiler then compiles BRL → Rust → WASM (release, ~2 min)
npm run install:wasm      # copies artefacts to game/app/public/wasm/
npm run dev:app           # React app uses WASM engine automatically
```

Use `npm run build:wasm:dev` for a faster debug build during iteration.

---

## npm Scripts Reference

| Command | What it does |
|---------|-------------|
| `npm run setup` | Install npm deps for all packages |
| `npm run build:demos` | Build JS bundles + compile BRL → IR (browser demos) |
| `npm run compile-brl` | Re-compile BRL source to IR only |
| `npm run serve:demos` | Serve `game/demos/` at http://localhost:3000 |
| `npm run dev:app` | Start React dev server (Vite) |
| `npm run build:app` | Production build of the React app |
| `npm run test:harness` | BRL → Rust → native test harness |
| `npm run test:compiler` | TypeScript compiler unit tests |
| `npm run test:engine` | JS engine unit tests |
| `npm run build:wasm` | BRL → Rust → WASM (release) |
| `npm run build:wasm:dev` | BRL → Rust → WASM (dev, faster) |
| `npm run install:wasm` | Copy WASM artefacts to React app |

### Makefile (Linux/macOS/WSL)

The `Makefile` wraps the same steps with additional helpers:

```bash
make help          # list all targets
make dev-setup     # quick first-time setup
make test          # compiler + engine tests
make test-wasm     # WASM harness tests
make build-wasm    # WASM release build
make demo-package  # create distributable ZIP
```

---

## Project Structure

```
game/
  app/        React web app (Vite + Tailwind)
  brl/        BRL source files (game rules — edit these!)
  bcl/        BCL configuration files (heroes, skills)
  demos/      Standalone HTML demos
packages/
  blink-compiler-ts/   TypeScript BRL compiler
  blink-engine/        JavaScript runtime engine
  blink-engine-wasm/   BRL→Rust test harness
  blink-engine-wasm-js/  WASM build orchestrator
  blink-runtime/       Rust core engine
  blink-test/          BRL testing framework
tools/
  compile-brl-to-ir.js  Batch BRL→IR compiler
scripts/
  install-rust-wasm-windows.ps1  Windows WASM setup
  install-wasm.js       Cross-platform WASM artefact installer
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [BRL User Guide](doc/language/brl-user-guide.md) | How to write game rules in BRL |
| [BRL Specification](doc/language/brl-specification.md) | BRL language reference |
| [IR Specification](doc/ir-specification.md) | Intermediate Representation format |
| [Engine Architecture](doc/engine/architecture.md) | How the runtime works |
| [WASM Integration](doc/engine/wasm-integration-design.md) | WASM engine design |
| [Game Design](doc/game-design/README.md) | Combat, characters, scoring |
| [Game Demo README](game/demos/README.md) | Running the HTML demos |
| [Docker Guide](DOCKER.md) | Docker-based development |

---

## CI/CD

GitHub Actions automatically:
- Deploys demos to **[GitHub Pages](https://ercasta.github.io/blink-idle-rpg/)** on push to main
- Builds distributable packages for Linux and Windows on releases

---

## License

MIT License — see [LICENSE](LICENSE)

