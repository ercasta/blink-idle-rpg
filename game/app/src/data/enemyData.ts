/**
 * Enemy Data — loads enemy template data from the canonical BRL source.
 *
 * Previously, enemy stats were hardcoded in WasmSimEngine.ts as
 * ENEMY_TEMPLATES.  This module loads the same data from
 * `game/brl/enemies.brl` (served at `public/game-files/enemies.brl`),
 * making the BRL file the single source of truth.
 *
 * Parsed results are cached after the first fetch.
 */

import {
  parseEntities,
  getComponent,
  extractStringField,
  extractNumberField,
  extractBoolField,
  fetchBrlFile,
} from './brlParser';

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

// ── Parsing ─────────────────────────────────────────────────────────────────

function parseEnemyTemplates(text: string): EnemyTemplate[] {
  const entities = parseEntities(text);
  const templates: EnemyTemplate[] = [];
  let nextId = 100;

  for (const entity of entities) {
    const character = getComponent(entity, 'Character');
    const health = getComponent(entity, 'Health');
    const combat = getComponent(entity, 'Combat');
    const enemy = getComponent(entity, 'Enemy');
    const enemyTemplate = getComponent(entity, 'EnemyTemplate');
    const stats = getComponent(entity, 'Stats');
    const manaComp = getComponent(entity, 'Mana');
    const finalBoss = getComponent(entity, 'FinalBoss');

    // Only process actual enemy templates
    if (!character || !health || !combat || !enemy || !enemyTemplate) continue;

    const isTemplate = extractBoolField(enemyTemplate.body, 'isTemplate');
    if (isTemplate !== true) continue;

    templates.push({
      id: nextId++,
      tier: extractNumberField(enemy.body, 'tier') ?? 1,
      name: extractStringField(character.body, 'name'),
      hp: extractNumberField(health.body, 'max') ?? 100,
      dmg: extractNumberField(combat.body, 'damage') ?? 10,
      def: extractNumberField(combat.body, 'defense') ?? 2,
      spd: extractNumberField(combat.body, 'attackSpeed') ?? 1.0,
      exp: extractNumberField(enemy.body, 'expReward') ?? 25,
      boss: extractBoolField(enemy.body, 'isBoss') ?? false,
      finalBoss: finalBoss !== undefined,
      stats: {
        strength: extractNumberField(stats?.body ?? '', 'strength') ?? 8,
        dexterity: extractNumberField(stats?.body ?? '', 'dexterity') ?? 8,
        intelligence: extractNumberField(stats?.body ?? '', 'intelligence') ?? 4,
        constitution: extractNumberField(stats?.body ?? '', 'constitution') ?? 8,
        wisdom: extractNumberField(stats?.body ?? '', 'wisdom') ?? 4,
      },
      mana: extractNumberField(manaComp?.body ?? '', 'max') ?? 0,
      critChance: extractNumberField(combat.body, 'critChance') ?? 0.05,
      critMultiplier: extractNumberField(combat.body, 'critMultiplier') ?? 1.5,
    });
  }

  return templates;
}

// ── Cache ────────────────────────────────────────────────────────────────────

let templateCache: EnemyTemplate[] | null = null;
let fetchPromise: Promise<EnemyTemplate[]> | null = null;

/**
 * Load enemy templates from the BRL file.
 * Returns cached results on subsequent calls.
 */
export async function loadEnemyTemplates(): Promise<EnemyTemplate[]> {
  if (templateCache) return templateCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const text = await fetchBrlFile('enemies.brl');
      const templates = parseEnemyTemplates(text);
      templateCache = templates;
      return templates;
    } catch (err) {
      console.error('Failed to load enemy templates from BRL:', err);
      // Return empty array — engine will fail gracefully
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
