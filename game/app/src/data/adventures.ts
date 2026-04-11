/**
 * Random adventure generation and default adventure data.
 */

import type { AdventureDefinition, GameMode, HeroClass, HeroDefinition, EnvironmentSettings, RunType } from '../types';
import { DEFAULT_ENVIRONMENT_SETTINGS } from '../types';
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

/** Generate a random adventure name like "The Forsaken Vale" */
export function randomAdventureName(): string {
  return `The ${pickRandom(ADVENTURE_ADJECTIVES)} ${pickRandom(ADVENTURE_NOUNS)}`;
}

// ── Random adventure ──────────────────────────────────────────────────────────

/** Randomise a single environment slider value around a base, clamped to 0–100. */
function randomPct(base: number, spread: number): number {
  const v = base + Math.floor(Math.random() * spread * 2) - spread;
  return Math.max(0, Math.min(100, Math.round(v / 5) * 5)); // snap to 5%
}

/** Generate random environment settings (unified per-element sliders). */
function randomEnvironment(): EnvironmentSettings {
  return {
    physicalPct:  randomPct(DEFAULT_ENVIRONMENT_SETTINGS.physicalPct, 25),
    magicalPct:   randomPct(DEFAULT_ENVIRONMENT_SETTINGS.magicalPct, 25),
    firePct:      randomPct(DEFAULT_ENVIRONMENT_SETTINGS.firePct, 20),
    waterPct:     randomPct(DEFAULT_ENVIRONMENT_SETTINGS.waterPct, 20),
    windPct:      randomPct(DEFAULT_ENVIRONMENT_SETTINGS.windPct, 15),
    earthPct:     randomPct(DEFAULT_ENVIRONMENT_SETTINGS.earthPct, 15),
    lightPct:     randomPct(DEFAULT_ENVIRONMENT_SETTINGS.lightPct, 15),
    darknessPct:  randomPct(DEFAULT_ENVIRONMENT_SETTINGS.darknessPct, 15),
  };
}

/**
 * Generate a random adventure with randomised difficulty and party requirements.
 * Biased toward normal/easy modes for a good first experience.
 * ~20% chance of generating a story mode adventure.
 */
export function generateRandomAdventure(): AdventureDefinition {
  const modes: GameMode[] = ['normal', 'normal', 'easy', 'hard'];
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

  // ~20% chance of story mode
  const runType: RunType = Math.random() < 0.2 ? 'story' : 'fight';

  const name = randomAdventureName();
  const environmentSettings = randomEnvironment();

  const draft: Omit<AdventureDefinition, 'description'> = {
    id: `adventure-${crypto.randomUUID()}`,
    name,
    mode,
    requiredHeroCount,
    allowedClasses,
    environmentSettings,
    runType,
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
