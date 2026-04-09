import { useState } from 'react';
import { GAME_MODES } from '../data/gameModes';
import type { GameMode, CustomModeSettings } from '../types';
import { DEFAULT_CUSTOM_SETTINGS } from '../types';

interface ModeSelectScreenProps {
  onSelect: (mode: GameMode, customSettings?: CustomModeSettings) => void;
  onBack: () => void;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy:   'bg-green-800 text-green-200',
  Normal: 'bg-amber-800 text-amber-200',
  Hard:   'bg-red-900 text-red-200',
  Custom: 'bg-purple-800 text-purple-200',
};

/** A single percentage-offset slider (-50…+50) */
function PctSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = value >= 0 ? `+${value}%` : `${value}%`;
  const color =
    value > 0 ? 'text-red-300' :
    value < 0 ? 'text-green-300' :
    'text-stone-300';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-stone-400">
        <span>{label}</span>
        <span className={`font-bold ${color}`}>{pct} vs Normal</span>
      </div>
      <input
        type="range"
        min={-50}
        max={50}
        step={5}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-purple-500"
      />
      <div className="flex justify-between text-xs text-stone-600">
        <span>−50%</span>
        <span>0%</span>
        <span>+50%</span>
      </div>
    </div>
  );
}

export function ModeSelectScreen({ onSelect, onBack }: ModeSelectScreenProps) {
  const [customSettings, setCustomSettings] = useState<CustomModeSettings>(DEFAULT_CUSTOM_SETTINGS);
  const [showCustomPanel, setShowCustomPanel] = useState(false);

  function updateSetting<K extends keyof CustomModeSettings>(key: K, value: number) {
    setCustomSettings(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-stone-400 hover:text-stone-100 text-2xl leading-none"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Choose Game Mode</h1>
      </div>

      {/* Mode list */}
      <div className="flex flex-col gap-4 flex-1">
        {GAME_MODES.map((mode) => (
          <div key={mode.id}>
            <button
              onClick={() => {
                if (mode.id === 'custom') {
                  setShowCustomPanel(prev => !prev);
                } else {
                  onSelect(mode.id);
                }
              }}
              className="w-full text-left bg-stone-800 hover:bg-stone-700 rounded-xl p-4 transition-colors border border-stone-700 hover:border-stone-500"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-lg">{mode.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${DIFFICULTY_COLOR[mode.difficulty] ?? ''}`}>
                  {mode.difficulty}
                </span>
              </div>
              <p className="text-stone-400 text-sm leading-relaxed">{mode.description}</p>
            </button>

            {/* Custom-mode slider panel (inline below the card) */}
            {mode.id === 'custom' && showCustomPanel && (
              <div className="bg-stone-800 border border-purple-700 rounded-b-xl px-4 pb-4 -mt-1 flex flex-col gap-3">
                <p className="text-xs text-purple-300 pt-3 pb-1">
                  Adjust each parameter relative to the Normal-mode baseline (±50%).
                </p>

                <PctSlider
                  label="Hero Death Penalty"
                  value={customSettings.heroPenaltyPct}
                  onChange={v => updateSetting('heroPenaltyPct', v)}
                />
                <PctSlider
                  label="Party Wipeout Penalty"
                  value={customSettings.wipeoutPenaltyPct}
                  onChange={v => updateSetting('wipeoutPenaltyPct', v)}
                />
                <PctSlider
                  label="Experience Gain"
                  value={customSettings.expMultiplierPct}
                  onChange={v => updateSetting('expMultiplierPct', v)}
                />
                <PctSlider
                  label="Encounter Difficulty"
                  value={customSettings.encounterDifficultyPct}
                  onChange={v => updateSetting('encounterDifficultyPct', v)}
                />

                <button
                  onClick={() => onSelect('custom', customSettings)}
                  className="mt-2 w-full py-2 bg-purple-700 hover:bg-purple-600 rounded-lg font-bold text-stone-100 text-sm transition-colors"
                >
                  Start Custom Game →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="text-center text-stone-600 text-xs mt-4 pt-4">
        Choose a mode, then pick your party.
      </p>
    </div>
  );
}
