/**
 * Pre-built hero definitions for party selection.
 * Six heroes, one per class.
 */

import type { HeroDefinition, HeroClass } from '../types';

export const HEROES: HeroDefinition[] = [
  {
    id: 'aldric',
    name: 'Aldric',
    heroClass: 'Warrior',
    description: 'A battle-hardened warrior who charges at the strongest foes.',
    role: 'Tank / DPS',
    emoji: '⚔️',
    stats: { strength: 12, dexterity: 7, intelligence: 4, constitution: 14, wisdom: 3 },
  },
  {
    id: 'lyra',
    name: 'Lyra',
    heroClass: 'Mage',
    description: 'A brilliant mage who obliterates the weakest enemy first.',
    role: 'Burst DPS',
    emoji: '🧙',
    stats: { strength: 3, dexterity: 6, intelligence: 15, constitution: 5, wisdom: 11 },
  },
  {
    id: 'sasha',
    name: 'Sasha',
    heroClass: 'Ranger',
    description: 'A swift ranger who picks off priority targets from range.',
    role: 'Control / DPS',
    emoji: '🏹',
    stats: { strength: 6, dexterity: 13, intelligence: 7, constitution: 7, wisdom: 7 },
  },
  {
    id: 'theron',
    name: 'Theron',
    heroClass: 'Paladin',
    description: 'A holy paladin who endures the longest and protects allies.',
    role: 'Support / Tank',
    emoji: '🛡️',
    stats: { strength: 9, dexterity: 5, intelligence: 6, constitution: 12, wisdom: 8 },
  },
  {
    id: 'kira',
    name: 'Kira',
    heroClass: 'Rogue',
    description: 'A cunning rogue who backstabs wounded enemies for big crits.',
    role: 'Finisher / DPS',
    emoji: '🗡️',
    stats: { strength: 8, dexterity: 14, intelligence: 6, constitution: 6, wisdom: 6 },
  },
  {
    id: 'elara',
    name: 'Elara',
    heroClass: 'Cleric',
    description: 'A devoted cleric who targets the least threatening enemy.',
    role: 'Healer / Support',
    emoji: '🙏',
    stats: { strength: 5, dexterity: 6, intelligence: 8, constitution: 9, wisdom: 12 },
  },
];

// ── Random hero generation ──────────────────────────────────────────────────

const CLASS_EMOJIS: Record<HeroClass, string> = {
  Warrior: '⚔️', Mage: '🧙', Ranger: '🏹', Paladin: '🛡️', Rogue: '🗡️', Cleric: '🙏',
};

const CLASS_ROLES: Record<HeroClass, string> = {
  Warrior: 'Tank / DPS', Mage: 'Burst DPS', Ranger: 'Control / DPS',
  Paladin: 'Support / Tank', Rogue: 'Finisher / DPS', Cleric: 'Healer / Support',
};

const FIRST_NAMES: Record<HeroClass, string[]> = {
  Warrior: ['Gorak', 'Bjorn', 'Hilda', 'Roland', 'Vex', 'Korrin', 'Bran', 'Ulric'],
  Mage: ['Zara', 'Orion', 'Celeste', 'Magnus', 'Freya', 'Alaric', 'Solara', 'Nyx'],
  Ranger: ['Finn', 'Ivy', 'Talon', 'Scout', 'Briar', 'Storm', 'Ash', 'Wren'],
  Paladin: ['Gareth', 'Seraph', 'Valor', 'Isolde', 'Cedric', 'Helena', 'Tormund', 'Grace'],
  Rogue: ['Shadow', 'Viper', 'Nyx', 'Shade', 'Dusk', 'Jinx', 'Sly', 'Raven'],
  Cleric: ['Mercy', 'Dawn', 'Sage', 'Blessing', 'Aria', 'Luminara', 'Faith', 'Solace'],
};

/**
 * Allocate 40 stat points across 5 stats, weighted by class priorities.
 * Each stat gets a base of 4 + weighted random allocation.
 */
function rollStats(heroClass: HeroClass): HeroDefinition['stats'] {
  // Class stat weight priorities: [str, dex, int, con, wis]
  const weights: Record<HeroClass, number[]> = {
    Warrior: [5, 2, 1, 4, 1],
    Mage:    [1, 2, 5, 1, 4],
    Ranger:  [2, 5, 2, 2, 2],
    Paladin: [3, 1, 2, 4, 3],
    Rogue:   [3, 5, 1, 2, 2],
    Cleric:  [1, 2, 3, 3, 5],
  };

  const w = weights[heroClass];
  const totalWeight = w.reduce((a, b) => a + b, 0);
  const statNames = ['strength', 'dexterity', 'intelligence', 'constitution', 'wisdom'] as const;
  const stats: Record<string, number> = {};

  // Start each stat at 4, allocate remaining 20 points weighted by class
  let remaining = 20;
  for (let i = 0; i < 5; i++) {
    stats[statNames[i]] = 4;
  }

  // Distribute remaining points with randomness
  for (let p = 0; p < remaining; p++) {
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < 5; i++) {
      roll -= w[i];
      if (roll <= 0 || i === 4) {
        // Cap individual stat at 16
        if (stats[statNames[i]] < 16) {
          stats[statNames[i]]++;
        } else {
          // Overflow to a random uncapped stat
          for (let j = 0; j < 5; j++) {
            if (stats[statNames[j]] < 16) {
              stats[statNames[j]]++;
              break;
            }
          }
        }
        break;
      }
    }
  }

  return stats as HeroDefinition['stats'];
}

/**
 * Generate a random party of 4 heroes with diverse classes.
 * Ensures at least one healer-type (Cleric or Paladin) and one DPS.
 */
export function generateRandomParty(): HeroDefinition[] {
  // Pick 4 classes ensuring class diversity:
  // Always include one Cleric/Paladin for sustainability and varied DPS
  const dpsClasses: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Rogue'];
  const supportClasses: HeroClass[] = ['Cleric', 'Paladin'];

  // Shuffle helper
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Pick 1 support + 3 from shuffled remaining classes
  const support = shuffle(supportClasses)[0];
  const otherClasses = shuffle([...dpsClasses, supportClasses.find(c => c !== support)!]);
  const pickedClasses = [support, ...otherClasses.slice(0, 3)];

  return shuffle(pickedClasses).map((hc, i) => {
    const names = FIRST_NAMES[hc];
    const name = names[Math.floor(Math.random() * names.length)];
    return {
      id: `random-${i}-${Date.now()}`,
      name,
      heroClass: hc,
      description: `A ${hc.toLowerCase()} ready for adventure.`,
      role: CLASS_ROLES[hc],
      emoji: CLASS_EMOJIS[hc],
      stats: rollStats(hc),
    };
  });
}
