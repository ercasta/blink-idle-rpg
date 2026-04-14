#!/usr/bin/env node
/**
 * copy-game-files.js
 *
 * Copy BRL and BCL source files from their canonical locations
 * (game/brl/ and game/bcl/) into the React app's public directory
 * so that Vite can serve them at runtime.
 *
 * This eliminates the need to maintain duplicate copies of these files
 * under game/app/public/game-files/.
 *
 * Run before dev or build:
 *   node scripts/copy-game-files.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'game', 'app', 'public', 'game-files');

// BRL files needed at runtime by the web app (fetched via HTTP for display/parsing)
const BRL_SRC = path.join(ROOT, 'game', 'brl');
const BRL_FILES = [
  'classic-rpg.brl',
  'enemies.brl',
  'game-config.brl',
  'hero-classes.brl',
  'heroes.brl',
  'scenario-easy.brl',
  'scenario-normal.brl',
  'scenario-hard.brl',
  'skill-catalog.brl',
];

// BCL files served to the web app
const BCL_SRC = path.join(ROOT, 'game', 'bcl');
const BCL_FILES = [
  'cleric-skills.bcl',
  'mage-skills.bcl',
  'party-config.bcl',
  'rogue-skills.bcl',
  'warrior-skills.bcl',
];

// ── Copy files ──────────────────────────────────────────────────────────────

fs.mkdirSync(DEST, { recursive: true });

let copied = 0;

for (const file of BRL_FILES) {
  const src = path.join(BRL_SRC, file);
  if (!fs.existsSync(src)) {
    console.error(`❌  Missing BRL source: ${path.relative(ROOT, src)}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(DEST, file));
  copied++;
}

for (const file of BCL_FILES) {
  const src = path.join(BCL_SRC, file);
  if (!fs.existsSync(src)) {
    console.error(`❌  Missing BCL source: ${path.relative(ROOT, src)}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(DEST, file));
  copied++;
}

console.log(`✅  Copied ${copied} game files to ${path.relative(ROOT, DEST)}`);
