/**
 * Scenario Data — loads pre-compiled game mode configuration from JSON.
 *
 * At build time, `scripts/compile-game-data.js` reads the scenario BRL files
 * and produces `public/game-data/scenarios.json`.  This module fetches that
 * pre-compiled JSON at runtime, avoiding any BRL parsing in the browser.
 */

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

// ── Cache ────────────────────────────────────────────────────────────────────

let configCache: Record<string, ModeConfig> | null = null;
let fetchPromise: Promise<Record<string, ModeConfig>> | null = null;

/**
 * Load all scenario configurations from the pre-compiled JSON file.
 * Returns a map of mode name → ModeConfig.
 * Cached after first successful load.
 */
export async function loadScenarioConfigs(): Promise<Record<string, ModeConfig>> {
  if (configCache) return configCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ?? '/';
      const url = `${base}game-data/scenarios.json`.replace('//', '/');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch scenarios.json: ${res.status}`);
      const configs: Record<string, ModeConfig> = await res.json();
      configCache = configs;
      return configs;
    } catch (err) {
      console.error('Failed to load scenario configs from scenarios.json:', err);
      configCache = {};
      return configCache;
    }
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
