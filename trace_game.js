// Trace to understand exactly what happens when spawn_initial_enemies runs
const { BlinkGame } = require('./packages/blink-engine/dist/index.js');
const { compile } = require('./packages/blink-compiler-ts/dist/index.js');
const fs = require('fs');
const path = require('path');

async function traceGame() {
    console.log('=== Debugging spawn_initial_enemies ===\n');
    
    // Compile the game from source
    const brlContent = fs.readFileSync(path.join(process.cwd(), 'game/brl/classic-rpg.brl'), 'utf8');
    const enemiesContent = fs.readFileSync(path.join(process.cwd(), 'game/bdl/enemies.bdl'), 'utf8');
    const gameConfigContent = fs.readFileSync(path.join(process.cwd(), 'game/bdl/game-config.bdl'), 'utf8');
    
    const sources = [
        { path: 'classic-rpg.brl', content: brlContent, language: 'brl' },
        { path: 'enemies.bdl', content: enemiesContent, language: 'bdl' },
        { path: 'game-config.bdl', content: gameConfigContent, language: 'bdl' },
    ];
    
    const result = compile(sources, { includeSourceMap: true });
    const ir = result.ir;
    
    // Find the spawn_initial_enemies rule
    const rule = ir.rules.find(r => r.name === 'spawn_initial_enemies');
    console.log('spawn_initial_enemies rule actions:');
    console.log(JSON.stringify(rule.actions, null, 2));
}

traceGame().catch(console.error);
