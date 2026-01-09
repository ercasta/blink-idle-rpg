// Final test of fixed game
const { BlinkGame } = require('./packages/blink-engine/dist/index.js');
const { compile } = require('./packages/blink-compiler-ts/dist/index.js');
const fs = require('fs');
const path = require('path');

async function traceGame() {
    console.log('=== Final Game Test ===\n');
    
    const brlContent = fs.readFileSync(path.join(process.cwd(), 'game/brl/classic-rpg.brl'), 'utf8');
    const enemiesContent = fs.readFileSync(path.join(process.cwd(), 'game/bdl/enemies.bdl'), 'utf8');
    const heroesContent = fs.readFileSync(path.join(process.cwd(), 'game/bdl/heroes.bdl'), 'utf8');
    const gameConfigContent = fs.readFileSync(path.join(process.cwd(), 'game/bdl/game-config.bdl'), 'utf8');
    
    const sources = [
        { path: 'classic-rpg.brl', content: brlContent, language: 'brl' },
        { path: 'enemies.bdl', content: enemiesContent, language: 'bdl' },
        { path: 'heroes.bdl', content: heroesContent, language: 'bdl' },
        { path: 'game-config.bdl', content: gameConfigContent, language: 'bdl' },
    ];
    
    const result = compile(sources, { includeSourceMap: true });
    if (result.errors.length > 0) {
        console.error('Compilation errors:');
        for (const err of result.errors) {
            console.error(`  ${err.file}:${err.line}:${err.column}: ${err.message}`);
        }
        return;
    }
    const ir = result.ir;
    console.log(`Compiled successfully: ${ir.rules.length} rules\n`);
    
    const game = await BlinkGame.create({ debug: false });
    
    const filteredIR = {
        ...ir,
        initial_state: {
            entities: ir.initial_state.entities.filter(entity => !entity.components.HeroTemplate)
        }
    };
    
    game.loadRulesFromObject(filteredIR);
    
    // Create 2 test heroes
    for (let i = 0; i < 2; i++) {
        const entityId = 100 + i;
        game.createEntity(entityId);
        game.addComponent(entityId, 'Character', { name: `Hero${i}`, class: 'Warrior', level: 1, experience: 0, experienceToLevel: 100 });
        game.addComponent(entityId, 'Health', { current: 100, max: 100 });
        game.addComponent(entityId, 'Mana', { current: 50, max: 50 });
        game.addComponent(entityId, 'Stats', { strength: 10, dexterity: 10, intelligence: 10, constitution: 10, wisdom: 10 });
        game.addComponent(entityId, 'Combat', { damage: 20, defense: 5, attackSpeed: 1.0, critChance: 0.1, critMultiplier: 1.5 });
        game.addComponent(entityId, 'Target', { entity: null });
        game.addComponent(entityId, 'Team', { id: 'player', isPlayer: true });
        game.addComponent(entityId, 'Skills', { skill1: 'power_strike', skill2: '', skill3: '', skill4: '', skillPoints: 0 });
        game.addComponent(entityId, 'Buffs', { damageBonus: 0, defenseBonus: 0, hasteBonus: 0, shieldAmount: 0, regenAmount: 0 });
    }
    
    // Track events
    const eventCounts = {};
    let totalSteps = 0;
    
    // Schedule GameStart
    game.scheduleEvent('GameStart', 0);
    
    // Run until we get past 15 seconds of game time or 2000 steps
    console.log('=== Running simulation (up to 15s or 2000 steps) ===');
    while (game.hasEvents() && totalSteps < 2000 && game.getTime() < 15.0) {
        const result = game.step();
        totalSteps++;
        if (result) {
            const eventType = result.event.eventType;
            eventCounts[eventType] = (eventCounts[eventType] || 0) + 1;
        }
    }
    
    console.log(`Total steps: ${totalSteps}`);
    console.log(`Simulation time: ${game.getTime().toFixed(2)}s`);
    console.log('\nEvent counts:');
    for (const [event, count] of Object.entries(eventCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${event}: ${count}`);
    }
    
    // Check entity state
    console.log('\n=== Entity State ===');
    const heroes = game.query('Team', 'Health');
    let heroesWithTargets = 0;
    for (const heroId of heroes) {
        const team = game.getComponent(heroId, 'Team');
        const health = game.getComponent(heroId, 'Health');
        const target = game.getComponent(heroId, 'Target');
        const char = game.getComponent(heroId, 'Character');
        if (team?.isPlayer) {
            console.log(`Hero ${heroId}: HP=${health?.current}, Target=${target?.entity}, Level=${char?.level}`);
            if (target?.entity !== null && target?.entity !== undefined) heroesWithTargets++;
        }
    }
    
    // Count enemies
    const enemies = game.query('Enemy', 'Health');
    let spawnedEnemies = 0;
    let aliveEnemies = 0;
    let deadEnemies = 0;
    for (const enemyId of enemies) {
        const template = game.getComponent(enemyId, 'EnemyTemplate');
        if (!template?.isTemplate) {
            const health = game.getComponent(enemyId, 'Health');
            spawnedEnemies++;
            if (health?.current > 0) aliveEnemies++;
            else deadEnemies++;
        }
    }
    console.log(`Spawned enemies: ${spawnedEnemies}, Alive: ${aliveEnemies}, Dead: ${deadEnemies}`);
    
    // Check game state
    const gameStateEntities = game.query('GameState');
    if (gameStateEntities.length > 0) {
        const gs = game.getComponent(gameStateEntities[0], 'GameState');
        console.log(`GameState: wave=${gs?.currentWave}, enemiesDefeated=${gs?.enemiesDefeated}`);
    }
    
    // Analysis
    console.log('\n=== Analysis ===');
    const doAttackCount = eventCounts['DoAttack'] || 0;
    const afterAttackCount = eventCounts['AfterAttack'] || 0;
    const deathCount = eventCounts['Death'] || 0;
    const enemyDefeatedCount = eventCounts['EnemyDefeated'] || 0;
    
    if (afterAttackCount > 0) {
        console.log(`✓ Combat happening: ${afterAttackCount} attacks landed`);
    } else if (doAttackCount > 0) {
        console.log(`❌ ${doAttackCount} DoAttack events but 0 AfterAttack`);
    }
    
    if (deathCount > 0) {
        console.log(`✓ Deaths happening: ${deathCount} deaths`);
    }
    
    if (enemyDefeatedCount > 0) {
        console.log(`✓ Enemies being defeated: ${enemyDefeatedCount} defeated`);
    }
    
    console.log('\n=== Test Complete ===');
}

traceGame().catch(err => {
    console.error('Error:', err.message);
    console.error(err.stack);
});
