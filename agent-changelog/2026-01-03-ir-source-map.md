# IR Source Map Implementation

**Date**: 2026-01-03

## Summary
Implemented source map support in the Blink IR format to enable debugging capabilities. The IR now includes the original BRL, BCL, and BDL source files when compiled with the `--source-map` flag.

## Changes Made

### Compiler (Rust)

1. **IR Module Types** (`src/compiler/src/ir/mod.rs`):
   - Added `SourceMap` struct with `files` array
   - Added `SourceFile` struct with `path`, `content`, and `language` fields
   - Added optional `source_map` field to `IRModule`
   - Updated `generate` functions to support additional source files

2. **Compiler Library** (`src/compiler/src/lib.rs`):
   - Added `compile_to_json_with_sources()` function
   - Refactored to use shared `compile_to_typed_ast()` helper to reduce code duplication

3. **Compiler CLI** (`src/compiler/src/main.rs`):
   - Added `--include` flag to include additional source files (BCL, BDL)
   - Updated compile command to collect and pass additional files

### Build Workflows

All three workflow files updated to include BCL and BDL files in source maps:
- `.github/workflows/build-demo-linux.yml`
- `.github/workflows/build-demo-windows.yml`
- `.github/workflows/github-pages.yml`

### HTML Demo

Updated `game/demos/rpg-demo.html`:
- Modified `loadSourceFilesFromIR()` to parse new source_map format
- Supports multiple files of the same language type (concatenated)

## Usage

```bash
# Compile with source map (BRL only)
blink-compiler compile -i game/brl/classic-rpg.brl -o output.ir.json --pretty --source-map

# Compile with BCL and BDL files included
blink-compiler compile -i game/brl/classic-rpg.brl -o output.ir.json --pretty --source-map \
  --include game/bcl/warrior-skills.bcl \
  --include game/bcl/mage-skills.bcl \
  --include game/bdl/heroes.bdl
```

## IR Output Structure

```json
{
  "version": "1.0",
  "module": "unnamed",
  "source_map": {
    "files": [
      {
        "path": "game/brl/classic-rpg.brl",
        "content": "// Full BRL source...",
        "language": "brl"
      },
      {
        "path": "game/bcl/warrior-skills.bcl",
        "content": "// Full BCL source...",
        "language": "bcl"
      },
      {
        "path": "game/bdl/heroes.bdl",
        "content": "// Full BDL source...",
        "language": "bdl"
      }
    ]
  },
  "components": [...],
  "rules": [...],
  ...
}
```

## Related Files
- `src/compiler/src/ir/mod.rs` - IR types and generation
- `src/compiler/src/lib.rs` - Compiler API
- `src/compiler/src/main.rs` - CLI interface
- `game/demos/rpg-demo.html` - HTML demo consumer
