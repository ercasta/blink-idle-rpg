import { useState } from 'react';
import { HEROES } from '../data/heroes';
import { TRAIT_AXES, TRAIT_MIN, TRAIT_MAX, defaultTraits } from '../data/traits';
import type { HeroDefinition, HeroTraits } from '../types';

const MAX_PARTY = 6;
const MIN_PARTY = 1;

interface PartySelectScreenProps {
  onStart: (heroes: HeroDefinition[]) => void;
  onBack: () => void;
}

export function PartySelectScreen({ onStart, onBack }: PartySelectScreenProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [editingHeroId, setEditingHeroId] = useState<string | null>(null);
  // Mutable trait overrides keyed by hero.id
  const [traitOverrides, setTraitOverrides] = useState<Record<string, HeroTraits>>({});

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_PARTY) return prev;
      return [...prev, id];
    });
  }

  function getTraits(heroId: string): HeroTraits {
    const hero = HEROES.find(h => h.id === heroId);
    return traitOverrides[heroId] ?? hero?.traits ?? defaultTraits();
  }

  function setTrait(heroId: string, key: keyof HeroTraits, value: number) {
    setTraitOverrides(prev => ({
      ...prev,
      [heroId]: { ...getTraits(heroId), [key]: value },
    }));
  }

  function resetTraits(heroId: string) {
    setTraitOverrides(prev => {
      const next = { ...prev };
      delete next[heroId];
      return next;
    });
  }

  function handleStart() {
    if (selected.length < MIN_PARTY) return;
    const heroes = selected
      .map(id => {
        const hero = HEROES.find(h => h.id === id);
        if (!hero) return null;
        return { ...hero, traits: getTraits(id) };
      })
      .filter((h): h is HeroDefinition => Boolean(h));
    onStart(heroes);
  }

  const editingHero = editingHeroId ? HEROES.find(h => h.id === editingHeroId) : null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={editingHeroId ? () => setEditingHeroId(null) : onBack}
          className="text-slate-400 hover:text-white text-2xl leading-none"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">
          {editingHeroId ? `${editingHero?.name} — Traits` : 'Select Your Party'}
        </h1>
      </div>

      {/* Trait Editor */}
      {editingHero && editingHeroId ? (
        <TraitEditor
          hero={editingHero}
          traits={getTraits(editingHeroId)}
          onChangeTrait={(key, val) => setTrait(editingHeroId, key, val)}
          onReset={() => resetTraits(editingHeroId)}
          onDone={() => setEditingHeroId(null)}
        />
      ) : (
        <>
          <p className="text-slate-400 text-sm mb-5">
            Choose 1–{MAX_PARTY} heroes. Click ⚙️ to customize traits. Selected: {selected.length}
          </p>

          {/* Hero grid */}
          <div className="flex flex-col gap-3 flex-1">
            {HEROES.map((hero) => {
              const isSelected = selected.includes(hero.id);
              const hasOverride = !!traitOverrides[hero.id];
              return (
                <div key={hero.id} className="flex gap-2">
                  <button
                    onClick={() => toggle(hero.id)}
                    className={`flex-1 text-left rounded-xl p-4 transition-colors border-2 ${
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
                          {hasOverride && (
                            <span className="text-xs bg-amber-600 px-1.5 py-0.5 rounded-full">✏️</span>
                          )}
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
                  {/* Trait edit button */}
                  <button
                    onClick={() => setEditingHeroId(hero.id)}
                    className="px-3 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl text-lg transition-colors"
                    title="Customize traits"
                  >
                    ⚙️
                  </button>
                </div>
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
        </>
      )}
    </div>
  );
}

// ── Trait Editor sub-component ──────────────────────────────────────────────

interface TraitEditorProps {
  hero: HeroDefinition;
  traits: HeroTraits;
  onChangeTrait: (key: keyof HeroTraits, value: number) => void;
  onReset: () => void;
  onDone: () => void;
}

function TraitEditor({ hero, traits, onChangeTrait, onReset, onDone }: TraitEditorProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{hero.emoji}</span>
        <div>
          <div className="font-bold">{hero.name}</div>
          <div className="text-xs text-slate-400">{hero.heroClass} · {hero.role}</div>
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Traits shape stat growth, skill selection, and combat AI.
        Drag sliders to customize this hero's personality.
      </p>

      <div className="flex flex-col gap-3">
        {TRAIT_AXES.map(axis => {
          const value = traits[axis.key];
          return (
            <div key={axis.key} className="bg-slate-800 rounded-lg p-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-blue-400">{axis.negativePole}</span>
                <span className="text-slate-500 font-mono">{value > 0 ? '+' : ''}{value}</span>
                <span className="text-amber-400">{axis.positivePole}</span>
              </div>
              <input
                type="range"
                min={TRAIT_MIN}
                max={TRAIT_MAX}
                value={value}
                onChange={e => onChangeTrait(axis.key, parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-5 pt-4 border-t border-slate-800">
        <button
          onClick={onReset}
          className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 text-sm transition-colors"
        >
          Reset to Default
        </button>
        <button
          onClick={onDone}
          className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
