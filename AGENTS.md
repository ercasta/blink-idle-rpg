# Development instructions

## Code Versioning Policy

**NEVER version derived/generated code.** Generated files like JavaScript bundles (`.bundle.js`), compiled outputs, and IR files (`.ir.json`) must NOT be committed to the repository.

- **Generated JavaScript files** (e.g., `*.bundle.js`) must be built from their TypeScript sources using the build process
- **IR files** (`.ir.json`) must be compiled from BRL source files
- **Reason:** Versioning generated files leads to stale file issues, merge conflicts, and unnecessarily large repository size

If code fails to load due to missing generated files, fix the build process or documentation to ensure users know to build first (e.g., run `npm run build:demos`).

## Pre-submission Build Checks

**ALWAYS** run these checks before submitting a PR to ensure the build passes.

### Cross-platform (npm — works on Windows, Linux, macOS)

```
npm run setup
npm run build:demos
npm run test:compiler
npm run test:engine
```

### Linux/macOS (Makefile)

```bash
make install-packages
make build-packages
make compile-brl
make test
make demo-package
```

All commands must complete successfully before submitting a PR.

## Language Compilation Test Suite

After making changes to the compiler, run the TypeScript compiler test suite:

```bash
cd packages/blink-compiler-ts
npm install
npm run build
npm test
```

This test suite validates:
- Component definitions
- Rule definitions and triggers
- Function definitions
- Tracker definitions
- Entity syntax (new and legacy)
- `entities having` expressions
- Bound choice functions
- Composite types
- Control flow (if/else, for loops)
- Expressions (binary, unary, field access, index access, function calls)
- Statement types (let, schedule, create, delete)
- Assignment operators

All tests must pass before changes to the compiler are committed.

## WASM Engine Build

The WASM engine compiles BRL → Rust → WASM. Prerequisites must be installed once.

**Windows:**
```powershell
.\scripts\install-rust-wasm-windows.ps1
npm run build:wasm
npm run install:wasm
```

**Linux/macOS:**
```bash
curl https://sh.rustup.rs -sSf | sh
rustup target add wasm32-unknown-unknown
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
npm run build:wasm      # or: make build-wasm
npm run install:wasm    # or: make install-wasm
```

Use `npm run build:wasm:dev` (or `make build-wasm-dev`) for faster iteration during development.

