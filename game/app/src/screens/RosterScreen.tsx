import { useState } from 'react';
import { TRAIT_AXES, TRAIT_MIN, TRAIT_MAX, defaultTraits, randomTraits } from '../data/traits';
import type { HeroDefinition, HeroClass, HeroTraits } from '../types';
import { generateRandomHero } from '../data/heroes';
import { generateHeroDescription, encodeHeroToParams } from '../data/heroDescription';
import type { SharedHeroData } from '../data/heroDescription';

const MAX_ROSTER = 20;

const ALL_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

const CLASS_EMOJIS: Record<HeroClass, string> = {
  Warrior: '⚔️', Mage: '🧙', Ranger: '🏹', Paladin: '🛡️', Rogue: '🗡️', Cleric: '🙏',
};

const CLASS_ROLES: Record<HeroClass, string> = {
  Warrior: 'Tank / DPS', Mage: 'Burst DPS', Ranger: 'Control / DPS',
  Paladin: 'Support / Tank', Rogue: 'Finisher / DPS', Cleric: 'Healer / Support',
};

interface RosterScreenProps {
  roster: HeroDefinition[];
  onRosterChange: (roster: HeroDefinition[]) => void;
  onBack: () => void;
  /** Pre-populated hero data received via a share link */
  sharedHero?: SharedHeroData | null;
}

type RosterView = 'list' | 'edit-traits' | 'create';

export function RosterScreen({ roster, onRosterChange, onBack, sharedHero }: RosterScreenProps) {
  const [view, setView] = useState<RosterView>(() => (sharedHero ? 'create' : 'list'));
  const [editingHero, setEditingHero] = useState<HeroDefinition | null>(null);
  // For create: a new hero being configured before adding
  const [draftHero, setDraftHero] = useState<HeroDefinition | null>(() => {
    if (!sharedHero) return null;
    return {
      id: `hero-${crypto.randomUUID()}`,
      name: sharedHero.name,
      heroClass: sharedHero.heroClass,
      description: generateHeroDescription(sharedHero.heroClass, sharedHero.traits),
      role: CLASS_ROLES[sharedHero.heroClass],
      emoji: CLASS_EMOJIS[sharedHero.heroClass],
      stats: { strength: 8, dexterity: 8, intelligence: 8, constitution: 8, wisdom: 8 },
      traits: sharedHero.traits,
    };
  });
  const [shareCopied, setShareCopied] = useState<string | null>(null);

  function openEditTraits(hero: HeroDefinition) {
    setEditingHero({ ...hero });
    setView('edit-traits');
  }

  function saveEdit(updated: HeroDefinition) {
    const newRoster = roster.map(h => h.id === updated.id ? updated : h);
    onRosterChange(newRoster);
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

  function setDraftName(name: string) {
    if (!draftHero) return;
    setDraftHero({ ...draftHero, name });
  }

  function setDraftClass(heroClass: HeroClass) {
    if (!draftHero) return;
    setDraftHero({
      ...draftHero,
      heroClass,
      emoji: CLASS_EMOJIS[heroClass],
      role: CLASS_ROLES[heroClass],
    });
  }

  function confirmCreate() {
    if (!draftHero || roster.length >= MAX_ROSTER) return;
    const finalHero: HeroDefinition = {
      ...draftHero,
      description: generateHeroDescription(draftHero.heroClass, draftHero.traits),
    };
    onRosterChange([...roster, finalHero]);
    setView('list');
    setDraftHero(null);
  }

  function copyShareLink(hero: HeroDefinition) {
    const params = encodeHeroToParams({ name: hero.name, heroClass: hero.heroClass, traits: hero.traits });
    const base = window.location.origin + window.location.pathname;
    const url = `${base}?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(hero.id);
      setTimeout(() => setShareCopied(null), 2000);
    }).catch(() => {
      // Fallback: prompt user to copy
      window.prompt('Copy this link to share your hero:', url);
    });
  }

  // ── Edit existing hero ───────────────────────────────────────────────────

  if (view === 'edit-traits' && editingHero) {
    return (
      <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setView('list'); setEditingHero(null); }}
            className="text-stone-400 hover:text-stone-100 text-2xl leading-none"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">Edit Hero</h1>
        </div>

        {/* Name & Class editing */}
        <div className="bg-stone-800 border border-stone-700 rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs text-stone-400 mb-1">Name</label>
            <input
              type="text"
              value={editingHero.name}
              maxLength={24}
              onChange={e => setEditingHero(prev => prev ? { ...prev, name: e.target.value } : prev)}
              className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">Class</label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_CLASSES.map(hc => (
                <button
                  key={hc}
                  onClick={() => setEditingHero(prev => prev ? { ...prev, heroClass: hc, emoji: CLASS_EMOJIS[hc], role: CLASS_ROLES[hc] } : prev)}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    editingHero.heroClass === hc
                      ? 'bg-amber-700 border-amber-500 text-stone-100'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:border-stone-400'
                  }`}
                >
                  {CLASS_EMOJIS[hc]} {hc}
                </button>
              ))}
            </div>
          </div>
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
          onDone={() => saveEdit({
            ...editingHero,
            description: generateHeroDescription(editingHero.heroClass, editingHero.traits),
          })}
          doneLabel="Save"
        />
      </div>
    );
  }

  // ── Create hero ──────────────────────────────────────────────────────────

  if (view === 'create' && draftHero) {
    return (
      <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setView('list'); setDraftHero(null); }}
            className="text-stone-400 hover:text-stone-100 text-2xl leading-none"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">Create Hero</h1>
        </div>

        {/* Name & Class selection */}
        <div className="bg-stone-800 border border-stone-700 rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs text-stone-400 mb-1">Name</label>
            <input
              type="text"
              value={draftHero.name}
              maxLength={24}
              onChange={e => setDraftName(e.target.value)}
              className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">Class</label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_CLASSES.map(hc => (
                <button
                  key={hc}
                  onClick={() => setDraftClass(hc)}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    draftHero.heroClass === hc
                      ? 'bg-amber-700 border-amber-500 text-stone-100'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:border-stone-400'
                  }`}
                >
                  {CLASS_EMOJIS[hc]} {hc}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats preview */}
        <div className="bg-stone-800 border border-stone-700 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{draftHero.emoji}</span>
            <div>
              <div className="font-bold text-lg">{draftHero.name || '—'}</div>
              <div className="text-xs text-stone-400">{draftHero.heroClass} · {draftHero.role}</div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1 text-xs text-center mb-3">
            {Object.entries(draftHero.stats).map(([stat, val]) => (
              <div key={stat} className="bg-stone-700/50 rounded p-1">
                <div className="text-stone-400 uppercase" style={{ fontSize: '0.6rem' }}>{stat.slice(0, 3)}</div>
                <div className="font-bold text-stone-200">{val}</div>
              </div>
            ))}
          </div>
          <button
            onClick={rerollDraft}
            className="w-full py-2 rounded-lg border border-stone-600 text-stone-300 hover:text-stone-100 hover:border-stone-400 text-sm transition-colors"
          >
            🎲 Reroll Hero
          </button>
        </div>

        {/* Trait editor */}
        <p className="text-xs text-stone-500 mb-3">Customize this hero's traits, or randomize them.</p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={randomizeDraftTraits}
            className="flex-1 py-2 rounded-lg border border-stone-600 text-stone-300 hover:text-stone-100 hover:border-stone-400 text-sm transition-colors"
          >
            🎲 Random Traits
          </button>
          <button
            onClick={resetDraftTraits}
            className="flex-1 py-2 rounded-lg border border-stone-600 text-stone-300 hover:text-stone-100 hover:border-stone-400 text-sm transition-colors"
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
        <div className="pt-4 mt-2 border-t border-stone-800">
          <button
            onClick={confirmCreate}
            disabled={roster.length >= MAX_ROSTER || !draftHero.name.trim()}
            className="w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-amber-700 hover:bg-amber-600 text-stone-100"
          >
            ✓ Add to Roster ({roster.length}/{MAX_ROSTER})
          </button>
        </div>
      </div>
    );
  }

  // ── Hero list ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="text-stone-400 hover:text-stone-100 text-2xl leading-none"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Hero Roster</h1>
      </div>
      <p className="text-stone-400 text-sm mb-5">
        {roster.length === 0
          ? 'Your roster is empty. Generate heroes to start a run!'
          : `${roster.length} hero${roster.length !== 1 ? 'es' : ''} · up to ${MAX_ROSTER}`}
      </p>

      {/* Hero list */}
      <div className="flex flex-col gap-3 flex-1">
        {roster.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-500 py-12">
            <div className="text-5xl">🧑‍🤝‍🧑</div>
            <p className="text-sm text-center">No heroes yet.<br />Tap below to create your first hero.</p>
          </div>
        )}
        {roster.map((hero) => (
          <div key={hero.id} className="flex gap-2">
            <div className="flex-1 bg-stone-800 border border-stone-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{hero.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{hero.name}</span>
                    <span className="text-xs text-stone-400">{hero.heroClass}</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">{hero.role}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1 text-xs text-center">
                {Object.entries(hero.stats).map(([stat, val]) => (
                  <div key={stat} className="bg-stone-700/50 rounded p-1">
                    <div className="text-stone-400 uppercase" style={{ fontSize: '0.6rem' }}>{stat.slice(0, 3)}</div>
                    <div className="font-bold text-stone-200">{val}</div>
                  </div>
                ))}
              </div>
              {/* Hero description */}
              {hero.description && (
                <p className="mt-3 text-xs text-stone-500 leading-relaxed line-clamp-3">
                  {hero.description.split('\n\n')[0]}
                </p>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => openEditTraits(hero)}
                className="flex-1 px-3 bg-stone-800 border border-stone-700 hover:border-stone-500 rounded-xl text-lg transition-colors"
                title="Edit hero"
              >
                ⚙️
              </button>
              <button
                onClick={() => copyShareLink(hero)}
                className={`flex-1 px-3 bg-stone-800 border rounded-xl text-lg transition-colors ${
                  shareCopied === hero.id
                    ? 'border-amber-500 text-amber-400'
                    : 'border-stone-700 hover:border-amber-600'
                }`}
                title="Share hero"
              >
                {shareCopied === hero.id ? '✓' : '🔗'}
              </button>
              <button
                onClick={() => deleteHero(hero.id)}
                className="flex-1 px-3 bg-stone-800 border border-stone-700 hover:border-red-600 hover:text-red-400 rounded-xl text-lg transition-colors"
                title="Remove hero"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add hero button */}
      <div className="pt-4 mt-4 border-t border-stone-800">
        <button
          onClick={openCreate}
          disabled={roster.length >= MAX_ROSTER}
          className="w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-amber-700 hover:bg-amber-600 text-stone-100"
        >
          + Create New Hero
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
          <div className="text-xs text-stone-400">{hero.heroClass} · {hero.role}</div>
        </div>
      </div>

      <p className="text-xs text-stone-500 mb-4">
        Traits shape stat growth, skill selection, and combat AI.
        Drag sliders to customize this hero's personality.
      </p>

      <div className="flex flex-col gap-3">
        {TRAIT_AXES.map(axis => {
          const value = traits[axis.key];
          return (
            <div key={axis.key} className="bg-stone-800 border border-stone-700 rounded-lg p-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-sky-400">{axis.negativePole}</span>
                <span className="text-stone-500 font-mono">{value > 0 ? '+' : ''}{value}</span>
                <span className="text-amber-400">{axis.positivePole}</span>
              </div>
              <input
                type="range"
                min={TRAIT_MIN}
                max={TRAIT_MAX}
                value={value}
                onChange={e => onChangeTrait(axis.key, parseInt(e.target.value, 10))}
                className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
            </div>
          );
        })}
      </div>

      {!hideFoot && (
        <div className="flex gap-3 mt-5 pt-4 border-t border-stone-800">
          <button
            onClick={onReset}
            className="flex-1 py-3 rounded-xl border border-stone-600 text-stone-400 hover:text-stone-100 hover:border-stone-400 text-sm transition-colors"
          >
            Reset to Default
          </button>
          <button
            onClick={onDone}
            className="flex-1 py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-stone-100 font-bold text-sm transition-colors"
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
