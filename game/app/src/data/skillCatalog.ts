/**
 * Skill Catalog — extracts skill descriptions embedded in the BRL skill-catalog file.
 *
 * The skill descriptions live in `public/game-files/skill-catalog.brl` as entities
 * carrying a `SkillInfo` component.  This module fetches that file at runtime and
 * parses out the descriptions using a lightweight regex approach, so the authoritative
 * source of truth always remains the BRL file itself.
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

// ── Simple BRL string-field extractor ────────────────────────────────────────

/**
 * Extract the value of a string field from a BRL component block snippet.
 * e.g.  `  name: "Power Strike"` → "Power Strike"
 */
function extractField(block: string, field: string): string {
  const re = new RegExp(`\\b${field}:\\s*"([^"]*)"`, 's');
  const m = block.match(re);
  return m ? m[1] : '';
}

/**
 * Parse all SkillInfo entities from raw BRL text.
 * Looks for blocks of the form:
 *   SkillInfo {
 *     id: "..."
 *     name: "..."
 *     ...
 *   }
 */
function parseBrl(text: string): SkillEntry[] {
  const entries: SkillEntry[] = [];

  // Match every SkillInfo { ... } block
  const blockRe = /SkillInfo\s*\{([^}]*)\}/gs;
  let m: RegExpExecArray | null;

  while ((m = blockRe.exec(text)) !== null) {
    const block = m[1];
    const id = extractField(block, 'id');
    if (!id) continue;

    const name = extractField(block, 'name');
    const description = extractField(block, 'description');
    const skillType = extractField(block, 'skillType');
    const prereqRaw = extractField(block, 'prerequisites');
    const prerequisites = prereqRaw
      ? prereqRaw.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    entries.push({ id, name, description, skillType, prerequisites });
  }

  return entries;
}

// ── Cache ────────────────────────────────────────────────────────────────────

let catalogCache: Map<string, SkillEntry> | null = null;
let fetchPromise: Promise<Map<string, SkillEntry>> | null = null;

/**
 * Fetch and parse the skill catalog BRL file.
 * Returns a Map of skill-id → SkillEntry.
 * Subsequent calls return the cached result without re-fetching.
 */
export async function loadSkillCatalog(): Promise<Map<string, SkillEntry>> {
  if (catalogCache) return catalogCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const base = import.meta.env?.BASE_URL ?? '/';
      const url = `${base}game-files/skill-catalog.brl`.replace('//', '/');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch skill catalog: ${res.status}`);
      const text = await res.text();
      const entries = parseBrl(text);
      const map = new Map<string, SkillEntry>(entries.map(e => [e.id, e]));
      catalogCache = map;
      return map;
    } catch (err) {
      // Log for debugging; return empty map so the UI degrades gracefully
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
