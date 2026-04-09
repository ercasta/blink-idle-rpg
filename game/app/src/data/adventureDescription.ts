/**
 * Auto-generated adventure descriptions based on adventure settings.
 *
 * Generates a 2-3 paragraph description that evokes the adventure's
 * difficulty, party requirements, and class restrictions.
 *
 * Also provides URL encoding/decoding for adventure share links,
 * mirroring the hero share-link pattern in heroDescription.ts.
 */

import type { AdventureDefinition, GameMode, HeroClass, CustomModeSettings } from '../types';
import { DEFAULT_CUSTOM_SETTINGS } from '../types';

// ── Difficulty prose ─────────────────────────────────────────────────────────

const DIFFICULTY_OPENINGS: Record<Exclude<GameMode, 'custom'>, string[]> = {
  easy: [
    'A welcoming journey through familiar lands',
    'An approachable quest designed for newcomers',
    'A gentle expedition into monster-haunted wilds',
    'A forgiving campaign where heroes have room to breathe',
  ],
  normal: [
    'A classic campaign forged in the crucible of balanced challenge',
    'A storied quest demanding both courage and cunning',
    'A time-honoured expedition through ever-deepening dangers',
    'A proper adventure where only the well-prepared survive',
  ],
  hard: [
    'A punishing ordeal that separates legends from mortals',
    'A merciless gauntlet where every mistake costs dearly',
    'A brutal expedition into the darkest reaches of the realm',
    'A true test of heroism where the weak do not return',
  ],
};

const CUSTOM_OPENINGS = [
  'A hand-crafted experience tuned to your exact specifications',
  'A bespoke adventure shaped by your own rules',
  'A custom challenge tailored for the discerning adventurer',
];

function getDifficultyOpening(mode: GameMode, seed: number): string {
  if (mode === 'custom') {
    return CUSTOM_OPENINGS[seed % CUSTOM_OPENINGS.length];
  }
  const list = DIFFICULTY_OPENINGS[mode];
  return list[seed % list.length];
}

// ── Difficulty body sentences ────────────────────────────────────────────────

function getDifficultyBody(mode: GameMode, customSettings?: CustomModeSettings): string {
  if (mode === 'easy') {
    return 'Enemies are fewer and slower to grow in power. Deaths carry lighter penalties, and the party ' +
      'earns fewer points per kill — ideal for learning the ropes or relaxing between tougher runs.';
  }
  if (mode === 'normal') {
    return 'Enemies scale steadily and bosses demand respect. Death and retreat cost meaningful score, ' +
      'but dedicated heroes who survive long enough will find themselves rewarded handsomely.';
  }
  if (mode === 'hard') {
    return 'Enemies multiply fast and bosses hit like calamities. Every death strips points and precious ' +
      'recovery time. Only the most cohesive and powerful parties will live to tell the tale.';
  }
  // custom — describe which dials are tweaked
  const lines: string[] = [];
  if (customSettings) {
    const { heroPenaltyPct, wipeoutPenaltyPct, expMultiplierPct, encounterDifficultyPct } = customSettings;
    if (heroPenaltyPct !== 0) {
      lines.push(
        heroPenaltyPct > 0
          ? `Hero deaths are ${heroPenaltyPct}% more punishing than normal.`
          : `Hero deaths are ${Math.abs(heroPenaltyPct)}% lighter than normal.`
      );
    }
    if (wipeoutPenaltyPct !== 0) {
      lines.push(
        wipeoutPenaltyPct > 0
          ? `Party wipeouts bring ${wipeoutPenaltyPct}% heavier penalties.`
          : `Party wipeouts are ${Math.abs(wipeoutPenaltyPct)}% less costly.`
      );
    }
    if (expMultiplierPct !== 0) {
      lines.push(
        expMultiplierPct > 0
          ? `Heroes gain ${expMultiplierPct}% more experience per kill.`
          : `Experience rewards are reduced by ${Math.abs(expMultiplierPct)}%.`
      );
    }
    if (encounterDifficultyPct !== 0) {
      lines.push(
        encounterDifficultyPct > 0
          ? `Encounters are ${encounterDifficultyPct}% harder than the baseline.`
          : `Encounter difficulty is reduced by ${Math.abs(encounterDifficultyPct)}%.`
      );
    }
  }
  if (lines.length === 0) {
    return 'All parameters match the normal-mode baseline — a tailored adventure with familiar stakes.';
  }
  return lines.join(' ');
}

// ── Party requirement prose ──────────────────────────────────────────────────

const ALL_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

const CLASS_THEMES: Record<HeroClass, string> = {
  Warrior:  'steel-clad warriors',
  Mage:     'arcane spellcasters',
  Ranger:   'fleet-footed rangers',
  Paladin:  'holy paladins',
  Rogue:    'shadow-swift rogues',
  Cleric:   'devout clerics',
};

const HERO_COUNT_LABELS: Record<number, string> = {
  1: 'a lone hero',
  2: 'a pair of adventurers',
  3: 'a small warband',
  4: 'a well-rounded party',
  5: 'a large expedition',
  6: 'a full company of champions',
};

function getPartyRequirementSentence(
  requiredHeroCount: number,
  allowedClasses: HeroClass[],
): string {
  const countLabel = HERO_COUNT_LABELS[requiredHeroCount] ?? `a party of ${requiredHeroCount}`;

  const allAllowed = allowedClasses.length === ALL_CLASSES.length;
  if (allAllowed) {
    return `This adventure calls for ${countLabel} of any class combination.`;
  }

  const classNames = allowedClasses.map(c => CLASS_THEMES[c]);
  let classPhrase: string;
  if (classNames.length === 1) {
    classPhrase = classNames[0];
  } else if (classNames.length === 2) {
    classPhrase = `${classNames[0]} and ${classNames[1]}`;
  } else {
    const last = classNames[classNames.length - 1];
    classPhrase = classNames.slice(0, -1).join(', ') + ', and ' + last;
  }
  return `This adventure requires ${countLabel}, drawn exclusively from ${classPhrase}.`;
}

// ── Flavour closers by mode ──────────────────────────────────────────────────

const FLAVOUR_CLOSERS: Record<Exclude<GameMode, 'custom'>, string[]> = {
  easy: [
    'A fine first step on the path to glory.',
    'Even seasoned heroes return here to hone their craft.',
    'Low stakes, high spirits — the perfect training ground.',
  ],
  normal: [
    'Fame and fortune await those who endure.',
    'Will your party\u2019s story be one for the annals?',
    'A worthy challenge for heroes who take their calling seriously.',
  ],
  hard: [
    'Enter only if your party is ready for annihilation.',
    'Glory is earned here — not given.',
    'The realm remembers those who conquer this trial. And forgets those who don\'t.',
  ],
};

const CUSTOM_CLOSERS = [
  'Shaped by your hands, this adventure is truly your own.',
  'The rules are yours to set — the glory yours to claim.',
  'Your custom design, your rules, your legend.',
];

function getFlavourCloser(mode: GameMode, seed: number): string {
  if (mode === 'custom') {
    return CUSTOM_CLOSERS[seed % CUSTOM_CLOSERS.length];
  }
  const list = FLAVOUR_CLOSERS[mode];
  return list[seed % list.length];
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Generate a dynamic 2-3 paragraph description for an adventure.
 * Uses the adventure's settings to produce evocative, varied prose.
 */
export function generateAdventureDescription(
  adventure: Pick<AdventureDefinition, 'mode' | 'customSettings' | 'requiredHeroCount' | 'allowedClasses' | 'name'>,
): string {
  // Use a simple stable hash of the adventure name as a seed so the same
  // name always produces the same variant of sentences.
  let seed = 0;
  for (let i = 0; i < adventure.name.length; i++) seed += adventure.name.charCodeAt(i);

  const p1 = getDifficultyOpening(adventure.mode, seed) + '. ' +
    getDifficultyBody(adventure.mode, adventure.customSettings);

  const p2 = getPartyRequirementSentence(adventure.requiredHeroCount, adventure.allowedClasses);

  const p3 = getFlavourCloser(adventure.mode, seed);

  return [p1, p2, p3].join('\n\n');
}

// ── URL encoding / decoding for adventure share links ─────────────────────────

const VALID_MODES: GameMode[] = ['normal', 'easy', 'hard', 'custom'];
const HERO_CLASSES_ALL: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

/**
 * Encode an adventure into URL search params so it can be shared as a link or QR code.
 * All information is encoded – the recipient can reconstruct the full AdventureDefinition.
 */
export function encodeAdventureToParams(adv: AdventureDefinition): URLSearchParams {
  const params = new URLSearchParams();
  params.set('advName', adv.name);
  params.set('advMode', adv.mode);
  params.set('advHeroCount', String(adv.requiredHeroCount));
  params.set('advClasses', adv.allowedClasses.join(','));
  if (adv.mode === 'custom' && adv.customSettings) {
    params.set('advHeroPenalty', String(adv.customSettings.heroPenaltyPct));
    params.set('advWipeoutPenalty', String(adv.customSettings.wipeoutPenaltyPct));
    params.set('advExpMultiplier', String(adv.customSettings.expMultiplierPct));
    params.set('advEncounterDifficulty', String(adv.customSettings.encounterDifficultyPct));
  }
  return params;
}

/**
 * Decode adventure share data from URL search params.
 * Returns null if the params are missing or invalid.
 */
export function decodeAdventureFromParams(params: URLSearchParams): AdventureDefinition | null {
  const name = params.get('advName');
  const modeRaw = params.get('advMode');
  const heroCountRaw = params.get('advHeroCount');
  const classesRaw = params.get('advClasses');

  if (!name || !modeRaw || !heroCountRaw || !classesRaw) return null;
  if (!VALID_MODES.includes(modeRaw as GameMode)) return null;

  const mode = modeRaw as GameMode;
  const requiredHeroCount = parseInt(heroCountRaw, 10);
  if (isNaN(requiredHeroCount) || requiredHeroCount < 1 || requiredHeroCount > 6) return null;

  const allowedClasses = classesRaw
    .split(',')
    .filter(c => HERO_CLASSES_ALL.includes(c as HeroClass)) as HeroClass[];
  if (allowedClasses.length === 0) return null;

  let customSettings: CustomModeSettings | undefined;
  if (mode === 'custom') {
    const hp = parseInt(params.get('advHeroPenalty') ?? '', 10);
    const wp = parseInt(params.get('advWipeoutPenalty') ?? '', 10);
    const em = parseInt(params.get('advExpMultiplier') ?? '', 10);
    const ed = parseInt(params.get('advEncounterDifficulty') ?? '', 10);
    if (isNaN(hp) || isNaN(wp) || isNaN(em) || isNaN(ed)) return null;
    if ([hp, wp, em, ed].some(v => v < -50 || v > 50)) return null;
    customSettings = {
      heroPenaltyPct: hp,
      wipeoutPenaltyPct: wp,
      expMultiplierPct: em,
      encounterDifficultyPct: ed,
    };
  } else {
    customSettings = { ...DEFAULT_CUSTOM_SETTINGS };
  }

  const adv: AdventureDefinition = {
    id: `adventure-${crypto.randomUUID()}`,
    name,
    mode,
    customSettings,
    requiredHeroCount,
    allowedClasses,
    description: '',
  };
  adv.description = generateAdventureDescription(adv);
  return adv;
}
