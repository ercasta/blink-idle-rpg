/**
 * WASM Engine Test Harness
 *
 * End-to-end tests for the BRL → Rust → native compilation pipeline.
 * Tests compile BRL to Rust, build a native test binary, and execute it.
 *
 * Note: These tests compile to native (not WASM) for testing purposes.
 * The WASM target uses the same generated code but targets wasm32.
 */

import { compileToRust, SourceFile } from '@blink/compiler-ts';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RUNTIME_PATH = path.join(REPO_ROOT, 'packages', 'blink-runtime');
const DEMOS_PATH = path.join(REPO_ROOT, 'game', 'demos', 'brl');
const GENERATED_DIR = path.join(REPO_ROOT, 'packages', 'blink-engine-wasm', 'generated');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  output?: string;
}

/**
 * Compile a BRL file to Rust source code using the compiler.
 */
function compileBrlToRust(brlFiles: string[]): Map<string, string> {
  const sources: SourceFile[] = brlFiles.map(f => ({
    path: f,
    content: fs.readFileSync(f, 'utf-8'),
    language: 'brl' as const,
  }));

  const result = compileToRust(sources);

  if (result.errors.length > 0) {
    throw new Error(
      `Compilation errors:\n${result.errors.map(e => `  ${e.file}:${e.line}:${e.column}: ${e.message}`).join('\n')}`
    );
  }

  return result.files;
}

/**
 * Write generated Rust files to a temporary crate directory.
 */
function writeGeneratedCrate(files: Map<string, string>, testName: string): string {
  const crateDir = path.join(GENERATED_DIR, testName);
  const srcDir = path.join(crateDir, 'src');

  fs.mkdirSync(srcDir, { recursive: true });

  // Write Cargo.toml
  fs.writeFileSync(
    path.join(crateDir, 'Cargo.toml'),
    `[package]
name = "blink-game-${testName}"
version = "0.1.0"
edition = "2024"

[lib]
name = "blink_game_${testName}"
path = "src/lib.rs"

[[bin]]
name = "test_game"
path = "src/main.rs"

[dependencies]
blink-runtime = { path = "${RUNTIME_PATH.replace(/\\/g, '/')}" }
serde_json = "1"
`
  );

  // Write generated source files
  for (const [filename, content] of files) {
    fs.writeFileSync(path.join(srcDir, filename), content);
  }

  // Write main.rs test harness
  const mainRs = generateTestMain(testName);
  fs.writeFileSync(path.join(srcDir, 'main.rs'), mainRs);

  return crateDir;
}

/**
 * Generate a main.rs that initializes the game, runs steps, and prints state.
 */
function generateTestMain(testName: string): string {
  // The main.rs lives alongside the lib.rs in the same crate.
  // It uses the crate's own modules via the crate name.
  const crateName = `blink_game_${testName}`;
  return `// Generated test harness for ${testName}
#![allow(dead_code, unused_imports, unused_variables)]

use ${crateName}::*;

fn main() {
    let mut engine = blink_runtime::Engine::new();

    // Initialize the game
    init_game(&mut engine);

    // Schedule the GameStart event
    let game_start_type = engine.interner.intern("GameStart");
    let start_event = blink_runtime::Event::new(game_start_type);
    engine.timeline.schedule_immediate(start_event);

    // Run simulation steps
    let mut steps_run = 0u32;
    let max_steps = 1000u32;

    while engine.has_events() && steps_run < max_steps {
        if step(&mut engine) {
            steps_run += 1;
        } else {
            break;
        }
    }

    // Print results as JSON
    println!("{{");
    println!("  \\"test\\": \\"${testName}\\",");
    println!("  \\"steps_run\\": {},", steps_run);
    println!("  \\"final_time\\": {},", engine.get_time());
    println!("  \\"has_events\\": {},", engine.has_events());
    println!("  \\"status\\": \\"ok\\"");
    println!("}}");
}
`;
}

/**
 * Build the generated crate using cargo.
 */
function buildCrate(crateDir: string): string {
  try {
    const output = execSync('cargo build 2>&1', {
      cwd: crateDir,
      encoding: 'utf-8',
      timeout: 120_000,
    });
    return output;
  } catch (e: any) {
    throw new Error(`Cargo build failed:\n${e.stdout || ''}\n${e.stderr || ''}`);
  }
}

/**
 * Run the compiled test binary.
 */
function runBinary(crateDir: string): string {
  try {
    const output = execSync(
      './target/debug/test_game',
      {
        cwd: crateDir,
        encoding: 'utf-8',
        timeout: 30_000,
      }
    );
    return output.trim();
  } catch (e: any) {
    throw new Error(`Binary execution failed:\n${e.stdout || ''}\n${e.stderr || ''}`);
  }
}

/**
 * Run a single end-to-end test.
 */
function runTest(testName: string, brlFiles: string[]): TestResult {
  try {
    console.log(`\n--- Test: ${testName} ---`);

    // Step 1: Compile BRL to Rust
    console.log('  Compiling BRL to Rust...');
    const files = compileBrlToRust(brlFiles);
    console.log(`  Generated ${files.size} Rust files`);

    // Step 2: Write generated crate
    console.log('  Writing generated crate...');
    const crateDir = writeGeneratedCrate(files, testName);

    // Step 3: Build with cargo
    console.log('  Building with cargo...');
    buildCrate(crateDir);
    console.log('  Build successful!');

    // Step 4: Run the binary
    console.log('  Running test binary...');
    const output = runBinary(crateDir);
    console.log(`  Output: ${output}`);

    // Step 5: Parse and validate output
    const result = JSON.parse(output);
    if (result.status !== 'ok') {
      throw new Error(`Test reported non-ok status: ${result.status}`);
    }
    if (result.steps_run === 0) {
      throw new Error('No simulation steps were run');
    }

    console.log(`  ✓ PASSED (${result.steps_run} steps, time=${result.final_time})`);
    return { name: testName, passed: true, output };
  } catch (e: any) {
    console.error(`  ✗ FAILED: ${e.message}`);
    return { name: testName, passed: false, error: e.message };
  }
}

// ── Main test runner ──

function main() {
  console.log('=== WASM Engine End-to-End Tests ===\n');
  console.log(`Runtime path: ${RUNTIME_PATH}`);
  console.log(`Demos path: ${DEMOS_PATH}`);

  // Clean generated directory
  if (fs.existsSync(GENERATED_DIR)) {
    fs.rmSync(GENERATED_DIR, { recursive: true });
  }
  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  const results: TestResult[] = [];

  // Test 1: Counter demo
  results.push(
    runTest('counter', [path.join(DEMOS_PATH, 'counter.brl')])
  );

  // Test 2: Combat demo
  results.push(
    runTest('combat', [path.join(DEMOS_PATH, 'combat.brl')])
  );

  // Test 3: Functions demo
  results.push(
    runTest('functions', [path.join(DEMOS_PATH, 'functions.brl')])
  );

  // Print summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const r of results) {
    console.log(`  ${r.passed ? '✓' : '✗'} ${r.name}${r.error ? ': ' + r.error.split('\n')[0] : ''}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
