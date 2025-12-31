# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-combat-demo] - 2025-01-01

### Added
- **Combat Demo Release**: First official release featuring the interactive combat demo
  - Simple combat system with Hero vs Goblin battle
  - Real-time combat visualization with health bars and animations
  - Combat log showing all battle events
  - Adjustable simulation speed (0.5x to 10x)
  - Responsive design works on desktop and mobile
  - Demo runs directly in browser - no build required!

### Features Included
- **Blink Rule Language (BRL)**: Game rules definition language (specification draft)
- **Blink Compiler**: Rust-based compiler that converts BRL to IR format
  - Lexer with logo-based tokenization
  - Parser for BRL syntax
  - IR Generator producing JSON output
  - CLI tools for compilation and debugging
- **JavaScript Engine**: Browser-based game engine
  - Entity-Component-System (ECS) architecture
  - Event-driven simulation
  - Component tracking system
  - TypeScript implementation
- **Interactive Demo**: Standalone HTML demos
  - Combat demo (simple-combat)
  - RPG demo (classic-rpg)
  - Browser-based, no server required

### Documentation
- Main README with quick start guide
- Compiler README with usage examples
- BRL language specification (draft)
- IR specification
- Engine architecture documentation
- **New**: Windows build instructions for Rust compiler
- **New**: Cross-platform setup guide for Node.js packages

### Examples
- `simple-combat.brl` - Basic combat rules
- `simple-clicker.brl` - Simple clicker game
- `simple-combat.ir.json` - Compiled combat IR
- `classic-rpg.ir.json` - Full RPG system IR
- BCL (Blink Choice Language) examples for party configuration

### Known Limitations
- BRL specification is still in draft form
- Parser has basic error recovery
- Limited game examples
- No save/load functionality in demo
- Testing framework present but limited test coverage

### Technical Details
- Rust compiler version: 0.1.0
- JavaScript engine version: 0.1.0
- Target platforms: Windows, Linux, macOS
- Browser compatibility: Modern browsers with ES6+ support

### Installation
No installation required! Download the demo package and open `combat-demo.html` in your browser.

For development:
- Rust 2021 edition (cargo 1.70+)
- Node.js LTS (18+ recommended)
- TypeScript 5.3+

---

## Future Releases

Planned features for upcoming releases:
- Enhanced BRL language features
- More game examples and templates
- Save/load system
- Multiplayer support exploration
- Native engine (Rust)
- Batch engine for balance testing
- LSP and VS Code extension
