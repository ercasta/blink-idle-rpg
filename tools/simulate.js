#!/usr/bin/env node
/**
 * Blink Idle RPG — Simulation Harness
 *
 * Runs multiple independent simulations and aggregates KPIs.
 *
 * Usage:
 *   node tools/simulate.js --mode normal --runs 20 --seed-start 1 --output /tmp/results.json
 *   node tools/simulate.js --mode normal,hardcore --runs 10 --seed-start 42
 *
 * See doc/game-design/simulation.md for the full specification.
 */

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

// ─── Load compiled packages ────────────────────────────────────────────────
const { BlinkGame } = require(path.join(ROOT, 'packages/blink-engine/dist/index.js'));
const { compileString } = require(path.join(ROOT, 'packages/blink-compiler-ts/dist/index.js'));

// ─── Compile BRL source ────────────────────────────────────────────────────
const brlSource = fs.readFileSync(path.join(ROOT, 'game/brl/classic-rpg.brl'), 'utf8');
const compileResult = compileString(brlSource, 'brl');
if (compileResult.errors.length > 0) {
  console.error('BRL compilation failed:');
  compileResult.errors.forEach(e => console.error(' -', e.message));
  process.exit(1);
}
const gameIR = compileResult.ir;

// ─── Game mode scoring configurations ──────────────────────────────────────
const GAME_MODES = {
  casual: {
    pointsPerKill: 5, pointsPerWave: 25, pointsPerBoss: 200,
    pointsLostPerDeath: 0, pointsLostPerRetreat: 0, pointsLostPerPenaltySecond: 0,
    timeBonusPoints: 0, timeBonusInterval: 10.0,
    initialEnemyCount: 3, healthScaleRate: 100, damageScaleRate: 150,
    retreatTimePenalty: 5.0, deathTimePenaltyMultiplier: 2.0, fleeCooldown: 5.0,
    bossEveryKills: 100, tierProgressionKills: 50, hasVictoryCondition: true,
  },
  normal: {
    pointsPerKill: 10, pointsPerWave: 50, pointsPerBoss: 500,
    pointsLostPerDeath: 100, pointsLostPerRetreat: 50, pointsLostPerPenaltySecond: 2,
    timeBonusPoints: 1000, timeBonusInterval: 10.0,
    initialEnemyCount: 5, healthScaleRate: 200, damageScaleRate: 300,
    retreatTimePenalty: 10.0, deathTimePenaltyMultiplier: 5.0, fleeCooldown: 5.0,
    bossEveryKills: 100, tierProgressionKills: 50, hasVictoryCondition: true,
  },
  hardcore: {
    pointsPerKill: 15, pointsPerWave: 75, pointsPerBoss: 1000,
    pointsLostPerDeath: 500, pointsLostPerRetreat: 200, pointsLostPerPenaltySecond: 5,
    timeBonusPoints: 2000, timeBonusInterval: 5.0,
    initialEnemyCount: 5, healthScaleRate: 250, damageScaleRate: 400,
    retreatTimePenalty: 20.0, deathTimePenaltyMultiplier: 10.0, fleeCooldown: 15.0,
    bossEveryKills: 100, tierProgressionKills: 50, hasVictoryCondition: true,
  },
  endless: {
    pointsPerKill: 10, pointsPerWave: 50, pointsPerBoss: 500,
    pointsLostPerDeath: 150, pointsLostPerRetreat: 50, pointsLostPerPenaltySecond: 2,
    timeBonusPoints: 1000, timeBonusInterval: 10.0,
    initialEnemyCount: 5, healthScaleRate: 200, damageScaleRate: 300,
    retreatTimePenalty: 10.0, deathTimePenaltyMultiplier: 5.0, fleeCooldown: 5.0,
    bossEveryKills: 50, tierProgressionKills: 30, hasVictoryCondition: false,
  },
};

// ─── Standard party compositions ───────────────────────────────────────────
const STANDARD_PARTIES = {
  balanced: ['Warrior', 'Mage', 'Cleric', 'Ranger', 'Paladin', 'Rogue'],
  two_hero: ['Warrior', 'Mage'],
  solo_warrior: ['Warrior'],
};

// ─── Entity setup helpers ───────────────────────────────────────────────────
function createHeroEntity(game, id, heroClass) {
  const HERO_STATS = {
    Warrior: { health: 120, mana: 30,  damage: 18, defense: 10, attackSpeed: 0.8, critChance: 0.1,  critMultiplier: 1.5, skill1: 'power_strike' },
    Mage:    { health: 70,  mana: 100, damage: 25, defense: 4,  attackSpeed: 0.7, critChance: 0.15, critMultiplier: 2.0, skill1: 'fireball' },
    Ranger:  { health: 90,  mana: 50,  damage: 20, defense: 6,  attackSpeed: 1.2, critChance: 0.2,  critMultiplier: 1.5, skill1: 'aimed_shot' },
    Paladin: { health: 110, mana: 60,  damage: 15, defense: 12, attackSpeed: 0.7, critChance: 0.08, critMultiplier: 1.5, skill1: 'holy_strike' },
    Rogue:   { health: 80,  mana: 40,  damage: 22, defense: 5,  attackSpeed: 1.1, critChance: 0.25, critMultiplier: 2.0, skill1: 'backstab' },
    Cleric:  { health: 85,  mana: 80,  damage: 14, defense: 7,  attackSpeed: 0.7, critChance: 0.08, critMultiplier: 1.5, skill1: 'heal' },
  };
  const stats = HERO_STATS[heroClass] || HERO_STATS.Warrior;
  const eid = game.createEntity(id);
  game.addComponent(eid, 'Character', { name: heroClass, class: heroClass, level: 1, experience: 0, experienceToLevel: 100 });
  game.addComponent(eid, 'Health', { current: stats.health, max: stats.health });
  game.addComponent(eid, 'Mana', { current: stats.mana, max: stats.mana });
  game.addComponent(eid, 'Stats', { strength: 10, dexterity: 10, intelligence: 10, constitution: 10, wisdom: 10 });
  game.addComponent(eid, 'Combat', { damage: stats.damage, defense: stats.defense, attackSpeed: stats.attackSpeed, critChance: stats.critChance, critMultiplier: stats.critMultiplier });
  game.addComponent(eid, 'Target', { entity: null });
  game.addComponent(eid, 'Team', { id: 'player', isPlayer: true });
  game.addComponent(eid, 'Skills', { skill1: stats.skill1, skill2: '', skill3: '', skill4: '', skillPoints: 0 });
  game.addComponent(eid, 'Buffs', { damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0 });
  return eid;
}

function createEnemyTemplate(game, id, tier, name, hp, damage, speed, expReward, isBoss) {
  isBoss = isBoss || false;
  const eid = game.createEntity(id);
  game.addComponent(eid, 'Character', { name: name, class: isBoss ? 'Boss' : 'Monster', level: tier, experience: 0, experienceToLevel: 999 });
  game.addComponent(eid, 'Health', { current: hp, max: hp });
  game.addComponent(eid, 'Mana', { current: 0, max: 0 });
  game.addComponent(eid, 'Stats', { strength: 8, dexterity: 8, intelligence: 4, constitution: 8, wisdom: 4 });
  game.addComponent(eid, 'Combat', { damage: damage, defense: Math.floor(tier * 2), attackSpeed: speed, critChance: 0.05, critMultiplier: 1.5 });
  game.addComponent(eid, 'Target', { entity: null });
  game.addComponent(eid, 'Team', { id: 'enemy', isPlayer: false });
  game.addComponent(eid, 'Enemy', { tier: tier, isBoss: isBoss, expReward: expReward, wave: tier, name: isBoss ? 'Lord Vexar' : name });
  game.addComponent(eid, 'EnemyTemplate', { isTemplate: true });
  game.addComponent(eid, 'Buffs', { damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0 });
  if (isBoss) {
    game.addComponent(eid, 'FinalBoss', { isFinalBoss: true });
  }
  return eid;
}

// ─── Run one simulation ─────────────────────────────────────────────────────
function runSimulation(opts) {
  const runId = opts.runId;
  const gameModeId = opts.gameModeId;
  const seed = opts.seed;
  const partyComposition = opts.partyComposition;
  const maxSimulationTime = opts.maxSimulationTime || 3600;

  const mode = GAME_MODES[gameModeId];
  if (!mode) throw new Error('Unknown game mode: ' + gameModeId);

  const game = BlinkGame.createSync({ debug: false });
  game.loadRulesFromObject(gameIR);

  // Heroes (IDs 1..N)
  partyComposition.forEach(function(cls, i) { createHeroEntity(game, i + 1, cls); });

  // Enemy templates (IDs 100–108)
  createEnemyTemplate(game, 100, 1, 'Goblin Scout',      60,  8,  1.0, 25,  false);
  createEnemyTemplate(game, 101, 2, 'Orc Raider',        90,  12, 0.8, 35,  false);
  createEnemyTemplate(game, 102, 2, 'Dark Wolf',         75,  14, 1.2, 40,  false);
  createEnemyTemplate(game, 103, 3, 'Skeleton Warrior',  110, 16, 0.7, 50,  false);
  createEnemyTemplate(game, 104, 3, 'Dark Mage',         80,  22, 0.5, 75,  false);
  createEnemyTemplate(game, 105, 4, 'Troll Berserker',   180, 22, 0.6, 80,  false);
  createEnemyTemplate(game, 106, 5, 'Demon Knight',      250, 30, 0.7, 150, false);
  createEnemyTemplate(game, 107, 6, 'Ancient Dragon',    400, 40, 0.8, 300, false);
  createEnemyTemplate(game, 108, 6, 'Dragon Lord Vexar', 500, 40, 0.8, 500, true);

  // Game state + spawn config (ID 99)
  var gsId = game.createEntity(99);
  game.addComponent(gsId, 'GameState', {
    currentWave: 1, enemiesDefeated: 0, playerDeaths: 0,
    bossDefeated: false, gameOver: false, victory: false,
    retargetingActive: false, currentTier: 1, waveInTier: 1, bossSpawned: false,
  });
  game.addComponent(gsId, 'SpawnConfig', {
    bossEveryKills: mode.bossEveryKills,
    tierProgressionKills: mode.tierProgressionKills,
    maxTier: 6,
    wavesPerTier: 3,
    healthScaleRate: mode.healthScaleRate,
    damageScaleRate: mode.damageScaleRate,
    initialEnemyCount: mode.initialEnemyCount,
  });

  // Run stats (ID 98)
  var rsId = game.createEntity(98);
  game.addComponent(rsId, 'RunStats', {
    simulationTime: 0.0, retreatCount: 0, retreatPenalty: 0.0,
    deathPenalty: 0.0, totalTime: 0.0, canFlee: true, lastFleeTime: -999.0,
  });

  // Flee config (ID 97)
  var fcId = game.createEntity(97);
  game.addComponent(fcId, 'FleeConfig', {
    retreatTimePenalty: mode.retreatTimePenalty,
    deathTimePenaltyMultiplier: mode.deathTimePenaltyMultiplier,
    fleeCooldown: mode.fleeCooldown,
  });

  // Score + ScoringRules (ID 96)
  var scoreId = game.createEntity(96);
  game.addComponent(scoreId, 'ScoringRules', {
    pointsPerKill: mode.pointsPerKill,
    pointsPerWave: mode.pointsPerWave,
    pointsPerBoss: mode.pointsPerBoss,
    pointsLostPerDeath: mode.pointsLostPerDeath,
    pointsLostPerRetreat: mode.pointsLostPerRetreat,
    pointsLostPerPenaltySecond: mode.pointsLostPerPenaltySecond,
    timeBonusPoints: mode.timeBonusPoints,
    timeBonusInterval: mode.timeBonusInterval,
  });
  game.addComponent(scoreId, 'Score', {
    total: 0, killScore: 0, waveScore: 0, bossScore: 0, speedBonus: 0,
    deathPenaltyTotal: 0, retreatPenaltyTotal: 0, timePenaltyTotal: 0,
    bossesDefeated: 0, wavesCompleted: 0,
  });

  // Fire GameStart
  game.scheduleEvent('GameStart', 0, {});

  // Run until game over or timeout
  game.runUntilComplete(maxSimulationTime);

  // Collect results
  var gs = game.getComponent(99, 'GameState');
  var rs = game.getComponent(98, 'RunStats');
  var sc = game.getComponent(96, 'Score');

  var survivingHeroes = partyComposition.filter(function(cls, i) {
    var h = game.getComponent(i + 1, 'Health');
    return h && h.current > 0;
  }).length;

  var outcomeReason = 'Timeout';
  if (gs && gs.gameOver) outcomeReason = gs.victory ? 'Victory' : 'GameOver';

  var result = {
    runId: runId,
    gameModeId: gameModeId,
    seed: seed,
    finalScore: sc ? sc.total : 0,
    deepestWave: gs ? gs.currentWave : 1,
    deepestTier: gs ? gs.currentTier : 1,
    totalKills: gs ? gs.enemiesDefeated : 0,
    bossesDefeated: sc ? sc.bossesDefeated : 0,
    heroDeaths: gs ? gs.playerDeaths : 0,
    retreatCount: rs ? rs.retreatCount : 0,
    totalTime: rs ? rs.totalTime : 0,
    simulationTime: rs ? rs.simulationTime : 0,
    penaltyTime: (rs ? rs.deathPenalty : 0) + (rs ? rs.retreatPenalty : 0),
    survivingHeroes: survivingHeroes,
    partySize: partyComposition.length,
    partyComposition: partyComposition,
    outcomeReason: outcomeReason,
  };

  game.destroy();
  return result;
}

// ─── Aggregate KPIs ─────────────────────────────────────────────────────────
function percentile(sorted, p) {
  var idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function aggregateKPIs(results) {
  var n = results.length;
  if (n === 0) return {};

  var scores = results.map(function(r) { return r.finalScore; }).sort(function(a, b) { return a - b; });
  var waves  = results.map(function(r) { return r.deepestWave; });
  var deaths = results.map(function(r) { return r.heroDeaths; });
  var times  = results.map(function(r) { return r.totalTime; });

  function mean(arr) { return arr.reduce(function(a, b) { return a + b; }, 0) / n; }
  function median(arr) {
    var s = arr.slice().sort(function(a, b) { return a - b; });
    return s[Math.floor(n / 2)];
  }

  var meanScore = mean(scores);
  var stdev = Math.sqrt(scores.reduce(function(s, x) { return s + Math.pow(x - meanScore, 2); }, 0) / n);
  var wins = results.filter(function(r) { return r.outcomeReason === 'Victory'; }).length;

  return {
    n: n,
    winRate: +((wins / n * 100).toFixed(1)),
    meanScore: +(meanScore.toFixed(1)),
    medianScore: median(scores),
    p10Score: percentile(scores, 0.1),
    p90Score: percentile(scores, 0.9),
    stdevScore: +(stdev.toFixed(1)),
    meanDeepestWave: +(mean(waves).toFixed(2)),
    meanHeroDeaths: +(mean(deaths).toFixed(2)),
    meanTotalTime: +(mean(times).toFixed(2)),
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

// Simple arg parser
function getArg(name, defaultVal) {
  var idx = process.argv.indexOf('--' + name);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return defaultVal;
}
function hasFlag(name) {
  return process.argv.includes('--' + name);
}

// Only run CLI when invoked directly
if (require.main === module) {
  var modes     = getArg('mode', 'normal').split(',').map(function(m) { return m.trim(); });
  var runs      = parseInt(getArg('runs', '20'), 10);
  var seedStart = parseInt(getArg('seed-start', '1'), 10);
  var outputFile = getArg('output', '');
  var partyKey  = getArg('party', 'balanced');
  var quiet     = hasFlag('quiet');
  var party     = STANDARD_PARTIES[partyKey] || STANDARD_PARTIES.balanced;

  var allResults = [];
  var kpisByMode = {};

  modes.forEach(function(modeId) {
    if (!quiet) console.log('\n── Running ' + runs + ' simulations in "' + modeId + '" mode ──');

    var modeResults = [];
    for (var i = 0; i < runs; i++) {
      var seed = seedStart + i;
      try {
        var result = runSimulation({
          runId: i + 1,
          gameModeId: modeId,
          seed: seed,
          partyComposition: party,
          maxSimulationTime: 3600,
        });
        modeResults.push(result);
        if (!quiet) {
          process.stdout.write(
            '  run ' + String(i + 1).padStart(3) + ' seed=' + seed + ': ' +
            'score=' + String(result.finalScore).padStart(6) + ' ' +
            'wave=' + String(result.deepestWave).padStart(3) + ' ' +
            'kills=' + String(result.totalKills).padStart(4) + ' ' +
            result.outcomeReason + '\n'
          );
        }
      } catch (err) {
        console.error('  run ' + (i + 1) + ' FAILED:', err.message);
      }
    }

    allResults = allResults.concat(modeResults);
    kpisByMode[modeId] = aggregateKPIs(modeResults);

    if (!quiet) {
      var kpi = kpisByMode[modeId];
      console.log('\n  ── KPIs for "' + modeId + '" (' + kpi.n + ' runs) ──');
      console.log('  Win rate:        ' + kpi.winRate + '%');
      console.log('  Mean score:      ' + kpi.meanScore);
      console.log('  Median score:    ' + kpi.medianScore);
      console.log('  p10/p90 score:   ' + kpi.p10Score + ' / ' + kpi.p90Score);
      console.log('  Score stdev:     ' + kpi.stdevScore);
      console.log('  Mean wave:       ' + kpi.meanDeepestWave);
      console.log('  Mean deaths:     ' + kpi.meanHeroDeaths);
      console.log('  Mean total time: ' + kpi.meanTotalTime + 's');
    }
  });

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify({ kpisByMode: kpisByMode, results: allResults }, null, 2));
    if (!quiet) console.log('\nResults written to ' + outputFile);
  }
}

module.exports = { runSimulation: runSimulation, aggregateKPIs: aggregateKPIs, GAME_MODES: GAME_MODES };
