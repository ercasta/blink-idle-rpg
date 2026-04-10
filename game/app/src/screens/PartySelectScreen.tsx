import { useState } from 'react';
import type { HeroDefinition, HeroClass, AdventureDefinition } from '../types';
import { ClassIcon, HeroesIcon, PlayIcon } from '../components/icons';

const ALL_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

interface PartySelectScreenProps {
  roster: HeroDefinition[];
  adventure: AdventureDefinition;
  onStart: (heroes: HeroDefinition[]) => void;
  onBack: () => void;
  onManageRoster: () => void;
}

export function PartySelectScreen({ roster, adventure, onStart, onBack, onManageRoster }: PartySelectScreenProps) {
  const maxParty = adventure.requiredHeroCount;
  const allowedClasses = adventure.allowedClasses.length > 0 ? adventure.allowedClasses : ALL_CLASSES;
  const allClassesAllowed = allowedClasses.length === ALL_CLASSES.length;

  const [selected, setSelected] = useState<string[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterClass, setFilterClass] = useState<HeroClass | ''>('');

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= maxParty) return prev;
      return [...prev, id];
    });
  }

  function handleStart() {
    if (selected.length < 1) return;
    const heroes = selected
      .map(id => roster.find(h => h.id === id))
      .filter((h): h is HeroDefinition => Boolean(h));
    onStart(heroes);
  }

  // Filter roster by adventure's allowed classes, then by user filters
  const filteredRoster = roster.filter(hero => {
    if (!allowedClasses.includes(hero.heroClass)) return false;
    const nameMatch = hero.name.toLowerCase().includes(filterName.toLowerCase());
    const classMatch = filterClass === '' || hero.heroClass === filterClass;
    return nameMatch && classMatch;
  });

  // The roster heroes that match the adventure's class restriction
  const eligibleRosterCount = roster.filter(h => allowedClasses.includes(h.heroClass)).length;

  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="text-stone-400 hover:text-stone-100 text-2xl leading-none">
          ←
        </button>
        <h1 className="text-xl font-bold">Assemble Your Party</h1>
      </div>

      {/* Adventure context banner */}
      <div className="bg-stone-800 border border-amber-700/40 rounded-xl px-3 py-2 mb-4 text-xs text-stone-400">
        <span className="font-semibold text-amber-400">{adventure.name}</span>
        {' · '}
        {maxParty} {maxParty === 1 ? 'hero' : 'heroes'} required
        {!allClassesAllowed && (
          <span className="inline-flex items-center gap-0.5"> · {allowedClasses.map(c => <ClassIcon key={c} heroClass={c} size={14}/>)}</span>
        )}
      </div>

      {eligibleRosterCount === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-12">
          <HeroesIcon size={48} className="text-stone-500"/>
          <p className="text-stone-400 text-sm">
            {roster.length === 0
              ? 'Your roster is empty. Create heroes before starting a run.'
              : `No heroes in your roster match the allowed classes for "${adventure.name}".`
            }
          </p>
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
            Choose up to {maxParty} {maxParty === 1 ? 'hero' : 'heroes'}.
            {' '}Selected: {selected.length}/{maxParty}
          </p>
          <button
            onClick={onManageRoster}
            className="text-xs text-stone-500 hover:text-stone-300 mb-4 text-left transition-colors underline"
          >
            ← Manage Roster
          </button>

          {/* Filters */}
          <div className="flex flex-col gap-2 mb-4">
            <input
              type="text"
              placeholder="Search by name…"
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 text-sm placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFilterClass('')}
                className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  filterClass === ''
                    ? 'bg-amber-700 border-amber-500 text-stone-100'
                    : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-400'
                }`}
              >
                All
              </button>
              {allowedClasses.map(hc => (
                <button
                  key={hc}
                  onClick={() => setFilterClass(prev => prev === hc ? '' : hc)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    filterClass === hc
                      ? 'bg-amber-700 border-amber-500 text-stone-100'
                      : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-400'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5"><ClassIcon heroClass={hc} size={14}/> {hc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hero grid */}
          <div className="flex flex-col gap-3 flex-1">
            {filteredRoster.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-500 py-12">
                <p className="text-sm text-center">No heroes match your filters.</p>
              </div>
            )}
            {filteredRoster.map((hero) => {
              const isSelected = selected.includes(hero.id);
              const isDisabled = !isSelected && selected.length >= maxParty;
              return (
                <button
                  key={hero.id}
                  onClick={() => toggle(hero.id)}
                  disabled={isDisabled}
                  className={`w-full text-left rounded-xl p-4 transition-colors border-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-amber-900/40 border-amber-600'
                      : 'bg-stone-800 border-stone-700 hover:border-stone-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ClassIcon heroClass={hero.heroClass} size={32}/>
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
                </button>
              );
            })}
          </div>

          {/* Start button */}
          <div className="pt-4 mt-4 border-t border-stone-800">
            <button
              onClick={handleStart}
              disabled={selected.length < 1}
              className="w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-amber-700 hover:bg-amber-600 text-stone-100"
            >
              {selected.length < 1
                ? 'Select at least 1 hero'
                : <span className="inline-flex items-center gap-2"><PlayIcon size={18}/> Run! ({selected.length} hero{selected.length !== 1 ? 'es' : ''})</span>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
