/**
 * Simulation entry point for the Blink Idle RPG web app.
 *
 * Production path (used by the web app):
 *   runSimulation() → WasmSimEngine — compiled native code, ~300 ms for
 *   300 kills, no IR file required.  Throws if the WASM binary is absent.
 *
 * Prototyping / game-designer path:
 *   runSimulationDev() — JS engine that interprets the pre-compiled IR at
 *   runtime.  Slower (~5 s) but does not require a WASM build, useful when
 *   iterating on BRL rules without rebuilding the WASM binary.
 *
 * To build the WASM binary: make build-wasm && make install-wasm
 */

import { BlinkGame } from '@blink/engine';
import type { GameSnapshot, HeroDefinition, GameMode } from '../types';
import { runSimulationWasm } from './WasmSimEngine';

// ── Hero stats per class ────────────────────────────────────────────────────

const CLASS_BASE_HP: Record<string, number> = {
  Warrior: 160, Mage: 90, Ranger: 110, Paladin: 140, Rogue: 105, Cleric: 120,
};

const CLASS_BASE_DAMAGE: Record<string, number> = {
  Warrior: 22, Mage: 30, Ranger: 18, Paladin: 16, Rogue: 20, Cleric: 13,
};

const CLASS_BASE_DEFENSE: Record<string, number> = {
  Warrior: 8, Mage: 2, Ranger: 5, Paladin: 9, Rogue: 4, Cleric: 6,
};

const CLASS_SKILLS: Record<string, [string, string, string, string]> = {
  Warrior: ['power_strike', 'shield_bash', 'defensive_stance', 'execute'],
  Mage:    ['fireball', 'frost_bolt', 'arcane_blast', 'mana_shield'],
  Ranger:  ['arrow_shot', 'multi_shot', 'evade', 'trap'],
  Paladin: ['holy_strike', 'divine_shield', 'consecrate', 'lay_on_hands'],
  Rogue:   ['backstab', 'smoke_bomb', 'poison_blade', 'shadowstep'],
  Cleric:  ['heal', 'smite', 'divine_favor', 'holy_word'],
};

const CLASS_ATTACK_SPEED: Record<string, number> = {
  Warrior: 0.9, Mage: 0.6, Ranger: 1.1, Paladin: 0.7, Rogue: 1.3, Cleric: 0.6,
};

// ── Game mode spawn configs ─────────────────────────────────────────────────

const MODE_CONFIGS: Record<GameMode, {
  bossEveryKills: number; tierProgressionKills: number;
  healthScaleRate: number; damageScaleRate: number; initialEnemyCount: number;
  retreatTimePenalty: number; deathTimePenaltyMultiplier: number; fleeCooldown: number;
  pointsPerKill: number; pointsPerWave: number; pointsPerBoss: number;
  pointsLostPerDeath: number; pointsLostPerRetreat: number; pointsLostPerPenaltySecond: number;
  timeBonusPoints: number; timeBonusInterval: number;
}> = {
  normal: {
    bossEveryKills: 100, tierProgressionKills: 50,
    healthScaleRate: 200, damageScaleRate: 300, initialEnemyCount: 5,
    retreatTimePenalty: 10.0, deathTimePenaltyMultiplier: 5.0, fleeCooldown: 5.0,
    pointsPerKill: 10, pointsPerWave: 50, pointsPerBoss: 500,
    pointsLostPerDeath: 100, pointsLostPerRetreat: 50, pointsLostPerPenaltySecond: 2,
    timeBonusPoints: 1000, timeBonusInterval: 10.0,
  },
  easy: {
    bossEveryKills: 150, tierProgressionKills: 75,
    healthScaleRate: 100, damageScaleRate: 150, initialEnemyCount: 3,
    retreatTimePenalty: 5.0, deathTimePenaltyMultiplier: 3.0, fleeCooldown: 5.0,
    pointsPerKill: 5, pointsPerWave: 25, pointsPerBoss: 250,
    pointsLostPerDeath: 50, pointsLostPerRetreat: 25, pointsLostPerPenaltySecond: 1,
    timeBonusPoints: 500, timeBonusInterval: 15.0,
  },
  hard: {
    bossEveryKills: 75, tierProgressionKills: 40,
    healthScaleRate: 300, damageScaleRate: 450, initialEnemyCount: 7,
    retreatTimePenalty: 15.0, deathTimePenaltyMultiplier: 7.0, fleeCooldown: 5.0,
    pointsPerKill: 15, pointsPerWave: 75, pointsPerBoss: 1000,
    pointsLostPerDeath: 200, pointsLostPerRetreat: 100, pointsLostPerPenaltySecond: 5,
    timeBonusPoints: 2000, timeBonusInterval: 5.0,
  },
};

// ── Enemy template data ─────────────────────────────────────────────────────

const ENEMY_TEMPLATES = [
  { id: 100, tier: 1, name: 'Goblin Scout',      hp: 60,  dmg: 8,  spd: 1.0, exp: 25,  boss: false },
  { id: 101, tier: 2, name: 'Orc Raider',        hp: 90,  dmg: 12, spd: 0.8, exp: 35,  boss: false },
  { id: 102, tier: 2, name: 'Dark Wolf',         hp: 75,  dmg: 14, spd: 1.2, exp: 40,  boss: false },
  { id: 103, tier: 3, name: 'Skeleton Warrior',  hp: 110, dmg: 16, spd: 0.7, exp: 50,  boss: false },
  { id: 104, tier: 3, name: 'Dark Mage',         hp: 80,  dmg: 22, spd: 0.5, exp: 75,  boss: false },
  { id: 105, tier: 4, name: 'Troll Berserker',   hp: 180, dmg: 22, spd: 0.6, exp: 80,  boss: false },
  { id: 106, tier: 5, name: 'Demon Knight',      hp: 250, dmg: 30, spd: 0.7, exp: 150, boss: false },
  { id: 107, tier: 6, name: 'Ancient Dragon',    hp: 400, dmg: 40, spd: 0.8, exp: 300, boss: false },
  { id: 108, tier: 6, name: 'Dragon Lord Vexar', hp: 500, dmg: 40, spd: 0.8, exp: 500, boss: true  },
];

// ── Simulation constants ────────────────────────────────────────────────────

/** Steps per chunk — small enough to allow browser repaints between chunks. */
const CHUNK_SIZE = 500;

/** Max wall-clock milliseconds for the simulation (keeps UX fast). */
const MAX_WALL_MS = 5_000;

// ── Run simulation ──────────────────────────────────────────────────────────

/**
 * Run the simulation using the WASM engine (production path).
 *
 * Throws an error when the WASM binary is not installed so that the caller
 * (App.tsx error screen) surfaces a clear message to the user instead of
 * falling back to the slower JS engine.
 *
 * To install the WASM binary:
 *   make build-wasm && make install-wasm
 */
export async function runSimulation(
  irUrl: string,
  selectedHeroes: HeroDefinition[],
  mode: GameMode
): Promise<GameSnapshot[]> {
  const wasmResult = await runSimulationWasm(selectedHeroes, mode);
  if (wasmResult !== null) {
    return wasmResult;
  }

  throw new Error(
    'WASM engine is not available. ' +
    'Run `make build-wasm && make install-wasm` to build and install it.'
  );
}

/**
 * Run the simulation using the JS engine (game-designer prototyping path).
 *
 * Fetches the pre-compiled IR at `irUrl` and runs in 500-step chunks,
 * yielding between chunks so the browser stays responsive.  This is slower
 * than the WASM engine (~5 s vs ~300 ms) and should NOT be used in the
 * deployed web app — use it when iterating on BRL rules without a WASM build.
 */
export async function runSimulationDev(
  irUrl: string,
  selectedHeroes: HeroDefinition[],
  mode: GameMode
): Promise<GameSnapshot[]> {
  return runSimulationJs(irUrl, selectedHeroes, mode);
}

/**
 * Internal JS engine runner — not exported; use runSimulationDev() instead.
 */
async function runSimulationJs(
  irUrl: string,
  selectedHeroes: HeroDefinition[],
  mode: GameMode
): Promise<GameSnapshot[]> {
  // 1. Fetch IR (rules + components only; no entities)
  const ir: unknown = await fetch(irUrl).then(r => {
    if (!r.ok) throw new Error(`Failed to load IR from ${irUrl}: ${r.statusText}`);
    return r.json();
  });

  const game = BlinkGame.createSync({ debug: false });
  game.loadRulesFromObject(ir);

  const cfg = MODE_CONFIGS[mode] ?? MODE_CONFIGS.normal;

  // 2. Create hero entities (IDs 1..N)
  selectedHeroes.forEach((hero, i) => {
    const heroId = i + 1;
    const heroClass = hero.heroClass;
    const skills = CLASS_SKILLS[heroClass] ?? ['basic_attack', '', '', ''];
    const baseHp = CLASS_BASE_HP[heroClass] ?? 100;
    const baseDmg = CLASS_BASE_DAMAGE[heroClass] ?? 15;
    const baseDef = CLASS_BASE_DEFENSE[heroClass] ?? 5;
    const baseSpd = CLASS_ATTACK_SPEED[heroClass] ?? 1.0;

    const conBonus = Math.floor((hero.stats.constitution - 10) * 5);
    const intBonus = Math.floor((hero.stats.intelligence - 10) * 3);
    const strBonus = Math.floor((hero.stats.strength - 10) * 2);
    const dexBonus = (hero.stats.dexterity - 10) * 0.05;
    const wisBonus = Math.floor((hero.stats.wisdom - 10) * 5);

    const maxHp   = Math.max(50, baseHp + conBonus);
    const damage  = Math.max(5, baseDmg + strBonus + intBonus);
    const defense = Math.max(0, baseDef + Math.floor((hero.stats.constitution - 10)));
    const attackSpeed = Math.max(0.3, baseSpd + dexBonus);
    const maxMana = Math.max(50, 100 + wisBonus);
    const critChance = Math.min(0.5, 0.05 + hero.stats.dexterity * 0.01);

    const eid = game.createEntity(heroId);
    game.addComponent(eid, 'Character', {
      name: hero.name, class: hero.heroClass, level: 1, experience: 0, experienceToLevel: 100,
    });
    game.addComponent(eid, 'Health', { current: maxHp, max: maxHp });
    game.addComponent(eid, 'Mana',   { current: maxMana, max: maxMana });
    game.addComponent(eid, 'Stats', {
      strength: hero.stats.strength, dexterity: hero.stats.dexterity,
      intelligence: hero.stats.intelligence, constitution: hero.stats.constitution,
      wisdom: hero.stats.wisdom,
    });
    game.addComponent(eid, 'Combat', {
      damage, defense, attackSpeed, critChance, critMultiplier: 1.5,
    });
    game.addComponent(eid, 'Target', { entity: null });
    game.addComponent(eid, 'Team',   { id: 'player', isPlayer: true });
    game.addComponent(eid, 'Skills', {
      skill1: skills[0], skill2: skills[1], skill3: skills[2], skill4: skills[3], skillPoints: 0,
    });
    game.addComponent(eid, 'Buffs', {
      damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0,
    });
    game.addComponent(eid, 'SkillCooldown', {
      skill1Cooldown: 0.0, skill2Cooldown: 0.0, skill3Cooldown: 0.0, skill4Cooldown: 0.0,
    });
  });

  // 3. Create enemy templates (IDs 100–108)
  for (const tmpl of ENEMY_TEMPLATES) {
    const eid = game.createEntity(tmpl.id);
    game.addComponent(eid, 'Character', {
      name: tmpl.name, class: tmpl.boss ? 'Boss' : 'Monster',
      level: tmpl.tier, experience: 0, experienceToLevel: 999,
    });
    game.addComponent(eid, 'Health', { current: tmpl.hp, max: tmpl.hp });
    game.addComponent(eid, 'Mana',   { current: 0, max: 0 });
    game.addComponent(eid, 'Stats',  {
      strength: 8, dexterity: 8, intelligence: 4, constitution: 8, wisdom: 4,
    });
    game.addComponent(eid, 'Combat', {
      damage: tmpl.dmg, defense: Math.floor(tmpl.tier * 2),
      attackSpeed: tmpl.spd, critChance: 0.05, critMultiplier: 1.5,
    });
    game.addComponent(eid, 'Target', { entity: null });
    game.addComponent(eid, 'Team',   { id: 'enemy', isPlayer: false });
    game.addComponent(eid, 'Enemy',  {
      tier: tmpl.tier, isBoss: tmpl.boss, expReward: tmpl.exp, wave: tmpl.tier, name: tmpl.name,
    });
    game.addComponent(eid, 'EnemyTemplate', { isTemplate: true });
    game.addComponent(eid, 'Buffs', {
      damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0,
    });
    if (tmpl.boss) {
      game.addComponent(eid, 'FinalBoss', { isFinalBoss: true });
    }
  }

  // 4. Game state entity (ID 99)
  const gsId = game.createEntity(99);
  game.addComponent(gsId, 'GameState', {
    currentWave: 1, enemiesDefeated: 0, playerDeaths: 0,
    bossDefeated: false, gameOver: false, victory: false,
    retargetingActive: false, currentTier: 1, waveInTier: 1, bossSpawned: false,
  });
  game.addComponent(gsId, 'SpawnConfig', {
    bossEveryKills: cfg.bossEveryKills,
    tierProgressionKills: cfg.tierProgressionKills,
    maxTier: 6, wavesPerTier: 3,
    healthScaleRate: cfg.healthScaleRate,
    damageScaleRate: cfg.damageScaleRate,
    initialEnemyCount: cfg.initialEnemyCount,
  });
  // N checkpoints: one per enemy defeated (interval=1).
  // The design spec targets N=30 checkpoints every 10 kills, but the JS
  // engine is CPU-bound so we capture every kill and display as many
  // snapshots as we collect within the 5-second wall-clock budget.
  // The WASM engine (v2) will run the full 300-kill game in ~300ms and
  // always produce exactly 30 checkpoints at interval=10.
  game.addComponent(gsId, 'ProgressTracker', {
    checkpointInterval: 1,
    checkpointsReached: 0,
    totalCheckpoints: 30,
  });

  // 5. Run stats entity (ID 98)
  const rsId = game.createEntity(98);
  game.addComponent(rsId, 'RunStats', {
    simulationTime: 0.0, retreatCount: 0, retreatPenalty: 0.0,
    deathPenalty: 0.0, totalTime: 0.0, canFlee: true, lastFleeTime: -999.0,
  });

  // 6. Flee config entity (ID 97)
  const fcId = game.createEntity(97);
  game.addComponent(fcId, 'FleeConfig', {
    retreatTimePenalty: cfg.retreatTimePenalty,
    deathTimePenaltyMultiplier: cfg.deathTimePenaltyMultiplier,
    fleeCooldown: cfg.fleeCooldown,
  });

  // 7. Score + ScoringRules entity (ID 96)
  const scoreId = game.createEntity(96);
  game.addComponent(scoreId, 'ScoringRules', {
    pointsPerKill: cfg.pointsPerKill,
    pointsPerWave: cfg.pointsPerWave,
    pointsPerBoss: cfg.pointsPerBoss,
    pointsLostPerDeath: cfg.pointsLostPerDeath,
    pointsLostPerRetreat: cfg.pointsLostPerRetreat,
    pointsLostPerPenaltySecond: cfg.pointsLostPerPenaltySecond,
    timeBonusPoints: cfg.timeBonusPoints,
    timeBonusInterval: cfg.timeBonusInterval,
  });
  game.addComponent(scoreId, 'Score', {
    total: 0, killScore: 0, waveScore: 0, bossScore: 0, speedBonus: 0,
    deathPenaltyTotal: 0, retreatPenaltyTotal: 0, timePenaltyTotal: 0,
    bossesDefeated: 0, wavesCompleted: 0,
  });

  // 8. Subscribe to checkpoint events
  const snapshots: GameSnapshot[] = [];
  const unsub = game.onSimulation((evt) => {
    if (evt.type === 'step' && evt.event?.eventType === 'ProgressCheckpoint') {
      snapshots.push(captureSnapshot(game, snapshots.length + 1, selectedHeroes));
    }
  });

  // 9. Run simulation in chunks, yielding to the browser between each chunk
  game.scheduleEvent('GameStart', 0);

  const startWall = performance.now();

  while (performance.now() - startWall < MAX_WALL_MS) {
    game.runUntilComplete(CHUNK_SIZE);

    // Check for game over / victory
    const gs = game.getComponent(99, 'GameState') as Record<string, unknown> | undefined;
    if (gs && ((gs['gameOver'] as boolean) || (gs['victory'] as boolean))) break;

    // Yield to browser so loading screen stays visible and responsive
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  unsub();

  // Final snapshot (captures end state even if no more checkpoints)
  snapshots.push(captureSnapshot(game, snapshots.length + 1, selectedHeroes));

  game.destroy();
  return snapshots;
}

// ── Snapshot helper ─────────────────────────────────────────────────────────

function captureSnapshot(
  game: BlinkGame,
  step: number,
  heroes: HeroDefinition[]
): GameSnapshot {
  const gs = game.getComponent(99, 'GameState') as Record<string, unknown> | undefined;
  const rs = game.getComponent(98, 'RunStats') as Record<string, unknown> | undefined;
  const sc = game.getComponent(96, 'Score') as Record<string, unknown> | undefined;

  const heroLevels: Record<string, number> = {};
  heroes.forEach((hero, i) => {
    const ch = game.getComponent(i + 1, 'Character') as Record<string, unknown> | undefined;
    if (ch) {
      heroLevels[hero.name] = (ch['level'] as number) ?? 1;
    }
  });

  return {
    step,
    simulationTime: (rs?.['simulationTime'] as number) ?? 0,
    enemiesDefeated: (gs?.['enemiesDefeated'] as number) ?? 0,
    score: (sc?.['total'] as number) ?? 0,
    currentTier: (gs?.['currentTier'] as number) ?? 1,
    currentWave: (gs?.['currentWave'] as number) ?? 1,
    heroLevels,
    bossesDefeated: (sc?.['bossesDefeated'] as number) ?? 0,
    playerDeaths: (gs?.['playerDeaths'] as number) ?? 0,
    isGameOver: (gs?.['gameOver'] as boolean) ?? false,
    victory: (gs?.['victory'] as boolean) ?? false,
  };
}
