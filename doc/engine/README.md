# Blink Engine Documentation

## Documents

| Document | Description |
|----------|-------------|
| [architecture.md](architecture.md) | ECS, Timeline, event dispatch — how the runtime works |
| [browser-engine.md](browser-engine.md) | JavaScript engine implementation details |
| [wasm-integration-design.md](wasm-integration-design.md) | WASM engine and React app integration |

## Engine Overview

The Blink engine runs BRL-compiled game rules. Two engines exist:

- **JS engine** (`packages/blink-engine/`) — TypeScript, runs in the browser. Primary engine for development.
- **WASM engine** (`packages/blink-runtime/` + `packages/blink-engine-wasm-js/`) — Rust compiled to WASM. Production performance target.

Both engines implement the same `ISimEngine` TypeScript interface and are interchangeable from the app's perspective.

### Build pipeline

```
BRL source files
    │
    ▼ blink-compiler-ts
IR JSON  ──────────────────────────► JS engine (browser)
    │
    ▼ codegen-rust.ts
Rust source
    │
    ▼ wasm-pack
WASM binary  ──────────────────────► WASM engine (browser / native tests)
```

See the root [README.md](../../README.md) for local build commands.

