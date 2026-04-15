/**
 * Skill Catalog — loads pre-compiled skill descriptions from JSON.
 *
 * At build time, `scripts/compile-game-data.js` reads `game/brl/skill-catalog.brl`
 * and produces `public/game-data/skills.json`.  This module fetches that
 * pre-compiled JSON at runtime, avoiding any BRL parsing in the browser.
 *
 * Parsed results are cached after the first fetch.
 */

export interface SkillEntry {
  id: string;
  name: string;
  description: string;
  skillType: string;
  prerequisites: string[];
}

// ── Cache ────────────────────────────────────────────────────────────────────

let catalogCache: Map<string, SkillEntry> | null = null;
let fetchPromise: Promise<Map<string, SkillEntry>> | null = null;

/**
 * Fetch the pre-compiled skill catalog JSON.
 * Returns a Map of skill-id → SkillEntry.
 * Subsequent calls return the cached result without re-fetching.
 */
export async function loadSkillCatalog(): Promise<Map<string, SkillEntry>> {
  if (catalogCache) return catalogCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ?? '/';
      const url = `${base}game-data/skills.json`.replace('//', '/');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch skills.json: ${res.status}`);
      const entries: SkillEntry[] = await res.json();
      const map = new Map<string, SkillEntry>(entries.map(e => [e.id, e]));
      catalogCache = map;
      return map;
    } catch (err) {
      console.error('Failed to load skill catalog:', err);
      catalogCache = new Map();
      return catalogCache;
    }
  })();

  return fetchPromise;
}

/**
 * Synchronous lookup: returns the entry if already loaded, otherwise null.
 * Use after awaiting `loadSkillCatalog()`.
 */
export function getSkillEntry(skillId: string): SkillEntry | null {
  return catalogCache?.get(skillId) ?? null;
}
