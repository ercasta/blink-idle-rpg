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
 * Resolve import declarations from main.brl to an ordered list of file paths.
 * Import syntax: `import module_name` where `module_name` maps to
 * `<module_name with underscores replaced by hyphens>.brl` in the BRL directory.
 */
function resolveBrlImports(mainFile, brlDir) {
  const content = fs.readFileSync(mainFile, 'utf8');
  const importRe = /^\s*import\s+([\w.]+)/gm;
  const files = [];
  let m;
  while ((m = importRe.exec(content)) !== null) {
    const parts = m[1].split('.');
    const filename = parts.map(p => p.replace(/_/g, '-')).join('/') + '.brl';
    const filepath = path.join(brlDir, filename);
    if (!fs.existsSync(filepath)) {
      console.warn(`  Warning: imported BRL file not found: ${filepath}`);
      continue;
    }
    files.push(filepath);
  }
  return files;
}

const BRL_DIR = path.join(ROOT, 'game/brl');
const MAIN_BRL = path.join(BRL_DIR, 'main.brl');

/**
 * Compile a set of BRL files to one merged IR JSON file.
 */
function compileBrlFiles(files, outputName) {
  const sources = files.map(f => ({
    path: path.basename(f),
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

// ─── Resolve the full ordered list of BRL files from main.brl ─────────────
const allBrlFiles = fs.existsSync(MAIN_BRL)
  ? resolveBrlImports(MAIN_BRL, BRL_DIR)
  : [];

if (allBrlFiles.length === 0) {
  console.error('❌ main.brl not found or contains no imports. Cannot compile BRL.');
  process.exit(1);
}

// ─── Compile game rules (all BRL files for complete component coverage) ──────
// Entity initial state (heroes, enemies, game config) is set up
// programmatically at runtime by the SimEngine.
console.log(`Compiling classic-rpg.ir.json from ${allBrlFiles.length} BRL files …`);
const classicIR = compileBrlFiles(allBrlFiles, 'classic-rpg');

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
const BRL_TESTS_OUTPUT_DIR = path.join(ROOT, 'game/brl-tests/ir');
fs.mkdirSync(BRL_TESTS_OUTPUT_DIR, { recursive: true });

console.log('Compiling classic-rpg-full.ir.json (full game with entities) …');
const fullIR = compileBrlFiles(allBrlFiles, 'classic-rpg-full');

// Keep initial_state entities — this IR includes the full game setup
const fullOut = path.join(BRL_TESTS_OUTPUT_DIR, 'classic-rpg-full.ir.json');
fs.writeFileSync(fullOut, JSON.stringify(fullIR, null, 2));
console.log(`  → ${fullOut}  (${(fs.statSync(fullOut).size / 1024).toFixed(1)} KB)`);

console.log('\n✅ BRL compilation complete.');
