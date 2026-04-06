#!/usr/bin/env node
/**
 * install-wasm.js
 *
 * Cross-platform script to copy WASM build artefacts from the generated
 * package into the React app's public directory.
 *
 * Run after `npm run build:wasm`:
 *   node scripts/install-wasm.js
 *
 * Equivalent to `make install-wasm` but works on Windows without make.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC  = path.join(ROOT, 'packages', 'blink-engine-wasm-js', 'generated', 'blink-rpg-wasm', 'pkg');
const DEST = path.join(ROOT, 'game', 'app', 'public', 'wasm');

// Check that the WASM package has been built
if (!fs.existsSync(SRC)) {
  console.error('❌  WASM not built yet — run `npm run build:wasm` first.');
  process.exit(1);
}

// Create destination directory
fs.mkdirSync(DEST, { recursive: true });

// Copy required files
const files = [
  'blink_rpg_wasm.js',
  'blink_rpg_wasm_bg.wasm',
  'blink_rpg_wasm.d.ts',
  'blink_rpg_wasm_bg.wasm.d.ts',
  'package.json',
];

let copied = 0;
for (const file of files) {
  const src = path.join(SRC, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DEST, file));
    const size = fs.statSync(path.join(DEST, file)).size;
    console.log(`  ✓  ${file}  (${(size / 1024).toFixed(1)} KB)`);
    copied++;
  }
}

console.log(`\nInstalled ${copied} files to ${path.relative(ROOT, DEST)}`);
