# Blink Idle RPG - Game

This directory contains the Blink Idle RPG game - a complete idle RPG that demonstrates the power of the Blink language ecosystem.

## Files

### Main Game Files

- **classic-rpg.html** - The main game file (renamed from rpg-demo.html)
- **rpg-demo.html** - Legacy name (kept for backward compatibility)
- **rpg-demo.css** - Game styling
- **index.html** - Demo selector page

### JavaScript Bundles

- **blink-engine.bundle.js** - The Blink game engine (compiled from TypeScript)
- **blink-compiler.bundle.js** - The BRL/BDL compiler for in-browser compilation

### Helper Modules (Extracted)

Located in `js/` directory:

- **utils.js** - General utility functions (HTML escaping, formatting, etc.)
- **character-manager.js** - Character and party management logic
- **leaderboard.js** - Leaderboard save/load/export functionality
- **bcl-customization.js** - BCL (AI strategy) customization system
- **game-engine.js** - Game engine initialization and execution

### Documentation

- **ARCHITECTURE.md** - Comprehensive architecture guide explaining:
  - System overview with diagrams
  - Loading and compilation process
  - File structure and organization
  - Data flow
  - Key components
  - Technical details
  
- **COMPILATION.md** - Detailed guide on compilation:
  - What are BRL, BDL, and BCL?
  - The compilation pipeline
  - Pre-compilation vs in-browser compilation
  - How the current game uses compilation
  - Debugging tips

- **README.md** - This file

## Quick Start

### Option 1: Use a Local Web Server

The game must be served from a web server (not opened directly as file://) due to ES6 module imports and CORS restrictions.

**Using Python:**
```bash
cd game/demos
python -m http.server 8000
# Open http://localhost:8000/classic-rpg.html
```

**Using Node.js (npx serve):**
```bash
cd game/demos
npx serve .
# Open http://localhost:3000/classic-rpg.html
```

**Using Node.js (http-server):**
```bash
cd game/demos
npx http-server
# Open http://localhost:8080/classic-rpg.html
```

### Option 2: GitHub Pages

The game is automatically deployed to GitHub Pages:
https://ercasta.github.io/blink-idle-rpg/

## How to Play

1. **Choose a Scenario**
   - Easy: Casual Adventure (slower spawns, lower penalties)
   - Normal: Classic Campaign (balanced difficulty)
   - Hard: Nightmare Mode (fast spawns, harsh penalties)

2. **Select Your Party**
   - Choose 4 heroes from the carousel
   - Each hero has unique stats and abilities
   - Click "Customize Strategy" to modify AI behavior (optional)

3. **Start the Adventure**
   - Click "Start Adventure" to begin
   - Watch your heroes battle waves of enemies
   - Click "Go!" to run simulation in batches
   - Use "Flee Battle" if things get dicey (cooldown applies)

4. **View Results**
   - Game ends when all enemies defeated (Victory) or all heroes die (Defeat)
   - Final time = simulation time + penalties
   - Your run is saved to the leaderboard

## Game Mechanics

### Time System

- **Simulation Time:** In-game time that advances during battle
- **Total Time:** Simulation time + retreat penalties + death penalties
- **Leaderboard Ranking:** Based on total time (fastest wins)

### Penalties

- **Retreat Penalty:** Added when you flee from battle
- **Death Penalty:** Added when a hero dies
- **Cooldowns:** Cannot flee again immediately after retreating

### Progression

- Heroes gain experience and level up
- Enemy difficulty scales with kills
- Boss enemies appear every 100 kills
- Wave counter tracks progression

## Customization

### BCL (Blink Choice Language) Editor

Click "Customize Strategy" on any hero to:

1. **Select a Choice Point** - Different decision points (targeting, skills, healing, fleeing)
2. **Edit the Code** - Modify BCL functions to change AI behavior
3. **Save Changes** - Stored in browser localStorage
4. **Download Delta** - Export your customizations as .bcl file

**Note:** In the current version, BCL customizations are saved but not compiled/executed. A future release will add in-browser BCL compilation so your custom strategies actually affect gameplay!

### Dev Mode

Click "Dev Mode" to enable debugging tools:

- **Step Buttons:** Step through execution one event at a time
- **Source Viewer:** See BRL/BCL/BDL source code
- **Line Highlighting:** Shows which rule is currently executing
- **Debug Info:** Displays current rule name, event type, and source location

## Architecture

The game uses a layered architecture:

```
┌─────────────────────────────────────┐
│         HTML/CSS/JavaScript         │  ← User Interface
├─────────────────────────────────────┤
│      Helper Modules (js/*.js)       │  ← Extracted Logic
├─────────────────────────────────────┤
│    Blink Engine (blink-engine.js)   │  ← Game Simulation
├─────────────────────────────────────┤
│           IR (JSON Data)            │  ← Compiled Rules
└─────────────────────────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a complete explanation.

## Development

### Building the Bundles

The JavaScript bundles are built from TypeScript source:

```bash
# From repository root
make dev-setup

# This builds:
#   - blink-engine.bundle.js from packages/blink-engine
#   - blink-compiler.bundle.js from packages/blink-compiler-ts
```

### Compiling BRL/BDL Files

Game rules and data are pre-compiled to IR (Intermediate Representation):

```bash
# Compile a scenario
npx blink-compiler compile \
  -i game/brl/classic-rpg.brl \
  --bdl game/bdl/heroes.bdl \
  --bdl game/bdl/enemies.bdl \
  --bdl game/bdl/scenario-easy.bdl \
  -o game/ir/classic-rpg-easy.ir.json \
  --source-map \
  --pretty
```

### Modifying the Game

To make changes:

1. **Edit BRL/BDL files** in `game/brl/` and `game/bdl/`
2. **Recompile to IR** using the command above
3. **Refresh browser** to see changes

For JavaScript changes:

1. **Edit HTML file** or helper modules in `js/`
2. **Refresh browser** (no build step needed for these)

## File Structure

```
game/demos/
├── classic-rpg.html          # Main game (NEW NAME)
├── rpg-demo.html             # Legacy name (same file)
├── rpg-demo.css              # Styling
├── blink-engine.bundle.js    # Game engine
├── blink-compiler.bundle.js  # Compiler
├── js/                       # Helper modules (extracted)
│   ├── utils.js
│   ├── character-manager.js
│   ├── leaderboard.js
│   ├── bcl-customization.js
│   └── game-engine.js
├── ARCHITECTURE.md           # Architecture guide
├── COMPILATION.md            # Compilation guide
└── README.md                 # This file
```

## Browser Compatibility

The game requires a modern browser with support for:

- ES6 modules (`import`/`export`)
- `async`/`await`
- `fetch` API
- `localStorage`
- WebAssembly (for future in-browser compilation)

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Game Won't Load

**Problem:** Blank page or "Failed to load IR" error

**Solutions:**
1. Make sure you're using a web server (not file://)
2. Check browser console for errors
3. Verify IR files exist in `game/ir/` directory
4. Try a different browser

### No Heroes Showing

**Problem:** Party selection shows "No Heroes Available"

**Solutions:**
1. Check that IR loaded successfully (browser console)
2. Verify IR has entities with `HeroInfo` component
3. Try a different scenario

### Game Runs Too Fast/Slow

**Problem:** Simulation speed is too fast or too slow

**Solutions:**
1. Adjust the time slider (5s to 500s per batch)
2. Use Dev Mode for step-by-step execution
3. Check if your browser is throttling JavaScript

### BCL Customizations Not Working

**Problem:** Custom strategies don't affect gameplay

**Note:** This is expected! BCL customizations are saved but not yet compiled. A future release will add in-browser BCL compilation. For now, customizations are cosmetic and can be downloaded for later use.

## Contributing

To improve the game:

1. **Report Issues:** Open GitHub issues for bugs or feature requests
2. **Submit PRs:** Code improvements, new features, bug fixes
3. **Add Documentation:** Help others understand the codebase
4. **Create Content:** New BRL rules, heroes, enemies, scenarios

## License

MIT License - see repository root LICENSE file

## Learn More

- **BRL User Guide:** `doc/language/brl-user-guide.md`
- **BCL User Guide:** `doc/language/bcl-user-guide.md`
- **Engine API:** `packages/blink-engine/README.md`
- **Project Overview:** Root `README.md`
