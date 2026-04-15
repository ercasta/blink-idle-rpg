#!/usr/bin/env node
/**
 * copy-game-files.js
 *
 * Copy BCL source files from game/bcl/ into the React app's public directory
 * so that Vite can serve them at runtime.
 *
 * BRL entity data is no longer served as raw BRL source.  Instead,
 * `scripts/compile-game-data.js` compiles BRL entity data to pre-parsed JSON
 * files under `public/game-data/`.  Run that script (or `npm run compile-game-data`)
 * to regenerate the JSON after changing BRL content files.
 *
 * Run before dev or build:
 *   node scripts/copy-game-files.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'game', 'app', 'public', 'game-files');

// BCL files served to the web app
const BCL_SRC = path.join(ROOT, 'game', 'bcl');
const BCL_FILES = [
  'cleric-skills.bcl',
  'mage-skills.bcl',
  'party-config.bcl',
  'rogue-skills.bcl',
  'warrior-skills.bcl',
];

// ── Copy BCL files ──────────────────────────────────────────────────────────

fs.mkdirSync(DEST, { recursive: true });

let copied = 0;

for (const file of BCL_FILES) {
  const src = path.join(BCL_SRC, file);
  if (!fs.existsSync(src)) {
    console.error(`❌  Missing BCL source: ${path.relative(ROOT, src)}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(DEST, file));
  copied++;
}

console.log(`✅  Copied ${copied} BCL files to ${path.relative(ROOT, DEST)}`);

