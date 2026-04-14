/**
 * Hero Class Data — loads hero class balance data from the canonical BRL source.
 *
 * Previously, hero class stats were hardcoded in WasmSimEngine.ts
 * (CLASS_BASE_HP, CLASS_BASE_DAMAGE, CLASS_BASE_DEFENSE, CLASS_ATTACK_SPEED,
 * CLASS_SKILLS) and traits.ts (CLASS_BASE_GROWTH, ELEMENT_THRESHOLD).
 *
 * This module loads the same data from `game/brl/hero-classes.brl`
 * (served at `public/game-files/hero-classes.brl`), making the BRL file
 * the single source of truth for hero class balance.
 *
 * Parsed results are cached after the first fetch.
 */

import {
  parseEntities,
  getComponent,
  extractStringField,
  extractNumberField,
  fetchBrlFile,
} from './brlParser';

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

// ── Parsing ─────────────────────────────────────────────────────────────────

function parseHeroClassData(text: string): {
  classes: Record<string, HeroClassData>;
  balanceConfig: HeroBalanceConfig;
} {
  const entities = parseEntities(text);
  const classes: Record<string, HeroClassData> = {};
  let balanceConfig: HeroBalanceConfig = { elementThreshold: 5 };

  for (const entity of entities) {
    // Parse balance config entity
    const balComp = getComponent(entity, 'HeroBalanceConfig');
    if (balComp) {
      balanceConfig = {
        elementThreshold: extractNumberField(balComp.body, 'elementThreshold') ?? 5,
      };
      continue;
    }

    // Parse hero class entities
    const classDef = getComponent(entity, 'HeroClassDef');
    if (!classDef) continue;

    const className = extractStringField(classDef.body, 'className');
    if (!className) continue;

    const combatComp = getComponent(entity, 'HeroBaseCombat');
    const skillsComp = getComponent(entity, 'HeroStartingSkills');
    const growthComp = getComponent(entity, 'HeroGrowthVector');

    classes[className] = {
      className,
      combat: {
        baseHp: extractNumberField(combatComp?.body ?? '', 'baseHp') ?? 100,
        baseDamage: extractNumberField(combatComp?.body ?? '', 'baseDamage') ?? 15,
        baseDefense: extractNumberField(combatComp?.body ?? '', 'baseDefense') ?? 5,
        baseAttackSpeed: extractNumberField(combatComp?.body ?? '', 'baseAttackSpeed') ?? 1.0,
      },
      skills: {
        skill1: extractStringField(skillsComp?.body ?? '', 'skill1'),
        skill2: extractStringField(skillsComp?.body ?? '', 'skill2'),
        skill3: extractStringField(skillsComp?.body ?? '', 'skill3'),
        skill4: extractStringField(skillsComp?.body ?? '', 'skill4'),
      },
      growth: {
        growthStr: extractNumberField(growthComp?.body ?? '', 'growthStr') ?? 0.2,
        growthDex: extractNumberField(growthComp?.body ?? '', 'growthDex') ?? 0.2,
        growthInt: extractNumberField(growthComp?.body ?? '', 'growthInt') ?? 0.2,
        growthCon: extractNumberField(growthComp?.body ?? '', 'growthCon') ?? 0.2,
        growthWis: extractNumberField(growthComp?.body ?? '', 'growthWis') ?? 0.2,
      },
    };
  }

  return { classes, balanceConfig };
}

// ── Cache ────────────────────────────────────────────────────────────────────

let classDataCache: Record<string, HeroClassData> | null = null;
let balanceConfigCache: HeroBalanceConfig | null = null;
let fetchPromise: Promise<{ classes: Record<string, HeroClassData>; balanceConfig: HeroBalanceConfig }> | null = null;

/**
 * Load hero class data from the BRL file.
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
      const text = await fetchBrlFile('hero-classes.brl');
      const result = parseHeroClassData(text);
      classDataCache = result.classes;
      balanceConfigCache = result.balanceConfig;
      return result;
    } catch (err) {
      console.error('Failed to load hero class data from hero-classes.brl:', err);
      // Return empty defaults — engine will use fallback data
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
