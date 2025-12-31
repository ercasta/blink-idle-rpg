# Blink Idle RPG - Combat Demo Release v0.1.0

**First Official Release!** 

This is the first official release of Blink Idle RPG, featuring an interactive combat demonstration showcasing the Blink engine and rule language in action.

## What's Included

### Combat Demo
- **Interactive browser-based combat simulation** between Hero and Goblin
- **No installation required** - just open `combat-demo.html` in your browser!
- Real-time health bars and visual combat feedback
- Adjustable simulation speed (0.5x to 10x)
- Detailed combat log
- Responsive design works on desktop and mobile

### Development Tools

#### Blink Compiler (Rust)
- Command-line compiler that converts BRL (Blink Rule Language) to IR (Intermediate Representation)
- Built with Rust for performance and safety
- **Now with Windows build instructions!** See README.md for details
- Supports debugging tools (token viewer, AST viewer)

#### Blink Engine (JavaScript/TypeScript)
- Browser-based game engine with ECS (Entity-Component-System) architecture
- Event-driven simulation engine
- Component tracking system for UI updates
- TypeScript implementation with type definitions

### Example Files
- `simple-combat.brl` - BRL source for the combat demo
- `simple-combat.ir.json` - Compiled IR version
- `simple-clicker.brl` - Simple clicker game example
- `classic-rpg.ir.json` - Full RPG system IR
- BCL (Blink Choice Language) examples for AI strategies

## Quick Start

### Playing the Demo

1. **Download** the demo package from GitHub Actions or releases
2. **Extract** the files to a folder
3. **Open** `combat-demo.html` in your web browser
4. **Click** "Start Battle" and watch the combat unfold!

That's it! No build process, no installation, no server required.

### For Developers

#### Building the Rust Compiler

**Windows:**
```cmd
# 1. Download Rust installer from https://rustup.rs/
# 2. Run rustup-init.exe and follow the prompts
# 3. Restart your terminal/command prompt
# 4. Verify installation
rustup --version
cargo --version

# 5. Build the compiler
cd src\compiler
cargo build
cargo test
```

**Linux/macOS:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build the compiler
cd src/compiler
cargo build
cargo test
```

#### Building the JavaScript Engine

**All Platforms:**
```bash
# Install Node.js from https://nodejs.org/
# Then build the engine
cd packages/blink-engine
npm install
npm run build
```

## What's New in This Release

### Features
- Interactive combat demo with visual feedback  
- Rust-based BRL compiler with lexer, parser, and IR generator  
- JavaScript game engine with ECS architecture  
- Component tracking system for UI updates  
- Event-driven simulation  
- TypeScript support and type definitions  
- Mobile-responsive design  
- **NEW: Comprehensive Windows build instructions**  
- **NEW: Detailed CHANGELOG documenting the release**  

### Documentation
- Main README with quick start guide
- Compiler documentation with usage examples
- BRL language specification (draft)
- IR specification
- Engine architecture documentation
- **NEW: Windows-specific build instructions and troubleshooting**

## How It Works

The Blink system uses a three-part architecture:

1. **BRL (Blink Rule Language)**: Define game rules, components, and events in human-readable format
2. **Compiler**: Converts BRL to IR (Intermediate Representation) in JSON format
3. **Engine**: Executes the IR to run the game simulation

```
BRL Source → Compiler → IR (JSON) → Engine → Game Simulation
```

The combat demo loads pre-compiled IR and executes it in real-time in your browser!

## Technical Details

- **Rust Compiler Version**: 0.1.0
- **JavaScript Engine Version**: 0.1.0
- **Rust Edition**: 2021
- **TypeScript Version**: 5.3+
- **Node.js**: LTS 18+ recommended
- **Browser Support**: Modern browsers with ES6+ support

### Platforms
- Windows (with new build instructions!)  
- Linux  
- macOS  
- Mobile browsers (iOS, Android)  

## Known Limitations

This is an early release with some limitations:

- BRL specification is still in draft form
- Parser has basic error recovery (some BRL files may not compile)
- Limited number of game examples
- No save/load functionality in demos
- Testing framework present but limited coverage
- BCL (Blink Choice Language) specification not yet complete

## What's Next

Future releases will include:
- Enhanced BRL language features and improved parser
- More game examples and templates
- Save/load system for demos
- Native Rust engine for performance
- Batch engine for game balance testing
- Language Server Protocol (LSP) for IDE support
- VS Code extension for BRL development

## Documentation

Full documentation is available in the repository:
- [Main README](README.md) - Quick start and overview
- [CHANGELOG](CHANGELOG.md) - Detailed version history
- [BRL Specification](doc/language/brl-specification.md) - Rule language details
- [IR Specification](doc/ir-specification.md) - Intermediate representation format
- [Engine Architecture](doc/engine/architecture.md) - How the engine works
- [Compiler README](src/compiler/README.md) - Compiler usage and development

## Reporting Issues

Found a bug or have a suggestion? Please open an issue on GitHub:
https://github.com/ercasta/blink-idle-rpg/issues

## License

MIT License - see [LICENSE](LICENSE) file

---

**Enjoy the combat demo!**

We're excited to share this first release with you. The combat demo showcases the core concepts of Blink Idle RPG, and we can't wait to see what you think!
