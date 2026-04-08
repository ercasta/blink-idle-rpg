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
const EXAMPLES_PATH = path.join(REPO_ROOT, 'game', 'brl-tests', 'brl');
const GAME_BRL_PATH = path.join(REPO_ROOT, 'game', 'brl');
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
 * For the classic_rpg test, generates an extended harness that reports detailed
 * game state (enemies defeated, checkpoints, score, hero levels, etc.) and
 * supports running multiple games with different seeds.
 */
function generateTestMain(testName: string): string {
  const crateName = `blink_game_${testName}`;

  if (testName === 'classic_rpg') {
    return generateClassicRpgMain(crateName);
  }

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
 * Generate the extended main.rs for the classic RPG full-game test.
 * Runs multiple games with different seeds and reports detailed stats.
 */
function generateClassicRpgMain(crateName: string): string {
  return `// Generated test harness for classic_rpg — multi-game batch runner
#![allow(dead_code, unused_imports, unused_variables)]

use ${crateName}::*;
use ${crateName}::components::*;

fn run_game(seed: u64, max_steps: u32) -> serde_json::Value {
    let mut engine = blink_runtime::Engine::with_seed(seed);

    // Initialize the game
    let named = init_game(&mut engine);

    // Schedule the GameStart event
    let game_start_type = engine.interner.intern("GameStart");
    let start_event = blink_runtime::Event::new(game_start_type);
    engine.timeline.schedule_immediate(start_event);

    // Run simulation steps
    let mut steps_run = 0u32;

    while engine.has_events() && steps_run < max_steps {
        if step(&mut engine) {
            steps_run += 1;
        } else {
            break;
        }

        // Check if game is over to stop early
        if let Some(gs) = engine.world.try_get::<GameState>(named.game_state) {
            if gs.game_over {
                break;
            }
        }
    }

    // Read game state components for detailed reporting
    let gs = engine.world.get::<GameState>(named.game_state).clone();
    let pt = engine.world.get::<ProgressTracker>(named.game_state).clone();
    let rs = engine.world.get::<RunStats>(named.run_stats).clone();
    let score = engine.world.get::<Score>(named.scoring_entity).clone();

    // Read hero levels
    let hero_ids = [named.aldric, named.lyra, named.theron, named.elara];
    let hero_names = ["Aldric", "Lyra", "Theron", "Elara"];
    let mut heroes = Vec::new();
    for i in 0..4 {
        let ch = engine.world.get::<Character>(hero_ids[i]).clone();
        let hp = engine.world.get::<Health>(hero_ids[i]).clone();
        let cb = engine.world.get::<Combat>(hero_ids[i]).clone();
        heroes.push(serde_json::json!({
            "name": hero_names[i],
            "level": ch.level,
            "hp": hp.current,
            "maxHp": hp.max,
            "damage": cb.damage,
            "defense": cb.defense,
        }));
    }

    serde_json::json!({
        "seed": seed,
        "steps_run": steps_run,
        "final_time": engine.get_time(),
        "has_events": engine.has_events(),
        "enemiesDefeated": gs.enemies_defeated,
        "playerDeaths": gs.player_deaths,
        "currentTier": gs.current_tier,
        "gameOver": gs.game_over,
        "victory": gs.victory,
        "bossDefeated": gs.boss_defeated,
        "checkpointsReached": pt.checkpoints_reached,
        "totalCheckpoints": pt.total_checkpoints,
        "score": {
            "total": score.total,
            "killScore": score.kill_score,
            "bossScore": score.boss_score,
            "speedBonus": score.speed_bonus,
            "deathPenaltyTotal": score.death_penalty_total,
            "retreatPenaltyTotal": score.retreat_penalty_total,
            "timePenaltyTotal": score.time_penalty_total,
        },
        "heroes": heroes,
    })
}

fn main() {
    let seeds: Vec<u64> = vec![42, 123, 777, 2024, 31337];
    let max_steps = 1_500_000u32;
    let mut results = Vec::new();

    for &seed in &seeds {
        let result = run_game(seed, max_steps);
        results.push(result);
    }

    // Print summary table to stderr for human readability
    eprintln!("\\n=== Multi-Game Batch Results ({} games, max {} steps) ===", seeds.len(), max_steps);
    eprintln!("{:<8} {:>8} {:>8} {:>6} {:>6} {:>6} {:>8} {:>8}",
        "Seed", "Steps", "Enemies", "Deaths", "Tier", "Chkpts", "Score", "Victory");
    eprintln!("{}", "-".repeat(72));

    let mut total_score: i64 = 0;
    let mut total_enemies: i64 = 0;
    let mut total_deaths: i64 = 0;
    let mut total_checkpoints: i64 = 0;
    let mut all_positive = true;
    let mut all_30_checkpoints = true;

    for r in &results {
        let s = r["score"]["total"].as_i64().unwrap_or(0);
        let e = r["enemiesDefeated"].as_i64().unwrap_or(0);
        let d = r["playerDeaths"].as_i64().unwrap_or(0);
        let t = r["currentTier"].as_i64().unwrap_or(0);
        let c = r["checkpointsReached"].as_i64().unwrap_or(0);
        let v = r["victory"].as_bool().unwrap_or(false);
        let steps = r["steps_run"].as_u64().unwrap_or(0);

        total_score += s;
        total_enemies += e;
        total_deaths += d;
        total_checkpoints += c;
        if s < 0 { all_positive = false; }
        if c < 30 { all_30_checkpoints = false; }

        eprintln!("{:<8} {:>8} {:>8} {:>6} {:>6} {:>6} {:>8} {:>8}",
            r["seed"], steps, e, d, t, c, s, if v { "YES" } else { "no" });
    }

    let n = seeds.len() as i64;
    eprintln!("{}", "-".repeat(72));
    eprintln!("Average: enemies={:.0}, deaths={:.0}, checkpoints={:.0}, score={:.0}",
        total_enemies as f64 / n as f64,
        total_deaths as f64 / n as f64,
        total_checkpoints as f64 / n as f64,
        total_score as f64 / n as f64);
    eprintln!("All scores positive: {}", all_positive);
    eprintln!("All reached 30 checkpoints: {}", all_30_checkpoints);

    // Print combined JSON to stdout
    let output = serde_json::json!({
        "test": "classic_rpg",
        "games": results,
        "summary": {
            "gamesRun": seeds.len(),
            "allScoresPositive": all_positive,
            "all30Checkpoints": all_30_checkpoints,
            "averageScore": total_score as f64 / n as f64,
            "averageEnemies": total_enemies as f64 / n as f64,
            "averageDeaths": total_deaths as f64 / n as f64,
            "averageCheckpoints": total_checkpoints as f64 / n as f64,
        },
        "steps_run": results.iter().map(|r| r["steps_run"].as_u64().unwrap_or(0)).max().unwrap_or(0),
        "final_time": results.last().map(|r| r["final_time"].as_f64().unwrap_or(0.0)).unwrap_or(0.0),
        "has_events": false,
        "status": "ok"
    });

    println!("{}", serde_json::to_string(&output).unwrap());
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
function runBinary(crateDir: string, testName?: string): string {
  try {
    // Classic RPG multi-game test needs much longer timeout
    const timeout = testName === 'classic_rpg' ? 300_000 : 30_000;
    const output = execSync(
      './target/debug/test_game',
      {
        cwd: crateDir,
        encoding: 'utf-8',
        timeout,
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
    const output = runBinary(crateDir, testName);
    console.log(`  Output: ${output.substring(0, 500)}${output.length > 500 ? '...' : ''}`);

    // Step 5: Parse and validate output
    const result = JSON.parse(output);
    if (result.status !== 'ok') {
      throw new Error(`Test reported non-ok status: ${result.status}`);
    }
    if (result.steps_run === 0) {
      throw new Error('No simulation steps were run');
    }

    // Extended validation for classic_rpg multi-game test
    if (testName === 'classic_rpg' && result.summary) {
      const summary = result.summary;
      console.log(`  Games run: ${summary.gamesRun}`);
      console.log(`  Average score: ${summary.averageScore.toFixed(0)}`);
      console.log(`  Average enemies: ${summary.averageEnemies.toFixed(0)}`);
      console.log(`  Average deaths: ${summary.averageDeaths.toFixed(0)}`);
      console.log(`  Average checkpoints: ${summary.averageCheckpoints.toFixed(1)}`);
      console.log(`  All scores positive: ${summary.allScoresPositive}`);
      console.log(`  All 30 checkpoints: ${summary.all30Checkpoints}`);

      if (!summary.allScoresPositive) {
        throw new Error(`Some games had negative scores (average: ${summary.averageScore.toFixed(0)})`);
      }
      if (!summary.all30Checkpoints) {
        throw new Error(`Not all games reached 30 checkpoints (average: ${summary.averageCheckpoints.toFixed(1)})`);
      }
    }

    console.log(`  ✓ PASSED (${result.steps_run} steps)`);
    return { name: testName, passed: true, output };
  } catch (e: any) {
    console.error(`  ✗ FAILED: ${e.message}`);
    return { name: testName, passed: false, error: e.message };
  }
}

// ── Main test runner ──

function main() {
  console.log('=== WASM Engine End-to-End Tests ===\n');
  console.log(`Runtime path:   ${RUNTIME_PATH}`);
  console.log(`BRL tests path: ${EXAMPLES_PATH}`);
  console.log(`Game BRL path:  ${GAME_BRL_PATH}`);

  // Clean generated directory
  if (fs.existsSync(GENERATED_DIR)) {
    fs.rmSync(GENERATED_DIR, { recursive: true });
  }
  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  const results: TestResult[] = [];

  // ── Engine pipeline validation tests (small standalone BRL programs) ──

  // Test 1: Counter — verifies scheduling and component field updates
  results.push(
    runTest('counter', [path.join(EXAMPLES_PATH, 'counter.brl')])
  );

  // Test 2: Combat — verifies entity queries, targeting, damage, conditionals
  results.push(
    runTest('combat', [path.join(EXAMPLES_PATH, 'combat.brl')])
  );

  // Test 3: Functions — verifies user-defined functions and builtins
  results.push(
    runTest('functions', [path.join(EXAMPLES_PATH, 'functions.brl')])
  );

  // ── Full game BRL test ─────────────────────────────────────────────────
  // Compiles the complete game rule set with a normal-difficulty scenario and
  // two test heroes (Warrior + Mage).  Validates the entire pipeline from
  // source BRL through to a working simulation binary.
  //
  // Files compiled (in order):
  //   heroes.brl          — hero AI functions (select_attack_target, etc.)
  //   enemies.brl         — enemy template entities (Goblin Scout … Dragon Lord Vexar)
  //   scenario-normal.brl — game state, spawn config, flee config (normal difficulty)
  //   classic-rpg.brl     — all game rules (combat, levelling, scoring, fleeing …)
  //   test-heroes.brl     — two hero entities (Aldric/Warrior, Lyra/Mage) for testing
  results.push(
    runTest('classic_rpg', [
      path.join(GAME_BRL_PATH, 'heroes.brl'),
      path.join(GAME_BRL_PATH, 'enemies.brl'),
      path.join(GAME_BRL_PATH, 'scenario-normal.brl'),
      path.join(GAME_BRL_PATH, 'classic-rpg.brl'),
      path.join(GAME_BRL_PATH, 'test-heroes.brl'),
    ])
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
