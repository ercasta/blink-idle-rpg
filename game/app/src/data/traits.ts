/**
 * Character Traits System — implements doc/game-design/character-traits.md.
 *
 * Traits are 12 signed integers in [−16, 15] that drive stat growth,
 * skill selection, and AI decision weights.
 */

import type { HeroClass, HeroTraits, DamageCategory, Element, LinePreference, HeroRole } from '../types';

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

const CLASS_BASE_GROWTH: Record<HeroClass, [number, number, number, number, number]> = {
  // [STR, DEX, INT, CON, WIS]
  Warrior: [0.60, 0.25, 0.05, 0.55, 0.15],
  Mage:    [0.05, 0.20, 0.70, 0.10, 0.55],
  Ranger:  [0.20, 0.70, 0.10, 0.25, 0.15],
  Paladin: [0.40, 0.15, 0.10, 0.40, 0.55],
  Rogue:   [0.35, 0.65, 0.05, 0.25, 0.10],
  Cleric:  [0.10, 0.15, 0.35, 0.30, 0.70],
};

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

  const baseGrowth = CLASS_BASE_GROWTH[heroClass];
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

  const baseGrowth = CLASS_BASE_GROWTH[heroClass];
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

// ── Skill name formatting ────────────────────────────────────────────────────

/**
 * Get the display name of a skill by its ID.
 * Formats IDs like "power_strike" to "Power Strike".
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getSkillName(skillId: string, _heroClass?: string): string {
  return skillId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ── Damage type & resistance derivation from traits ─────────────────────────

const ELEMENT_THRESHOLD = 5;

/**
 * Derive a hero's primary damage category from the pm trait.
 * Physical (pm ≤ −5), Magical (pm ≥ 5), default Physical.
 */
export function deriveDamageCategory(traits: HeroTraits): DamageCategory {
  return traits.pm >= ELEMENT_THRESHOLD ? 'magical' : 'physical';
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
    if (mag >= ELEMENT_THRESHOLD && mag > best.magnitude) {
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
  return Math.max(0, Math.min(50, (oriented - ELEMENT_THRESHOLD) * 5));
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
