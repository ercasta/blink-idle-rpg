/**
 * Auto-generated hero descriptions based on character traits.
 *
 * Generates 2-3 paragraphs that describe the hero's personality,
 * combat style and elemental/spiritual nature. The most extreme traits
 * get longer sentences; mild traits get brief phrases.
 */

import type { HeroTraits, HeroClass } from '../types';
import { computeLinePreference, computeRole } from './traits';

// ── Threshold helpers ────────────────────────────────────────────────────────

/** Trait intensity classification */
function intensity(value: number): 'strong' | 'moderate' | 'mild' | 'neutral' {
  const abs = Math.abs(value);
  if (abs >= 11) return 'strong';
  if (abs >= 6) return 'moderate';
  if (abs >= 3) return 'mild';
  return 'neutral';
}

function pos(value: number) { return value > 0; }

// ── Per-trait sentence banks ─────────────────────────────────────────────────
// Each trait has sentences keyed by direction (positive/negative) and intensity

const PM_SENTENCES = {
  negative: {
    strong: 'A warrior of raw physical might, this hero relies on muscle and steel above all else.',
    moderate: 'Grounded in physical combat, this hero trusts strength and endurance over arcane arts.',
    mild: 'More comfortable with blade than spell.',
  },
  positive: {
    strong: 'This hero draws power from the arcane, weaving magic as naturally as others breathe.',
    moderate: 'Attuned to magical forces, this hero blends spellcraft into every aspect of combat.',
    mild: 'A touch of magic colours this hero\'s fighting style.',
  },
};

const OD_SENTENCES = {
  negative: {
    strong: 'Relentlessly offensive, this hero presses every advantage and never backs down from a fight.',
    moderate: 'An aggressive combatant who keeps constant pressure on the enemy.',
    mild: 'Slightly more attack-minded than most.',
  },
  positive: {
    strong: 'A stalwart guardian, this hero would sooner absorb a hundred blows than let an ally fall.',
    moderate: 'Defensive instincts run deep, making this hero a reliable shield for the party.',
    mild: 'A measured defender who picks battles wisely.',
  },
};

const SA_SENTENCES = {
  negative: {
    strong: 'Selfless to a fault, this hero channels every action into uplifting and protecting companions.',
    moderate: 'A natural supporter who finds meaning in boosting allies rather than personal glory.',
    mild: 'Leans toward helping others when the chance arises.',
  },
  positive: {
    strong: 'Driven by personal glory, this hero charges headlong into the fray seeking kills and conquest.',
    moderate: 'An ambitious attacker who hunts the strongest foes.',
    mild: 'Shows a clear taste for direct combat.',
  },
};

const RC_SENTENCES = {
  negative: {
    strong: 'Reckless and bold, this hero dives into danger with no thought for the consequences.',
    moderate: 'Takes calculated risks freely, often acting before thinking.',
    mild: 'Has a slight daring streak.',
  },
  positive: {
    strong: 'Methodical and cautious, this hero never acts without a plan and always keeps an escape route open.',
    moderate: 'Patient and measured, preferring careful strategy over rash action.',
    mild: 'Shows a steady, cautious hand in dangerous moments.',
  },
};

const FW_SENTENCES = {
  negative: {
    strong: 'Fire courses through this hero\'s soul — a passionate, burning force that scorches all in its path.',
    moderate: 'The heat of fire shapes this hero\'s elemental affinities and temper alike.',
    mild: 'A faint flame flickers in this hero\'s elemental nature.',
  },
  positive: {
    strong: 'Cool as still water, this hero flows around obstacles and extinguishes rage with calm precision.',
    moderate: 'An affinity for water lends this hero fluid adaptability in the heat of battle.',
    mild: 'A subtle kinship with water tempers this hero\'s fire.',
  },
};

const WE_SENTENCES = {
  negative: {
    strong: 'Swift as the wind, this hero strikes from unexpected angles and vanishes before retaliation.',
    moderate: 'The wind\'s restlessness runs in this hero\'s veins, making them unpredictable and hard to pin down.',
    mild: 'A breezy quality marks this hero\'s movements.',
  },
  positive: {
    strong: 'Rooted like ancient stone, this hero endures what would break others through sheer immovable will.',
    moderate: 'Earth-bound and steadfast, this hero gains strength from holding their ground.',
    mild: 'A grounded solidity underpins this hero\'s approach.',
  },
};

const LD_SENTENCES = {
  negative: {
    strong: 'Blessed by radiant light, this hero carries hope as a weapon and drives back darkness wherever it lurks.',
    moderate: 'The light guides this hero\'s purpose and keeps their allies from despair.',
    mild: 'A soft light illuminates this hero\'s convictions.',
  },
  positive: {
    strong: 'This hero walks willingly through shadow, wielding darkness as a cloak and a weapon.',
    moderate: 'Comfortable with the unseen, this hero exploits the shadows others fear.',
    mild: 'Darkness is no stranger to this hero.',
  },
};

const CO_SENTENCES = {
  negative: {
    strong: 'Chaos is this hero\'s element — improvised, wild, and gloriously unpredictable in every encounter.',
    moderate: 'Prone to creative chaos, this hero adapts on the fly with inspired improvisation.',
    mild: 'Has a slightly chaotic streak that keeps enemies guessing.',
  },
  positive: {
    strong: 'Disciplined and orderly, this hero fights with clockwork precision and unerring focus.',
    moderate: 'Order and structure give this hero a reliable edge in sustained engagements.',
    mild: 'Prefers a structured approach when options allow.',
  },
};

const SH_SENTENCES = {
  negative: {
    strong: 'A cunning schemer, this hero achieves victory through deception, misdirection, and clever traps.',
    moderate: 'Shrewd and resourceful, this hero is not above bending the rules to win.',
    mild: 'A sly glint shows in this hero\'s eyes.',
  },
  positive: {
    strong: 'Bound by an iron code of honour, this hero refuses any victory that comes at the cost of principle.',
    moderate: 'Honour guides every decision, making this hero trustworthy to allies and respected by foes.',
    mild: 'A strong sense of integrity shapes this hero\'s choices.',
  },
};

const RM_SENTENCES = {
  negative: {
    strong: 'A long-range specialist who picks enemies apart from a distance with precise, lethal fire.',
    moderate: 'Prefers to engage from range, keeping enemies at arm\'s length.',
    mild: 'Has a slight preference for ranged engagements.',
  },
  positive: {
    strong: 'In the thick of melee, this hero thrives — close quarters is where they feel most alive.',
    moderate: 'Most effective up close, this hero drives hard into the heart of the enemy line.',
    mild: 'Gravitates toward melee when given the choice.',
  },
};

const AI_SENTENCES = {
  negative: {
    strong: 'A natural sponge of power, this hero drains life and energy from foes to fuel their own survival.',
    moderate: 'Absorbs damage and resources with uncanny efficiency, turning enemy aggression into their own strength.',
    mild: 'Shows a slight tendency to absorb rather than project force.',
  },
  positive: {
    strong: 'Overflowing with destructive intent, this hero unleashes damage rather than absorbing it.',
    moderate: 'Prefers to deal out punishment rather than endure it.',
    mild: 'A small aggressive instinct pushes this hero to inflict rather than absorb.',
  },
};

const AF_SENTENCES = {
  negative: {
    strong: 'A force of sweeping devastation, this hero strikes many targets at once to maximise collective carnage.',
    moderate: 'Commands the battlefield through area-wide attacks that punish clustered enemies.',
    mild: 'Shows a slight preference for area-covering techniques.',
  },
  positive: {
    strong: 'Every strike is surgical and deliberate, targeting a single enemy with absolute focused intensity.',
    moderate: 'Locks onto priority targets with unwavering concentration.',
    mild: 'Tends to focus on one target at a time.',
  },
};

// ── Class intro sentences ────────────────────────────────────────────────────

const CLASS_INTROS: Record<HeroClass, string> = {
  Warrior:  'A trained warrior who has survived countless battles through strength and iron will.',
  Mage:     'A scholar of the arcane arts who has mastered the weaving of magical forces.',
  Ranger:   'A seasoned scout who reads the land and strikes with the patience of a predator.',
  Paladin:  'A holy champion forged in equal parts devotion and battle-hardened experience.',
  Rogue:    'A shadow-dancer who turns every situation into an opportunity with lightning reflexes.',
  Cleric:   'A devoted servant of higher powers who channels divine energy into healing and judgement.',
};

// ── Description composer ────────────────────────────────────────────────────

interface TraitEntry {
  key: keyof HeroTraits;
  value: number;
  abs: number;
  intens: 'strong' | 'moderate' | 'mild' | 'neutral';
}

function getSentence(key: keyof HeroTraits, value: number): string | null {
  const intens = intensity(value);
  if (intens === 'neutral') return null;
  const isPos = pos(value);

  const banks: Record<keyof HeroTraits, typeof PM_SENTENCES> = {
    pm: PM_SENTENCES, od: OD_SENTENCES, sa: SA_SENTENCES, rc: RC_SENTENCES,
    fw: FW_SENTENCES, we: WE_SENTENCES, ld: LD_SENTENCES, co: CO_SENTENCES,
    sh: SH_SENTENCES, rm: RM_SENTENCES, ai: AI_SENTENCES, af: AF_SENTENCES,
  };

  const bank = banks[key];
  const dir = isPos ? bank.positive : bank.negative;

  if (intens === 'strong') return dir.strong;
  if (intens === 'moderate') return dir.moderate;
  return dir.mild;
}

/**
 * Generate a 2-3 paragraph description for a hero based on their traits.
 * The most extreme traits dominate, weaker ones are mentioned briefly.
 */
export function generateHeroDescription(heroClass: HeroClass, traits: HeroTraits): string {
  // Sort traits by absolute value descending
  const entries: TraitEntry[] = (Object.keys(traits) as (keyof HeroTraits)[]).map(key => ({
    key,
    value: traits[key],
    abs: Math.abs(traits[key]),
    intens: intensity(traits[key]),
  })).sort((a, b) => b.abs - a.abs);

  const strong = entries.filter(e => e.intens === 'strong');
  const moderate = entries.filter(e => e.intens === 'moderate');
  const mild = entries.filter(e => e.intens === 'mild');

  const paragraphs: string[] = [];

  // Compute line and role for the intro sentence
  const line = computeLinePreference(traits);
  const role = computeRole(heroClass, traits);
  const lineRoleSentence = line === 'front'
    ? `Preferring the front line, this ${role} excels at close-quarters engagement.`
    : `Favoring the back line, this ${role} contributes best from a safe distance.`;

  // Paragraph 1: Class intro + line/role sentence + top strong traits (up to 2)
  const p1Parts: string[] = [CLASS_INTROS[heroClass], lineRoleSentence];
  for (const e of strong.slice(0, 2)) {
    const s = getSentence(e.key, e.value);
    if (s) p1Parts.push(s);
  }
  paragraphs.push(p1Parts.join(' '));

  // Paragraph 2: Remaining strong + leading moderate traits
  const p2Entries = [...strong.slice(2), ...moderate.slice(0, 3)];
  if (p2Entries.length > 0) {
    const p2Parts = p2Entries.map(e => getSentence(e.key, e.value)).filter(Boolean) as string[];
    if (p2Parts.length > 0) {
      paragraphs.push(p2Parts.join(' '));
    }
  }

  // Paragraph 3: Mild traits (brief phrases) if any meaningful ones
  const p3Entries = [...moderate.slice(3), ...mild.slice(0, 4)];
  if (p3Entries.length > 0) {
    const p3Parts = p3Entries.map(e => getSentence(e.key, e.value)).filter(Boolean) as string[];
    if (p3Parts.length > 0) {
      paragraphs.push(p3Parts.join(' '));
    }
  }

  // Ensure at least 2 paragraphs
  if (paragraphs.length < 2) {
    paragraphs.push('This hero\u2019s potential is still unwritten, ready to be shaped by the battles ahead.');
  }

  return paragraphs.join('\n\n');
}

// ── URL encoding/decoding of hero share data ─────────────────────────────────

export interface SharedHeroData {
  name: string;
  heroClass: HeroClass;
  traits: HeroTraits;
  /** Total adventures played — included in QR to track hero history */
  adventuresPlayed?: number;
}

const TRAIT_KEYS: (keyof HeroTraits)[] = ['pm', 'od', 'sa', 'rc', 'fw', 'we', 'ld', 'co', 'sh', 'rm', 'ai', 'af'];
const HERO_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

/**
 * Single-character codes for each hero class (compact QR encoding).
 * W=Warrior, M=Mage, R=Ranger, P=Paladin, G=roGue, C=Cleric
 */
const CLASS_TO_CODE: Record<HeroClass, string> = {
  Warrior: 'W', Mage: 'M', Ranger: 'R', Paladin: 'P', Rogue: 'G', Cleric: 'C',
};
const CODE_TO_CLASS: Record<string, HeroClass> = {
  W: 'Warrior', M: 'Mage', R: 'Ranger', P: 'Paladin', G: 'Rogue', C: 'Cleric',
};

/**
 * Encode all 12 trait values into a 24-character string.
 * Each trait value (−16…15) is offset by +16 → 0…31, then zero-padded to 2 decimal digits.
 * Example: −16 → "00", 0 → "16", 15 → "31"
 */
function encodeTraits(traits: HeroTraits): string {
  return TRAIT_KEYS.map(k => String(traits[k] + 16).padStart(2, '0')).join('');
}

/**
 * Decode a 24-character trait string back to a HeroTraits object.
 * Returns null if the string is malformed.
 */
function decodeTraits(encoded: string): HeroTraits | null {
  if (encoded.length !== 24) return null;
  const result: Partial<HeroTraits> = {};
  for (let i = 0; i < TRAIT_KEYS.length; i++) {
    const raw = parseInt(encoded.slice(i * 2, i * 2 + 2), 10);
    if (isNaN(raw) || raw < 0 || raw > 31) return null;
    result[TRAIT_KEYS[i]] = raw - 16;
  }
  return result as HeroTraits;
}

/**
 * Encode a hero's share data into URL search params (compact format).
 *
 * Compact params:
 *   n  – hero name
 *   c  – class as 1 alphanumeric char (W/M/R/P/G/C)
 *   t  – 24-char trait string (all 12 traits, 2 decimal digits each, offset +16)
 *   a  – adventures played (optional)
 */
export function encodeHeroToParams(data: SharedHeroData): URLSearchParams {
  const params = new URLSearchParams();
  params.set('n', data.name);
  params.set('c', CLASS_TO_CODE[data.heroClass]);
  params.set('t', encodeTraits(data.traits));
  if (data.adventuresPlayed !== undefined && data.adventuresPlayed > 0) {
    params.set('a', String(data.adventuresPlayed));
  }
  return params;
}

/**
 * Decode hero share data from URL search params.
 * Supports both the compact format (n/c/t/a) and the legacy format (heroName/heroClass/pm/od/…).
 * Returns null if the params are missing or invalid.
 */
export function decodeHeroFromParams(params: URLSearchParams): SharedHeroData | null {
  // ── Compact format ──────────────────────────────────────────────────────────
  const nameCompact = params.get('n');
  const classCode = params.get('c');
  const traitStr = params.get('t');
  if (nameCompact && classCode && traitStr) {
    const heroClass = CODE_TO_CLASS[classCode];
    if (!heroClass) return null;
    const traits = decodeTraits(traitStr);
    if (!traits) return null;
    const adventuresRaw = params.get('a');
    const adventuresPlayed = adventuresRaw !== null ? parseInt(adventuresRaw, 10) : undefined;
    return {
      name: nameCompact,
      heroClass,
      traits,
      adventuresPlayed: adventuresPlayed !== undefined && !isNaN(adventuresPlayed) ? adventuresPlayed : undefined,
    };
  }

  // ── Legacy format (heroName / heroClass / individual trait params) ──────────
  const name = params.get('heroName');
  const heroClassRaw = params.get('heroClass');
  if (!name || !heroClassRaw) return null;
  if (!HERO_CLASSES.includes(heroClassRaw as HeroClass)) return null;

  const traits: Partial<HeroTraits> = {};
  for (const key of TRAIT_KEYS) {
    const raw = params.get(key);
    if (raw === null) return null;
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < -16 || val > 15) return null;
    traits[key] = val;
  }

  return {
    name,
    heroClass: heroClassRaw as HeroClass,
    traits: traits as HeroTraits,
  };
}
