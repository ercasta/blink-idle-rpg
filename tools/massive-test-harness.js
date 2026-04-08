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

const ROOT             = path.join(__dirname, '..');
const DEFAULT_DATA_DIR = path.join(ROOT, 'game', 'data');

const {
  ensureBinary,
  runOneSimulation,
  aggregateKPIs,
  loadGameData,
  buildHeroJson,
  buildEnemyJson,
  buildConfigEntities,
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

// ─── Run a single scenario ──────────────────────────────────────────────────

function runScenario(binaryPath, scenario, gameData, seedOffset, verbose) {
  const mode = gameData.gameModes[scenario.mode];
  if (!mode) {
    throw new Error(`Unknown mode "${scenario.mode}" in scenario "${scenario.id}"`);
  }

  const results = [];
  for (let i = 0; i < scenario.runs; i++) {
    const seed = scenario.seedStart + seedOffset + i;
    const config = {
      seed,
      maxSteps: 500000,
      heroes: scenario.party.map(cls => buildHeroJson(cls, gameData.heroes)),
      enemies: gameData.enemies.map(e => buildEnemyJson(e)),
      configEntities: buildConfigEntities(mode),
    };

    try {
      const result = runOneSimulation(binaryPath, config);
      results.push(result);
      if (verbose) {
        const gs = result.gameState || {};
        const sc = result.score || {};
        const outcome = gs.gameOver ? (gs.victory ? 'Victory' : 'Defeat') : 'Timeout';
        console.log(
          `    run ${i + 1}/${scenario.runs} seed=${seed}: ` +
          `score=${String(sc.total ?? 0).padStart(6)} ` +
          `wave=${String(gs.currentWave ?? 1).padStart(3)} ` +
          `kills=${String(gs.enemiesDefeated ?? 0).padStart(4)} ` +
          outcome
        );
      }
    } catch (err) {
      console.error(`    run ${i + 1}/${scenario.runs} FAILED: ${err.message}`);
    }
  }

  return {
    scenario,
    results,
    kpis: aggregateKPIs(results),
  };
}

// ─── Check evaluation dispatch ──────────────────────────────────────────────

/**
 * Evaluate a single check against collected scenario results.
 * Returns { passed: boolean, message: string }
 */
function evaluateCheck(check, allResults, binaryPath, gameData, seedOffset) {
  try {
    switch (check.type) {
      case 'determinism':
        return checkDeterminism(check, allResults, binaryPath, gameData, seedOffset);
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

function checkDeterminism(check, allResults, binaryPath, gameData, seedOffset) {
  const scenarioId = check.params.scenario;
  const sr = getScenarioResults(scenarioId, allResults);
  const scenario = sr.scenario;
  const mode = gameData.gameModes[scenario.mode];

  const mismatches = [];
  for (let i = 0; i < sr.results.length; i++) {
    const seed = scenario.seedStart + seedOffset + i;
    const config = {
      seed,
      maxSteps: 500000,
      heroes: scenario.party.map(cls => buildHeroJson(cls, gameData.heroes)),
      enemies: gameData.enemies.map(e => buildEnemyJson(e)),
      configEntities: buildConfigEntities(mode),
    };

    const replay = runOneSimulation(binaryPath, config);
    const original = sr.results[i];

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
 * @returns {{ passed: object[], failed: object[], summary: object }}
 */
function runHarness(options = {}) {
  const {
    retries       = 3,
    showPassed    = false,
    verbose       = false,
    dataDir       = DEFAULT_DATA_DIR,
    scenariosFile = path.join(dataDir, 'test-scenarios.json'),
    checksFile    = path.join(dataDir, 'test-checks.json'),
    rebuild       = false,
  } = options;

  // 1. Load config
  const scenarios = loadJsonConfig(scenariosFile, 'Scenarios');
  const checks    = loadJsonConfig(checksFile, 'Checks');

  console.log(`Loaded ${scenarios.length} scenarios and ${checks.length} checks`);
  console.log(`Max retries: ${retries}\n`);

  // 2. Load game data and compile binary
  console.log(`Loading game data from ${dataDir}...`);
  const gameData = loadGameData(dataDir);

  console.log('Ensuring native simulation binary...');
  const binaryPath = ensureBinary(rebuild);

  // 3. Run with retry loop
  let pendingChecks = checks.map(c => ({ ...c }));
  const passedChecks = [];
  const failedChecks = [];
  const SEED_OFFSET_STEP = 10000;

  for (let attempt = 0; attempt <= retries && pendingChecks.length > 0; attempt++) {
    const seedOffset = attempt * SEED_OFFSET_STEP;

    if (attempt > 0) {
      console.log(`\n${'═'.repeat(72)}`);
      console.log(`RETRY ${attempt}/${retries} — re-running all simulations (seed offset: +${seedOffset})`);
      console.log(`  ${pendingChecks.length} check(s) still pending`);
      console.log('═'.repeat(72));
    }

    // 3a. Run all scenarios
    console.log(`\n── Running ${scenarios.length} scenarios ──`);
    const allResults = {};
    for (const scenario of scenarios) {
      if (!verbose) {
        process.stdout.write(`  ${scenario.id.padEnd(25)} `);
      } else {
        console.log(`\n  ${scenario.name} (${scenario.id}):`);
      }

      const result = runScenario(binaryPath, scenario, gameData, seedOffset, verbose);
      allResults[scenario.id] = result;

      if (!verbose) {
        const k = result.kpis;
        console.log(
          `${result.results.length} runs | ` +
          `mean score: ${String(k.meanScore ?? 'N/A').padStart(7)} | ` +
          `win rate: ${String((k.winRate ?? 0) + '%').padStart(6)} | ` +
          `mean wave: ${String(k.meanWave ?? 'N/A').padStart(5)}`
        );
      }
    }

    // 3b. Evaluate pending checks
    console.log(`\n── Evaluating ${pendingChecks.length} check(s) (attempt ${attempt + 1}) ──`);
    const stillFailing = [];

    for (const check of pendingChecks) {
      const result = evaluateCheck(check, allResults, binaryPath, gameData, seedOffset);

      if (result.passed) {
        passedChecks.push({
          id: check.id,
          name: check.name,
          description: check.description,
          message: result.message,
          passedOnAttempt: attempt + 1,
        });
        console.log(`  ✓ ${check.id}: ${result.message}`);
      } else {
        if (attempt < retries) {
          stillFailing.push(check);
          console.log(`  ✗ ${check.id}: ${result.message} (will retry)`);
        } else {
          failedChecks.push({
            id: check.id,
            name: check.name,
            description: check.description,
            message: result.message,
            attemptsUsed: attempt + 1,
          });
          console.log(`  ✗ ${check.id}: ${result.message} (FINAL FAILURE)`);
        }
      }
    }

    pendingChecks = stillFailing;

    if (pendingChecks.length === 0) {
      console.log(`\n  All checks passed on attempt ${attempt + 1}`);
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

  try {
    const result = runHarness({
      retries,
      showPassed,
      verbose,
      dataDir,
      rebuild,
      ...(scenariosFile ? { scenariosFile } : {}),
      ...(checksFile ? { checksFile } : {}),
    });

    printReport(result, showPassed, jsonOutput);
    process.exit(result.summary.allPassed ? 0 : 1);
  } catch (err) {
    console.error(`\nFATAL ERROR: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(2);
  }
}

module.exports = { runHarness };
