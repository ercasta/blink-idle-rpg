# Blink Engine & Toolchain Documentation

This folder contains documentation for the Blink game engine and development toolchain.

## Overview

The Blink Engine is responsible for:
- Executing BRL/BCL code
- Managing the game timeline and events
- Maintaining entity-component state
- Providing feedback to players through trackers

## Documents in This Folder

| Document | Description | Target Developers |
|----------|-------------|-------------------|
| [architecture.md](architecture.md) | Core engine architecture | All engine developers |
| [browser-engine.md](browser-engine.md) | Browser implementation | Frontend/JS developers |
| [api/](api/) | API documentation | All developers |

## Implementation Targets

Multiple engine implementations can exist:

| Target | Purpose | Technology | Priority |
|--------|---------|------------|----------|
| **Browser** | Player-facing game client | JavaScript/WASM | High |
| **Batch** | Balance testing | Rust native | Medium |
| **Dev** | Hot-reloading development | Rust + file watching | Medium |
| **Server** | Client-server games | Rust native | Future |

## Toolchain Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        TOOLCHAIN                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ BRL Compiler │    │ BCL          │    │ LSP Server       │  │
│  │   (Rust)     │    │ Interpreter  │    │ (Language        │  │
│  │              │    │              │    │  Support)        │  │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                   │                      │            │
│         ▼                   ▼                      ▼            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Intermediate Representation (IR)             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         ▼                    ▼                    ▼            │
│  ┌─────────────┐     ┌─────────────┐      ┌─────────────┐     │
│  │ JS/WASM     │     │ Native      │      │ Debug       │     │
│  │ Backend     │     │ Backend     │      │ Backend     │     │
│  └─────────────┘     └─────────────┘      └─────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Development Tracks

### Track 1: Core Engine (Rust)
- Timeline implementation
- ECS runtime
- Event scheduling
- Intermediate representation

**Prerequisites**: Rust, ECS patterns  
**Output**: Core library (`blink-core`)

### Track 2: Browser Runtime (JavaScript/WASM)
- JavaScript API
- WASM bindings
- Web worker support
- Rendering integration

**Prerequisites**: Track 1 architecture, JavaScript, WASM  
**Output**: NPM package (`@blink/engine`)

### Track 3: Compiler (Rust)
- BRL parser
- Semantic analysis
- IR generation
- Multiple backends

**Prerequisites**: Track 1 IR definition, Rust, compiler theory  
**Output**: CLI tool (`blink-compiler`)

### Track 4: Developer Tools
- Language Server Protocol
- VS Code extension
- Hot reload server

**Prerequisites**: Track 3 parser, LSP knowledge  
**Output**: VS Code extension

## Getting Started

1. **Understand the architecture**: Read [architecture.md](architecture.md)
2. **Choose your track**: Pick based on expertise
3. **Set up environment**: Follow track-specific setup
4. **Implement interfaces**: Use the API documentation

## Related Documentation

- [Language Specification](../language/README.md) - BRL/BCL reference
- [Project Summary](../summary.md) - High-level overview
