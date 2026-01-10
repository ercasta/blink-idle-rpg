# Understanding the Blink Compilation Process

This document explains how Blink language files (BRL, BDL, BCL) are compiled and executed in the browser.

## The Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│                  Blink Language Ecosystem                    │
└─────────────────────────────────────────────────────────────┘

  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │   .brl   │   │   .bdl   │   │   .bcl   │
  │  (Rules) │   │  (Data)  │   │(Strategy)│
  └────┬─────┘   └────┬─────┘   └────┬─────┘
       │              │              │
       └──────────────┴──────────────┘
                      │
                      ▼
          ┌────────────────────┐
          │ Blink Compiler     │
          │ (TypeScript/WASM)  │
          └──────────┬─────────┘
                     │
                     ▼
          ┌────────────────────┐
          │  IR (JSON format)  │
          │ Intermediate Repr. │
          └──────────┬─────────┘
                     │
                     ▼
          ┌────────────────────┐
          │  Blink Engine      │
          │  (JavaScript)      │
          └──────────┬─────────┘
                     │
                     ▼
          ┌────────────────────┐
          │   Game Execution   │
          └────────────────────┘
```

## What Are BRL, BDL, and BCL?

### BRL (Blink Rule Language)

**Purpose:** Defines game logic and rules

**Example:**
```brl
// File: classic-rpg.brl

component Health {
  current: number
  max: number
}

component Combat {
  damage: number
  defense: number
  attackSpeed: number
}

rule on DoAttack {
  if entity.Combat and entity.Target {
    let target = entity.Target.entity
    let damage = entity.Combat.damage
    schedule DealDamage after 0.1 { target: target, amount: damage }
  }
}

rule on DealDamage {
  if entity.Health {
    entity.Health.current -= event.amount
    if entity.Health.current <= 0 {
      schedule CharacterDeath after 0.1 { entity: entity.id }
    }
  }
}
```

**Key Concepts:**
- **Components:** Data structures attached to entities (Health, Combat, Character, etc.)
- **Rules:** Event handlers that define what happens when events occur
- **Events:** Trigger game logic (DoAttack, DealDamage, CharacterDeath, etc.)
- **Entities:** Game objects that have components (heroes, enemies, config)

### BDL (Blink Data Language)

**Purpose:** Defines initial game state and configuration

**Example:**
```bdl
// File: heroes.bdl

entity aldric {
  Character { name: "Aldric the Brave", class: "Warrior", level: 1 }
  Health { current: 150, max: 150 }
  Combat { damage: 20, defense: 10, attackSpeed: 1.0 }
  Team { id: "player", isPlayer: true }
  HeroInfo {
    description: "A mighty warrior with great strength",
    role: "Tank",
    difficulty: "Easy"
  }
}

entity lyra {
  Character { name: "Lyra Brightstar", class: "Mage", level: 1 }
  Health { current: 80, max: 80 }
  Mana { current: 100, max: 100 }
  Combat { damage: 35, defense: 3, attackSpeed: 0.7 }
  Team { id: "player", isPlayer: true }
  HeroInfo {
    description: "A powerful mage who wields destructive magic",
    role: "Damage Dealer",
    difficulty: "Hard"
  }
}
```

**Key Concepts:**
- **Entity Definitions:** Pre-defined game objects with components
- **Initial State:** Starting values for heroes, enemies, and configuration
- **Multiple BDL Files:** Can split data across files (heroes.bdl, enemies.bdl, config.bdl)

### BCL (Blink Choice Language)

**Purpose:** Defines AI decision-making strategies

**Example:**
```bcl
// File: warrior-skills.bcl

// Choose which enemy to attack
choice fn select_attack_target(character: Character, enemies: list): id {
  let lowestHealth = enemies[0]
  for enemy in enemies {
    if enemy.Health.current < lowestHealth.Health.current {
      lowestHealth = enemy
    }
  }
  return lowestHealth.id
}

// Decide whether to flee from battle
choice fn should_flee_from_battle(party: list, enemies: list, runStats: RunStats): boolean {
  let totalHealth = 0.0
  let totalMaxHealth = 0.0
  
  for hero in party {
    totalHealth += hero.Health.current
    totalMaxHealth += hero.Health.max
  }
  
  let avgHealth = totalHealth / totalMaxHealth
  
  // Flee if party health below 30%
  if avgHealth < 0.3 {
    return true
  }
  
  return false
}
```

**Key Concepts:**
- **Choice Functions:** Player-defined decision logic
- **Bound to Entities:** Each entity can have custom choice functions
- **Future Feature:** Browser-based compilation (not yet implemented)

## The Compilation Pipeline

### Step 1: Write Source Files

Game developers write three types of files:

1. **classic-rpg.brl** - Game rules and components
2. **heroes.bdl + enemies.bdl + config.bdl** - Game data
3. **warrior-skills.bcl + mage-skills.bcl + ...** - AI strategies

### Step 2: Compile to IR

The Blink compiler combines all files and generates an IR (Intermediate Representation):

```bash
# Command line compilation (pre-build step)
npx blink-compiler compile \
  -i game/brl/classic-rpg.brl \
  --bdl game/bdl/heroes.bdl \
  --bdl game/bdl/enemies.bdl \
  --bdl game/bdl/scenario-easy.bdl \
  -o game/ir/classic-rpg-easy.ir.json \
  --source-map \
  --pretty
```

**What happens during compilation:**

1. **Lexing:** Source code → tokens
2. **Parsing:** Tokens → Abstract Syntax Tree (AST)
3. **Semantic Analysis:** Validate rules, check types
4. **IR Generation:** AST → JSON structure
5. **Optimization:** Simplify IR, remove dead code

**Output: IR JSON File**

```json
{
  "components": {
    "Health": {
      "fields": {
        "current": { "type": "number" },
        "max": { "type": "number" }
      }
    },
    "Combat": { ... }
  },
  "rules": [
    {
      "name": "attack_rule",
      "trigger": { "event": "DoAttack" },
      "condition": "entity.Combat && entity.Target",
      "body": { ... }
    }
  ],
  "initial_state": {
    "entities": [
      {
        "id": "aldric",
        "components": {
          "Character": { "name": "Aldric the Brave", ... },
          "Health": { "current": 150, "max": 150 },
          ...
        }
      }
    ]
  }
}
```

### Step 3: Load in Browser

When you open the game:

```javascript
// Fetch pre-compiled IR
const response = await fetch('classic-rpg-easy.ir.json');
const ir = await response.json();

console.log('Loaded IR:', ir);
// IR contains:
//   - Component definitions
//   - Rule definitions  
//   - Initial entities (heroes, enemies, config)
//   - Choice point metadata (for BCL)
```

### Step 4: Execute with Engine

The Blink Engine loads the IR and executes it:

```javascript
// Create game instance
const game = await BlinkEngine.BlinkGame.create({
  msPerFrame: 100,
  maxEventsPerFrame: 1000
});

// Load IR rules
game.loadRulesFromObject(ir);

// Create initial entities
ir.initial_state.entities.forEach(entity => {
  game.createEntity(entity.id);
  // Add components...
});

// Schedule initial event
game.scheduleEvent('GameStart', 0);

// Run simulation
while (game.hasEvents()) {
  game.step();  // Process one event
}
```

## Compilation Modes

### Pre-Compilation (Current)

**Where:** Build step (before deployment)
**Tool:** `blink-compiler-ts` (TypeScript compiler)
**Output:** IR JSON files deployed with game

**Advantages:**
- Fast game startup (no compilation wait)
- Multiple scenarios pre-compiled with different configs
- IR can be cached by browser

**Disadvantages:**
- Cannot edit BRL/BDL in browser
- Changes require recompilation and redeployment

### In-Browser Compilation (Planned)

**Where:** Browser (during gameplay)
**Tool:** `blink-compiler-wasm` (future WebAssembly compiler)
**Output:** IR generated in memory

**Advantages:**
- Edit BRL/BDL/BCL directly in browser
- See changes immediately (hot reload)
- No build step for simple changes
- Great for learning and experimentation

**Disadvantages:**
- Compilation takes time (5-10 seconds)
- Larger initial download (compiler WASM file)
- More complex error handling

**Future Example:**
```javascript
// Load compiler WASM module
const compiler = await BlinkCompiler.init();

// Compile in browser
const brlCode = document.getElementById('brl-editor').value;
const bdlCode = document.getElementById('bdl-editor').value;

const ir = await compiler.compile({
  files: [
    { path: 'game.brl', content: brlCode },
    { path: 'data.bdl', content: bdlCode }
  ]
});

// Load and run immediately
game.loadRulesFromObject(ir);
```

## How the Current Game Uses Compilation

### Scenario Selection

Each difficulty has a pre-compiled IR file:

1. **classic-rpg-easy.ir.json**
   - Compiles: `classic-rpg.brl` + `heroes.bdl` + `enemies.bdl` + `scenario-easy.bdl`
   - Easy spawns, low penalties, beginner-friendly

2. **classic-rpg-normal.ir.json**
   - Compiles: `classic-rpg.brl` + `heroes.bdl` + `enemies.bdl` + `scenario-normal.bdl`
   - Balanced difficulty

3. **classic-rpg-hard.ir.json**
   - Compiles: `classic-rpg.brl` + `heroes.bdl` + `enemies.bdl` + `scenario-hard.bdl`
   - Fast spawns, high penalties, challenging

**Scenario-specific BDL:**
```bdl
// scenario-easy.bdl
entity game_config {
  SpawnConfig {
    initialEnemyCount: 3
    spawnDelaySeconds: 8.0
  }
  FleeConfig {
    fleeCooldownSeconds: 5.0
    fleeTimePenaltySeconds: 10.0
  }
  DeathConfig {
    respawnDelaySeconds: 5.0
    deathTimePenaltySeconds: 20.0
  }
}

// scenario-hard.bdl
entity game_config {
  SpawnConfig {
    initialEnemyCount: 5
    spawnDelaySeconds: 3.0  // Faster spawns!
  }
  FleeConfig {
    fleeCooldownSeconds: 10.0
    fleeTimePenaltySeconds: 30.0  // Harsher penalty!
  }
  DeathConfig {
    respawnDelaySeconds: 8.0
    deathTimePenaltySeconds: 60.0  // Much harsher!
  }
}
```

### Party Selection

Heroes are extracted from `IR.initial_state.entities`:

```javascript
// Find all heroes in IR
const heroes = ir.initial_state.entities.filter(entity => {
  return entity.components.HeroInfo && 
         entity.components.Team.isPlayer === true;
});

// Display in UI
heroes.forEach(hero => {
  renderHeroCard({
    name: hero.components.Character.name,
    health: hero.components.Health.max,
    damage: hero.components.Combat.damage,
    description: hero.components.HeroInfo.description
  });
});
```

### Game Execution

The engine processes rules in event order:

```javascript
// Schedule initial event
game.scheduleEvent('GameStart', 0);

// Events trigger rules
// GameStart → spawn_initial_enemies rule
// EnemySpawned → assign_player_targets rule
// (time passes) → DoAttack events
// DoAttack → DealDamage events
// DealDamage → CharacterDeath events (if health <= 0)
// CharacterDeath → spawn_replacement_enemy rule (for enemies)
// CharacterDeath → respawn_player rule (for heroes)
```

## Debugging Tips

### Check Compilation Errors

If IR fails to load, check browser console:

```javascript
console.error('Failed to load IR:', error);
// Look for:
//   - 404 errors (file not found)
//   - JSON parse errors (malformed IR)
//   - Network errors (CORS, connection issues)
```

### Inspect IR Structure

```javascript
console.log('IR Components:', Object.keys(ir.components));
console.log('IR Rules:', ir.rules.length);
console.log('Initial Entities:', ir.initial_state.entities.length);

// Find specific entity
const aldric = ir.initial_state.entities.find(e => e.id === 'aldric');
console.log('Aldric:', aldric);
```

### Track Rule Execution

Enable debug mode to see rule firing:

```javascript
const game = await BlinkEngine.BlinkGame.create({
  debug: true  // Logs every rule execution
});

// Console output:
// [DEBUG] Rule 'spawn_initial_enemies' triggered at t=0.00
// [DEBUG] Rule 'assign_player_targets' triggered at t=0.05
// [DEBUG] Rule 'attack_rule' triggered at t=0.10
```

### Dev Mode

Use the in-game Dev Mode to:

1. Step through events one at a time
2. See which rule is executing
3. View source code with line highlighting
4. Inspect entity state after each step

## Summary

The Blink compilation process:

1. **Write:** BRL (rules) + BDL (data) + BCL (strategies)
2. **Compile:** TypeScript compiler → IR JSON
3. **Load:** Browser fetches IR file
4. **Execute:** Blink Engine runs IR as game simulation

This architecture enables:
- **Fast compilation** (seconds, not minutes)
- **Easy modding** (change BDL, recompile, play)
- **Cross-platform** (IR runs on any engine: JS, Rust, etc.)
- **Future in-browser editing** (WASM compiler coming soon)

For more details, see [ARCHITECTURE.md](./ARCHITECTURE.md).
