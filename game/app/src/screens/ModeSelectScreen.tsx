import { GAME_MODES } from '../data/gameModes';
import type { GameMode } from '../types';

interface ModeSelectScreenProps {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: 'bg-green-700 text-green-100',
  Normal: 'bg-blue-700 text-blue-100',
  Hard: 'bg-red-700 text-red-100',
};

export function ModeSelectScreen({ onSelect, onBack }: ModeSelectScreenProps) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white text-2xl leading-none"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Choose Game Mode</h1>
      </div>

      {/* Mode list */}
      <div className="flex flex-col gap-4 flex-1">
        {GAME_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSelect(mode.id)}
            className="w-full text-left bg-slate-800 hover:bg-slate-700 rounded-xl p-4 transition-colors border border-slate-700 hover:border-slate-500"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-lg">{mode.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${DIFFICULTY_COLOR[mode.difficulty] ?? ''}`}>
                {mode.difficulty}
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">{mode.description}</p>
          </button>
        ))}
      </div>

      {/* Footer */}
      <p className="text-center text-slate-600 text-xs mt-4 pt-4">
        Choose a mode, then pick your party.
      </p>
    </div>
  );
}
