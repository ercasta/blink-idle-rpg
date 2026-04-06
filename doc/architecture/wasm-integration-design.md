# WASM Engine & Web Integration Design

This document defines the design for integrating the Blink game engine with the web player app.

## Overview

- Checkpoint-driven UI: the simulation captures N snapshots (N=30) for a short replay
- Engine abstraction: `blink-runtime` compiled to WASM; rules compiled BRL → Rust → WASM
- Runtime data: entity data injected via `create_entity`/`add_component`

## N-Step Checkpoint System

An engine captures `GameSnapshot` at defined progress checkpoints; UI replays them at 1s intervals.

## Engine Abstraction Interface

Both adapters implement `ISimEngine`; WASM engine runs in a worker and posts snapshots on completion.

## Build Pipeline

`make compile-brl` → compile BRL to IR → `wasm-pack` build for `blink-runtime` → copy to `game/app/public/wasm/`.
