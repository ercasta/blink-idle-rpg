/**
 * Pre-built hero definitions for party selection.
 * Six heroes, one per class.
 */

import type { HeroDefinition } from '../types';

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
