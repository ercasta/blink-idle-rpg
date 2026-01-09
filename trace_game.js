// Debug find_new_target rule
const { BlinkGame } = require('./packages/blink-engine/dist/index.js');
const { compile } = require('./packages/blink-compiler-ts/dist/index.js');
const fs = require('fs');
const path = require('path');

async function traceGame() {
    console.log('=== Debugging find_new_target rule compilation ===\n');
    
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
    const ir = result.ir;
    
    // Print the find_new_target rule in detail
    const rule = ir.rules.find(r => r.name === 'find_new_target');
    console.log('find_new_target rule:');
    console.log(JSON.stringify(rule, null, 2));
}

traceGame().catch(console.error);
