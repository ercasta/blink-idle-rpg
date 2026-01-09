const { compile } = require('./packages/blink-compiler-ts/dist/index.js');
const fs = require('fs');
const path = require('path');

console.log('=== Compiling Classic RPG ===\n');

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
    console.log(`Found ${result.errors.length} errors:\n`);
    for (const err of result.errors) {
        console.log(`${err.file}:${err.line}:${err.column}: ${err.message}`);
    }
} else {
    console.log(`Compiled successfully: ${result.ir.rules.length} rules`);
}
