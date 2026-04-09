#!/usr/bin/env node
/**
 * Blink Idle RPG — Massive Test Harness
 *
 * A callable tool for agents and humans to validate game design properties
 * through predefined simulation scenarios and configurable checks.
 *
 * The harness:
 *   1. Loads simulation scenarios from game/data/test-scenarios.json
 *   2. Loads validation checks   from game/data/test-checks.json
 *   3. Compiles BRL → Rust → native binary (reuses tools/simulate.js infra)
 *   4. Runs every scenario (collecting per-run results and KPIs)
 *   5. Evaluates all checks against the collected results
 *   6. On check failure, reruns ALL simulations and retries ONLY failed checks
 *   7. Repeats up to N times (configurable, default 3)
 *   8. Reports results — all failures with descriptions; optionally passed checks
 *
 * Usage:
 *   node tools/massive-test-harness.js [options]
 *
 * Options:
 *   --retries N       Max retry attempts for failed checks (default: 3)
 *   --show-passed     Also report passed checks in output
 *   --verbose         Show per-run simulation details
 *   --data DIR        Game data directory (default: game/data)
 *   --scenarios FILE  Override scenarios file path
 *   --checks FILE     Override checks file path
 *   --json            Output structured JSON for programmatic consumption
 *   --rebuild         Force recompile of native binary
 *
 * Exit codes:
 *   0  All checks passed
 *   1  Some checks failed
 *   2  Tool error (compilation, I/O, etc.)
 *
 * Module API:
 *   const { runHarness } = require('./tools/massive-test-harness');
 *   const result = runHarness({ retries: 3, showPassed: true });
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const os   = require('os');

const ROOT             = path.join(__dirname, '..');
const DEFAULT_DATA_DIR = path.join(ROOT, 'game', 'data');

// Match the e2e test step limit (packages/blink-engine-wasm/tests/e2e-test.ts)
const DEFAULT_MAX_STEPS = 5000000;

// Seed offset per retry — keeps each attempt's seed range non-overlapping
// (scenario.runs is at most ~20, so 10 000 is a safe margin)
const SEED_OFFSET_STEP = 10000;

const {
  ensureBinary,
  runOneSimulationAsync,
  aggregateKPIs,
  loadGameData,
  buildHeroJson,
  buildEnemyJson,
  buildConfigEntities,
  applyCustomSettings,
} = require('./simulate.js');

// ─── CLI helpers ────────────────────────────────────────────────────────────

function getArg(name, defaultVal) {
  const idx = process.argv.indexOf('--' + name);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return defaultVal;
}

function hasFlag(name) {
  return process.argv.includes('--' + name);
}

// ─── Load config files ──────────────────────────────────────────────────────

function loadJsonConfig(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ─── Bounded-concurrency async runner ───────────────────────────────────────

/**
 * Run an array of zero-argument async factory functions with at most
 * `concurrency` running simultaneously.  Results are returned in the same
 * order as `tasks`.
 *
 * @template T
 * @param {Array<() => Promise<T>>} tasks
 * @param {number} concurrency
 * @returns {Promise<T[]>}
 */
async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      results[idx] = await tasks[idx]();
    }
  }

  // Spin up at most `concurrency` workers; each drains the shared queue.
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// ─── Run all scenarios in parallel ──────────────────────────────────────────

/**
 * Build the simulation config for a single run of a scenario.
 */
function buildRunConfig(scenario, gameData, seed) {
  let mode = gameData.gameModes[scenario.mode];
  if (!mode) {
    throw new Error(`Unknown mode "${scenario.mode}" in scenario "${scenario.id}"`);
  }
  const customSettings = scenario.customSettings || null;
  if (scenario.mode === 'custom' && customSettings) {
    mode = applyCustomSettings(gameData.gameModes['normal'], customSettings);
  }
  const expMult = (scenario.mode === 'custom' && customSettings)
    ? 1 + (customSettings.expMultiplierPct || 0) / 100
    : null;
  const envSettings = scenario.environmentSettings || null;

  return {
    seed,
    maxSteps: DEFAULT_MAX_STEPS,
    heroes: scenario.party.map(cls => buildHeroJson(cls, gameData.heroes)),
    enemies: gameData.enemies.map(e => buildEnemyJson(e, expMult, envSettings)),
    configEntities: buildConfigEntities(mode),
  };
}

/**
 * Run all scenario runs in parallel (bounded by CPU count).
 * Returns a map of scenarioId → { scenario, results[], kpis }.
 *
 * Individual run failures are logged and excluded from results rather than
 * aborting the entire batch.
 *
 * @param {string} binaryPath
 * @param {object[]} scenarios
 * @param {object} gameData
 * @param {number} seedOffset
 * @param {boolean} verbose
 * @param {Function} log   — progress logger (stderr-safe)
 * @returns {Promise<object>}
 */
async function runAllScenariosParallel(binaryPath, scenarios, gameData, seedOffset, verbose, log) {
  const concurrency = os.cpus().length;

  // Flatten every (scenario × run-index) pair into an ordered task list.
  const tasks   = [];
  const runMeta = [];   // parallel metadata for each task slot

  for (const scenario of scenarios) {
    for (let i = 0; i < scenario.runs; i++) {
      const seed   = scenario.seedStart + seedOffset + i;
      const config = buildRunConfig(scenario, gameData, seed);
      const runIdx = i;
      const scId   = scenario.id;

      tasks.push(() =>
        runOneSimulationAsync(binaryPath, config).catch(err => ({
          _error: err.message,
          _seed:  seed,
          _scId:  scId,
          _run:   runIdx,
        }))
      );
      runMeta.push({ scenarioId: scId, runIndex: runIdx, seed });
    }
  }

  const totalRuns = tasks.length;
  log(`  Spawning ${totalRuns} simulations (concurrency=${concurrency})...`);

  const rawResults = await runWithConcurrency(tasks, concurrency);

  // Group successful results back by scenario.
  const allResults = {};
  for (const scenario of scenarios) {
    allResults[scenario.id] = { scenario, results: [] };
  }

  for (let t = 0; t < rawResults.length; t++) {
    const { scenarioId, runIndex, seed } = runMeta[t];
    const raw = rawResults[t];

    if (raw && !raw._error) {
      allResults[scenarioId].results.push(raw);
      if (verbose) {
        const gs      = raw.gameState || {};
        const sc      = raw.score    || {};
        const outcome = gs.gameOver ? (gs.victory ? 'Victory' : 'Defeat') : 'Timeout';
        log(
          `    ${scenarioId} run ${runIndex + 1} seed=${seed}: ` +
          `score=${String(sc.total ?? 0).padStart(6)} ` +
          `wave=${String(gs.currentWave ?? 1).padStart(3)} ` +
          `kills=${String(gs.enemiesDefeated ?? 0).padStart(4)} ` +
          outcome
        );
      }
    } else {
      const msg = raw?._error || 'unknown error';
      process.stderr.write(
        `  WARN: ${scenarioId} run ${runIndex + 1} seed=${seed} failed: ${msg}\n`
      );
    }
  }

  // Attach KPIs and print one-line summary per scenario.
  for (const scenario of scenarios) {
    const sr  = allResults[scenario.id];
    sr.kpis   = aggregateKPIs(sr.results);
    if (!verbose) {
      const k = sr.kpis;
      log(
        `  ${scenario.id.padEnd(25)} ` +
        `${sr.results.length} runs | ` +
        `mean score: ${String(k.meanScore ?? 'N/A').padStart(7)} | ` +
        `win rate: ${String((k.winRate ?? 0) + '%').padStart(6)} | ` +
        `mean wave: ${String(k.meanWave ?? 'N/A').padStart(5)}`
      );
    }
  }

  return allResults;
}

// ─── Check evaluation dispatch ──────────────────────────────────────────────

/**
 * Evaluate a single check against collected scenario results.
 * Returns a Promise<{ passed: boolean, message: string }>.
 */
async function evaluateCheck(check, allResults, binaryPath, gameData, seedOffset) {
  try {
    switch (check.type) {
      case 'determinism':
        return await checkDeterminism(check, allResults, binaryPath, gameData, seedOffset);
      case 'score_nonnegative':
        return checkScoreNonnegative(check, allResults);
      case 'score_consistent':
        return checkScoreConsistent(check, allResults);
      case 'kills_positive':
        return checkKillsPositive(check, allResults);
      case 'mean_score_greater':
        return checkMeanScoreGreater(check, allResults);
      case 'mean_kills_greater':
        return checkMeanKillsGreater(check, allResults);
      case 'victory_rate_min':
        return checkVictoryRateMin(check, allResults);
      case 'victory_implies_boss':
        return checkVictoryImpliesBoss(check, allResults);
      case 'win_rate_greater_or_equal':
        return checkWinRateGreaterOrEqual(check, allResults);
      case 'mean_score_margin':
        return checkMeanScoreMargin(check, allResults);
      default:
        return { passed: false, message: `Unknown check type: "${check.type}"` };
    }
  } catch (err) {
    return { passed: false, message: `Check evaluation error: ${err.message}` };
  }
}

// ─── Helper: get results for a scenario ─────────────────────────────────────

function getScenarioResults(scenarioId, allResults) {
  const r = allResults[scenarioId];
  if (!r) {
    throw new Error(`Scenario "${scenarioId}" not found in results`);
  }
  if (r.results.length === 0) {
    throw new Error(`No successful runs for scenario "${scenarioId}"`);
  }
  return r;
}

// ─── Check implementations ──────────────────────────────────────────────────

async function checkDeterminism(check, allResults, binaryPath, gameData, seedOffset) {
  const scenarioId = check.params.scenario;
  const sr = getScenarioResults(scenarioId, allResults);
  const scenario = sr.scenario;

  const concurrency = os.cpus().length;
  const envSettings = scenario.environmentSettings || null;

  // Build one replay task per original run, all in parallel.
  const tasks = sr.results.map((original, i) => {
    const seed   = scenario.seedStart + seedOffset + i;
    const config = buildRunConfig(scenario, gameData, seed);
    return () => runOneSimulationAsync(binaryPath, config).then(replay => ({ original, replay, seed }));
  });

  const replayResults = await runWithConcurrency(tasks, concurrency);

  const mismatches = [];
  for (const { original, replay, seed } of replayResults) {
    const diffs = [];
    if (original.score.total !== replay.score.total) {
      diffs.push(`score.total: ${original.score.total} vs ${replay.score.total}`);
    }
    if (original.stepsRun !== replay.stepsRun) {
      diffs.push(`stepsRun: ${original.stepsRun} vs ${replay.stepsRun}`);
    }
    if (original.gameState.enemiesDefeated !== replay.gameState.enemiesDefeated) {
      diffs.push(`enemiesDefeated: ${original.gameState.enemiesDefeated} vs ${replay.gameState.enemiesDefeated}`);
    }
    if (original.gameState.currentWave !== replay.gameState.currentWave) {
      diffs.push(`currentWave: ${original.gameState.currentWave} vs ${replay.gameState.currentWave}`);
    }
    if (String(original.gameState.victory) !== String(replay.gameState.victory)) {
      diffs.push(`victory: ${original.gameState.victory} vs ${replay.gameState.victory}`);
    }
    if (diffs.length > 0) {
      mismatches.push({ seed, diffs });
    }
  }

  if (mismatches.length === 0) {
    return {
      passed: true,
      message: `All ${sr.results.length} runs reproduced identically`,
    };
  }
  return {
    passed: false,
    message: `${mismatches.length}/${sr.results.length} runs differ on replay:\n` +
      mismatches.map(m => `  seed ${m.seed}: ${m.diffs.join(', ')}`).join('\n'),
  };
}

function checkScoreNonnegative(check, allResults) {
  const scenarios = resolveScenarioList(check.params);
  const failures = [];

  for (const sid of scenarios) {
    const sr = getScenarioResults(sid, allResults);
    for (let i = 0; i < sr.results.length; i++) {
      const score = sr.results[i].score?.total ?? 0;
      if (score < 0) {
        failures.push(`${sid} run ${i + 1}: score=${score}`);
      }
    }
  }

  if (failures.length === 0) {
    return { passed: true, message: 'All runs have non-negative scores' };
  }
  return {
    passed: false,
    message: `Negative scores found:\n  ${failures.join('\n  ')}`,
  };
}

function checkScoreConsistent(check, allResults) {
  const scenarios = resolveScenarioList(check.params);
  const failures = [];

  for (const sid of scenarios) {
    const sr = getScenarioResults(sid, allResults);
    for (let i = 0; i < sr.results.length; i++) {
      const sc = sr.results[i].score;
      if (!sc) {
        failures.push(`${sid} run ${i + 1}: no score data`);
        continue;
      }
      const expected =
        (sc.killScore || 0) +
        (sc.bossScore || 0) +
        (sc.waveScore || 0) +
        (sc.speedBonus || 0) -
        (sc.deathPenaltyTotal || 0) -
        (sc.retreatPenaltyTotal || 0) -
        (sc.timePenaltyTotal || 0);

      if (sc.total !== expected) {
        failures.push(
          `${sid} run ${i + 1}: total=${sc.total} expected=${expected} ` +
          `(kill=${sc.killScore} boss=${sc.bossScore} wave=${sc.waveScore} ` +
          `speed=${sc.speedBonus} -death=${sc.deathPenaltyTotal} ` +
          `-retreat=${sc.retreatPenaltyTotal} -time=${sc.timePenaltyTotal})`
        );
      }
    }
  }

  if (failures.length === 0) {
    return { passed: true, message: 'Score total matches sum of components for all runs' };
  }
  return {
    passed: false,
    message: `Score inconsistencies:\n  ${failures.join('\n  ')}`,
  };
}

function checkKillsPositive(check, allResults) {
  const scenarios = resolveScenarioList(check.params);
  const failures = [];

  for (const sid of scenarios) {
    const sr = getScenarioResults(sid, allResults);
    for (let i = 0; i < sr.results.length; i++) {
      const kills = sr.results[i].gameState?.enemiesDefeated ?? 0;
      if (kills < 1) {
        failures.push(`${sid} run ${i + 1}: enemiesDefeated=${kills}`);
      }
    }
  }

  if (failures.length === 0) {
    return { passed: true, message: 'All runs defeated at least one enemy' };
  }
  return {
    passed: false,
    message: `Runs with zero kills:\n  ${failures.join('\n  ')}`,
  };
}

function checkMeanScoreGreater(check, allResults) {
  const { scenarioA, scenarioB } = check.params;
  const srA = getScenarioResults(scenarioA, allResults);
  const srB = getScenarioResults(scenarioB, allResults);

  const meanA = srA.kpis.meanScore;
  const meanB = srB.kpis.meanScore;

  if (meanA > meanB) {
    return {
      passed: true,
      message: `${scenarioA} mean score (${meanA}) > ${scenarioB} mean score (${meanB})`,
    };
  }
  return {
    passed: false,
    message: `Expected ${scenarioA} mean score (${meanA}) > ${scenarioB} mean score (${meanB}), ` +
      `difference: ${(meanA - meanB).toFixed(1)}`,
  };
}

function checkMeanKillsGreater(check, allResults) {
  const { scenarioA, scenarioB } = check.params;
  const srA = getScenarioResults(scenarioA, allResults);
  const srB = getScenarioResults(scenarioB, allResults);

  const meanKills = results =>
    results.map(r => r.gameState?.enemiesDefeated ?? 0).reduce((a, b) => a + b, 0) / results.length;

  const killsA = meanKills(srA.results);
  const killsB = meanKills(srB.results);

  if (killsA > killsB) {
    return {
      passed: true,
      message: `${scenarioA} mean kills (${killsA.toFixed(1)}) > ${scenarioB} mean kills (${killsB.toFixed(1)})`,
    };
  }
  return {
    passed: false,
    message: `Expected ${scenarioA} mean kills (${killsA.toFixed(1)}) > ${scenarioB} mean kills (${killsB.toFixed(1)})`,
  };
}

function checkVictoryRateMin(check, allResults) {
  const { scenario, minRate } = check.params;
  const sr = getScenarioResults(scenario, allResults);

  const wins = sr.results.filter(r => r.gameState?.victory).length;
  const rate = (wins / sr.results.length) * 100;

  if (rate >= minRate) {
    return {
      passed: true,
      message: `Victory rate ${rate.toFixed(1)}% >= ${minRate}% (${wins}/${sr.results.length} wins)`,
    };
  }
  return {
    passed: false,
    message: `Victory rate ${rate.toFixed(1)}% < minimum ${minRate}% (${wins}/${sr.results.length} wins)`,
  };
}

function checkVictoryImpliesBoss(check, allResults) {
  const scenarios = resolveScenarioList(check.params);
  const failures = [];

  for (const sid of scenarios) {
    const sr = getScenarioResults(sid, allResults);
    for (let i = 0; i < sr.results.length; i++) {
      const gs = sr.results[i].gameState;
      if (gs?.victory && !gs?.bossDefeated) {
        failures.push(`${sid} run ${i + 1}: victory=true but bossDefeated=false`);
      }
    }
  }

  if (failures.length === 0) {
    return { passed: true, message: 'All victories have bossDefeated=true' };
  }
  return {
    passed: false,
    message: `Victory without boss defeat:\n  ${failures.join('\n  ')}`,
  };
}

function checkWinRateGreaterOrEqual(check, allResults) {
  const { scenarioA, scenarioB } = check.params;
  const srA = getScenarioResults(scenarioA, allResults);
  const srB = getScenarioResults(scenarioB, allResults);

  const rateA = srA.kpis.winRate;
  const rateB = srB.kpis.winRate;

  if (rateA >= rateB) {
    return {
      passed: true,
      message: `${scenarioA} win rate (${rateA}%) >= ${scenarioB} win rate (${rateB}%)`,
    };
  }
  return {
    passed: false,
    message: `Expected ${scenarioA} win rate (${rateA}%) >= ${scenarioB} win rate (${rateB}%)`,
  };
}

/**
 * Check that scenarioA's mean score exceeds scenarioB's by at least `minMarginPct`%.
 * This validates that game mechanics produce *meaningful* score differences,
 * not just barely-positive ones.
 */
function checkMeanScoreMargin(check, allResults) {
  const { scenarioA, scenarioB, minMarginPct } = check.params;
  const srA = getScenarioResults(scenarioA, allResults);
  const srB = getScenarioResults(scenarioB, allResults);

  const meanA = srA.kpis.meanScore;
  const meanB = srB.kpis.meanScore;

  // Avoid division by zero — use absolute margin if base is near zero
  const marginPct = meanB !== 0
    ? ((meanA - meanB) / Math.abs(meanB)) * 100
    : (meanA > meanB ? Infinity : -Infinity);

  if (marginPct >= minMarginPct) {
    return {
      passed: true,
      message: `${scenarioA} mean score (${meanA}) exceeds ${scenarioB} (${meanB}) ` +
        `by ${marginPct.toFixed(1)}% (≥ ${minMarginPct}% required)`,
    };
  }
  return {
    passed: false,
    message: `Expected ${scenarioA} (${meanA}) to exceed ${scenarioB} (${meanB}) ` +
      `by ≥ ${minMarginPct}%, actual margin: ${marginPct.toFixed(1)}%`,
  };
}

// ─── Helper: resolve a list of scenario IDs from check params ───────────────

function resolveScenarioList(params) {
  if (Array.isArray(params.scenarios)) return params.scenarios;
  if (params.scenario) return [params.scenario];
  return [];
}

// ─── Main harness runner ────────────────────────────────────────────────────

/**
 * Run the full test harness.
 *
 * @param {object} options
 * @param {number} [options.retries=3]        Max retry attempts
 * @param {boolean} [options.showPassed=false] Include passed checks in output
 * @param {boolean} [options.verbose=false]    Show per-run details
 * @param {string} [options.dataDir]           Game data directory
 * @param {string} [options.scenariosFile]     Scenarios JSON path
 * @param {string} [options.checksFile]        Checks JSON path
 * @param {boolean} [options.rebuild=false]    Force binary recompile
 * @returns {Promise<{ passed: object[], failed: object[], summary: object }>}
 */
async function runHarness(options = {}) {
  const {
    retries       = 3,
    showPassed    = false,
    verbose       = false,
    jsonOutput    = false,
    dataDir       = DEFAULT_DATA_DIR,
    scenariosFile = path.join(dataDir, 'test-scenarios.json'),
    checksFile    = path.join(dataDir, 'test-checks.json'),
    rebuild       = false,
  } = options;

  // When --json is used, progress goes to stderr so stdout is clean JSON
  const origConsoleLog = console.log;
  if (jsonOutput) {
    console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
  }
  const log  = jsonOutput ? (...a) => process.stderr.write(a.join(' ') + '\n') : origConsoleLog;

  // 1. Load config
  const scenarios = loadJsonConfig(scenariosFile, 'Scenarios');
  const checks    = loadJsonConfig(checksFile, 'Checks');

  log(`Loaded ${scenarios.length} scenarios and ${checks.length} checks`);
  log(`Max retries: ${retries}\n`);

  // 2. Load game data and compile binary
  log(`Loading game data from ${dataDir}...`);
  const gameData = loadGameData(dataDir);

  log('Ensuring native simulation binary...');
  const binaryPath = ensureBinary(rebuild);

  // 3. Run with retry loop
  let pendingChecks = checks.map(c => ({ ...c }));
  const passedChecks = [];
  const failedChecks = [];

  for (let attempt = 0; attempt <= retries && pendingChecks.length > 0; attempt++) {
    const seedOffset = attempt * SEED_OFFSET_STEP;

    if (attempt > 0) {
      log(`\n${'═'.repeat(72)}`);
      log(`RETRY ${attempt}/${retries} — re-running all simulations (seed offset: +${seedOffset})`);
      log(`  ${pendingChecks.length} check(s) still pending`);
      log('═'.repeat(72));
    }

    // 3a. Run all scenarios in parallel
    log(`\n── Running ${scenarios.length} scenarios ──`);
    const allResults = await runAllScenariosParallel(
      binaryPath, scenarios, gameData, seedOffset, verbose, log
    );

    // 3b. Evaluate pending checks (determinism replays are also parallel)
    log(`\n── Evaluating ${pendingChecks.length} check(s) (attempt ${attempt + 1}) ──`);
    const checkResults = await Promise.all(
      pendingChecks.map(check => evaluateCheck(check, allResults, binaryPath, gameData, seedOffset))
    );

    const stillFailing = [];
    for (let ci = 0; ci < pendingChecks.length; ci++) {
      const check  = pendingChecks[ci];
      const result = checkResults[ci];

      if (result.passed) {
        passedChecks.push({
          id: check.id,
          name: check.name,
          description: check.description,
          message: result.message,
          passedOnAttempt: attempt + 1,
        });
        log(`  ✓ ${check.id}: ${result.message}`);
      } else {
        if (attempt < retries) {
          stillFailing.push(check);
          log(`  ✗ ${check.id}: ${result.message} (will retry)`);
        } else {
          failedChecks.push({
            id: check.id,
            name: check.name,
            description: check.description,
            message: result.message,
            attemptsUsed: attempt + 1,
          });
          log(`  ✗ ${check.id}: ${result.message} (FINAL FAILURE)`);
        }
      }
    }

    pendingChecks = stillFailing;

    if (pendingChecks.length === 0) {
      log(`\n  All checks passed on attempt ${attempt + 1}`);
      break;
    }
  }

  // 4. Build summary
  const summary = {
    totalChecks: checks.length,
    passed: passedChecks.length,
    failed: failedChecks.length,
    allPassed: failedChecks.length === 0,
  };

  // Restore console.log if overridden
  if (jsonOutput) {
    console.log = origConsoleLog;
  }

  return { passed: passedChecks, failed: failedChecks, summary };
}

// ─── Report printing ────────────────────────────────────────────────────────

function printReport(result, showPassed, jsonOutput) {
  const { passed, failed, summary } = result;

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('\n' + '═'.repeat(72));
  console.log('  MASSIVE TEST HARNESS — RESULTS');
  console.log('═'.repeat(72));

  // Failed checks (always shown)
  if (failed.length > 0) {
    console.log(`\n  FAILED CHECKS (${failed.length}):`);
    console.log('  ' + '─'.repeat(68));
    for (const f of failed) {
      console.log(`\n  ✗ [${f.id}] ${f.name}`);
      console.log(`    ${f.description}`);
      console.log(`    Result: ${f.message}`);
      console.log(`    Attempts: ${f.attemptsUsed}`);
    }
  }

  // Passed checks (optional)
  if (showPassed && passed.length > 0) {
    console.log(`\n  PASSED CHECKS (${passed.length}):`);
    console.log('  ' + '─'.repeat(68));
    for (const p of passed) {
      console.log(`  ✓ [${p.id}] ${p.name}`);
      console.log(`    ${p.message} (attempt ${p.passedOnAttempt})`);
    }
  }

  // Summary
  console.log('\n  ' + '─'.repeat(68));
  console.log(`  Total: ${summary.totalChecks} | Passed: ${summary.passed} | Failed: ${summary.failed}`);
  console.log('  ' + (summary.allPassed ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'));
  console.log('═'.repeat(72) + '\n');
}

// ─── CLI entry point ────────────────────────────────────────────────────────

if (require.main === module) {
  const retries       = parseInt(getArg('retries', '3'), 10);
  const showPassed    = hasFlag('show-passed');
  const verbose       = hasFlag('verbose');
  const jsonOutput    = hasFlag('json');
  const rebuild       = hasFlag('rebuild');
  const dataDir       = getArg('data', DEFAULT_DATA_DIR);
  const scenariosFile = getArg('scenarios', undefined);
  const checksFile    = getArg('checks', undefined);

  runHarness({
    retries,
    showPassed,
    verbose,
    jsonOutput,
    dataDir,
    rebuild,
    ...(scenariosFile ? { scenariosFile } : {}),
    ...(checksFile ? { checksFile } : {}),
  })
    .then(result => {
      printReport(result, showPassed, jsonOutput);
      process.exit(result.summary.allPassed ? 0 : 1);
    })
    .catch(err => {
      console.error(`\nFATAL ERROR: ${err.message}`);
      if (err.stack) console.error(err.stack);
      process.exit(2);
    });
}

module.exports = { runHarness };
