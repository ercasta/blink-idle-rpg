# Game Logic Migration from HTML to BRL

**Date:** 2026-01-02  
**Context:** New requirement to move all game logic and data from HTML to BRL files

## Current Situation

The `game/demos/rpg-demo.html` file contains significant game logic that should be in BRL:

### 1. Enemy Templates (lines 715-775)
```javascript
let enemyTemplates = [
  { name: "Goblin Scout", tier: 1, health: 60, damage: 8, speed: 1.0, exp: 25 },
  { name: "Orc Raider", tier: 2, health: 90, damage: 12, speed: 0.8, exp: 35 },
  // ... 6 more enemy types including Ancient Dragon boss
];
```

**Should be:** Enemy configuration in a separate BRL file (e.g., `game/brl/enemy-data.brl`)

### 2. Enemy Spawning Logic (lines 3075-3140)
```javascript
function spawnEnemy() {
  // Boss spawning logic (every 100 kills)
  // Tier progression based on kills
  // Scaling formulas for health and damage
  // Entity creation and component assignment
  // Random target selection
}
```

**Should be:** BRL rules that handle `SpawnEnemy` events and create entities with components

### 3. Initial Player State (lines 2449-2700+)
The embedded IR contains complete player party setup with stats, skills, etc.

**Should be:** Separate BRL file for initial party configuration

### 4. Wave Progression Logic
Currently in JavaScript:
- Boss spawning every 100 kills
- Tier progression formula: `Math.floor(kills / 50) + 1`
- Scaling: health `* (1 + kills / 200)`, damage `* (1 + kills / 300)`

**Should be:** BRL rules responding to `EnemyDefeated` and calculating next spawn

## Challenges

### BRL Language Limitations

1. **No Initial State in BRL Syntax**
   - BRL defines components and rules, but initial entity creation is done in IR
   - The `initial_state` section of IR is not expressible in current BRL syntax
   - Would need either:
     - BRL syntax extension for initial entities
     - A separate data format that compiles to IR initial_state

2. **Limited Entity Creation**
   - BRL has `create entity { ... }` for runtime entity creation
   - Works fine for enemy spawning during gameplay
   - But initial party setup needs different approach

3. **Random Selection**
   - JavaScript uses `Math.random()` for enemy selection
   - BRL doesn't have randomization built-in
   - Would need random event generation in engine

4. **Configuration Data**
   - Enemy templates are pure data (not behavior)
   - BRL is primarily for rules/behavior
   - Might need a companion data format

## Recommended Approach

### Phase 1: Enemy Spawning Rules (Immediate)
Create `game/brl/enemy-spawning.brl`:
- Rules that respond to `SpawnEnemy` event
- Use `create entity` to spawn enemies
- Set components based on enemy type
- Implement scaling formulas in BRL

### Phase 2: Enemy Templates (Near-term)
Create `game/brl/enemy-data.brl` or `game/data/enemies.json`:
- Store enemy templates as data
- Either extend BRL for data definitions or use JSON
- Compile/transform to be accessible by rules

### Phase 3: Initial State (Longer-term)
- Extend BRL syntax to support initial entity definitions
- OR create a companion `.brldata` file format
- Ensure it compiles to IR's `initial_state` section

### Phase 4: Remove HTML Logic
- HTML should only be UI and engine orchestration
- All game mechanics in BRL
- All game data in BRL or companion data files

## Out of Scope for Current PR

The current PR is focused on **recurring retargeting**, not the full game logic migration. The migration above is a substantial separate task that would require:
- Language design decisions
- Compiler changes
- Extensive testing
- Migration of all existing demos

## Recommendation

File a separate issue for "Move all game logic from HTML to BRL" with the analysis above. This is a larger architectural change that affects:
- BRL language spec
- Compiler implementation  
- Demo structure
- Documentation

The recurring retargeting feature implemented in this PR is complete and independent of the HTML logic migration.
