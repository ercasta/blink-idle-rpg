# Blink Compiler

The Blink Compiler parses Blink Rule Language (BRL), Blink Data Language (BDL), and Blink Choice Language (BCL) source code and produces an Intermediate Representation (IR) that can be executed by any Blink engine.

## Architecture

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ BRL/BDL/BCL  │ ──► │    Lexer    │ ──► │    Parser    │ ──► │   Analyzer   │
│   Source     │     └─────────────┘     └──────────────┘     └──────────────┘
└──────────────┘                                                      │
                                                                      ▼
                                                              ┌──────────────┐
                                                              │ IR Generator │
                                                              └──────────────┘
                                                                      │
                                                                      ▼
                                                              ┌──────────────┐
                                                              │   Blink IR   │
                                                              │  (JSON/Bin)  │
                                                              └──────────────┘
```

## Supported Languages

| Language | Extension | Purpose | IR Output |
|----------|-----------|---------|-----------|
| BRL | `.brl` | Game rules, components | `components`, `rules`, `functions` |
| BDL | `.bdl` | Entity data definitions | `initial_state.entities` |
| BCL | `.bcl` | Player strategies (planned) | `choice_functions` (planned) |

## Components

- **Lexer** (`src/lexer/`): Tokenizes BRL/BDL/BCL source code
- **Parser** (`src/parser/`): Builds Abstract Syntax Tree (AST)
- **Analyzer** (`src/analyzer/`): Semantic analysis and type checking
- **IR Generator** (`src/ir/`): Produces the final IR output

## Building

### Prerequisites

**Windows:**
- Install Rust from [https://rustup.rs/](https://rustup.rs/)
  - Download and run `rustup-init.exe`
  - Follow the installer prompts (default options work fine)
  - Restart your terminal/command prompt after installation
- Verify installation: `cargo --version`

**Linux/macOS:**
- Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Verify installation: `cargo --version`

### Build Commands

```bash
cd src/compiler
cargo build
```

**Windows users:** Commands work in both Command Prompt and PowerShell. Use the same syntax as shown above.

## Usage

### CLI

```bash
# Compile BRL to IR
blink-compiler compile -i game.brl -o game.ir.json --pretty

# Compile BRL with BDL entity data included
blink-compiler compile -i game.brl --include enemies.bdl --include heroes.bdl -o game.ir.json --pretty

# Compile with source map for debugging
blink-compiler compile -i game.brl --include data.bdl --source-map -o game.ir.json --pretty

# Check syntax without generating IR
blink-compiler check -i game.brl

# Debug: view tokens
blink-compiler tokens -i game.brl

# Debug: view AST
blink-compiler ast -i game.brl
```

### Multi-File Compilation

The `--include` flag allows combining multiple source files for compilation:

```bash
# Compile BRL with BDL files
blink-compiler compile \
  --input game/brl/classic-rpg.brl \
  --include game/bdl/enemies.bdl \
  --include game/bdl/heroes.bdl \
  --output game/ir/classic-rpg.ir.json \
  --pretty
```

The order matters:
1. BRL files must define components first
2. BDL files use those component definitions to create entities
3. All included files are concatenated and compiled together

**Windows Path Examples:**
```cmd
# Using backslashes (Command Prompt style)
blink-compiler compile -i ..\..\examples\brl\simple-combat.brl -o output.ir.json --pretty

# Using forward slashes (works in PowerShell and Command Prompt)
blink-compiler compile -i ../../examples/brl/simple-combat.brl -o output.ir.json --pretty
```

### Library

```rust
use blink_compiler::{compile, CompilerOptions};

let source = r#"
    component Health {
        current: integer
        maximum: integer
    }

    // Trackers removed from language
"#;

let options = CompilerOptions {
    pretty_print: true,
    ..Default::default()
};

let ir = compile(source, &options)?;
println!("{}", serde_json::to_string_pretty(&ir)?);
```

## IR Format

The compiler produces IR conforming to the [IR Specification](../../doc/ir-specification.md).

### Example: BRL Output

```json
{
  "version": "1.0",
  "module": "unnamed",
  "components": [
    {
      "id": 0,
      "name": "Health",
      "fields": [
        { "name": "current", "type": "number" },
        { "name": "maximum", "type": "number" }
      ]
    }
  ],
  "rules": [],
  "functions": [],
  "trackers": [
    {
      "id": 0,
      "component": "Health",
      "event": "DamageEvent"
    }
  ]
}
```

### Example: BDL Entity Output

When BDL files are included, entities appear in `initial_state`:

```json
{
  "version": "1.0",
  "initial_state": {
    "entities": [
      {
        "id": 0,
        "name": "goblin_scout",
        "components": {
          "Character": {
            "name": "Goblin Scout",
            "class": "Monster"
          },
          "Health": {
            "current": 60,
            "max": 60
          },
          "Enemy": {
            "tier": 1,
            "isBoss": false
          }
        }
      }
    ]
  }
}
```

## Development

### Running Tests

```bash
cargo test
```

### Dependencies

- `logos` - Fast lexer generator
- `chumsky` - Parser combinator library (optional, for future use)
- `serde` / `serde_json` - IR serialization
- `clap` - CLI argument parsing
- `thiserror` - Error handling
- `miette` - Pretty error display

## Related Documentation

- [BRL Specification](../../doc/language/brl-specification.md)
- [BDL Specification](../../doc/language/bdl-specification.md)
- [BCL Specification](../../doc/language/bcl-specification.md)
- [IR Specification](../../doc/ir-specification.md)
- [Development Tracks](../../doc/DEVELOPMENT_TRACKS.md)
