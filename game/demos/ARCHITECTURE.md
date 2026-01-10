# Blink Idle RPG - Architecture and Compilation Guide

## Overview

This document explains the architecture of the Blink Idle RPG game, with special focus on the loading and compilation process that happens in your browser.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Loading and Compilation Process](#loading-and-compilation-process)
3. [File Structure](#file-structure)
4. [Data Flow](#data-flow)
5. [Key Components](#key-components)

## Architecture Overview

The Blink Idle RPG is a browser-based game that demonstrates the power of the Blink language ecosystem:

- **BRL (Blink Rule Language)**: Defines game rules, components, and event handlers
- **BDL (Blink Data Language)**: Defines game data (heroes, enemies, scenarios)
- **BCL (Blink Choice Language)**: Defines AI strategies for characters
- **In-Browser Compiler**: TypeScript compiler that runs in the browser
- **Game Engine**: JavaScript engine that executes the compiled IR (Intermediate Representation)

```
┌─────────────────────────────────────────────────────────────┐
│                    Blink Idle RPG Game                      │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  BRL Files  │  │   BDL Files  │  │    BCL Files     │  │
│  │ (Game Rules)│  │ (Game Data)  │  │  (AI Strategies) │  │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬────────┘  │
│         │                │                     │            │
│         └────────────────┴──────────┬──────────┘            │
│                                     ▼                        │
│                      ┌───────────────────────┐              │
│                      │  TypeScript Compiler  │              │
│                      │  (blink-compiler.js)  │              │
│                      └───────────┬───────────┘              │
│                                  ▼                           │
│                      ┌───────────────────────┐              │
│                      │   IR (JSON Object)    │              │
│                      │  Intermediate Repr.   │              │
│                      └───────────┬───────────┘              │
│                                  ▼                           │
│                      ┌───────────────────────┐              │
│                      │    Blink Engine       │              │
│                      │  (blink-engine.js)    │              │
│                      └───────────┬───────────┘              │
│                                  ▼                           │
│                      ┌───────────────────────┐              │
│                      │   Game Simulation     │              │
│                      │  (Heroes vs Enemies)  │              │
│                      └───────────────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

## Loading and Compilation Process

### Phase 1: Scenario Selection

When you open the game, the first screen shows available scenarios (Easy, Normal, Hard). Each scenario:

1. **Loads a pre-compiled IR file** specific to that difficulty
2. The IR file was created by compiling:
   - `classic-rpg.brl` (game rules)
   - `heroes.bdl` (hero definitions)
   - `enemies.bdl` (enemy definitions)
   - `scenario-{difficulty}.bdl` (difficulty-specific configuration)

```
classic-rpg.brl  ─┐
heroes.bdl       ├─> TypeScript Compiler ─> classic-rpg-easy.ir.json
enemies.bdl      │    (Pre-compiled)
scenario-easy.bdl┘
```

**Why pre-compile scenarios?**
- Faster game startup (no compilation wait)
- Each difficulty has different spawn rates, penalties, and balance
- IR files can be cached by the browser

### Phase 2: Party Selection

After selecting a scenario, the IR is loaded and processed:

1. **Extract Hero Data**: The game reads `IR.initial_state.entities` to find all heroes
   - Heroes have `HeroInfo` component and `Team.isPlayer = true`
   - Each hero has stats, description, role, and difficulty rating

2. **Hero Selection UI**: You choose 4 heroes using carousel controls
   - Each slot shows a different hero
   - Arrow buttons cycle through available heroes
   - You cannot select the same hero twice

3. **BCL Customization** (Optional): You can customize each hero's AI strategy
   - Click "Customize Strategy" on any hero
   - Edit choice functions that control targeting, skills, healing, fleeing
   - Customizations are saved to localStorage
   - In the current version, customizations are cosmetic (not executed)
   - Future versions will compile BCL in-browser and merge with IR

### Phase 3: Game Initialization

When you click "Start Adventure":

1. **Load Game Engine**: `blink-engine.js` is loaded (if not already)

2. **Initialize Blink Game**:
   ```javascript
   game = await BlinkEngine.BlinkGame.create({
     debug: false,
     msPerFrame: 100,
     maxEventsPerFrame: 1000
   });
   ```

3. **Load IR Rules**:
   ```javascript
   game.loadRulesFromObject(filteredIR);
   ```

4. **Create Hero Entities**: For each selected hero, the game creates an entity with:
   - Character component (name, class, level)
   - Health component (current/max HP)
   - Mana component (current/max mana)
   - Combat component (damage, defense, attack speed)
   - Skills component (available abilities)
   - Team component (isPlayer = true)

5. **Initialize Game State**: 
   - Run tracking (time, retreats, penalties)
   - Leaderboard integration
   - Event subscriptions

### Phase 4: Game Execution

The game runs in a step-based simulation:

1. **Schedule Initial Event**: `GameStart` event is scheduled at time 0

2. **BRL Rules Execute**: The game engine processes events:
   - `spawn_initial_enemies`: Creates 5 enemies based on spawn configuration
   - `spawn_replacement_enemy`: Spawns new enemies when one is defeated
   - `on_player_death`: Handles character death and respawn
   - `update_combat_stats`: Tracks kills and wave progression

3. **Event Loop**:
   ```javascript
   // User clicks "Go!" to run simulation
   while (game.getTime() < targetTime) {
     game.step();  // Process one event
     updateUI();   // Update character cards and combat log
   }
   ```

4. **UI Updates**: After each batch of steps:
   - Character health/mana bars update
   - Combat log shows attack/death messages
   - Wave counter and stats update
   - Game over conditions checked

### Phase 5: Game Completion

When the game ends (victory or defeat):

1. **Final Stats Calculated**:
   - Total time = simulation time + penalties
   - Penalties come from retreats and deaths

2. **Save to Leaderboard**:
   - Run data saved to localStorage
   - Sorted by completion time (fastest first)
   - Top 100 runs kept

3. **Display Results**:
   - Victory/defeat banner shown
   - Final stats displayed
   - Leaderboard updated

## File Structure

### Source Files (BRL/BDL/BCL)

Located in `/game/brl`, `/game/bdl`, `/game/bcl`:

```
game/
├── brl/
│   └── classic-rpg.brl          # Game rules and logic
├── bdl/
│   ├── heroes.bdl               # Hero definitions
│   ├── enemies.bdl              # Enemy definitions
│   ├── game-config.bdl          # Base game configuration
│   ├── scenario-easy.bdl        # Easy difficulty config
│   ├── scenario-normal.bdl      # Normal difficulty config
│   └── scenario-hard.bdl        # Hard difficulty config
└── bcl/
    ├── warrior-skills.bcl       # Warrior AI strategies
    ├── mage-skills.bcl          # Mage AI strategies
    ├── rogue-skills.bcl         # Rogue AI strategies
    ├── cleric-skills.bcl        # Cleric AI strategies
    └── party-config.bcl         # Party-level strategies
```

### Compiled Files (IR)

Pre-compiled IR files for each scenario:

```
game/ir/
├── classic-rpg-easy.ir.json     # Easy scenario IR
├── classic-rpg-normal.ir.json   # Normal scenario IR
└── classic-rpg-hard.ir.json     # Hard scenario IR
```

### Game Files

```
game/demos/
├── rpg-demo.html               # Main game file (HTML + inline JS)
├── rpg-demo.css               # Game styling
├── blink-engine.bundle.js     # Game engine (compiled from TS)
├── blink-compiler.bundle.js   # BRL compiler (compiled from TS)
└── js/                        # Extracted helper modules
    ├── utils.js               # General utilities
    ├── character-manager.js   # Character/party logic
    ├── leaderboard.js         # Leaderboard management
    ├── bcl-customization.js   # BCL editor logic
    └── game-engine.js         # Game initialization and execution
```

## Data Flow

### Compilation Flow (Pre-build)

```
BRL + BDL Files
     │
     ├─> TypeScript Compiler
     │   (blink-compiler-ts)
     │
     └─> IR JSON File
         (classic-rpg-{difficulty}.ir.json)
```

### Runtime Flow (In-Browser)

```
1. User selects scenario
   └─> Load IR file via fetch()

2. User selects party
   └─> Extract heroes from IR.initial_state.entities

3. User clicks "Start Adventure"
   └─> Initialize BlinkGame
   └─> Load IR rules
   └─> Create hero entities
   └─> Schedule GameStart event

4. Game executes
   └─> Process events in order
   └─> Update UI after each batch
   └─> Check win/lose conditions

5. Game ends
   └─> Calculate final stats
   └─> Save to leaderboard
   └─> Display results
```

## Key Components

### 1. Scenario Selection (`renderScenarios()`)

Creates scenario cards with:
- Difficulty badge (Easy/Normal/Hard)
- Description and stats
- Click handler to select scenario

### 2. Party Selection (`renderCharacterSelection()`)

For each of 4 slots:
- Carousel navigation (left/right arrows)
- Hero card with stats and description
- "Customize Strategy" button
- Validation (can't select same hero twice)

### 3. BCL Customization Modal (`openBclModal()`)

- Lists all choice points for the hero's class
- Shows choice function signature and documentation
- Code editor for customizing AI behavior
- Save/reset buttons
- Download BCL delta file option

### 4. Game Engine Integration (`initGameWithParty()`)

- Creates BlinkGame instance
- Loads IR rules
- Creates entities for selected heroes
- Subscribes to simulation events
- Starts game loop

### 5. UI Update Loop (`updateUI()`)

- Reads component data from game entities
- Updates character cards (health bars, etc.)
- Updates combat log with new events
- Updates status bar (time, wave, kills)
- Checks game over conditions

### 6. Leaderboard (`saveRunToLeaderboard()`)

- Creates run data object
- Saves to localStorage
- Sorts by completion time
- Displays top runs in table
- Export/clear functionality

## Future Enhancements

### In-Browser BCL Compilation

Currently planned for a future release:

1. User edits BCL code in modal
2. Browser-based WASM compiler compiles BCL
3. Generates delta IR with updated choice functions
4. Merges delta IR with base IR
5. Game executes with custom strategies

This will enable:
- True AI customization that affects gameplay
- Hot reload of strategies without page refresh
- Experimentation with different tactics
- Learning tool for BCL language

### In-Browser BRL/BDL Editing

Future release may support:

1. Edit BRL rules in browser
2. Edit BDL data (create custom heroes/enemies)
3. Compile on-the-fly
4. Test changes immediately
5. Export modified game files

## Technical Details

### IR Structure

The IR (Intermediate Representation) is a JSON object with:

```javascript
{
  "components": {
    // Component definitions (Health, Combat, Character, etc.)
  },
  "rules": [
    // Event handlers and game logic
  ],
  "initial_state": {
    "entities": [
      // Pre-defined entities (heroes, enemies, config)
    ]
  },
  "choice_points": [
    // BCL choice function metadata
  ],
  "source_map": {
    "files": [
      // Original BRL/BDL/BCL source code (when compiled with --source-map)
    ]
  }
}
```

### Event Processing

Events are processed in time order:

1. Event scheduled: `game.scheduleEvent('DoAttack', 0.5, { source: entityId })`
2. Event added to priority queue sorted by time
3. `game.step()` processes next event
4. Rule conditions checked: `rule on DoAttack { if entity.Target { ... } }`
5. Rule body executes: damage calculation, schedule next event, etc.
6. UI updates triggered

### Component System

Entities have components that hold data:

```javascript
// Hero entity (ID: 100)
{
  Character: { name: "Aldric the Brave", class: "Warrior", level: 1 },
  Health: { current: 150, max: 150 },
  Combat: { damage: 20, defense: 10, attackSpeed: 1.0 },
  Team: { id: "player", isPlayer: true },
  Target: { entity: null }  // Set dynamically during game
}
```

Rules query entities by component:

```brl
rule on DoAttack {
  if entity.Combat and entity.Target {
    let target = entity.Target.entity
    // Calculate damage and apply to target
  }
}
```

## Debugging

### Dev Mode

Click "Dev Mode" button to enable:

- Step-by-step execution (Step/x10/x100 buttons)
- Current rule name and event type displayed
- Source code viewer with line highlighting
- BRL/BCL/BDL tabs to view original source

### Browser Console

Check console for:

- IR loading status
- Character extraction counts
- Event processing logs (when debug: true)
- Error messages

### Combat Log

In-game log shows:

- Attack events with damage numbers
- Death/respawn messages
- Enemy spawn notifications
- System messages (flee, penalties, etc.)

## Performance

### Optimization Techniques

1. **Batch UI Updates**: Update every 5 steps, not every step
2. **Event Limiting**: Max 1000 events per frame to prevent lockups
3. **Component Queries**: Cached queries for frequently accessed components
4. **Minimal DOM Updates**: Only update changed character cards
5. **Debounced Rendering**: Use `requestAnimationFrame` for smooth updates

### Typical Performance

- 3000+ events per second on modern hardware
- 100 simulation seconds processed in ~2-3 real seconds
- Smooth UI updates with no frame drops

## Conclusion

The Blink Idle RPG demonstrates a complete game development pipeline:

1. **Development**: Write BRL rules and BDL data
2. **Compilation**: Compile to IR (JSON)
3. **Execution**: Run in browser with JS engine
4. **Customization**: Edit BCL strategies (future: compile in-browser)

This architecture enables rapid iteration, easy modding, and a clear separation between game logic (BRL), game data (BDL), and AI behavior (BCL).
