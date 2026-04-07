#!/usr/bin/env node
/**
 * Compile all BRL source files to IR JSON.
 *
 * Outputs:
 *   game/app/public/ir/classic-rpg.ir.json  — rules only (entities set at runtime)
 *   game/brl-tests/ir/classic-rpg-full.ir.json — full game with initial entities
 *
 * The React app uses classic-rpg.ir.json.  Entity data (heroes, enemies, game
 * state) is injected at runtime by WasmSimEngine.ts so the player's party
 * selection and difficulty settings can be applied.
 *
 * classic-rpg-full.ir.json bundles rules + entities for reference / tooling.
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

// ─── Compile standalone IR (all BRL files, WITH entities) ────────────────
// Used by the GitHub Pages deploy and `game/brl-tests/ir/` for reference.
// Includes scenario-normal.brl (NOT game-config.brl — they share entity names
// and are mutually exclusive; scenario files override the defaults).
const BRL_TESTS_OUTPUT_DIR = path.join(ROOT, 'game/brl-tests/ir');
fs.mkdirSync(BRL_TESTS_OUTPUT_DIR, { recursive: true });

console.log('Compiling classic-rpg-full.ir.json (full game with entities) …');
const fullIR = compileBrlFiles(
  [
    path.join(ROOT, 'game/brl/heroes.brl'),
    path.join(ROOT, 'game/brl/enemies.brl'),
    path.join(ROOT, 'game/brl/scenario-normal.brl'),
    path.join(ROOT, 'game/brl/classic-rpg.brl'),
  ],
  'classic-rpg-full'
);

// Keep initial_state entities — this IR includes the full game setup
const fullOut = path.join(BRL_TESTS_OUTPUT_DIR, 'classic-rpg-full.ir.json');
fs.writeFileSync(fullOut, JSON.stringify(fullIR, null, 2));
console.log(`  → ${fullOut}  (${(fs.statSync(fullOut).size / 1024).toFixed(1)} KB)`);

console.log('\n✅ BRL compilation complete.');
