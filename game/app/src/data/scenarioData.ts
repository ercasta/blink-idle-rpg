/**
 * Scenario Data — loads game mode configuration from the canonical BRL source.
 *
 * Previously, mode parameters were hardcoded in WasmSimEngine.ts as
 * MODE_CONFIGS.  This module loads the same data from the scenario BRL files
 * (`scenario-normal.brl`, `scenario-easy.brl`, `scenario-hard.brl`),
 * making BRL the single source of truth for game balance.
 *
 * Parsed results are cached after the first fetch.
 */

import {
  parseEntities,
  getComponent,
  extractNumberField,
  fetchBrlFile,
} from './brlParser';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ModeConfig {
  bossEveryKills: number;
  tierProgressionKills: number;
  healthScaleRate: number;
  damageScaleRate: number;
  initialEnemyCount: number;
  retreatTimePenalty: number;
  deathTimePenaltyMultiplier: number;
  fleeCooldown: number;
  pointsPerKill: number;
  pointsPerWave: number;
  pointsPerBoss: number;
  pointsLostPerDeath: number;
  pointsLostPerRetreat: number;
  pointsLostPerPenaltySecond: number;
  timeBonusPoints: number;
  timeBonusInterval: number;
}

// ── Parsing ─────────────────────────────────────────────────────────────────

function parseScenarioConfig(text: string): ModeConfig {
  const entities = parseEntities(text);

  // Extract SpawnConfig from game_state entity
  let spawnConfig = { bossEveryKills: 100, tierProgressionKills: 500, healthScaleRate: 80, damageScaleRate: 60, initialEnemyCount: 5 };
  let fleeConfig = { retreatTimePenalty: 10.0, deathTimePenaltyMultiplier: 2.0, fleeCooldown: 5.0 };
  let scoringRules = { pointsPerKill: 10, pointsPerWave: 50, pointsPerBoss: 500, pointsLostPerDeath: 30, pointsLostPerRetreat: 50, pointsLostPerPenaltySecond: 2, timeBonusPoints: 1000, timeBonusInterval: 10.0 };

  for (const entity of entities) {
    // SpawnConfig from game_state entity
    const spawn = getComponent(entity, 'SpawnConfig');
    if (spawn) {
      spawnConfig = {
        bossEveryKills: extractNumberField(spawn.body, 'bossEveryKills') ?? spawnConfig.bossEveryKills,
        tierProgressionKills: extractNumberField(spawn.body, 'tierProgressionKills') ?? spawnConfig.tierProgressionKills,
        healthScaleRate: extractNumberField(spawn.body, 'healthScaleRate') ?? spawnConfig.healthScaleRate,
        damageScaleRate: extractNumberField(spawn.body, 'damageScaleRate') ?? spawnConfig.damageScaleRate,
        initialEnemyCount: extractNumberField(spawn.body, 'initialEnemyCount') ?? spawnConfig.initialEnemyCount,
      };
    }

    // FleeConfig from flee_config entity
    const flee = getComponent(entity, 'FleeConfig');
    if (flee) {
      fleeConfig = {
        retreatTimePenalty: extractNumberField(flee.body, 'retreatTimePenalty') ?? fleeConfig.retreatTimePenalty,
        deathTimePenaltyMultiplier: extractNumberField(flee.body, 'deathTimePenaltyMultiplier') ?? fleeConfig.deathTimePenaltyMultiplier,
        fleeCooldown: extractNumberField(flee.body, 'fleeCooldown') ?? fleeConfig.fleeCooldown,
      };
    }

    // ScoringRules from scoring_entity
    const scoring = getComponent(entity, 'ScoringRules');
    if (scoring) {
      scoringRules = {
        pointsPerKill: extractNumberField(scoring.body, 'pointsPerKill') ?? scoringRules.pointsPerKill,
        pointsPerWave: extractNumberField(scoring.body, 'pointsPerWave') ?? scoringRules.pointsPerWave,
        pointsPerBoss: extractNumberField(scoring.body, 'pointsPerBoss') ?? scoringRules.pointsPerBoss,
        pointsLostPerDeath: extractNumberField(scoring.body, 'pointsLostPerDeath') ?? scoringRules.pointsLostPerDeath,
        pointsLostPerRetreat: extractNumberField(scoring.body, 'pointsLostPerRetreat') ?? scoringRules.pointsLostPerRetreat,
        pointsLostPerPenaltySecond: extractNumberField(scoring.body, 'pointsLostPerPenaltySecond') ?? scoringRules.pointsLostPerPenaltySecond,
        timeBonusPoints: extractNumberField(scoring.body, 'timeBonusPoints') ?? scoringRules.timeBonusPoints,
        timeBonusInterval: extractNumberField(scoring.body, 'timeBonusInterval') ?? scoringRules.timeBonusInterval,
      };
    }
  }

  return {
    ...spawnConfig,
    ...fleeConfig,
    ...scoringRules,
  };
}

// ── Cache ────────────────────────────────────────────────────────────────────

let configCache: Record<string, ModeConfig> | null = null;
let fetchPromise: Promise<Record<string, ModeConfig>> | null = null;

const SCENARIO_FILES: Record<string, string> = {
  normal: 'scenario-normal.brl',
  easy: 'scenario-easy.brl',
  hard: 'scenario-hard.brl',
};

/**
 * Load all scenario configurations from BRL files.
 * Returns a map of mode name → ModeConfig.
 * Cached after first successful load.
 */
export async function loadScenarioConfigs(): Promise<Record<string, ModeConfig>> {
  if (configCache) return configCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    const configs: Record<string, ModeConfig> = {};
    const entries = Object.entries(SCENARIO_FILES);

    const results = await Promise.all(
      entries.map(async ([mode, file]) => {
        try {
          const text = await fetchBrlFile(file);
          return { mode, config: parseScenarioConfig(text) };
        } catch (err) {
          console.error(`Failed to load scenario config ${file}:`, err);
          return null;
        }
      }),
    );

    for (const result of results) {
      if (result) {
        configs[result.mode] = result.config;
      }
    }

    configCache = configs;
    return configs;
  })();

  return fetchPromise;
}

/**
 * Synchronous access to cached scenario configs.
 * Returns null if not yet loaded — call loadScenarioConfigs() first.
 */
export function getScenarioConfigs(): Record<string, ModeConfig> | null {
  return configCache;
}
