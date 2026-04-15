/**
 * World Data Loader — loads pre-compiled world data from JSON.
 *
 * At build time, `scripts/compile-game-data.js` reads `game/brl/story-world-data.brl`
 * and produces `public/game-data/world-data.json`.  This module fetches that
 * pre-compiled JSON at runtime, avoiding any BRL parsing in the browser.
 */

import type {
  WorldLocation,
  WorldPath,
  WorldNpc,
  HeroArrivalComment,
  BlockingEncounter,
} from './worldData';

// ── Public API ──────────────────────────────────────────────────────────────

export interface WorldDataSet {
  locations: WorldLocation[];
  paths: WorldPath[];
  npcs: WorldNpc[];
  heroArrivalComments: HeroArrivalComment[];
  blockingEncounters: BlockingEncounter[];
}

let worldDataCache: WorldDataSet | null = null;
let fetchPromise: Promise<WorldDataSet> | null = null;

/**
 * Load all world data from the pre-compiled JSON file.
 * Returns cached results on subsequent calls.
 */
export async function loadWorldData(): Promise<WorldDataSet> {
  if (worldDataCache) return worldDataCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ?? '/';
      const url = `${base}game-data/world-data.json`.replace('//', '/');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch world-data.json: ${res.status}`);
      const data: WorldDataSet = await res.json();
      worldDataCache = data;
      return data;
    } catch (err) {
      console.error('Failed to load world data from world-data.json:', err);
      worldDataCache = {
        locations: [],
        paths: [],
        npcs: [],
        heroArrivalComments: [],
        blockingEncounters: [],
      };
      return worldDataCache;
    }
  })();

  return fetchPromise;
}

/**
 * Synchronous access to cached world data.
 * Returns null if not yet loaded — call loadWorldData() first.
 */
export function getWorldData(): WorldDataSet | null {
  return worldDataCache;
}
