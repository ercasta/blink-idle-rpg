/**
 * Character Traits System — implements doc/game-design/character-traits.md.
 *
 * Traits are 12 signed integers in [−16, 15] that drive stat growth,
 * skill selection, and AI decision weights.
 *
 * Game balance data (class growth vectors, element threshold) is loaded
 * from hero-classes.brl at runtime via heroClassData.ts.  BRL is the
 * single source of truth — loadHeroClassData() must be called before
 * using any stat computation or element derivation functions.
 */

import type { HeroClass, HeroTraits, HeroPathEntry, DamageCategory, Element, LinePreference, HeroRole } from '../types';
import { getHeroClassData, getHeroBalanceConfig } from './heroClassData';

// ── Trait axis metadata (for UI) ────────────────────────────────────────────

export interface TraitAxis {
  key: keyof HeroTraits;
  negativePole: string;
  positivePole: string;
}

export const TRAIT_AXES: TraitAxis[] = [
  { key: 'pm', negativePole: 'Physical', positivePole: 'Magical' },
  { key: 'od', negativePole: 'Offensive', positivePole: 'Defensive' },
  { key: 'sa', negativePole: 'Supportive', positivePole: 'Attacker' },
  { key: 'rc', negativePole: 'Risky', positivePole: 'Cautious' },
  { key: 'fw', negativePole: 'Fire', positivePole: 'Water' },
  { key: 'we', negativePole: 'Wind', positivePole: 'Earth' },
  { key: 'ld', negativePole: 'Light', positivePole: 'Darkness' },
  { key: 'co', negativePole: 'Chaos', positivePole: 'Order' },
  { key: 'sh', negativePole: 'Sly', positivePole: 'Honorable' },
  { key: 'rm', negativePole: 'Range', positivePole: 'Melee' },
  { key: 'ai', negativePole: 'Absorb', positivePole: 'Inflict' },
  { key: 'af', negativePole: 'Area', positivePole: 'Focus' },
];

export const TRAIT_MIN = -16;
export const TRAIT_MAX = 15;

export function defaultTraits(): HeroTraits {
  return { pm: 0, od: 0, sa: 0, rc: 0, fw: 0, we: 0, ld: 0, co: 0, sh: 0, rm: 0, ai: 0, af: 0 };
}

export function randomTraits(): HeroTraits {
  const t = defaultTraits();
  for (const axis of TRAIT_AXES) {
    t[axis.key] = Math.floor(Math.random() * 32) - 16; // [−16, 15]
  }
  return t;
}

// ── Normalisation ───────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function norm(t: number): number {
  return clamp(t, -16, 15) / 16.0;
}

// ── Gaussian random (Box-Muller) ────────────────────────────────────────────

function gaussian(mean: number, sigma: number): number {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  return mean + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── Class base-growth vectors ───────────────────────────────────────────────
// Growth vectors are loaded from hero-classes.brl at runtime via
// heroClassData.ts.  BRL is the single source of truth — there are no
// hardcoded fallbacks.  Call loadHeroClassData() before using stat
// computation functions.

function _getClassGrowth(heroClass: HeroClass): [number, number, number, number, number] {
  const classData = getHeroClassData();
  if (classData) {
    const cd = classData[heroClass];
    if (cd) {
      return [cd.growth.growthStr, cd.growth.growthDex, cd.growth.growthInt, cd.growth.growthCon, cd.growth.growthWis];
    }
  }
  throw new Error(
    `Hero class data for "${heroClass}" not loaded. Call loadHeroClassData() before using stat computation functions.`,
  );
}

function _getElementThreshold(): number {
  const config = getHeroBalanceConfig();
  if (config) return config.elementThreshold;
  throw new Error(
    'Hero balance config not loaded. Call loadHeroClassData() before using element derivation functions.',
  );
}

// ── Deterministic base stats from class + traits ────────────────────────────

/**
 * Compute base stats deterministically from class and traits.
 * Distributes 40 total stat points (base 4 per stat + 20 distributed)
 * using class growth weights modified by trait affinities, with no randomness.
 */
export function computeBaseStats(
  heroClass: HeroClass,
  traits: HeroTraits,
): { strength: number; dexterity: number; intelligence: number; constitution: number; wisdom: number } {
  const w_pm = norm(traits.pm);
  const w_od = norm(traits.od);
  const w_sa = norm(traits.sa);
  const w_rc = norm(traits.rc);
  const w_fw = norm(traits.fw);
  const w_we = norm(traits.we);
  const w_ld = norm(traits.ld);
  const w_co = norm(traits.co);
  const w_sh = norm(traits.sh);
  const w_rm = norm(traits.rm);
  const w_ai = norm(traits.ai);

  // Same trait affinity scores as computeLevelUpGains
  const affinity_STR = -w_pm + w_rm - w_od + w_sa;
  const affinity_DEX = -w_rm - w_rc - w_sh - w_we;
  const affinity_INT =  w_pm - w_fw - w_co;
  const affinity_CON =  w_od - w_ai + w_rc + w_we;
  const affinity_WIS = -w_sa + w_sh + w_co - w_ld;

  const baseGrowth = _getClassGrowth(heroClass);
  const affinities = [affinity_STR, affinity_DEX, affinity_INT, affinity_CON, affinity_WIS];

  // Combine class growth with trait affinities (deterministic, no jitter)
  const weights: number[] = [];
  for (let i = 0; i < 5; i++) {
    let w = baseGrowth[i] + affinities[i] * 0.35;
    w = Math.max(0.05, w);
    weights.push(w);
  }

  // Distribute 20 points proportionally (each stat starts at 4, total = 40)
  const pool = 20;
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map(w => (w / totalWeight) * pool);
  const stats = raw.map(r => Math.floor(r));

  // Distribute remaining fractional points by largest remainder
  let allocated = stats.reduce((a, b) => a + b, 0);
  const remainders = raw.map((r, i) => ({ i, frac: r - stats[i] }));
  remainders.sort((a, b) => b.frac - a.frac);
  for (const { i } of remainders) {
    if (allocated >= pool) break;
    stats[i]++;
    allocated++;
  }

  // Add base of 4, cap each stat at [4, 18]
  const statNames = ['strength', 'dexterity', 'intelligence', 'constitution', 'wisdom'] as const;
  const result: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    result[statNames[i]] = clamp(4 + stats[i], 4, 18);
  }

  return result as { strength: number; dexterity: number; intelligence: number; constitution: number; wisdom: number };
}

// ── Stat growth per level-up ────────────────────────────────────────────────

/**
 * Compute stat points gained on a single level-up, driven by traits.
 * Returns [str, dex, int, con, wis] gains.
 */
export function computeLevelUpGains(
  heroClass: HeroClass,
  traits: HeroTraits,
): [number, number, number, number, number] {
  const w_pm = norm(traits.pm);
  const w_od = norm(traits.od);
  const w_sa = norm(traits.sa);
  const w_rc = norm(traits.rc);
  const w_fw = norm(traits.fw);
  const w_we = norm(traits.we);
  const w_ld = norm(traits.ld);
  const w_co = norm(traits.co);
  const w_sh = norm(traits.sh);
  const w_rm = norm(traits.rm);
  const w_ai = norm(traits.ai);
  // w_af not used in stat growth formulas

  // Step 1: Trait affinity scores
  const affinity_STR = -w_pm + w_rm - w_od + w_sa;
  const affinity_DEX = -w_rm - w_rc - w_sh - w_we;
  const affinity_INT =  w_pm - w_fw - w_co;
  const affinity_CON =  w_od - w_ai + w_rc + w_we;
  const affinity_WIS = -w_sa + w_sh + w_co - w_ld;

  const baseGrowth = _getClassGrowth(heroClass);
  const affinities = [affinity_STR, affinity_DEX, affinity_INT, affinity_CON, affinity_WIS];

  // Step 2: Combine with class base growth
  const weights: number[] = [];
  for (let i = 0; i < 5; i++) {
    let w = baseGrowth[i] + affinities[i] * 0.35;
    // Step 3: Random jitter
    w += gaussian(0, 0.08);
    w = Math.max(0.05, w);
    weights.push(w);
  }

  // Step 4: Allocate points
  const pool = 8 + Math.floor(Math.random() * 3); // 8, 9, or 10
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const raw = weights.map(w => (w / totalWeight) * pool);
  const gains = raw.map(r => Math.floor(r)) as [number, number, number, number, number];

  // Distribute remaining fractional points
  let allocated = gains.reduce((a, b) => a + b, 0);
  const remainders = raw.map((r, i) => ({ i, frac: r - gains[i] }));
  remainders.sort((a, b) => b.frac - a.frac);
  for (const { i } of remainders) {
    if (allocated >= pool) break;
    gains[i]++;
    allocated++;
  }

  return gains;
}

// ── Simplified skill selection ──────────────────────────────────────────────
//
// Since the WASM engine handles actual combat skills, we simulate a simplified
// "skill path" here for display purposes. Each class has a simplified skill
// list with trait affinity profiles. At each level, the hero picks the
// highest-scoring available skill.

interface SkillDef {
  id: string;
  name: string;
  /** Sparse trait affinity: { traitKey: coefficient } */
  affinity: Partial<Record<keyof HeroTraits, number>>;
  prereqs: string[];
}

const WARRIOR_SKILLS: SkillDef[] = [
  { id: 'W_P1',  name: 'Power Strike',      affinity: { pm: -0.8, sa: 0.6, od: -0.5, rm: 0.5 }, prereqs: [] },
  { id: 'W_P3',  name: 'Taunt',             affinity: { od: 0.8, rm: 0.4, sh: 0.5 }, prereqs: ['W_P1'] },
  { id: 'W_P5',  name: 'Cleaving Blow',     affinity: { af: -0.7, pm: -0.5, od: -0.4, sa: 0.4 }, prereqs: ['W_P1'] },
  { id: 'W_P4',  name: 'Defensive Stance',  affinity: { od: 0.9, ai: -0.6, rc: 0.5 }, prereqs: ['W_P3'] },
  { id: 'W_P6',  name: 'Rampage',           affinity: { rc: -0.8, sa: 0.7, od: -0.6, pm: -0.5 }, prereqs: ['W_P5'] },
  { id: 'W_P11', name: 'War Cry',           affinity: { sa: -0.6, af: -0.5, sh: 0.5 }, prereqs: ['W_P3'] },
  { id: 'W_P9',  name: 'Last Stand',        affinity: { od: 0.8, rc: 0.6, ai: -0.5 }, prereqs: ['W_P4'] },
  { id: 'W_P10', name: 'Execute',           affinity: { sa: 0.8, od: -0.6, af: 0.5, pm: -0.4 }, prereqs: ['W_P6'] },
  { id: 'W_A1',  name: 'Heavy Armor',       affinity: { od: 0.7, ai: -0.5, we: 0.4 }, prereqs: [] },
  { id: 'W_A5',  name: 'Brutal Strikes',    affinity: { pm: -0.6, sa: 0.6, ai: 0.5 }, prereqs: [] },
  { id: 'W_P12', name: 'Shield Wall',       affinity: { od: 0.9, ai: -0.7, sa: -0.5, rc: 0.5 }, prereqs: ['W_P4', 'W_P11'] },
  { id: 'W_P16', name: "Warlord's Command", affinity: { sa: -0.7, co: 0.6, sh: 0.6, af: -0.4 }, prereqs: ['W_P11', 'W_P12'] },
];

const MAGE_SKILLS: SkillDef[] = [
  { id: 'M_P1',  name: 'Magic Missile',     affinity: { pm: 0.8, af: 0.4, sa: 0.3 }, prereqs: [] },
  { id: 'M_P2',  name: 'Fireball',          affinity: { pm: 0.7, fw: -0.8, af: -0.6, sa: 0.4 }, prereqs: ['M_P1'] },
  { id: 'M_P3',  name: 'Frost Bolt',        affinity: { pm: 0.7, fw: 0.8, af: 0.5, rc: 0.4 }, prereqs: ['M_P1'] },
  { id: 'M_P4',  name: 'Arcane Missiles',   affinity: { pm: 0.8, sa: 0.4, af: 0.4 }, prereqs: ['M_P1'] },
  { id: 'M_P5',  name: 'Meteor',            affinity: { pm: 0.7, fw: -0.7, af: -0.6, rc: -0.5 }, prereqs: ['M_P2'] },
  { id: 'M_P7',  name: 'Mana Shield',       affinity: { pm: 0.6, ai: -0.7, od: 0.6, rc: 0.4 }, prereqs: ['M_P4'] },
  { id: 'M_P6',  name: 'Blizzard',          affinity: { pm: 0.6, fw: 0.7, af: -0.6, rc: 0.4 }, prereqs: ['M_P3'] },
  { id: 'M_A1',  name: 'Scholar',           affinity: { pm: 0.6, rc: 0.4 }, prereqs: [] },
  { id: 'M_A3',  name: 'Elemental Affinity',affinity: { pm: 0.7, fw: -0.3 }, prereqs: ['M_A1'] },
  { id: 'M_P11', name: 'Combustion',        affinity: { pm: 0.6, fw: -0.8, sa: 0.5, co: -0.4 }, prereqs: ['M_P2'] },
  { id: 'M_P15', name: 'Cataclysm',         affinity: { pm: 0.7, fw: -0.7, af: -0.7, rc: -0.5 }, prereqs: ['M_P5', 'M_P11'] },
  { id: 'M_P16', name: 'Mana Overflow',     affinity: { pm: 0.8, co: -0.5, sa: 0.4 }, prereqs: ['M_P7'] },
];

const RANGER_SKILLS: SkillDef[] = [
  { id: 'RN_P1', name: 'Aimed Shot',        affinity: { rm: -0.7, sa: 0.5, af: 0.6 }, prereqs: [] },
  { id: 'RN_P2', name: 'Multi Shot',        affinity: { rm: -0.6, af: -0.7, sa: 0.4 }, prereqs: ['RN_P1'] },
  { id: 'RN_P3', name: 'Poison Arrow',      affinity: { rm: -0.5, sh: -0.5, ai: 0.5 }, prereqs: ['RN_P1'] },
  { id: 'RN_P4', name: 'Evade',             affinity: { rc: -0.5, od: 0.4, we: -0.4 }, prereqs: [] },
  { id: 'RN_P5', name: 'Rapid Fire',        affinity: { rm: -0.6, sa: 0.6, rc: -0.4 }, prereqs: ['RN_P1'] },
  { id: 'RN_P6', name: 'Eagle Eye',         affinity: { rm: -0.5, rc: -0.3, af: 0.5 }, prereqs: [] },
  { id: 'RN_P7', name: 'Volley',            affinity: { rm: -0.6, af: -0.8, sa: 0.5 }, prereqs: ['RN_P2'] },
  { id: 'RN_P8', name: 'Sniper Shot',       affinity: { rm: -0.8, af: 0.8, sa: 0.6 }, prereqs: ['RN_P5'] },
  { id: 'RN_A1', name: 'Survival Training', affinity: { od: 0.4, rc: 0.3, we: 0.3 }, prereqs: [] },
  { id: 'RN_A2', name: 'Marksman',          affinity: { rm: -0.5, af: 0.5, sa: 0.3 }, prereqs: ['RN_P6'] },
  { id: 'RN_P9', name: 'Barrage',           affinity: { rm: -0.6, af: -0.7, rc: -0.4 }, prereqs: ['RN_P7'] },
  { id: 'RN_P10',name: 'Kill Shot',         affinity: { rm: -0.7, af: 0.7, sa: 0.7 }, prereqs: ['RN_P8'] },
];

const PALADIN_SKILLS: SkillDef[] = [
  { id: 'PA_P1', name: 'Holy Strike',       affinity: { ld: -0.7, sh: 0.5, sa: 0.3 }, prereqs: [] },
  { id: 'PA_P2', name: 'Lay on Hands',      affinity: { sa: -0.8, ld: -0.6, rc: 0.5 }, prereqs: [] },
  { id: 'PA_P3', name: 'Divine Shield',     affinity: { od: 0.8, ai: -0.7, ld: -0.5 }, prereqs: ['PA_P2'] },
  { id: 'PA_P4', name: 'Consecrate',        affinity: { ld: -0.6, af: -0.5, sh: 0.4 }, prereqs: ['PA_P1'] },
  { id: 'PA_P5', name: 'Smite',             affinity: { ld: -0.7, sa: 0.5, sh: 0.4 }, prereqs: ['PA_P1'] },
  { id: 'PA_P6', name: 'Aura of Protection',affinity: { od: 0.7, sa: -0.5, co: 0.5, sh: 0.4 }, prereqs: ['PA_P3'] },
  { id: 'PA_P7', name: 'Resurrection',      affinity: { sa: -0.7, ld: -0.7, sh: 0.5, rc: 0.5 }, prereqs: ['PA_P2', 'PA_P3'] },
  { id: 'PA_A1', name: 'Devotion',          affinity: { sa: -0.5, ld: -0.4, sh: 0.4 }, prereqs: [] },
  { id: 'PA_A2', name: 'Shield Mastery',    affinity: { od: 0.6, ai: -0.5, rc: 0.4 }, prereqs: ['PA_A1'] },
  { id: 'PA_P8', name: 'Hammer of Wrath',   affinity: { ld: -0.6, sa: 0.6, pm: -0.4 }, prereqs: ['PA_P5'] },
  { id: 'PA_P9', name: 'Guardian Angel',    affinity: { ai: -0.7, od: 0.7, rc: 0.5, ld: -0.5 }, prereqs: ['PA_P3'] },
  { id: 'PA_P10',name: 'Sacred Beacon',     affinity: { sa: -0.7, ld: -0.6, co: 0.5, sh: 0.5 }, prereqs: ['PA_P6', 'PA_P7'] },
];

const ROGUE_SKILLS: SkillDef[] = [
  { id: 'R_P1',  name: 'Backstab',          affinity: { pm: -0.6, sh: -0.7, sa: 0.5, af: 0.5 }, prereqs: [] },
  { id: 'R_P2',  name: 'Shadowstep',        affinity: { sh: -0.6, rm: -0.4, rc: -0.4, sa: 0.4 }, prereqs: ['R_P1'] },
  { id: 'R_P3',  name: 'Eviscerate',        affinity: { pm: -0.5, ai: 0.6, sa: 0.5 }, prereqs: ['R_P1'] },
  { id: 'R_P5',  name: 'Fan of Knives',     affinity: { pm: -0.4, af: -0.7, sa: 0.5 }, prereqs: ['R_P1'] },
  { id: 'R_P6',  name: 'Shadow Cloak',      affinity: { sh: -0.7, rc: 0.5, od: 0.4 }, prereqs: ['R_P2'] },
  { id: 'R_P4',  name: 'Poisoned Blade',    affinity: { sh: -0.5, ai: 0.6, pm: -0.3 }, prereqs: ['R_P3'] },
  { id: 'R_P11', name: 'Critical Focus',    affinity: { pm: -0.4, sa: 0.6, af: 0.5, rc: -0.4 }, prereqs: ['R_P1'] },
  { id: 'R_A1',  name: 'Nimble',            affinity: { rc: -0.4, rm: -0.3, we: -0.3 }, prereqs: [] },
  { id: 'R_A2',  name: 'Lethality',         affinity: { pm: -0.4, sa: 0.5, rc: -0.3 }, prereqs: ['R_A1'] },
  { id: 'R_P7',  name: 'Ambush',            affinity: { sh: -0.8, rc: -0.5, af: 0.5, sa: 0.6 }, prereqs: ['R_P6', 'R_P1'] },
  { id: 'R_P14', name: 'Lethal Precision',  affinity: { pm: -0.5, sa: 0.7, af: 0.6, ai: 0.5 }, prereqs: ['R_P11'] },
  { id: 'R_P16', name: 'Shadow Master',     affinity: { sh: -0.8, ld: 0.6, rc: 0.4 }, prereqs: ['R_P6'] },
];

const CLERIC_SKILLS: SkillDef[] = [
  { id: 'C_P1',  name: 'Heal',              affinity: { sa: -0.8, ld: -0.7, sh: 0.5 }, prereqs: [] },
  { id: 'C_P2',  name: 'Smite',             affinity: { pm: 0.5, ld: -0.6, sh: 0.4, sa: 0.3 }, prereqs: [] },
  { id: 'C_P3',  name: 'Mass Heal',         affinity: { sa: -0.7, af: -0.6, ld: -0.5 }, prereqs: ['C_P1'] },
  { id: 'C_P4',  name: 'Purify',            affinity: { sa: -0.5, ld: -0.5, co: 0.5, sh: 0.4 }, prereqs: ['C_P1'] },
  { id: 'C_P5',  name: 'Divine Shield',     affinity: { ai: -0.6, od: 0.6, ld: -0.5, rc: 0.4 }, prereqs: ['C_P3'] },
  { id: 'C_P7',  name: 'Beacon of Hope',    affinity: { sa: -0.6, ld: -0.5, co: 0.5, sh: 0.4 }, prereqs: ['C_P3'] },
  { id: 'C_P6',  name: 'Judgement',         affinity: { ld: -0.6, sa: 0.5, sh: 0.4, od: -0.3 }, prereqs: ['C_P2'] },
  { id: 'C_A1',  name: 'Devotion',          affinity: { sa: -0.5, ld: -0.4, sh: 0.4 }, prereqs: [] },
  { id: 'C_A3',  name: 'Efficient Healer',  affinity: { sa: -0.5, co: 0.4, rc: 0.3 }, prereqs: ['C_A1'] },
  { id: 'C_P9',  name: 'Resurrection',      affinity: { sa: -0.7, ld: -0.7, sh: 0.5, rc: 0.5 }, prereqs: ['C_P3', 'C_P5'] },
  { id: 'C_P15', name: 'Channel Divinity',  affinity: { sa: -0.7, ld: -0.6, co: 0.5, rc: 0.4 }, prereqs: ['C_P7', 'C_P4'] },
  { id: 'C_P16', name: 'Sacred Beacon',     affinity: { sa: -0.7, ld: -0.6, co: 0.5, sh: 0.5 }, prereqs: ['C_P7'] },
];

const CLASS_SKILL_TREES: Record<HeroClass, SkillDef[]> = {
  Warrior: WARRIOR_SKILLS,
  Mage:    MAGE_SKILLS,
  Ranger:  RANGER_SKILLS,
  Paladin: PALADIN_SKILLS,
  Rogue:   ROGUE_SKILLS,
  Cleric:  CLERIC_SKILLS,
};

/**
 * Score a skill against the hero's traits.
 * Returns the sum of (coefficient × normalised trait) + small random noise.
 */
function scoreSkill(skill: SkillDef, traits: HeroTraits): number {
  let score = 0;
  for (const [key, coeff] of Object.entries(skill.affinity)) {
    score += (coeff as number) * norm(traits[key as keyof HeroTraits]);
  }
  // Add small Gaussian noise (σ = 0.15)
  score += gaussian(0, 0.15);
  return score;
}

/**
 * Pick the best available skill the hero hasn't already acquired.
 */
function pickSkill(
  heroClass: HeroClass,
  traits: HeroTraits,
  acquiredSkills: Set<string>,
): string | null {
  const tree = CLASS_SKILL_TREES[heroClass];
  const candidates = tree.filter(s =>
    !acquiredSkills.has(s.id) &&
    s.prereqs.every(p => acquiredSkills.has(p))
  );
  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestScore = scoreSkill(best, traits);
  for (let i = 1; i < candidates.length; i++) {
    const s = scoreSkill(candidates[i], traits);
    if (s > bestScore) {
      bestScore = s;
      best = candidates[i];
    }
  }
  return best.id;
}

/**
 * Get the display name of a skill by its ID.
 */
export function getSkillName(skillId: string, heroClass: HeroClass): string {
  const tree = CLASS_SKILL_TREES[heroClass];
  const found = tree.find(s => s.id === skillId)?.name;
  if (found) return found;
  // Skill ID not in the tree — format it as a proper display name by replacing
  // underscores with spaces and capitalizing the first letter of each word.
  return skillId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ── Full hero path simulation ───────────────────────────────────────────────

/**
 * Simulate the full progression path for a hero from level 1 to maxLevel.
 * Returns a list of path entries (one per level-up) capturing stat gains
 * and skill choices.
 */
export function simulateHeroPath(
  heroClass: HeroClass,
  traits: HeroTraits,
  maxLevel: number = 50,
): HeroPathEntry[] {
  const entries: HeroPathEntry[] = [];
  const acquiredSkills = new Set<string>();
  const cumulativeStats = { str: 0, dex: 0, int: 0, con: 0, wis: 0 };

  for (let level = 2; level <= maxLevel; level++) {
    const gains = computeLevelUpGains(heroClass, traits);
    const [str, dex, int, con, wis] = gains;
    cumulativeStats.str += str;
    cumulativeStats.dex += dex;
    cumulativeStats.int += int;
    cumulativeStats.con += con;
    cumulativeStats.wis += wis;

    // Pick a skill every 2nd level, starting at 2
    let skillChosen: string | null = null;
    if (level % 2 === 0) {
      const chosen = pickSkill(heroClass, traits, acquiredSkills);
      if (chosen) {
        acquiredSkills.add(chosen);
        skillChosen = chosen;
      }
    }

    entries.push({
      level,
      statsGained: { str, dex, int, con, wis },
      skillChosen,
    });
  }

  return entries;
}

// ── Damage type & resistance derivation from traits ─────────────────────────
// Element threshold is loaded from hero-classes.brl at runtime.
// BRL is the single source of truth — loadHeroClassData() must be called
// before using these functions.

/**
 * Derive a hero's primary damage category from the pm trait.
 * Physical (pm ≤ −5), Magical (pm ≥ 5), default Physical.
 */
export function deriveDamageCategory(traits: HeroTraits): DamageCategory {
  return traits.pm >= _getElementThreshold() ? 'magical' : 'physical';
}

/**
 * Derive a hero's damage element from the fw/we/ld traits.
 * Picks the axis with the largest absolute value ≥ threshold.
 */
export function deriveDamageElement(traits: HeroTraits): Element {
  const axes: { neg: Element; pos: Element; val: number }[] = [
    { neg: 'fire',  pos: 'water',    val: traits.fw },
    { neg: 'wind',  pos: 'earth',    val: traits.we },
    { neg: 'light', pos: 'darkness', val: traits.ld },
  ];

  let best: { element: Element; magnitude: number } = { element: 'neutral', magnitude: 0 };
  for (const axis of axes) {
    const mag = Math.abs(axis.val);
    if (mag >= _getElementThreshold() && mag > best.magnitude) {
      best = { element: axis.val < 0 ? axis.neg : axis.pos, magnitude: mag };
    }
  }
  return best.element;
}

/** Resistance values (0–50) keyed by damage category or element. */
export interface ResistanceProfile {
  physical: number;
  magical: number;
  fire: number;
  water: number;
  wind: number;
  earth: number;
  light: number;
  darkness: number;
}

function resistValue(traitVal: number, negative: boolean): number {
  const oriented = negative ? -traitVal : traitVal;
  return Math.max(0, Math.min(50, (oriented - _getElementThreshold()) * 5));
}

/**
 * Derive a hero's resistance profile from traits.
 * Each resistance is 0–50% reduction for the corresponding damage type.
 */
export function deriveResistances(traits: HeroTraits): ResistanceProfile {
  return {
    physical:  resistValue(traits.pm, true),   // physical-leaning (negative pm) resists physical
    magical:   resistValue(traits.pm, false),   // magical-leaning (positive pm) resists magical
    fire:      resistValue(traits.fw, true),    // fire-leaning (negative fw) resists fire
    water:     resistValue(traits.fw, false),   // water-leaning (positive fw) resists water
    wind:      resistValue(traits.we, true),    // wind-leaning (negative we) resists wind
    earth:     resistValue(traits.we, false),   // earth-leaning (positive we) resists earth
    light:     resistValue(traits.ld, true),    // light-leaning (negative ld) resists light
    darkness:  resistValue(traits.ld, false),   // darkness-leaning (positive ld) resists darkness
  };
}

// ── Line preference (front / back) ──────────────────────────────────────────

/**
 * Compute a hero's front/back line preference score from traits.
 * Positive → prefers front line, negative → prefers back line.
 *
 * Front-line indicators: melee (positive rm), offensive (negative od),
 * attacker (positive sa), risky (negative rc), physical (negative pm).
 * Back-line indicators: range (negative rm), defensive (positive od),
 * supportive (negative sa), cautious (positive rc), magical (positive pm).
 */
export function computeLinePreferenceScore(traits: HeroTraits): number {
  const w_pm = norm(traits.pm);
  const w_od = norm(traits.od);
  const w_sa = norm(traits.sa);
  const w_rc = norm(traits.rc);
  const w_rm = norm(traits.rm);
  const w_ai = norm(traits.ai);

  return (
    w_rm * 1.5    // melee (positive rm) → front
    - w_od * 1.2  // offensive (negative od) → front
    + w_sa * 1.0  // attacker (positive sa) → front
    - w_rc * 0.8  // risky (negative rc) → front
    - w_pm * 0.6  // physical (negative pm) → front
    + w_ai * 0.5  // inflict (positive ai) → front
  );
}

export function computeLinePreference(traits: HeroTraits): LinePreference {
  return computeLinePreferenceScore(traits) >= 0 ? 'front' : 'back';
}

// ── Hero role ───────────────────────────────────────────────────────────────

/**
 * Compute a hero's combat role from traits.
 * Scores each role and picks the highest.
 */
export function computeRole(heroClass: HeroClass, traits: HeroTraits): HeroRole {
  const w_pm = norm(traits.pm);
  const w_od = norm(traits.od);
  const w_sa = norm(traits.sa);
  const w_rc = norm(traits.rc);
  const w_rm = norm(traits.rm);
  const w_ai = norm(traits.ai);
  const w_af = norm(traits.af);
  const w_co = norm(traits.co);
  const w_sh = norm(traits.sh);

  const scores: { role: HeroRole; score: number }[] = [
    { role: 'Tank',       score: w_od * 1.5 + w_rc * 1.0 + w_rm * 0.8 - w_sa * 0.5 + w_sh * 0.4 },
    { role: 'DPS',        score: -w_od * 1.2 + w_sa * 1.5 + w_ai * 1.0 - w_rc * 0.5 + w_af * 0.3 },
    { role: 'Support',    score: -w_sa * 1.5 + w_co * 0.8 + w_sh * 0.6 + w_od * 0.5 + w_rc * 0.3 },
    { role: 'Healer',     score: -w_sa * 1.3 - w_ai * 1.2 + w_rc * 0.8 + w_od * 0.5 - w_pm * 0.3 },
    { role: 'Controller', score: w_pm * 1.0 - w_af * 1.0 + w_co * 0.8 - w_sa * 0.5 + w_rc * 0.3 },
    { role: 'Skirmisher', score: -w_rm * 1.0 - w_rc * 1.0 + w_sa * 0.8 - w_od * 0.5 + w_af * 0.3 },
  ];

  const classBias: Record<HeroClass, Partial<Record<HeroRole, number>>> = {
    Warrior:  { Tank: 0.3, DPS: 0.2 },
    Mage:     { DPS: 0.2, Controller: 0.3 },
    Ranger:   { DPS: 0.2, Skirmisher: 0.3 },
    Paladin:  { Tank: 0.3, Support: 0.2 },
    Rogue:    { DPS: 0.2, Skirmisher: 0.3 },
    Cleric:   { Healer: 0.3, Support: 0.2 },
  };

  for (const s of scores) {
    s.score += classBias[heroClass]?.[s.role] ?? 0;
  }

  scores.sort((a, b) => b.score - a.score);
  return scores[0].role;
}

/**
 * Build a combined sentence describing a hero's line, role, and class.
 * e.g. "front line Support Mage"
 */
export function heroSummary(heroClass: HeroClass, traits: HeroTraits, linePreference?: LinePreference): string {
  const line = linePreference ?? computeLinePreference(traits);
  const role = computeRole(heroClass, traits);
  return `${line} line ${role} ${heroClass}`;
}
