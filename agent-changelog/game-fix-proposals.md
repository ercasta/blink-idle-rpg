# Game Fix Proposals - Classic RPG

## Executive Summary

**Problem:** Heroes load but the game does not run because critical initialization logic is missing from BRL rules and exists only in UI code.

**Root Cause:** The game was designed with UI-driven initialization instead of rule-driven initialization. This makes the game fragile and dependent on each demo implementing initialization correctly.

**Impact:**
- Game won't start automatically
- Retargeting system never activates
- Different demos might behave differently
- Hard to debug and maintain

**Solution:** Add initialization rules to BRL that are triggered by a `GameStart` event, moving all game logic into the rules engine.

## Detailed Proposals

### Proposal #1: Add GameStart Event and Initialization Rules

**Priority:** HIGH - Critical for game to work
**Effort:** Medium (2-3 hours)
**Risk:** Low

#### Problem
The game has no centralized initialization. The UI must manually:
1. Schedule DoAttack events for each hero
2. Spawn initial enemies
3. Assign targets
4. Trigger the retargeting system

If any step is forgotten, the game won't work.

#### Proposed Solution

**Step 1: Define GameStart event trigger in BRL**

The compiler should recognize `GameStart` as a valid event type (it may already be allowed - any string is valid for events).

**Step 2: Add initialization rules to classic-rpg.brl**

```brl
// ============================================================================
// GAME INITIALIZATION RULES
// ============================================================================

// Rule 1: Start hero attacks when game begins
rule initialize_hero_attacks on GameStart {
    if entity.Team.isPlayer && entity.Health.current > 0 {
        // Stagger attacks by 0.1s per hero to avoid perfect synchronization
        let stagger = 0.1 * entity.id
        schedule [delay: stagger] DoAttack {
            source: entity.id
        }
    }
}

// Rule 2: Spawn initial enemies
rule initialize_enemy_wave on GameStart {
    if entity.SpawnConfig.initialEnemyCount > 0 {
        // Emit spawn event for initial wave
        schedule SpawnEnemyWave {
        }
    }
}

// Rule 3: Handle enemy wave spawning
rule spawn_enemy_wave on SpawnEnemyWave {
    if entity.GameState.gameOver == false {
        // Mark that enemies are being spawned
        entity.GameState.currentWave = 1
        
        // Emit event that enemies have spawned
        // This will trigger retargeting system
        schedule EnemySpawned {
            wave: 1
        }
    }
}
```

**Step 3: Update UI to use GameStart event**

In `rpg-demo.html`, replace the manual initialization:

```javascript
// OLD CODE (lines 3131-3145):
// Schedule initial attack events for selected heroes
for (let i = 0; i < selectedCharacters.length; i++) {
    const health = game.getComponent(i, 'Health');
    if (health && health.current > 0) {
        game.scheduleEvent('DoAttack', i * 0.1, { source: i });
    }
}

// Spawn initial set of enemies
spawnInitialEnemies(5);

// NEW CODE:
// Schedule GameStart event - let BRL handle initialization
game.scheduleEvent('GameStart', 0, {});

// Note: Still need UI to spawn enemies for now (see Proposal #4)
// This is a stepping stone - full enemy spawning in BRL is next phase
spawnInitialEnemies(5);

// After spawning, emit EnemySpawned to trigger retargeting
game.scheduleEvent('EnemySpawned', 0.5, { wave: 1 });
```

#### Benefits
- Centralized initialization
- Game logic in one place (BRL)
- Consistent behavior across demos
- Easier to test and debug
- Less code in UI

#### Testing
1. Load demo with 4 heroes
2. Click "Start Battle"
3. Verify heroes immediately start attacking
4. Verify enemies spawn and join combat
5. Verify retargeting system activates

---

### Proposal #2: Fix Retargeting System Activation

**Priority:** HIGH - Critical for continuous combat
**Effort:** Low (30 minutes)
**Risk:** Low

#### Problem
The retargeting system never activates because `EnemySpawned` event is never emitted. This means:
- Dead targets are never replaced
- Attacks stop when target dies
- Combat freezes

Current code:
```brl
rule start_global_retargeting on EnemySpawned {
    // Only start retargeting once, when first enemy spawns
    if entity.GameState.currentWave == 1 && entity.GameState.retargetingActive == false {
        entity.GameState.retargetingActive = true
        // Schedule first retargeting check in 2 seconds
        schedule [delay: 2.0] CheckAllTargets {
        }
    }
}
```

This rule will never fire because `EnemySpawned` is never emitted.

#### Proposed Solution Option A: Emit EnemySpawned from UI

Quick fix - have UI emit the event after spawning enemies:

```javascript
function spawnInitialEnemies(count) {
    const spawnedIds = [];
    for (let i = 0; i < count; i++) {
        spawnedIds.push(spawnEnemy());
    }
    
    // NEW: Emit EnemySpawned event to trigger retargeting
    game.scheduleEvent('EnemySpawned', 0, { wave: 1 });
    
    // Assign hero targets...
}
```

#### Proposed Solution Option B: Start retargeting on GameStart

Alternative - don't depend on EnemySpawned at all:

```brl
rule start_retargeting_system on GameStart {
    if entity.GameState.retargetingActive == false {
        entity.GameState.retargetingActive = true
        // Schedule first retargeting check in 2 seconds
        schedule [delay: 2.0] CheckAllTargets {
        }
    }
}
```

**Recommendation:** Use Option B. It's more robust and doesn't depend on enemy spawning details.

#### Benefits
- Retargeting system works
- Combat continues smoothly
- Dead targets are replaced automatically

#### Testing
1. Start battle
2. Wait for enemy to die
3. Verify heroes retarget to another enemy
4. Verify new enemy is spawned
5. Verify combat continues without manual intervention

---

### Proposal #3: Add Automatic Target Assignment

**Priority:** MEDIUM - Improves robustness
**Effort:** Medium (2 hours)
**Risk:** Medium

#### Problem
When entities spawn, targets are assigned manually by UI code. This logic should be in BRL.

Current UI code (lines 2996-3001):
```javascript
// After spawning enemies, assign hero targets
for (let heroId = 0; heroId <= 3; heroId++) {
    const randomEnemy = spawnedIds[Math.floor(Math.random() * spawnedIds.length)];
    game.setComponentField(heroId, 'Target', 'entity', randomEnemy);
}
```

#### Proposed Solution

Add a `FindNewTarget` rule that actually assigns targets:

```brl
// Rule to find and assign a new target
rule find_new_target on FindNewTarget {
    let seeker = event.seeker
    
    // Determine if seeker is a player or enemy
    let isPlayer = seeker.Team.isPlayer
    
    // Query for potential targets (opposite team)
    let candidates = entities having Team, Health where
        Team.isPlayer != isPlayer &&
        Health.current > 0
    
    // If no candidates, clear target
    if candidates.count == 0 {
        seeker.Target.entity = null
        return
    }
    
    // Select a random target
    let randomIndex = floor(random() * candidates.count)
    let newTarget = candidates[randomIndex]
    
    // Assign the target
    seeker.Target.entity = newTarget
    
    // Schedule an attack if not already attacking
    schedule [delay: 0.1] DoAttack {
        source: seeker.id
    }
}
```

Then update the existing `check_entity_target` rule to actually call this:

```brl
rule check_entity_target on CheckAllTargets {
    // Rule fires for each entity with Target and Health components
    if entity.Health.current > 0 {
        let target = entity.Target.entity
        
        // If no target or target is dead, find a new one
        if target == null || target.Health.current <= 0 {
            schedule FindNewTarget {
                seeker: entity.id
            }
        }
    }
}
```

Update UI to remove manual target assignment:

```javascript
function spawnInitialEnemies(count) {
    const spawnedIds = [];
    for (let i = 0; i < count; i++) {
        spawnedIds.push(spawnEnemy());
    }
    
    // NEW: Let BRL handle target assignment via FindNewTarget events
    // Schedule FindNewTarget for each hero
    for (let heroId = 0; heroId <= 3; heroId++) {
        game.scheduleEvent('FindNewTarget', 0.1, { seeker: heroId });
    }
    
    // Schedule FindNewTarget for each enemy
    for (const enemyId of spawnedIds) {
        game.scheduleEvent('FindNewTarget', 0.1, { seeker: enemyId });
    }
}
```

#### Benefits
- Target assignment logic in BRL, not UI
- Consistent targeting across all demos
- Can implement smarter targeting strategies
- Easier to add targeting preferences (e.g., "attack weakest")

#### Challenges
- Requires BRL support for entity queries (`entities having` syntax)
- May need performance optimization for large entity counts

#### Testing
1. Start battle
2. Verify heroes and enemies pick targets automatically
3. Kill an enemy
4. Verify heroes retarget to new enemy
5. Verify targeting remains balanced (not all targeting same entity)

---

### Proposal #4: Move Enemy Spawning to BRL

**Priority:** LOW - Nice to have
**Effort:** High (4-6 hours)
**Risk:** High

#### Problem
Enemy spawning is entirely in UI code (900+ lines). This makes it:
- Hard to modify spawn logic
- Inconsistent across demos
- Difficult to balance

Current spawning logic:
- Enemy templates hardcoded in UI
- Stats calculation in UI
- Tier progression in UI
- Boss spawning rules in UI

#### Proposed Solution

**Phase 1: Move templates to BDL**

Already done! The `enemies.bdl` file contains all enemy templates.

**Phase 2: Add spawn rules to BRL**

```brl
// Component to track enemy templates
component EnemySpawnState {
    nextEnemyId: integer
    enemyPool: list<id>
}

// Rule to spawn a replacement enemy when one dies
rule spawn_replacement_enemy on EnemyDefeated {
    if entity.GameState.enemiesDefeated < 1000 && entity.GameState.gameOver == false {
        schedule SpawnNewEnemy {
        }
    }
}

// Rule to actually spawn the enemy
rule spawn_new_enemy on SpawnNewEnemy {
    // Select enemy template based on progression
    let kills = entity.GameState.enemiesDefeated
    let tier = min(6, floor(kills / entity.SpawnConfig.tierProgressionKills) + 1)
    
    // Every 100 kills, spawn a boss
    let isBoss = (kills > 0) && (kills % entity.SpawnConfig.bossEveryKills == 0)
    
    // Get compendium of enemy templates
    let compendium = @enemy_compendium
    let templates = compendium.EnemyCompendium.entries
    
    // Filter by tier and boss status
    // (Would need BRL query support)
    let candidates = filter templates where
        Enemy.tier <= tier &&
        Enemy.isBoss == isBoss
    
    // Select random template
    let randomIndex = floor(random() * candidates.count)
    let template = candidates[randomIndex]
    
    // Clone the template entity with scaled stats
    let healthScale = 1 + (kills / entity.SpawnConfig.healthScaleRate)
    let damageScale = 1 + (kills / entity.SpawnConfig.damageScaleRate)
    
    let newEnemy = clone template {
        Health.current = template.Health.max * healthScale
        Health.max = template.Health.max * healthScale
        Combat.damage = template.Combat.damage * damageScale
    }
    
    // Emit that enemy spawned
    schedule EnemySpawned {
        enemy: newEnemy.id
        wave: entity.GameState.currentWave
    }
    
    // Find a target for the new enemy
    schedule FindNewTarget {
        seeker: newEnemy.id
    }
}
```

#### Challenges
- Requires BRL support for entity cloning (`clone` syntax)
- Requires BRL support for entity filtering and queries
- Complex to implement and test
- May have performance implications

#### Benefits
- All game logic in BRL
- Easy to modify spawn rates and difficulty curves
- Consistent across all demos
- Can implement dynamic difficulty adjustment

#### Recommendation
**Defer this to a future iteration.** Focus on Proposals #1-3 first, which provide immediate value with lower risk.

---

### Proposal #5: Add Explicit Game Phases

**Priority:** LOW - Enhancement
**Effort:** Medium (2-3 hours)
**Risk:** Low

#### Problem
The game has implicit phases (initialization, combat, game over) but no explicit state management for them.

#### Proposed Solution

Add a game phase component:

```brl
component GamePhase {
    current: string  // "initializing", "combat", "game_over"
    startTime: float
}
```

Add rules to transition between phases:

```brl
rule enter_initialization on GameStart {
    entity.GamePhase.current = "initializing"
    entity.GamePhase.startTime = simulation_time()
}

rule enter_combat on EnemySpawned {
    if entity.GamePhase.current == "initializing" {
        entity.GamePhase.current = "combat"
        entity.GamePhase.startTime = simulation_time()
    }
}

rule enter_game_over on GameOver {
    entity.GamePhase.current = "game_over"
    entity.GamePhase.startTime = simulation_time()
}
```

Use phases to control behavior:

```brl
rule attack_rule on DoAttack {
    // Only attack during combat phase
    if entity.GamePhase.current != "combat" {
        return
    }
    
    // ... rest of attack logic
}
```

#### Benefits
- Explicit state management
- Easier to add pre-combat and post-combat logic
- Better debugging (can see current phase)
- Could add pause/resume functionality

#### Challenges
- Adds complexity
- May not be necessary for current game design

#### Recommendation
**Defer this.** Current implicit phases work fine. Consider this if adding features like:
- Pre-battle buff selection
- Post-battle loot distribution
- Multiple combat rounds

---

## Implementation Roadmap

### Immediate (This PR)
1. ✅ Create documentation (this file)
2. ✅ Create diagrams
3. ✅ Analyze issues

### Phase 1: Minimum Viable Fix (Next PR)
1. Implement Proposal #1 (GameStart initialization)
2. Implement Proposal #2 (Fix retargeting activation)
3. Test thoroughly
4. Update documentation

### Phase 2: Robustness Improvements (Later PR)
1. Implement Proposal #3 (Automatic target assignment)
2. Add more comprehensive testing
3. Performance optimization

### Phase 3: Full BRL Migration (Future)
1. Implement Proposal #4 (Enemy spawning in BRL)
2. Implement Proposal #5 (Game phases) if needed
3. Remove all game logic from UI code

---

## Testing Strategy

### Unit Tests
- Test each rule individually
- Mock entity states
- Verify rule conditions trigger correctly

### Integration Tests
- Test full game flow from start to finish
- Test victory condition (5 kills)
- Test defeat condition (all heroes dead)
- Test retargeting system
- Test level up progression

### Performance Tests
- Test with 1000+ kills
- Measure event processing time
- Verify no memory leaks
- Check UI responsiveness

### Regression Tests
- Verify existing demos still work
- Check leaderboard functionality
- Verify BCL customization
- Test dev mode features

---

## Risk Assessment

### Proposal #1: GameStart Initialization
- **Risk:** LOW
- **Impact:** HIGH
- **Confidence:** 95%
- **Mitigation:** Thorough testing, can rollback easily

### Proposal #2: Fix Retargeting
- **Risk:** LOW
- **Impact:** HIGH  
- **Confidence:** 95%
- **Mitigation:** Simple change, easy to verify

### Proposal #3: Auto Target Assignment
- **Risk:** MEDIUM
- **Impact:** MEDIUM
- **Confidence:** 80%
- **Mitigation:** Extensive testing, gradual rollout

### Proposal #4: Enemy Spawning in BRL
- **Risk:** HIGH
- **Impact:** MEDIUM
- **Confidence:** 60%
- **Mitigation:** Defer until BRL language supports needed features

### Proposal #5: Game Phases
- **Risk:** LOW
- **Impact:** LOW
- **Confidence:** 90%
- **Mitigation:** Optional enhancement, can skip entirely

---

## Conclusion

The game is mostly working but lacks proper initialization. The immediate fixes (Proposals #1-2) are:
1. Low risk
2. High impact
3. Easy to implement
4. Well-tested

These changes will make the game robust and maintainable while moving toward the goal of having all game logic in BRL rules.

**Recommendation:** Implement Proposals #1 and #2 immediately. Defer #3-5 to future iterations based on need and BRL language capabilities.
