/**
 * Enemy Data — loads pre-compiled enemy template data from JSON.
 *
 * At build time, `scripts/compile-game-data.js` reads `game/brl/enemies.brl`
 * and produces `public/game-data/enemies.json`.  This module fetches that
 * pre-compiled JSON at runtime, avoiding any BRL parsing in the browser.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface EnemyTemplate {
  id: number;
  tier: number;
  name: string;
  hp: number;
  dmg: number;
  def: number;
  spd: number;
  exp: number;
  boss: boolean;
  /** True only for the final boss entity (has FinalBoss component). */
  finalBoss: boolean;
  /** Full component data for stats injection */
  stats: { strength: number; dexterity: number; intelligence: number; constitution: number; wisdom: number };
  /** Mana pool */
  mana: number;
  /** Crit values */
  critChance: number;
  critMultiplier: number;
}

// ── Cache ────────────────────────────────────────────────────────────────────

let templateCache: EnemyTemplate[] | null = null;
let fetchPromise: Promise<EnemyTemplate[]> | null = null;

/**
 * Load enemy templates from the pre-compiled JSON file.
 * Returns cached results on subsequent calls.
 */
export async function loadEnemyTemplates(): Promise<EnemyTemplate[]> {
  if (templateCache) return templateCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ?? '/';
      const url = `${base}game-data/enemies.json`.replace('//', '/');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch enemies.json: ${res.status}`);
      const templates: EnemyTemplate[] = await res.json();
      templateCache = templates;
      return templates;
    } catch (err) {
      console.error('Failed to load enemy templates from enemies.json:', err);
      templateCache = [];
      return templateCache;
    }
  })();

  return fetchPromise;
}

/**
 * Synchronous access to cached enemy templates.
 * Returns null if not yet loaded — call loadEnemyTemplates() first.
 */
export function getEnemyTemplates(): EnemyTemplate[] | null {
  return templateCache;
}
