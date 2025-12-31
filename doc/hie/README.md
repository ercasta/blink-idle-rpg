# Hielements Documentation

This folder contains documentation for using Hielements to describe and enforce the Blink Idle RPG architecture.

## What is Hielements?

**Hielements** is a language for describing and enforcing software architecture. Unlike traditional documentation that becomes stale, Hielements specifications are formally checked against actual code—ensuring architecture stays aligned with reality.

Key benefits:
- 📐 **Formalize architecture** in a declarative language
- ✅ **Enforce architectural rules** via static checks  
- 🔗 **Make relationships explicit** between components
- 🏗️ **Support hierarchical composition** for complex systems
- 🤝 **Enable human-AI collaboration** through structured specs

## Why Use Hielements for Blink?

The Blink project uses Hielements to:

1. **Document the system structure** - Define what elements exist (language, compiler, engine, runtime)
2. **Enforce alignment** - Ensure implementation matches design
3. **Guide AI development** - Provide context for AI assistants
4. **Track evolution** - Keep architecture docs in sync with code

## Documents in This Folder

| Document | Description | Audience |
|----------|-------------|----------|
| [language-reference.md](language-reference.md) | Hielements syntax and concepts | All developers |
| [blink-architecture.md](blink-architecture.md) | How Blink uses Hielements | Blink developers |
| [writing-specs.md](writing-specs.md) | Guide to writing .hie files | Contributors |

## Quick Start

### 1. Install Hielements

```bash
# Install via cargo (Rust package manager)
cargo install hielements

# Or download binary from releases
# https://github.com/ercasta/hielements/releases
```

### 2. Understand the Architecture Spec

The main Blink architecture is defined in `hielements.hie` at the project root:

```hielements
# Example from Blink's hielements.hie
import files
import rust

element blink_project:
    element language:
        scope brl_spec = files.file_selector('doc/language/brl-specification.md')
        scope bcl_spec = files.file_selector('doc/language/bcl-specification.md')
        check files.exists(brl_spec)
        check files.exists(bcl_spec)
    
    element engine:
        scope rust_src = rust.module_selector('src/engine')
        check rust.compiles(rust_src)
```

### 3. Run Checks

```bash
# Validate the architecture
hielements check hielements.hie

# Run all checks
hielements run hielements.hie
```

### 4. Update Specs When Changing Architecture

Per `AGENTS.md`, before making changes:
1. Read `hielements.hie` to understand structure
2. Plan changes in `agent-changelog/`
3. Update `hielements.hie` first
4. Implement the changes
5. Run Hielements checks to ensure alignment

## Development Tracks

Hielements documentation supports parallel development:

| Track | Hielements Role |
|-------|-----------------|
| **Language Design** | Define language spec files exist |
| **Compiler** | Define compiler module structure |
| **Engine** | Define engine component structure |
| **Browser Runtime** | Define package structure |
| **Dev Tools** | Define LSP/extension structure |

## Related Resources

- [Hielements GitHub Repository](https://github.com/ercasta/hielements)
- [Hielements Usage Guide](https://github.com/ercasta/hielements/blob/main/USAGE.md)
- [Hielements Language Reference](https://github.com/ercasta/hielements/blob/main/doc/language_reference.md)
