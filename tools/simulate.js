#!/usr/bin/env node
/**
 * Blink Idle RPG — Batch Simulation Tool (Native Engine)
 *
 * Compiles BRL → Rust → native binary, then runs multiple simulations with
 * configurable parameters for game balance testing.
 *
 * The tool reads game data (heroes, enemies, scoring rules, spawn config)
 * from JSON files in a data folder, allowing game designers to experiment
 * with different configurations without touching code.
 *
 * Usage:
 *   node tools/simulate.js --mode normal --runs 20 --seed-start 1
 *   node tools/simulate.js --mode normal,hard --runs 10 --data game/data/custom
 *   node tools/simulate.js --mode normal --runs 50 --output results.json
 *   node tools/simulate.js --list-parties
 *
 * Prerequisites:
 *   • Node.js 18+
 *   • Rust toolchain (cargo)
 *   • Built compiler: npm run build:compiler:ts
 *
 * The tool will automatically compile BRL → Rust → native on first run.
 * Subsequent runs reuse the cached binary unless --rebuild is passed.
 *
 * See doc/WORKFLOW.md for the full game designer workflow.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RUNTIME_PATH = path.join(ROOT, 'packages', 'blink-runtime');
const BRL_DIR = path.join(ROOT, 'game', 'brl');
const GENERATED_DIR = path.join(ROOT, 'packages', 'blink-engine-wasm', 'generated');
const DEFAULT_DATA_DIR = path.join(ROOT, 'game', 'data');

// ─── CLI arg parser ─────────────────────────────────────────────────────────

function getArg(name, defaultVal) {
  const idx = process.argv.indexOf('--' + name);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return defaultVal;
}
function hasFlag(name) {
  return process.argv.includes('--' + name);
}

// ─── Load game data from JSON files ─────────────────────────────────────────

function loadJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Load game data from a data directory.
 *
 * Expected structure:
 *   game/data/
 *     heroes.json          — hero class definitions (stats, skills)
 *     enemies.json         — enemy template definitions
 *     game-modes.json      — scoring rules & spawn config per mode
 *     parties.json         — named party compositions
 */
function loadGameData(dataDir) {
  const data = {
    heroes: loadJsonFile(path.join(dataDir, 'heroes.json')),
    enemies: loadJsonFile(path.join(dataDir, 'enemies.json')),
    gameModes: loadJsonFile(path.join(dataDir, 'game-modes.json')),
    parties: loadJsonFile(path.join(dataDir, 'parties.json')),
  };

  if (!data.heroes) throw new Error(`Missing ${path.join(dataDir, 'heroes.json')}`);
  if (!data.enemies) throw new Error(`Missing ${path.join(dataDir, 'enemies.json')}`);
  if (!data.gameModes) throw new Error(`Missing ${path.join(dataDir, 'game-modes.json')}`);
  if (!data.parties) throw new Error(`Missing ${path.join(dataDir, 'parties.json')}`);

  return data;
}

// ─── Compile BRL → Rust → native binary ─────────────────────────────────────

function ensureBinary(rebuild) {
  const crateDir = path.join(GENERATED_DIR, 'simulate');
  const ext = process.platform === 'win32' ? '.exe' : '';
  const binaryPath = path.join(crateDir, 'target', 'release', `simulate${ext}`);

  if (!rebuild && fs.existsSync(binaryPath)) {
    console.log('  Using cached binary (pass --rebuild to force recompile)');
    return binaryPath;
  }

  console.log('  Compiling BRL → Rust...');

  const { compileToRust } = require(
    path.join(ROOT, 'packages', 'blink-compiler-ts', 'dist', 'index.js')
  );

  const BRL_FILES = [
    path.join(BRL_DIR, 'classic-rpg.brl'),
    path.join(BRL_DIR, 'heroes.brl'),
  ];

  const sources = BRL_FILES.map(f => ({
    path: f,
    content: fs.readFileSync(f, 'utf8'),
    language: 'brl',
  }));

  const result = compileToRust(sources, { moduleName: 'blink_rpg' });

  if (result.errors.length > 0) {
    console.error('BRL compilation failed:');
    result.errors.forEach(e => console.error(`  ${e.file || '?'}:${e.line || '?'}: ${e.message}`));
    process.exit(1);
  }

  const srcDir = path.join(crateDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  for (const [filename, content] of result.files) {
    fs.writeFileSync(path.join(srcDir, filename), content);
  }

  // Cargo.toml
  fs.writeFileSync(path.join(crateDir, 'Cargo.toml'), `[package]
name = "simulate"
version = "0.1.0"
edition = "2024"

[lib]
name = "blink_game"
path = "src/lib.rs"

[[bin]]
name = "simulate"
path = "src/main.rs"

[dependencies]
blink-runtime = { path = "${RUNTIME_PATH.replace(/\\/g, '/')}" }
serde_json = "1"

[profile.release]
opt-level = 2
lto = "thin"
`);

  // main.rs — reads JSON config from stdin, runs simulation, outputs JSON
  fs.writeFileSync(path.join(srcDir, 'main.rs'), MAIN_RS);

  console.log('  Building native binary (release)...');
  try {
    execSync('cargo build --release 2>&1', {
      cwd: crateDir,
      encoding: 'utf-8',
      timeout: 180_000,
      stdio: 'pipe',
    });
  } catch (e) {
    console.error('Cargo build failed:');
    console.error(e.stdout || '');
    console.error(e.stderr || '');
    process.exit(1);
  }

  console.log('  Build successful!');
  return binaryPath;
}

// ─── Native binary source ───────────────────────────────────────────────────

const MAIN_RS = `// Auto-generated simulation harness.
// Reads JSON config from stdin, runs one simulation, outputs JSON results.
#![allow(dead_code, unused_imports, unused_variables)]

use blink_game::*;

fn main() {
    let input: String = {
        use std::io::Read;
        let mut buf = String::new();
        std::io::stdin().read_to_string(&mut buf).expect("Failed to read stdin");
        buf
    };
    let config: serde_json::Value = serde_json::from_str(&input).expect("Invalid JSON on stdin");

    let seed = config["seed"].as_u64().unwrap_or(42);
    let max_steps = config["maxSteps"].as_u64().unwrap_or(500_000) as u32;

    let mut engine = blink_runtime::Engine::with_seed(seed);

    // Initialize component registrations + string interning
    init_game(&mut engine);

    // Load heroes from config
    if let Some(heroes) = config["heroes"].as_array() {
        for (i, hero) in heroes.iter().enumerate() {
            let entity_id = (i + 1) as u32;
            engine.world.create_entity(entity_id);
            if let Some(obj) = hero.as_object() {
                for (comp_name, fields) in obj {
                    add_component_from_json(&mut engine, entity_id, comp_name, fields);
                }
            }
        }
    }

    // Load enemy templates from config
    if let Some(enemies) = config["enemies"].as_array() {
        for enemy_entry in enemies {
            let entity_id = enemy_entry["_entityId"].as_u64().unwrap_or(100) as u32;
            engine.world.create_entity(entity_id);
            if let Some(obj) = enemy_entry.as_object() {
                for (comp_name, fields) in obj {
                    if comp_name.starts_with('_') { continue; }
                    add_component_from_json(&mut engine, entity_id, comp_name, fields);
                }
            }
        }
    }

    // Load config entities
    if let Some(config_entities) = config["configEntities"].as_array() {
        for entry in config_entities {
            let entity_id = entry["_entityId"].as_u64().unwrap_or(99) as u32;
            engine.world.create_entity(entity_id);
            if let Some(obj) = entry.as_object() {
                for (comp_name, fields) in obj {
                    if comp_name.starts_with('_') { continue; }
                    add_component_from_json(&mut engine, entity_id, comp_name, fields);
                }
            }
        }
    }

    // Schedule GameStart
    let game_start_type = engine.interner.intern("GameStart");
    let start_event = blink_runtime::Event::new(game_start_type);
    engine.timeline.schedule_immediate(start_event);

    // Run simulation
    let mut steps_run = 0u32;
    while engine.has_events() && steps_run < max_steps {
        if step(&mut engine) {
            steps_run += 1;
        } else {
            break;
        }
    }

    // Read final state
    let gs_json = get_component_json(&engine, 99, "GameState");
    let rs_json = get_component_json(&engine, 98, "RunStats");
    let sc_json = get_component_json(&engine, 96, "Score");

    // Count surviving heroes
    let hero_count = config["heroes"].as_array().map(|h| h.len()).unwrap_or(0);
    let mut surviving = 0u32;
    for i in 0..hero_count {
        let hid = (i + 1) as u32;
        let hp_json = get_component_json(&engine, hid, "Health");
        let hp: serde_json::Value = serde_json::from_str(&hp_json).unwrap_or(serde_json::Value::Null);
        if hp["current"].as_f64().unwrap_or(0.0) > 0.0 {
            surviving += 1;
        }
    }

    println!("{{");
    println!("  \\"stepsRun\\": {},", steps_run);
    println!("  \\"simulationTime\\": {},", engine.get_time());
    println!("  \\"gameState\\": {},", gs_json);
    println!("  \\"runStats\\": {},", rs_json);
    println!("  \\"score\\": {},", sc_json);
    println!("  \\"survivingHeroes\\": {},", surviving);
    println!("  \\"heroCount\\": {}", hero_count);
    println!("}}");
}
`;

// ─── Build entity JSON for the native binary ────────────────────────────────

function buildHeroJson(heroClass, heroData) {
  const cls = heroData.classes[heroClass];
  if (!cls) throw new Error(`Unknown hero class: ${heroClass}`);

  return {
    Character: { name: cls.name || heroClass, class: heroClass, level: 1, experience: 0, experienceToLevel: 100 },
    Health: { current: cls.health, max: cls.health },
    Mana: { current: cls.mana || 0, max: cls.mana || 0 },
    Stats: cls.stats || { strength: 10, dexterity: 10, intelligence: 10, constitution: 10, wisdom: 10 },
    Combat: {
      damage: cls.damage, defense: cls.defense,
      attackSpeed: cls.attackSpeed, critChance: cls.critChance || 0.1, critMultiplier: cls.critMultiplier || 1.5,
    },
    Target: { entity: 0 },
    Team: { id: 'player', isPlayer: true },
    Skills: {
      skill1: (cls.skills || [])[0] || '', skill2: (cls.skills || [])[1] || '',
      skill3: (cls.skills || [])[2] || '', skill4: (cls.skills || [])[3] || '',
      skillPoints: 0,
    },
    Buffs: { damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0 },
    SkillCooldown: { skill1Cooldown: 0.0, skill2Cooldown: 0.0, skill3Cooldown: 0.0, skill4Cooldown: 0.0 },
  };
}

function buildEnemyJson(template) {
  return {
    _entityId: template.id,
    Character: {
      name: template.name, class: template.isBoss ? 'Boss' : 'Monster',
      level: template.tier, experience: 0, experienceToLevel: 999,
    },
    Health: { current: template.hp, max: template.hp },
    Mana: { current: 0, max: 0 },
    Stats: { strength: 8, dexterity: 8, intelligence: 4, constitution: 8, wisdom: 4 },
    Combat: {
      damage: template.damage, defense: Math.floor(template.tier * 2),
      attackSpeed: template.speed, critChance: 0.05, critMultiplier: 1.5,
    },
    Target: { entity: 0 },
    Team: { id: 'enemy', isPlayer: false },
    Enemy: { tier: template.tier, isBoss: template.isBoss || false, expReward: template.expReward, wave: template.tier, name: template.name },
    EnemyTemplate: { isTemplate: true },
    Buffs: { damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0 },
    ...(template.isBoss ? { FinalBoss: { isFinalBoss: true } } : {}),
  };
}

function buildConfigEntities(mode) {
  return [
    {
      _entityId: 99,
      GameState: {
        currentWave: 1, enemiesDefeated: 0, playerDeaths: 0,
        bossDefeated: false, gameOver: false, victory: false,
        retargetingActive: false, currentTier: 1, waveInTier: 1, bossSpawned: false,
      },
      SpawnConfig: {
        bossEveryKills: mode.bossEveryKills,
        tierProgressionKills: mode.tierProgressionKills,
        maxTier: mode.maxTier || 6, wavesPerTier: mode.wavesPerTier || 3,
        healthScaleRate: mode.healthScaleRate,
        damageScaleRate: mode.damageScaleRate,
        initialEnemyCount: mode.initialEnemyCount,
      },
      ProgressTracker: {
        checkpointInterval: 10, checkpointsReached: 0, totalCheckpoints: 30,
      },
    },
    {
      _entityId: 98,
      RunStats: {
        simulationTime: 0.0, retreatCount: 0, retreatPenalty: 0.0,
        deathPenalty: 0.0, totalTime: 0.0, canFlee: true, lastFleeTime: -999.0,
      },
    },
    {
      _entityId: 97,
      FleeConfig: {
        retreatTimePenalty: mode.retreatTimePenalty,
        deathTimePenaltyMultiplier: mode.deathTimePenaltyMultiplier,
        fleeCooldown: mode.fleeCooldown,
      },
    },
    {
      _entityId: 96,
      ScoringRules: {
        pointsPerKill: mode.pointsPerKill,
        pointsPerWave: mode.pointsPerWave,
        pointsPerBoss: mode.pointsPerBoss,
        pointsLostPerDeath: mode.pointsLostPerDeath,
        pointsLostPerRetreat: mode.pointsLostPerRetreat,
        pointsLostPerPenaltySecond: mode.pointsLostPerPenaltySecond,
        timeBonusPoints: mode.timeBonusPoints,
        timeBonusInterval: mode.timeBonusInterval,
      },
      Score: {
        total: 0, killScore: 0, waveScore: 0, bossScore: 0, speedBonus: 0,
        deathPenaltyTotal: 0, retreatPenaltyTotal: 0, timePenaltyTotal: 0,
        bossesDefeated: 0, wavesCompleted: 0,
      },
    },
  ];
}

// ─── Run one simulation ─────────────────────────────────────────────────────

function runOneSimulation(binaryPath, config) {
  const input = JSON.stringify(config);
  try {
    const output = execSync(binaryPath, {
      input: input,
      encoding: 'utf-8',
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(output.trim());
  } catch (e) {
    throw new Error(`Simulation binary failed: ${e.stderr || e.message}`);
  }
}

// ─── Aggregate KPIs ─────────────────────────────────────────────────────────

function percentile(sorted, p) {
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function aggregateKPIs(results) {
  const n = results.length;
  if (n === 0) return {};

  const scores = results.map(r => r.score?.total ?? 0).sort((a, b) => a - b);
  const mean = arr => arr.reduce((a, b) => a + b, 0) / n;

  const meanScore = mean(scores);
  const stdev = Math.sqrt(scores.reduce((s, x) => s + (x - meanScore) ** 2, 0) / n);
  const wins = results.filter(r => r.gameState?.victory).length;

  return {
    n,
    winRate: +(wins / n * 100).toFixed(1),
    meanScore: +meanScore.toFixed(1),
    medianScore: percentile(scores, 0.5),
    p10Score: percentile(scores, 0.1),
    p90Score: percentile(scores, 0.9),
    stdevScore: +stdev.toFixed(1),
    meanWave: +mean(results.map(r => r.gameState?.currentWave ?? 1)).toFixed(2),
    meanDeaths: +mean(results.map(r => r.gameState?.playerDeaths ?? 0)).toFixed(2),
    meanTime: +mean(results.map(r => r.simulationTime ?? 0)).toFixed(2),
    meanSteps: +mean(results.map(r => r.stepsRun ?? 0)).toFixed(0),
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const modes = getArg('mode', 'normal').split(',').map(m => m.trim());
  const runs = parseInt(getArg('runs', '20'), 10);
  const seedStart = parseInt(getArg('seed-start', '1'), 10);
  const outputFile = getArg('output', '');
  const partyKey = getArg('party', 'balanced');
  const dataDir = getArg('data', DEFAULT_DATA_DIR);
  const quiet = hasFlag('quiet');
  const rebuild = hasFlag('rebuild');
  const listParties = hasFlag('list-parties');

  // 1. Load game data
  console.log(`Loading game data from ${dataDir}...`);
  const gameData = loadGameData(dataDir);

  if (listParties) {
    console.log('\nAvailable parties:');
    for (const [name, comp] of Object.entries(gameData.parties)) {
      console.log(`  ${name}: ${comp.join(', ')}`);
    }
    process.exit(0);
  }

  // 2. Build binary
  console.log('Ensuring native simulation binary...');
  const binaryPath = ensureBinary(rebuild);

  // 3. Resolve party
  const party = gameData.parties[partyKey];
  if (!party) {
    console.error(`Unknown party: ${partyKey}. Available: ${Object.keys(gameData.parties).join(', ')}`);
    process.exit(1);
  }

  // 4. Run simulations
  const allResults = [];
  const kpisByMode = {};

  for (const modeId of modes) {
    const mode = gameData.gameModes[modeId];
    if (!mode) {
      console.error(`Unknown mode: ${modeId}. Available: ${Object.keys(gameData.gameModes).join(', ')}`);
      process.exit(1);
    }

    if (!quiet) console.log(`\n── Running ${runs} simulations in "${modeId}" mode ──`);

    const modeResults = [];
    for (let i = 0; i < runs; i++) {
      const seed = seedStart + i;
      try {
        const config = {
          seed,
          maxSteps: 500000,
          heroes: party.map(cls => buildHeroJson(cls, gameData.heroes)),
          enemies: gameData.enemies.map(e => buildEnemyJson(e)),
          configEntities: buildConfigEntities(mode),
        };

        const result = runOneSimulation(binaryPath, config);
        modeResults.push(result);

        if (!quiet) {
          const gs = result.gameState || {};
          const sc = result.score || {};
          const outcome = gs.gameOver ? (gs.victory ? 'Victory' : 'Defeat') : 'Timeout';
          process.stdout.write(
            `  run ${String(i + 1).padStart(3)} seed=${seed}: ` +
            `score=${String(sc.total ?? 0).padStart(6)} ` +
            `wave=${String(gs.currentWave ?? 1).padStart(3)} ` +
            `kills=${String(gs.enemiesDefeated ?? 0).padStart(4)} ` +
            `${outcome}\n`
          );
        }
      } catch (err) {
        console.error(`  run ${i + 1} FAILED: ${err.message}`);
      }
    }

    allResults.push(...modeResults);
    kpisByMode[modeId] = aggregateKPIs(modeResults);

    if (!quiet) {
      const kpi = kpisByMode[modeId];
      console.log(`\n  ── KPIs for "${modeId}" (${kpi.n} runs) ──`);
      console.log(`  Win rate:     ${kpi.winRate}%`);
      console.log(`  Mean score:   ${kpi.meanScore}`);
      console.log(`  Median score: ${kpi.medianScore}`);
      console.log(`  p10/p90:      ${kpi.p10Score} / ${kpi.p90Score}`);
      console.log(`  Score stdev:  ${kpi.stdevScore}`);
      console.log(`  Mean wave:    ${kpi.meanWave}`);
      console.log(`  Mean deaths:  ${kpi.meanDeaths}`);
      console.log(`  Mean time:    ${kpi.meanTime}s`);
      console.log(`  Mean steps:   ${kpi.meanSteps}`);
    }
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify({ kpisByMode, results: allResults }, null, 2));
    if (!quiet) console.log(`\nResults written to ${outputFile}`);
  }
}

module.exports = { runOneSimulation, aggregateKPIs, loadGameData, buildHeroJson, buildEnemyJson, buildConfigEntities };
