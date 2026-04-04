# Classic RPG Game Analysis

This document provides an in-depth analysis of how the classic RPG game is supposed to run for the first 10 enemy waves, including rules, choices, and events.

## Overview

The Classic RPG is an idle game where heroes automatically battle waves of enemies. The game progresses through tiers of increasing difficulty, with each tier containing multiple waves of enemies. The ultimate goal is to defeat the final boss, Lord Vexar.

## Game Configuration

From `game/bdl/game-config.bdl`:

| Parameter | Value | Description |
|-----------|-------|-------------|
| initialEnemyCount | 5 | Enemies per wave |
| wavesPerTier | 3 | Waves before tier advancement |
| maxTier | 3 | Maximum tier (boss tier) |
| retreatTimePenalty | 60.0 | Time penalty for retreating |
| deathTimePenaltyMultiplier | 2.0 | Multiplier for death penalty |
| fleeCooldown | 300.0 | Cooldown between fleeing |

## Expected Wave Progression (First 10 Waves)

### Wave Timeline

| Wave | Tier | Time (approx) | Enemies | Notes |
|------|------|---------------|---------|-------|
| 1 | 1 | t=0.5-2.5s | 5 Tier 1 | Initial spawn |
| 2 | 1 | t=5s | 5 Tier 1 | After 2s delay |
| 3 | 1 | t=7s | 5 Tier 1 | After 2s delay |
| 4 | 2 | t=9s | 5 Tier 2 | Tier advances |
| 5 | 2 | t=11s | 5 Tier 2 | |
| 6 | 2 | t=13s | 5 Tier 2 | |
| 7 | 3 | t=15s | 5 Tier 3 | Final tier |
| 8 | 3 | t=17s | 5 Tier 3 | |
| 9 | 3 | t=19s | 5 Tier 3 + Boss | Lord Vexar spawns |
| 10+ | N/A | N/A | N/A | No more waves after boss |

### Enemy Tiers

| Tier | Enemy Types |
|------|-------------|
| 1 | Goblin Scout (60 HP, 8 dmg) |
| 2 | Orc Raider (90 HP, 15 dmg), Dark Wolf (75 HP, 12 dmg) |
| 3 | Skeleton Warrior (110 HP, 18 dmg), Dark Mage (80 HP, 22 dmg), Troll Berserker (180 HP, 25 dmg), Demon Knight (250 HP, 30 dmg), Ancient Dragon (400 HP, 35 dmg) |
| Boss | Dragon Lord Vexar (500 HP, 40 dmg) |

## Event Flow

### Game Initialization

1. **GameStart** event triggers:
   - `initialize_hero_attacks`: Each hero schedules their first DoAttack
   - `start_retargeting_system`: Schedules CheckAllTargets in 2s
   - `spawn_initial_enemies`: Schedules 5 SpawnEnemy events staggered by 0.5s

### Combat Loop

```
DoAttack → AfterAttack → (damage applied) → 
  ├─ if target alive: schedule next DoAttack (1s/attackSpeed)
  └─ if target dead: Death event → EnemyDefeated or PlayerDefeated
```

### Target Assignment

```
CheckAllTargets (every 2s) →
  for each entity with Target component:
    if target == null or target.Health <= 0:
      → FindNewTarget event
        → find first living enemy (for players) or player (for enemies)
        → assign Target.entity
        → schedule DoAttack
```

### Wave Progression

```
EnemySpawned event →
  if currentTier == maxTier && !bossSpawned:
    → SpawnLordVexar
    → bossSpawned = true
    → no more wave scheduling
  else:
    → Spawn enemies for this wave
    → advance waveInTier (or advance tier if waveInTier > wavesPerTier)
    → schedule next EnemySpawned in 2s
```

## Rules Analysis

### Key Rules (from `game/brl/classic-rpg.brl`)

#### 1. spawn_initial_enemies
- **Trigger**: GameStart
- **Filter**: entity has SpawnConfig
- **Action**: Initialize wave tracking, schedule 5 SpawnEnemy events

#### 2. spawn_enemy_from_template
- **Trigger**: SpawnEnemy
- **Filter**: entity has SpawnConfig
- **Action**: Clone enemy template matching requested tier

#### 3. attack_rule
- **Trigger**: DoAttack
- **Condition**: entity.Target.entity != null && entity.Health.current > 0
- **Action**: Apply damage, schedule AfterAttack

#### 4. find_new_target
- **Trigger**: FindNewTarget
- **Action**: Find first valid target (living enemy for players, living player for enemies)

#### 5. handle_enemy_spawned
- **Trigger**: EnemySpawned
- **Filter**: entity has GameState && entity has SpawnConfig
- **Action**: Spawn wave enemies, advance tier/wave, schedule next wave

## Issues Found and Fixed

### Issue 1: Rules Firing for All Entities
**Problem**: Rules like `spawn_initial_enemies` fired for all 13+ entities instead of just the GameState entity.

**Solution**: Add `entity has SpawnConfig` filter to ensure single execution.

### Issue 2: Incorrect Component Check Syntax
**Problem**: Code like `if entity.GameState && entity.SpawnConfig` was parsed incorrectly.

**Solution**: Use `if entity has GameState` syntax for component existence checks.

### Issue 3: Invalid Field Access
**Problem**: Code like `seeker.id` or `enemies.count` compiled without errors but failed at runtime.

**Solution**: 
- Added semantic analyzer to catch these at compile time
- Use `seeker` directly (not `.id`) for entity references
- Use `len(enemies)` instead of `.count`

### Issue 4: Event Field Access
**Problem**: `event.seeker` was compiled as a variable reference instead of event field lookup.

**Solution**: Modified compiler to generate `param` expressions for `event.X` syntax.

### Issue 5: Return Statements Ignored
**Problem**: `return` inside conditional blocks was silently ignored because the IR doesn't support early exit.

**Solution**: Restructured code to use nested if-else instead of early returns.

### Issue 6: Local Variable Reassignment
**Problem**: `foundTarget = true` (reassignment) was silently ignored.

**Solution**: Modified compiler to handle identifier assignments by generating `let` actions.

## Testing the Game

Run the game simulation:

```javascript
const { BlinkGame } = require('./packages/blink-engine/dist/index.js');
const { compile } = require('./packages/blink-compiler-ts/dist/index.js');

// Compile game sources
const sources = [
    { path: 'classic-rpg.brl', content: brlContent, language: 'brl' },
    { path: 'enemies.bdl', content: enemiesContent, language: 'bdl' },
    { path: 'heroes.bdl', content: heroesContent, language: 'bdl' },
    { path: 'game-config.bdl', content: gameConfigContent, language: 'bdl' },
];
const result = compile(sources);

// Create game and load rules
const game = await BlinkGame.create();
game.loadRulesFromObject(result.ir);

// Start game
game.scheduleEvent('GameStart', 0);

// Run simulation
while (game.hasEvents()) {
    const result = game.step();
    // Process result...
}
```

## Compiler Improvements

### Semantic Analyzer

The new semantic analyzer (`packages/blink-compiler-ts/src/semantic.ts`) validates:

1. **Variable declarations**: All referenced variables must be declared
2. **Component existence**: Components in `has` and `entities having` must exist
3. **Field access**: Fields in `entity.Component.field` must exist in the component
4. **Function calls**: Called functions must be defined or built-in

### Example Errors Now Caught

```
// Before: silently failed at runtime
// After: compilation error
entity.id  // Error: Invalid field access 'entity.id'
enemies.count  // Error: Invalid field access 'enemies.count'
undeclared_var  // Error: Undeclared variable 'undeclared_var'
entity has UnknownComp  // Error: Unknown component 'UnknownComponent'
```

## Conclusion

The game now compiles correctly and combat is functional:
- Heroes find and attack enemies
- Enemies attack heroes
- Damage is applied correctly
- Waves spawn as expected
- Target reassignment works when targets die

The main improvements were:
1. Fixing BRL syntax to use correct patterns (`entity has Component`, `len()`)
2. Adding semantic validation to catch errors at compile time
3. Fixing compiler bugs in event field access and variable reassignment
4. Restructuring rules to avoid unsupported `return` statements
