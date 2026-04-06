#!/usr/bin/env node
/**
 * blink-engine-wasm-js/build.js
 *
 * Builds the WASM module for the Blink Idle RPG web app.
 *
 * Pipeline:
 *   1. Compile BRL game rules → Rust source (via @blink/compiler-ts)
 *   2. Write a temporary Cargo crate with the generated sources +
 *      wasm_entry.rs template + Cargo.toml from template
 *   3. Run wasm-pack to produce a web-target ES module + .wasm binary
 *   4. Copy the build artefacts to the destination directory
 *      (default: game/app/public/wasm/)
 *
 * Prerequisites:
 *   • Rust + cargo   — https://www.rust-lang.org/tools/install
 *   • wasm-pack      — https://rustwasm.github.io/wasm-pack/installer/
 *   • wasm32 target  — `rustup target add wasm32-unknown-unknown`
 *
 * Usage:
 *   node build.js              # release build
 *   node build.js --dev        # debug build (larger .wasm, faster compile)
 *   node build.js --out <dir>  # override output directory
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT      = path.resolve(__dirname, '..', '..');
const RUNTIME_PATH   = path.join(REPO_ROOT, 'packages', 'blink-runtime');
const BRL_DIR        = path.join(REPO_ROOT, 'game', 'brl');
const GENERATED_DIR  = path.join(__dirname, 'generated');
const CRATE_DIR      = path.join(GENERATED_DIR, 'blink-rpg-wasm');

const CARGO_TOML_TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'Cargo.toml.template'),
  'utf8'
);
const WASM_ENTRY_TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'wasm_entry.rs.template'),
  'utf8'
);

// ── Parse CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const outIdx = args.indexOf('--out');
const OUTPUT_DIR = outIdx >= 0 && args[outIdx + 1]
  ? path.resolve(args[outIdx + 1])
  : path.join(REPO_ROOT, 'game', 'app', 'public', 'wasm');

// ── Step 1: Compile BRL → Rust ──────────────────────────────────────────────

console.log('\n[1/4] Compiling BRL game rules to Rust source…');

const { compileToRust } = require(
  path.join(REPO_ROOT, 'packages', 'blink-compiler-ts', 'dist', 'index.js')
);

// The app only needs the component/rule definitions from classic-rpg.brl and
// heroes.brl; entity initial state is set up at runtime by the JS caller.
const BRL_FILES = [
  path.join(BRL_DIR, 'classic-rpg.brl'),
  path.join(BRL_DIR, 'heroes.brl'),
];

const sources = BRL_FILES.map(f => ({
  path: f,
  content: fs.readFileSync(f, 'utf8'),
  language: /** @type {'brl'} */ ('brl'),
}));

const result = compileToRust(sources, { moduleName: 'blink_rpg' });

if (result.errors.length > 0) {
  console.error('\nCompilation errors:');
  result.errors.forEach(e => {
    console.error(`  ${e.file || '?'}:${e.line || '?'}: ${e.message}`);
  });
  process.exit(1);
}

console.log(`  Generated ${result.files.size} Rust source files`);

// ── Step 2: Write generated Cargo crate ─────────────────────────────────────

console.log('\n[2/4] Writing generated Rust crate…');

const srcDir = path.join(CRATE_DIR, 'src');
fs.mkdirSync(srcDir, { recursive: true });

// Write generated source files from the BRL compiler
for (const [filename, content] of result.files) {
  fs.writeFileSync(path.join(srcDir, filename), content);
  console.log(`  src/${filename} (${(content.length / 1024).toFixed(1)} KB)`);
}

// Write the wasm_entry.rs template (adds wasm-bindgen API on top of generated code)
fs.writeFileSync(path.join(srcDir, 'wasm_entry.rs'), WASM_ENTRY_TEMPLATE);
console.log(`  src/wasm_entry.rs (template)`);

// Append wasm_entry module declaration to lib.rs
const libRsPath = path.join(srcDir, 'lib.rs');
let libRs = fs.readFileSync(libRsPath, 'utf8');
libRs += '\n// WASM entry point (wasm-bindgen API)\npub mod wasm_entry;\n';
fs.writeFileSync(libRsPath, libRs);

// Write Cargo.toml from template
const cargoToml = CARGO_TOML_TEMPLATE.replaceAll(
  '{{RUNTIME_PATH}}',
  RUNTIME_PATH.replace(/\\/g, '/')   // use forward slashes on Windows too
);
fs.writeFileSync(path.join(CRATE_DIR, 'Cargo.toml'), cargoToml);
console.log(`  Cargo.toml`);

// ── Step 3: Build with wasm-pack ────────────────────────────────────────────

console.log('\n[3/4] Building WASM module with wasm-pack…');

// Verify prerequisites
function checkTool(cmd, name, hint) {
  try {
    execSync(`${cmd} 2>&1`, { stdio: 'pipe' });
  } catch (e) {
    if (e.status !== 0 || !e.stdout) {
      console.error(`\n❌  ${name} not found. ${hint}`);
      process.exit(1);
    }
  }
}

checkTool(
  'wasm-pack --version',
  'wasm-pack',
  'Install with: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh'
);
checkTool(
  process.platform === 'win32'
    ? 'rustup target list --installed | findstr wasm32-unknown-unknown'
    : 'rustup target list --installed | grep wasm32-unknown-unknown',
  'wasm32 target',
  'Install with: rustup target add wasm32-unknown-unknown'
);

const profile = isDev ? '--dev' : '--release';
const wasmPackCmd = `wasm-pack build ${profile} --target web --out-dir pkg --out-name blink_rpg_wasm`;

console.log(`  $ ${wasmPackCmd}`);
try {
  execSync(wasmPackCmd, {
    cwd: CRATE_DIR,
    stdio: 'inherit',
    timeout: 180_000,  // 3 minutes — typical WASM build takes 1–2 min on first run
  });
} catch (e) {
  console.error('\n❌  wasm-pack build failed (see output above)');
  process.exit(1);
}

// ── Step 4: Copy artefacts to output directory ───────────────────────────────

console.log(`\n[4/4] Copying WASM artefacts to ${OUTPUT_DIR}…`);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const pkgDir = path.join(CRATE_DIR, 'pkg');
const filesToCopy = fs.readdirSync(pkgDir).filter(f =>
  // Copy .wasm, .js, .d.ts, .json files; skip _bg.wasm.d.ts and gitignore
  /\.(wasm|js|d\.ts|json)$/.test(f) && !f.startsWith('.')
);

for (const file of filesToCopy) {
  const src = path.join(pkgDir, file);
  const dest = path.join(OUTPUT_DIR, file);
  fs.copyFileSync(src, dest);
  const size = (fs.statSync(dest).size / 1024).toFixed(1);
  console.log(`  ${file} (${size} KB)`);
}

console.log('\n✅  WASM build complete!');
console.log(`   Artefacts written to: ${OUTPUT_DIR}`);
console.log('   Add the following to your app:\n');
console.log('     import init, { BlinkWasmGame } from \'/wasm/blink_rpg_wasm.js\';');
console.log('     await init();');
console.log('     const game = new BlinkWasmGame();');
