---
name: compile-brl-to-wasm
description: Concise workflow to compile BRL → IR → WASM for demos/tests.
---

Purpose
Provide a short, repeatable set of steps to build IR and produce a runnable WASM/demo for local testing.

When to use
- After changing BRL or the compiler; before running demos or CI that need runtime artifacts.

Prerequisites
- Node.js + npm and `make` available; compiler build dependencies installed.

Quick steps
1. Build tooling: `make install-packages && make build-packages` (or `cd packages/blink-compiler-ts && npm install && npm run build`).
2. Produce IR: `make compile-brl` → check `ir/*.ir.json`.
3. Build runtime (example Node):
   - `cd packages/blink-engine-wasm-js && npm install && npm run build`
   - Run a harness: `node ./bin/run-demo.js --ir ../../ir/classic-rpg.ir.json` (package-specific).

Validate
- Smoke test the demo or run `make test` / `cd tests && npm test`.

Troubleshooting
- If `make compile-brl` fails: rebuild `packages/blink-compiler-ts`.
- If WASM build fails: check the chosen engine package logs and native toolchain setup.

Non-goal
- Do not commit generated `.ir.json`, `.wasm`, or other build outputs.

Example prompt
- "Compile BRL to IR and build the Node WASM demo"

