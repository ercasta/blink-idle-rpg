/**
 * Random adventure generation and default adventure data.
 */

import type { AdventureDefinition, HeroClass, HeroDefinition } from '../types';
import { generateAdventureDescription } from './adventureDescription';
import { generateRandomHero } from './heroes';

const ALL_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

// ── Named adventure pools ─────────────────────────────────────────────────────

const ADVENTURE_ADJECTIVES = [
  'Forsaken', 'Ancient', 'Shattered', 'Cursed', 'Blazing', 'Frozen',
  'Howling', 'Silent', 'Crimson', 'Golden', 'Iron', 'Sunken',
  'Twisted', 'Verdant', 'Ashen', 'Hallowed', 'Feral', 'Ruined',
  'Buried', 'Forgotten',
];

const ADVENTURE_NOUNS = [
  'Vale', 'Keep', 'Wastes', 'Spire', 'Crypt', 'Mire',
  'Reaches', 'Crucible', 'Hollow', 'Expanse', 'Dungeon', 'Depths',
  'Throne', 'Citadel', 'Abyss', 'Sanctum', 'Forest', 'Plains',
  'Summit', 'Shore',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Generate a random adventure name like "Forsaken Vale" */
function randomAdventureName(): string {
  return `The ${pickRandom(ADVENTURE_ADJECTIVES)} ${pickRandom(ADVENTURE_NOUNS)}`;
}

// ── Random adventure ──────────────────────────────────────────────────────────

/**
 * Generate a random adventure with randomised difficulty and party requirements.
 * Biased toward normal/easy modes for a good first experience.
 */
export function generateRandomAdventure(): AdventureDefinition {
  const modes = ['normal', 'normal', 'easy', 'hard'] as const;
  const mode = pickRandom(modes);

  // Hero count: bias toward 4
  const counts = [2, 3, 4, 4, 4, 5, 6];
  const requiredHeroCount = pickRandom(counts);

  // Allowed classes: 70% all, 30% subset of 3-5 random classes
  let allowedClasses: HeroClass[];
  if (Math.random() < 0.7) {
    allowedClasses = [...ALL_CLASSES];
  } else {
    const count = 3 + Math.floor(Math.random() * 3); // 3-5
    allowedClasses = shuffle(ALL_CLASSES).slice(0, count);
  }

  const name = randomAdventureName();

  const draft: Omit<AdventureDefinition, 'description'> = {
    id: `adventure-${crypto.randomUUID()}`,
    name,
    mode,
    requiredHeroCount,
    allowedClasses,
  };

  return {
    ...draft,
    description: generateAdventureDescription(draft),
  };
}

/**
 * Generate a random party fitting the adventure's class/count constraints.
 */
export function generateRandomPartyForAdventure(adventure: AdventureDefinition): HeroDefinition[] {
  const available = adventure.allowedClasses.length > 0
    ? adventure.allowedClasses
    : ALL_CLASSES;

  // Shuffle classes and cycle to fill required count, maximizing diversity
  const shuffledClasses = shuffle(available);
  const heroes: HeroDefinition[] = [];

  for (let i = 0; i < adventure.requiredHeroCount; i++) {
    const targetClass = shuffledClasses[i % shuffledClasses.length];
    const hero = generateRandomHero();
    // Patch heroClass to match the adventure constraint
    heroes.push({ ...hero, heroClass: targetClass });
  }

  return heroes;
}
