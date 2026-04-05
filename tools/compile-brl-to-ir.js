#!/usr/bin/env node
/**
 * Compile all BRL source files to IR JSON for the web app.
 *
 * Output: game/app/public/ir/classic-rpg.ir.json
 *
 * Usage:
 *   node tools/compile-brl-to-ir.js
 */

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'game/app/public/ir');

// ─── Load compiled compiler ────────────────────────────────────────────────
const { compile } = require(path.join(ROOT, 'packages/blink-compiler-ts/dist/index.js'));

/**
 * Compile a set of BRL files to one merged IR JSON file.
 */
function compileBrlFiles(files, outputName) {
  const sources = files.map(f => ({
    path: f,
    content: fs.readFileSync(f, 'utf8'),
    language: 'brl',
  }));

  const result = compile(sources, { moduleName: outputName });

  if (result.errors.length > 0) {
    console.error(`\n❌ Compilation errors for ${outputName}:`);
    result.errors.forEach(e => {
      const loc = e.file ? `${e.file}:${e.line || '?'}:${e.column || '?'}` : '?';
      console.error(`   ${loc}: ${e.message}`);
    });
    process.exit(1);
  }

  return result.ir;
}

// ─── Ensure output directory exists ───────────────────────────────────────
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Compile classic-rpg (core rules + normal scenario + heroes + enemies) ─
console.log('Compiling classic-rpg.ir.json …');
const classicIR = compileBrlFiles(
  [
    path.join(ROOT, 'game/brl/classic-rpg.brl'),
    path.join(ROOT, 'game/brl/game-config.brl'),
    path.join(ROOT, 'game/brl/heroes.brl'),
    path.join(ROOT, 'game/brl/enemies.brl'),
    path.join(ROOT, 'game/brl/scenario-normal.brl'),
  ],
  'classic-rpg'
);

const classicOut = path.join(OUTPUT_DIR, 'classic-rpg.ir.json');
fs.writeFileSync(classicOut, JSON.stringify(classicIR, null, 2));
console.log(`  → ${classicOut}  (${(fs.statSync(classicOut).size / 1024).toFixed(1)} KB)`);

// ─── Compile easy scenario variant ────────────────────────────────────────
console.log('Compiling scenario-easy.ir.json …');
const easyIR = compileBrlFiles(
  [
    path.join(ROOT, 'game/brl/classic-rpg.brl'),
    path.join(ROOT, 'game/brl/heroes.brl'),
    path.join(ROOT, 'game/brl/enemies.brl'),
    path.join(ROOT, 'game/brl/scenario-easy.brl'),
  ],
  'scenario-easy'
);
const easyOut = path.join(OUTPUT_DIR, 'scenario-easy.ir.json');
fs.writeFileSync(easyOut, JSON.stringify(easyIR, null, 2));
console.log(`  → ${easyOut}  (${(fs.statSync(easyOut).size / 1024).toFixed(1)} KB)`);

// ─── Compile hard scenario variant ────────────────────────────────────────
console.log('Compiling scenario-hard.ir.json …');
const hardIR = compileBrlFiles(
  [
    path.join(ROOT, 'game/brl/classic-rpg.brl'),
    path.join(ROOT, 'game/brl/heroes.brl'),
    path.join(ROOT, 'game/brl/enemies.brl'),
    path.join(ROOT, 'game/brl/scenario-hard.brl'),
  ],
  'scenario-hard'
);
const hardOut = path.join(OUTPUT_DIR, 'scenario-hard.ir.json');
fs.writeFileSync(hardOut, JSON.stringify(hardIR, null, 2));
console.log(`  → ${hardOut}  (${(fs.statSync(hardOut).size / 1024).toFixed(1)} KB)`);

console.log('\n✅ BRL compilation complete.');
