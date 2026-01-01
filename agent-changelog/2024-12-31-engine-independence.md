# Changelog: Engine Independence Architecture

**Date**: 2024-12-31  
**Request**: Evaluate IR architecture and ensure engines are independent

## Summary

Restructured the project architecture to make all runtime engines independent. They now depend only on the IR specification, not on each other.

## Changes to hielements.hie

### Added Elements
- `ir` - Blink IR specification as central contract
- `rust_engine` - Renamed from `engine`, moved to `src/engines/rust/`
- `js_engine` - Pure TypeScript browser engine (removed WASM dependency)
- `batch_engine` - New headless testing engine
- `architecture_docs` - Architecture decision records
- `ir_spec` - IR specification document check

### Modified Elements
- `documentation` - Added architecture_docs and ir_spec checks
- `devtools` - Clarified dependencies

### Removed Elements
- `browser_runtime` - Replaced with `js_engine` (no WASM)

### Dependency Changes
- All engines now depend on IR specification only
- JS Engine no longer depends on Rust Engine
- Added explicit dependency documentation in comments

## Documentation Changes

### New Files
- `doc/ir-specification.md` - Complete IR format specification
- `doc/architecture/ir-decision.md` - Architecture decision record

### Modified Files
- `doc/README.md` - Updated structure and track descriptions
- `doc/DEVELOPMENT_TRACKS.md` - Complete restructure:
  - Added IR-centric architecture diagram
  - Track 3 renamed to "Rust Engine"
  - Track 4 renamed to "JS Engine" (pure TypeScript)
  - Added Track 5 "Batch Engine"
  - Renumbered Track 6 "Developer Tools"
  - Updated Interface Contracts section
  - Updated Milestone Coordination
- `doc/engine/browser-engine.md` - Removed WASM, pure TypeScript:
  - New overview with design philosophy
  - Updated technology stack
  - New architecture diagram
  - New IR Loading section (replaced WASM Integration)
  - Updated package structure
  - Updated development setup
  - Updated implementation roadmap

## Rationale

See `doc/architecture/ir-decision.md` for full analysis. Key points:

1. **Centralized validation** - Compiler validates once, engines trust IR
2. **Independent development** - Teams can work in parallel
3. **Platform optimization** - Each engine optimized for its target
4. **Easier testing** - IR conformance test suite validates all engines
5. **JavaScript accessibility** - JS developers can contribute without Rust knowledge

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│    ┌──────────────┐                                                 │
│    │   BRL/BCL    │  Track 1: Language Spec                         │
│    │   Source     │                                                 │
│    └──────┬───────┘                                                 │
│           │                                                         │
│           ▼                                                         │
│    ┌──────────────┐                                                 │
│    │   Compiler   │  Track 2: Compile to IR                         │
│    │   (Rust)     │                                                 │
│    └──────┬───────┘                                                 │
│           │                                                         │
│           ▼                                                         │
│    ┌──────────────┐                                                 │
│    │  Blink IR    │  ◄── Central Contract ──────────────────────┐   │
│    │  (JSON)      │                                             │   │
│    └──────┬───────┘                                             │   │
│           │                                                     │   │
│     ┌─────┼─────────────────┬───────────────────┐               │   │
│     │     │                 │                   │               │   │
│     ▼     ▼                 ▼                   ▼               │   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │   │
│  │ Rust Engine │    │  JS Engine  │    │Batch Engine │          │   │
│  │  (Track 3)  │    │  (Track 4)  │    │  (Track 5)  │          │   │
│  │   Native    │    │  TypeScript │    │  Headless   │          │   │
│  └─────────────┘    └─────────────┘    └─────────────┘          │   │
│                                                                 │   │
│  Engines are INDEPENDENT - each implements IR spec              │   │
│                                                                 │   │
└─────────────────────────────────────────────────────────────────────┘
```

## Verification

Run hielements check to verify architecture alignment:

```bash
hielements check hielements.hie
```

Expected: All documentation checks pass. Implementation checks commented out until development starts.
