import { useState } from 'react';
import { HEROES } from '../data/heroes';
import type { HeroDefinition } from '../types';

const MAX_PARTY = 6;
const MIN_PARTY = 1;

interface PartySelectScreenProps {
  onStart: (heroes: HeroDefinition[]) => void;
  onBack: () => void;
}

export function PartySelectScreen({ onStart, onBack }: PartySelectScreenProps) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_PARTY) return prev;
      return [...prev, id];
    });
  }

  function handleStart() {
    if (selected.length < MIN_PARTY) return;
    const heroes = selected
      .map(id => HEROES.find(h => h.id === id))
      .filter((h): h is HeroDefinition => Boolean(h));
    onStart(heroes);
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white text-2xl leading-none"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Select Your Party</h1>
      </div>

      <p className="text-slate-400 text-sm mb-5">
        Choose 1–{MAX_PARTY} heroes. Selected: {selected.length}
      </p>

      {/* Hero grid */}
      <div className="flex flex-col gap-3 flex-1">
        {HEROES.map((hero) => {
          const isSelected = selected.includes(hero.id);
          return (
            <button
              key={hero.id}
              onClick={() => toggle(hero.id)}
              className={`w-full text-left rounded-xl p-4 transition-colors border-2 ${
                isSelected
                  ? 'bg-red-900/40 border-red-500'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{hero.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{hero.name}</span>
                    <span className="text-xs text-slate-400">{hero.heroClass}</span>
                    {isSelected && (
                      <span className="ml-auto text-xs bg-red-600 px-2 py-0.5 rounded-full">
                        ✓ Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{hero.role}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{hero.description}</p>
                </div>
              </div>

              {/* Stat bar summary */}
              <div className="mt-3 grid grid-cols-5 gap-1 text-xs text-center">
                {Object.entries(hero.stats).map(([stat, val]) => (
                  <div key={stat} className="bg-slate-700/50 rounded p-1">
                    <div className="text-slate-400 uppercase" style={{ fontSize: '0.6rem' }}>
                      {stat.slice(0, 3)}
                    </div>
                    <div className="font-bold text-slate-200">{val}</div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Start button */}
      <div className="pt-4 mt-4 border-t border-slate-800">
        <button
          onClick={handleStart}
          disabled={selected.length < MIN_PARTY}
          className="w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-500 text-white"
        >
          {selected.length < MIN_PARTY
            ? `Select at least ${MIN_PARTY} hero`
            : `⚔️ Run! (${selected.length} hero${selected.length !== 1 ? 'es' : ''})`}
        </button>
      </div>
    </div>
  );
}
