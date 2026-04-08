import { useState } from 'react';
import { TRAIT_AXES, TRAIT_MIN, TRAIT_MAX, defaultTraits, randomTraits } from '../data/traits';
import type { HeroDefinition, HeroClass, HeroTraits } from '../types';
import { generateRandomHero } from '../data/heroes';

const MAX_ROSTER = 20;

interface RosterScreenProps {
  roster: HeroDefinition[];
  onRosterChange: (roster: HeroDefinition[]) => void;
  onBack: () => void;
}

type RosterView = 'list' | 'edit-traits' | 'create';

export function RosterScreen({ roster, onRosterChange, onBack }: RosterScreenProps) {
  const [view, setView] = useState<RosterView>('list');
  const [editingHero, setEditingHero] = useState<HeroDefinition | null>(null);
  // For create: a new hero being configured before adding
  const [draftHero, setDraftHero] = useState<HeroDefinition | null>(null);

  function openEditTraits(hero: HeroDefinition) {
    setEditingHero({ ...hero });
    setView('edit-traits');
  }

  function saveTraits(traits: HeroTraits) {
    if (!editingHero) return;
    const updated = roster.map(h => h.id === editingHero.id ? { ...h, traits } : h);
    onRosterChange(updated);
    setView('list');
    setEditingHero(null);
  }

  function deleteHero(id: string) {
    onRosterChange(roster.filter(h => h.id !== id));
  }

  function openCreate() {
    setDraftHero(generateRandomHero());
    setView('create');
  }

  function rerollDraft() {
    setDraftHero(generateRandomHero());
  }

  function randomizeDraftTraits() {
    if (!draftHero) return;
    setDraftHero({ ...draftHero, traits: randomTraits() });
  }

  function resetDraftTraits() {
    if (!draftHero) return;
    setDraftHero({ ...draftHero, traits: defaultTraits() });
  }

  function setDraftTrait(key: keyof HeroTraits, value: number) {
    if (!draftHero) return;
    setDraftHero({ ...draftHero, traits: { ...draftHero.traits, [key]: value } });
  }

  function confirmCreate() {
    if (!draftHero || roster.length >= MAX_ROSTER) return;
    onRosterChange([...roster, draftHero]);
    setView('list');
    setDraftHero(null);
  }

  // ── Trait editor for existing hero ──────────────────────────────────────

  if (view === 'edit-traits' && editingHero) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-900 text-white px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setView('list'); setEditingHero(null); }}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">{editingHero.name} — Edit Traits</h1>
        </div>
        <TraitEditor
          hero={editingHero}
          traits={editingHero.traits}
          onChangeTrait={(key, val) =>
            setEditingHero(prev => prev ? { ...prev, traits: { ...prev.traits, [key]: val } } : prev)
          }
          onReset={() =>
            setEditingHero(prev => prev ? { ...prev, traits: defaultTraits() } : prev)
          }
          onDone={() => saveTraits(editingHero.traits)}
          doneLabel="Save"
        />
      </div>
    );
  }

  // ── Create hero ──────────────────────────────────────────────────────────

  if (view === 'create' && draftHero) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-900 text-white px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setView('list'); setDraftHero(null); }}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">Create Hero</h1>
        </div>

        {/* Hero preview card */}
        <div className="bg-slate-800 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{draftHero.emoji}</span>
            <div>
              <div className="font-bold text-lg">{draftHero.name}</div>
              <div className="text-xs text-slate-400">{draftHero.heroClass} · {draftHero.role}</div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1 text-xs text-center mb-3">
            {Object.entries(draftHero.stats).map(([stat, val]) => (
              <div key={stat} className="bg-slate-700/50 rounded p-1">
                <div className="text-slate-400 uppercase" style={{ fontSize: '0.6rem' }}>{stat.slice(0, 3)}</div>
                <div className="font-bold text-slate-200">{val}</div>
              </div>
            ))}
          </div>
          <button
            onClick={rerollDraft}
            className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 text-sm transition-colors"
          >
            🎲 Reroll Hero
          </button>
        </div>

        {/* Trait editor */}
        <p className="text-xs text-slate-500 mb-3">Customize this hero's traits, or randomize them.</p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={randomizeDraftTraits}
            className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 text-sm transition-colors"
          >
            🎲 Random Traits
          </button>
          <button
            onClick={resetDraftTraits}
            className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 text-sm transition-colors"
          >
            ↺ Reset Traits
          </button>
        </div>
        <TraitEditor
          hero={draftHero}
          traits={draftHero.traits}
          onChangeTrait={setDraftTrait}
          onReset={resetDraftTraits}
          onDone={confirmCreate}
          doneLabel={`Add to Roster (${roster.length}/${MAX_ROSTER})`}
          hideFoot
        />
        <div className="pt-4 mt-2 border-t border-slate-800">
          <button
            onClick={confirmCreate}
            disabled={roster.length >= MAX_ROSTER}
            className="w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-500 text-white"
          >
            ✓ Add to Roster ({roster.length}/{MAX_ROSTER})
          </button>
        </div>
      </div>
    );
  }

  // ── Hero list ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white px-4 py-6">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white text-2xl leading-none"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Hero Roster</h1>
      </div>
      <p className="text-slate-400 text-sm mb-5">
        {roster.length === 0
          ? 'Your roster is empty. Generate heroes to start a run!'
          : `${roster.length} hero${roster.length !== 1 ? 'es' : ''} · up to ${MAX_ROSTER}`}
      </p>

      {/* Hero list */}
      <div className="flex flex-col gap-3 flex-1">
        {roster.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500 py-12">
            <div className="text-5xl">🧑‍🤝‍🧑</div>
            <p className="text-sm text-center">No heroes yet.<br />Tap below to create your first hero.</p>
          </div>
        )}
        {roster.map((hero) => (
          <div key={hero.id} className="flex gap-2">
            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{hero.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{hero.name}</span>
                    <span className="text-xs text-slate-400">{hero.heroClass}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{hero.role}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1 text-xs text-center">
                {Object.entries(hero.stats).map(([stat, val]) => (
                  <div key={stat} className="bg-slate-700/50 rounded p-1">
                    <div className="text-slate-400 uppercase" style={{ fontSize: '0.6rem' }}>{stat.slice(0, 3)}</div>
                    <div className="font-bold text-slate-200">{val}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => openEditTraits(hero)}
                className="flex-1 px-3 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl text-lg transition-colors"
                title="Edit traits"
              >
                ⚙️
              </button>
              <button
                onClick={() => deleteHero(hero.id)}
                className="flex-1 px-3 bg-slate-800 border border-slate-700 hover:border-red-500 hover:text-red-400 rounded-xl text-lg transition-colors"
                title="Remove hero"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add hero button */}
      <div className="pt-4 mt-4 border-t border-slate-800">
        <button
          onClick={openCreate}
          disabled={roster.length >= MAX_ROSTER}
          className="w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-500 text-white"
        >
          + Generate New Hero
        </button>
      </div>
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
  doneLabel?: string;
  hideFoot?: boolean;
}

export function TraitEditor({ hero, traits, onChangeTrait, onReset, onDone, doneLabel = 'Done', hideFoot = false }: TraitEditorProps) {
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

      {!hideFoot && (
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
            {doneLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// Re-export HeroClass for convenience
export type { HeroClass };
