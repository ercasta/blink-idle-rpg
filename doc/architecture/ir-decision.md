# Architecture Decision: Intermediate Representation and Engine Independence — Current State

**Date**: 2026-04-06
**Status**: Implemented

## Summary

Current implementation follows a hybrid, IR-centric architecture: the TypeScript compiler emits a JSON IR which is the primary contract between the compiler and runtime engines. There is a JavaScript/TypeScript engine that consumes IR for browser usage, and a Rust-based runtime with tooling to produce WASM builds when needed.

## What is implemented

- The compiler generates IR (JSON) as an explicit output and test target.
- A browser-targeted JS engine consumes IR and exposes APIs to load `game.ir.json` files.
- A Rust/WASM pipeline exists to produce native and WASM engines from the same source (tooling and templates present).

## Evidence (representative files)

- Compiler IR generation and tests: `packages/blink-compiler-ts/src/codegen.ts`
- JS engine that loads IR: `packages/blink-engine/package.json` and package README
- WASM/Rust pipeline tooling: `packages/blink-engine-wasm-js/build.js` and `packages/blink-runtime/Cargo.toml`
- Project CI / docs indicate IR artifacts are generated but not committed: `.gitignore` entries for `*.ir.json` and AGENTS.md guidance

## Notes

- The repository provides IR as the single source-of-truth for rule semantics; engines implement execution against that IR.
- This aligns with the Hybrid Option (IR + JS engine + optional WASM) described previously; the implementation favors IR-first design with both JS and Rust/WASM runtimes available.

---

If you want, I can also (a) add a short example showing how to generate IR and load it in the JS engine, or (b) create a short CHANGELOG entry summarizing this state. Which would you prefer?
