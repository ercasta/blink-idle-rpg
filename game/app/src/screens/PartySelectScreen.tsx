import { useState } from 'react';
import type { HeroDefinition } from '../types';

const MAX_PARTY = 6;
const MIN_PARTY = 1;

interface PartySelectScreenProps {
  roster: HeroDefinition[];
  onStart: (heroes: HeroDefinition[]) => void;
  onBack: () => void;
  onManageRoster: () => void;
}

export function PartySelectScreen({ roster, onStart, onBack, onManageRoster }: PartySelectScreenProps) {
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
      .map(id => roster.find(h => h.id === id))
      .filter((h): h is HeroDefinition => Boolean(h));
    onStart(heroes);
  }

  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="text-stone-400 hover:text-stone-100 text-2xl leading-none"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Select Your Party</h1>
      </div>

      {roster.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-12">
          <div className="text-5xl">🧑‍🤝‍🧑</div>
          <p className="text-stone-400 text-sm">Your roster is empty.<br />Create heroes before starting a run.</p>
          <button
            onClick={onManageRoster}
            className="px-6 py-3 bg-amber-700 hover:bg-amber-600 rounded-xl font-bold transition-colors text-stone-100"
          >
            Manage Roster
          </button>
        </div>
      ) : (
        <>
          <p className="text-stone-400 text-sm mb-1">
            Choose 1–{MAX_PARTY} heroes from your roster. Selected: {selected.length}
          </p>
          <button
            onClick={onManageRoster}
            className="text-xs text-stone-500 hover:text-stone-300 mb-4 text-left transition-colors underline"
          >
            ← Manage Roster
          </button>

          {/* Hero grid */}
          <div className="flex flex-col gap-3 flex-1">
            {roster.map((hero) => {
              const isSelected = selected.includes(hero.id);
              return (
                <button
                  key={hero.id}
                  onClick={() => toggle(hero.id)}
                  className={`w-full text-left rounded-xl p-4 transition-colors border-2 ${
                    isSelected
                      ? 'bg-amber-900/40 border-amber-600'
                      : 'bg-stone-800 border-stone-700 hover:border-stone-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{hero.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{hero.name}</span>
                        <span className="text-xs text-stone-400">{hero.heroClass}</span>
                        {isSelected && (
                          <span className="ml-auto text-xs bg-amber-700 px-2 py-0.5 rounded-full text-stone-100">
                            ✓ Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">{hero.role}</p>
                      <p className="text-xs text-stone-500 mt-1 leading-relaxed">{hero.description}</p>
                    </div>
                  </div>

                  {/* Stat bar summary */}
                  <div className="mt-3 grid grid-cols-5 gap-1 text-xs text-center">
                    {Object.entries(hero.stats).map(([stat, val]) => (
                      <div key={stat} className="bg-stone-700/50 rounded p-1">
                        <div className="text-stone-400 uppercase" style={{ fontSize: '0.6rem' }}>
                          {stat.slice(0, 3)}
                        </div>
                        <div className="font-bold text-stone-200">{val}</div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Start button */}
          <div className="pt-4 mt-4 border-t border-stone-800">
            <button
              onClick={handleStart}
              disabled={selected.length < MIN_PARTY}
              className="w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-amber-700 hover:bg-amber-600 text-stone-100"
            >
              {selected.length < MIN_PARTY
                ? `Select at least ${MIN_PARTY} hero`
                : `⚔️ Run! (${selected.length} hero${selected.length !== 1 ? 'es' : ''})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
