/**
 * Hero Class Data — loads pre-compiled hero class balance data from JSON.
 *
 * At build time, `scripts/compile-game-data.js` reads `game/brl/hero-classes.brl`
 * and produces `public/game-data/hero-classes.json`.  This module fetches that
 * pre-compiled JSON at runtime, avoiding any BRL parsing in the browser.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface HeroClassCombatData {
  baseHp: number;
  baseDamage: number;
  baseDefense: number;
  baseAttackSpeed: number;
}

export interface HeroClassSkills {
  skill1: string;
  skill2: string;
  skill3: string;
  skill4: string;
}

export interface HeroClassGrowthVector {
  /** [STR, DEX, INT, CON, WIS] growth weights */
  growthStr: number;
  growthDex: number;
  growthInt: number;
  growthCon: number;
  growthWis: number;
}

export interface HeroClassData {
  className: string;
  combat: HeroClassCombatData;
  skills: HeroClassSkills;
  growth: HeroClassGrowthVector;
}

export interface HeroBalanceConfig {
  elementThreshold: number;
}

// ── Cache ────────────────────────────────────────────────────────────────────

let classDataCache: Record<string, HeroClassData> | null = null;
let balanceConfigCache: HeroBalanceConfig | null = null;
let fetchPromise: Promise<{ classes: Record<string, HeroClassData>; balanceConfig: HeroBalanceConfig }> | null = null;

/**
 * Load hero class data from the pre-compiled JSON file.
 * Returns cached results on subsequent calls.
 */
export async function loadHeroClassData(): Promise<{
  classes: Record<string, HeroClassData>;
  balanceConfig: HeroBalanceConfig;
}> {
  if (classDataCache && balanceConfigCache) {
    return { classes: classDataCache, balanceConfig: balanceConfigCache };
  }
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ?? '/';
      const url = `${base}game-data/hero-classes.json`.replace('//', '/');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch hero-classes.json: ${res.status}`);
      const result: { classes: Record<string, HeroClassData>; balanceConfig: HeroBalanceConfig } = await res.json();
      classDataCache = result.classes;
      balanceConfigCache = result.balanceConfig;
      return result;
    } catch (err) {
      console.error('Failed to load hero class data from hero-classes.json:', err);
      classDataCache = {};
      balanceConfigCache = { elementThreshold: 5 };
      return { classes: classDataCache, balanceConfig: balanceConfigCache };
    }
  })();

  return fetchPromise;
}

/**
 * Synchronous access to cached hero class data.
 * Returns null if not yet loaded — call loadHeroClassData() first.
 */
export function getHeroClassData(): Record<string, HeroClassData> | null {
  return classDataCache;
}

/**
 * Synchronous access to cached balance config.
 * Returns null if not yet loaded — call loadHeroClassData() first.
 */
export function getHeroBalanceConfig(): HeroBalanceConfig | null {
  return balanceConfigCache;
}
