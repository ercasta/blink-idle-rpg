#!/usr/bin/env node
/**
 * Compile all BRL source files to IR JSON for the web app.
 *
 * Output: game/app/public/ir/classic-rpg.ir.json
 *
 * Note: Only the rules/components file (classic-rpg.brl) is compiled to IR.
 * Entity data (heroes, enemies, game state) is set up programmatically at
 * runtime by the SimEngine, following the same pattern as tools/simulate.js.
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

// ─── Compile game rules (classic-rpg.brl + heroes.brl for functions) ──────
// Only the rules/components/functions are needed in the IR.
// Entity initial state (heroes, enemies, game config) is set up
// programmatically at runtime by the SimEngine.
console.log('Compiling classic-rpg.ir.json …');
const classicIR = compileBrlFiles(
  [
    path.join(ROOT, 'game/brl/classic-rpg.brl'),
    path.join(ROOT, 'game/brl/heroes.brl'),
  ],
  'classic-rpg'
);

// Remove all initial_state entities — they are set up at runtime
// to avoid conflicts and allow party customisation.
if (classicIR.initial_state) {
  classicIR.initial_state.entities = [];
}

const classicOut = path.join(OUTPUT_DIR, 'classic-rpg.ir.json');
fs.writeFileSync(classicOut, JSON.stringify(classicIR, null, 2));
console.log(`  → ${classicOut}  (${(fs.statSync(classicOut).size / 1024).toFixed(1)} KB)`);

// ─── Compile standalone demo IR (all BRL files, WITH entities) ────────────
// This is used by the GitHub Pages demo (rpg-demo.html) which loads
// pre-compiled IR instead of compiling BRL at runtime.
const DEMO_OUTPUT_DIR = path.join(ROOT, 'game/demos/ir');
fs.mkdirSync(DEMO_OUTPUT_DIR, { recursive: true });

console.log('Compiling rpg-demo.ir.json (standalone demo with entities) …');
const demoIR = compileBrlFiles(
  [
    path.join(ROOT, 'game/brl/game-config.brl'),
    path.join(ROOT, 'game/brl/heroes.brl'),
    path.join(ROOT, 'game/brl/enemies.brl'),
    path.join(ROOT, 'game/brl/scenario-normal.brl'),
    path.join(ROOT, 'game/brl/classic-rpg.brl'),
  ],
  'rpg-demo'
);

// Keep initial_state entities — the standalone demo needs them
const demoOut = path.join(DEMO_OUTPUT_DIR, 'rpg-demo.ir.json');
fs.writeFileSync(demoOut, JSON.stringify(demoIR, null, 2));
console.log(`  → ${demoOut}  (${(fs.statSync(demoOut).size / 1024).toFixed(1)} KB)`);

console.log('\n✅ BRL compilation complete.');
