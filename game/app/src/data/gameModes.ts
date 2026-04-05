/**
 * Game mode definitions.
 */

import type { GameModeDefinition } from '../types';

export const GAME_MODES: GameModeDefinition[] = [
  {
    id: 'normal',
    name: 'Classic Campaign',
    description: 'The standard Blink RPG experience. Balanced enemies, moderate penalties, and a clear victory condition when the final boss falls.',
    difficulty: 'Normal',
    irFile: '/ir/classic-rpg.ir.json',
  },
  {
    id: 'easy',
    name: 'Casual Adventure',
    description: 'A relaxed journey for newcomers. Fewer enemies per wave, slower scaling, and reduced penalties for death and retreat.',
    difficulty: 'Easy',
    irFile: '/ir/scenario-easy.ir.json',
  },
  {
    id: 'hard',
    name: 'Nightmare Mode',
    description: 'An intense challenge for veteran players. More enemies, faster progression, and severe punishments for failure.',
    difficulty: 'Hard',
    irFile: '/ir/scenario-hard.ir.json',
  },
];
