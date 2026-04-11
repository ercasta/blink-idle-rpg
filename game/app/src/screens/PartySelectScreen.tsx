import { useState } from 'react';
import type { HeroDefinition, HeroClass, AdventureDefinition, LinePreference, HeroRole } from '../types';
import { ALL_LINE_PREFERENCES, ALL_ROLES } from '../types';
import { ClassIcon, HeroesIcon, PlayIcon, StarIcon } from '../components/icons';
import { computeLinePreference, computeRole, heroSummary } from '../data/traits';

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
  const [filterLine, setFilterLine] = useState<LinePreference | ''>('');
  const [filterRole, setFilterRole] = useState<HeroRole | ''>('');
  const [filterFavourites, setFilterFavourites] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'adventures'>('name');

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
  const filteredRoster = roster
    .filter(hero => {
      if (!allowedClasses.includes(hero.heroClass)) return false;
      const nameMatch = hero.name.toLowerCase().includes(filterName.toLowerCase());
      const classMatch = filterClass === '' || hero.heroClass === filterClass;
      const lineMatch = filterLine === '' || (hero.linePreference ?? computeLinePreference(hero.traits)) === filterLine;
      const roleMatch = filterRole === '' || (hero.role ?? computeRole(hero.heroClass, hero.traits)) === filterRole;
      const favMatch = !filterFavourites || hero.favourite === true;
      return nameMatch && classMatch && lineMatch && roleMatch && favMatch;
    })
    .sort((a, b) => {
      if (sortBy === 'adventures') {
        return (b.adventuresPlayed ?? 0) - (a.adventuresPlayed ?? 0);
      }
      return a.name.localeCompare(b.name);
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
            <div className="flex flex-wrap gap-2">
              <select
                value={filterClass}
                onChange={e => setFilterClass(e.target.value as HeroClass | '')}
                className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-300 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="">All Classes</option>
                {allowedClasses.map(hc => <option key={hc} value={hc}>{hc}</option>)}
              </select>
              <select
                value={filterLine}
                onChange={e => setFilterLine(e.target.value as LinePreference | '')}
                className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-300 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="">All Lines</option>
                {ALL_LINE_PREFERENCES.map(lp => <option key={lp} value={lp}>{lp} line</option>)}
              </select>
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value as HeroRole | '')}
                className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-300 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="">All Roles</option>
                {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterFavourites(f => !f)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  filterFavourites
                    ? 'bg-amber-700 border-amber-500 text-stone-100'
                    : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-400'
                }`}
              >
                <StarIcon size={12} filled={filterFavourites}/> Favourites
              </button>
              <button
                onClick={() => setSortBy(s => s === 'adventures' ? 'name' : 'adventures')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  sortBy === 'adventures'
                    ? 'bg-amber-700 border-amber-500 text-stone-100'
                    : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-400'
                }`}
              >
                Sort: {sortBy === 'adventures' ? 'Adventures ↓' : 'Name A–Z'}
              </button>
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
              const adventuresPlayed = hero.adventuresPlayed ?? 0;
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
                        <span className="text-xs text-stone-400">{heroSummary(hero.heroClass, hero.traits, hero.linePreference)}</span>
                        {hero.favourite && (
                          <StarIcon size={12} filled className="text-amber-400"/>
                        )}
                        {isSelected && (
                          <span className="ml-auto text-xs bg-amber-700 px-2 py-0.5 rounded-full text-stone-100">
                            ✓ Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-600 mt-0.5">
                        {adventuresPlayed} adventure{adventuresPlayed !== 1 ? 's' : ''} played
                      </p>
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
