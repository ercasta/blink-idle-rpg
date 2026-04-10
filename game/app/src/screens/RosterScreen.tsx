import { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { TRAIT_AXES, TRAIT_MIN, TRAIT_MAX, defaultTraits, randomTraits, simulateHeroPath, getSkillName } from '../data/traits';
import type { HeroDefinition, HeroClass, HeroTraits } from '../types';
import { generateRandomHero } from '../data/heroes';
import { generateHeroDescription, encodeHeroToParams } from '../data/heroDescription';
import type { SharedHeroData } from '../data/heroDescription';
import { loadSkillCatalog } from '../data/skillCatalog';
import type { SkillEntry } from '../data/skillCatalog';

const ALL_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

const CLASS_EMOJIS: Record<HeroClass, string> = {
  Warrior: '⚔️', Mage: '🧙', Ranger: '🏹', Paladin: '🛡️', Rogue: '🗡️', Cleric: '🙏',
};

const CLASS_ROLES: Record<HeroClass, string> = {
  Warrior: 'Tank / DPS', Mage: 'Burst DPS', Ranger: 'Control / DPS',
  Paladin: 'Support / Tank', Rogue: 'Finisher / DPS', Cleric: 'Healer / Support',
};

// ── Hero sharing helpers ──────────────────────────────────────────────────────

function getHeroShareUrl(hero: HeroDefinition): string {
  const params = encodeHeroToParams({ name: hero.name, heroClass: hero.heroClass, traits: hero.traits });
  const base = window.location.origin + window.location.pathname;
  return `${base}?${params.toString()}`;
}

// ── Hero QR Modal ─────────────────────────────────────────────────────────────

function HeroQrModal({ hero, onClose }: { hero: HeroDefinition; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const url = getHeroShareUrl(hero);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 280, margin: 2 })
      .then(setDataUrl)
      .catch(e => console.error('[HeroQrModal] QR generation failed', e));
  }, [url]);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-stone-800 border border-stone-600 rounded-2xl p-6 max-w-xs w-full flex flex-col items-center gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-bold text-base text-stone-100">Share QR Code</h2>
        <p className="text-xs text-stone-400 text-center">
          <span className="font-semibold text-stone-200">{hero.name}</span>
        </p>
        {dataUrl
          ? <img src={dataUrl} alt="Hero QR Code" className="rounded-xl w-56 h-56" />
          : <div className="w-56 h-56 flex items-center justify-center text-stone-500 text-sm">Generating…</div>
        }
        <p className="text-xs text-stone-500 text-center break-all">{url}</p>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Hero Share Modal ──────────────────────────────────────────────────────────

function HeroShareModal({ hero, onClose }: { hero: HeroDefinition; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const url = getHeroShareUrl(hero);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link to share your hero:', url);
    }
  }

  async function nativeShare() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: hero.name, text: `Check out my hero: ${hero.name}`, url });
      } catch {
        // user cancelled – ignore
      }
    } else {
      copyLink();
    }
  }

  if (showQr) {
    return <HeroQrModal hero={hero} onClose={onClose} />;
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-stone-800 border border-stone-600 rounded-2xl p-5 max-w-xs w-full flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-bold text-base text-stone-100">Share Hero</h2>
        <p className="text-xs text-stone-400 text-center -mt-1">
          <span className="font-semibold text-stone-200">{hero.name}</span>
          {' '}·{' '}
          <span className="text-stone-400">{hero.heroClass}</span>
        </p>

        <button
          onClick={copyLink}
          className="w-full py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {copied ? '✓ Copied!' : '🔗 Copy Link'}
        </button>

        {typeof navigator.share === 'function' && (
          <button
            onClick={nativeShare}
            className="w-full py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            📤 Share…
          </button>
        )}

        <button
          onClick={() => setShowQr(true)}
          className="w-full py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          📷 Show QR Code
        </button>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl border border-stone-600 text-stone-400 hover:text-stone-200 text-xs font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Hero Overwrite Confirmation Modal ─────────────────────────────────────────

function HeroOverwriteConfirmModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-stone-800 border border-stone-600 rounded-2xl p-5 max-w-xs w-full flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-bold text-base text-stone-100">⚠️ Name Already Exists</h2>
        <p className="text-xs text-stone-400">
          A hero named{' '}
          <span className="font-semibold text-stone-200">"{name}"</span>{' '}
          already exists in your roster. Do you want to overwrite it?
        </p>
        <button
          onClick={onConfirm}
          className="w-full py-3 rounded-xl bg-red-800 hover:bg-red-700 text-stone-100 text-sm font-bold transition-colors"
        >
          Overwrite
        </button>
        <button
          onClick={onCancel}
          className="w-full py-2 rounded-xl border border-stone-600 text-stone-400 hover:text-stone-200 text-xs font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

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
  const [filterName, setFilterName] = useState('');
  const [filterClass, setFilterClass] = useState<HeroClass | ''>('');
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
  const [sharingHero, setSharingHero] = useState<HeroDefinition | null>(null);
  // Overwrite confirmation: holds the hero waiting for user confirmation
  const [pendingHeroCreate, setPendingHeroCreate] = useState<HeroDefinition | null>(null);
  const [pendingHeroEdit, setPendingHeroEdit] = useState<HeroDefinition | null>(null);

  function openEditTraits(hero: HeroDefinition) {
    setEditingHero({ ...hero });
    setView('edit-traits');
  }

  function saveEdit(updated: HeroDefinition) {
    // Check if the name changed and now conflicts with another hero
    const duplicate = roster.find(
      h => h.id !== updated.id && h.name.trim().toLowerCase() === updated.name.trim().toLowerCase(),
    );
    if (duplicate) {
      setPendingHeroEdit(updated);
      return;
    }
    commitSaveEdit(updated);
  }

  function commitSaveEdit(updated: HeroDefinition) {
    // Remove the conflicting hero (if any), then update the edited one
    const newRoster = roster
      .filter(h => h.id === updated.id || h.name.trim().toLowerCase() !== updated.name.trim().toLowerCase())
      .map(h => h.id === updated.id ? updated : h);
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
    if (!draftHero) return;
    const finalHero: HeroDefinition = {
      ...draftHero,
      description: generateHeroDescription(draftHero.heroClass, draftHero.traits),
    };
    // Check for duplicate name
    const duplicate = roster.find(
      h => h.name.trim().toLowerCase() === finalHero.name.trim().toLowerCase(),
    );
    if (duplicate) {
      setPendingHeroCreate(finalHero);
      return;
    }
    commitCreate(finalHero);
  }

  function commitCreate(finalHero: HeroDefinition) {
    // Remove any existing hero with the same name, then append new one
    onRosterChange([
      ...roster.filter(h => h.name.trim().toLowerCase() !== finalHero.name.trim().toLowerCase()),
      finalHero,
    ]);
    setView('list');
    setDraftHero(null);
  }

  function openShareModal(hero: HeroDefinition) {
    setSharingHero(hero);
  }

  // ── Edit existing hero ───────────────────────────────────────────────────

  if (view === 'edit-traits' && editingHero) {
    return (
      <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
        {pendingHeroEdit && (
          <HeroOverwriteConfirmModal
            name={pendingHeroEdit.name}
            onConfirm={() => {
              const hero = pendingHeroEdit;
              setPendingHeroEdit(null);
              commitSaveEdit(hero);
            }}
            onCancel={() => setPendingHeroEdit(null)}
          />
        )}
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
          doneDisabled={!editingHero.name.trim()}
          liveDescription={generateHeroDescription(editingHero.heroClass, editingHero.traits)}
        />
      </div>
    );
  }

  // ── Create hero ──────────────────────────────────────────────────────────

  if (view === 'create' && draftHero) {
    return (
      <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
        {pendingHeroCreate && (
          <HeroOverwriteConfirmModal
            name={pendingHeroCreate.name}
            onConfirm={() => {
              const hero = pendingHeroCreate;
              setPendingHeroCreate(null);
              commitCreate(hero);
            }}
            onCancel={() => setPendingHeroCreate(null)}
          />
        )}
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
              <div className="font-bold text-lg">{draftHero.name || 'Unnamed Hero'}</div>
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
          doneLabel={`Add to Roster (${roster.length})`}
          hideFoot
        />
        <div className="pt-4 mt-2 border-t border-stone-800">
          <button
            onClick={confirmCreate}
            disabled={!draftHero.name.trim()}
            className="w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-amber-700 hover:bg-amber-600 text-stone-100"
          >
            ✓ Add to Roster ({roster.length})
          </button>
        </div>
      </div>
    );
  }

  // ── Hero list ────────────────────────────────────────────────────────────

  const filteredRoster = roster.filter(hero => {
    const nameMatch = hero.name.toLowerCase().includes(filterName.toLowerCase());
    const classMatch = filterClass === '' || hero.heroClass === filterClass;
    return nameMatch && classMatch;
  });

  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
      {/* Share modal */}
      {sharingHero && (
        <HeroShareModal hero={sharingHero} onClose={() => setSharingHero(null)} />
      )}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="text-stone-400 hover:text-stone-100 text-2xl leading-none"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Hero Roster</h1>
      </div>
      <p className="text-stone-400 text-sm mb-4">
        {roster.length === 0
          ? 'Your roster is empty. Generate heroes to start a run!'
          : `${roster.length} hero${roster.length !== 1 ? 'es' : ''}`}
      </p>

      {/* Filters */}
      {roster.length > 0 && (
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
            {ALL_CLASSES.map(hc => (
              <button
                key={hc}
                onClick={() => setFilterClass(prev => prev === hc ? '' : hc)}
                className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  filterClass === hc
                    ? 'bg-amber-700 border-amber-500 text-stone-100'
                    : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-400'
                }`}
              >
                {CLASS_EMOJIS[hc]} {hc}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add hero button */}
      <div className="mb-4">
        <button
          onClick={openCreate}
          className="w-full py-4 rounded-xl font-bold text-lg transition-colors bg-amber-700 hover:bg-amber-600 text-stone-100"
        >
          + Create New Hero
        </button>
      </div>

      {/* Hero list */}
      <div className="flex flex-col gap-3 flex-1">
        {roster.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-500 py-12">
            <div className="text-5xl">🧑‍🤝‍🧑</div>
            <p className="text-sm text-center">No heroes yet.<br />Tap above to create your first hero.</p>
          </div>
        )}
        {roster.length > 0 && filteredRoster.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-500 py-12">
            <p className="text-sm text-center">No heroes match your filters.</p>
          </div>
        )}
        {filteredRoster.map((hero) => (
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
                onClick={() => openShareModal(hero)}
                className="flex-1 px-3 bg-stone-800 border border-stone-700 hover:border-amber-600 rounded-xl text-lg transition-colors"
                title="Share hero"
              >
                📤
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
  doneDisabled?: boolean;
  liveDescription?: string;
}

export function TraitEditor({ hero, traits, onChangeTrait, onReset, onDone, doneLabel = 'Done', hideFoot = false, doneDisabled = false, liveDescription }: TraitEditorProps) {
  const [showPath, setShowPath] = useState(false);
  const [skillCatalog, setSkillCatalog] = useState<Map<string, SkillEntry>>(new Map());
  const [selectedSkill, setSelectedSkill] = useState<SkillEntry | null>(null);

  useEffect(() => {
    loadSkillCatalog().then(setSkillCatalog);
  }, []);

  // Recompute path only when panel is open and when traits or heroClass changes
  const pathEntries = useMemo(
    () => (showPath ? simulateHeroPath(hero.heroClass, traits, 25) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showPath, hero.heroClass, JSON.stringify(traits)],
  );
  // Collect unique skills acquired (in order of acquisition)
  const acquiredSkillIds: string[] = [];
  for (const entry of pathEntries) {
    if (entry.skillChosen && !acquiredSkillIds.includes(entry.skillChosen)) {
      acquiredSkillIds.push(entry.skillChosen);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{hero.emoji}</span>
        <div>
          <div className="font-bold">{hero.name}</div>
          <div className="text-xs text-stone-400">{hero.heroClass} · {hero.role}</div>
        </div>
      </div>

      {liveDescription ? (
        <div className="bg-stone-800 border border-stone-700 rounded-xl p-4 mb-4">
          {liveDescription.split('\n\n').map((para, i) => (
            <p key={i} className={`text-xs text-stone-400 leading-relaxed ${i > 0 ? 'mt-2' : ''}`}>{para}</p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-500 mb-4">
          Traits shape stat growth, skill selection, and combat AI.
          Drag sliders to customize this hero's personality.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {TRAIT_AXES.map(axis => {
          const value = traits[axis.key];
          return (
            <div key={axis.key} className="bg-stone-800 border border-stone-700 rounded-lg p-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-400">{axis.negativePole}</span>
                <span className="text-stone-500 font-mono">{value > 0 ? '+' : ''}{value}</span>
                <span className="text-stone-400">{axis.positivePole}</span>
              </div>
              <input
                type="range"
                min={TRAIT_MIN}
                max={TRAIT_MAX}
                value={value}
                onChange={e => onChangeTrait(axis.key, parseInt(e.target.value, 10))}
                className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-stone-400"
              />
            </div>
          );
        })}
      </div>

      {/* Predict Hero Path */}
      <div className="mt-5">
        <button
          onClick={() => { setShowPath(p => !p); setSelectedSkill(null); }}
          className="w-full py-3 rounded-xl border border-stone-600 text-stone-300 hover:text-stone-100 hover:border-stone-400 text-sm font-medium transition-colors"
        >
          🔮 {showPath ? 'Hide Hero Path' : 'Predict Hero Path'}
        </button>

        {showPath && (
          <div className="mt-3 bg-stone-800 border border-stone-700 rounded-xl p-4">
            <p className="text-xs text-stone-500 mb-3 leading-relaxed">
              Simulated skill acquisitions to level 25, based on current traits.
              Tap a skill to read its description.
            </p>

            {/* Skill list */}
            <div className="flex flex-wrap gap-2 mb-3">
              {acquiredSkillIds.map(skillId => {
                const entry = skillCatalog.get(skillId);
                const label = entry?.name ?? getSkillName(skillId, hero.heroClass);
                const isSelected = selectedSkill?.id === skillId;
                return (
                  <button
                    key={skillId}
                    onClick={() => setSelectedSkill(isSelected ? null : (entry ?? { id: skillId, name: label, description: '', skillType: '', prerequisites: [] }))}
                    className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-stone-600 border-stone-400 text-stone-100'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:border-stone-400 hover:text-stone-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              {acquiredSkillIds.length === 0 && (
                <p className="text-xs text-stone-600 italic">No skills predicted for current traits.</p>
              )}
            </div>

            {/* Selected skill description */}
            {selectedSkill && (
              <div className="bg-stone-700/60 border border-stone-600 rounded-lg p-3 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-stone-200">{selectedSkill.name}</span>
                  {selectedSkill.skillType && (
                    <span className="text-stone-400 text-[0.65rem] uppercase tracking-wide border border-stone-600 rounded px-1.5 py-0.5">
                      {selectedSkill.skillType}
                    </span>
                  )}
                </div>
                {selectedSkill.description ? (
                  <p className="text-stone-400 leading-relaxed">{selectedSkill.description}</p>
                ) : (
                  <p className="text-stone-600 italic">No description available.</p>
                )}
                {selectedSkill.prerequisites.length > 0 && (
                  <p className="text-stone-500 mt-1.5">
                    <span className="text-stone-600">Requires: </span>
                    {selectedSkill.prerequisites.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Level-by-level breakdown */}
            <details className="mt-3">
              <summary className="text-xs text-stone-500 cursor-pointer hover:text-stone-400 select-none">
                Show level-by-level breakdown
              </summary>
              <div className="mt-2 flex flex-col gap-1 max-h-48 overflow-y-auto">
                {pathEntries.filter(e => e.skillChosen).map(entry => {
                  const catalogEntry = skillCatalog.get(entry.skillChosen!);
                  const name = catalogEntry?.name ?? getSkillName(entry.skillChosen!, hero.heroClass);
                  return (
                    <div key={entry.level} className="flex items-center gap-2 text-xs">
                      <span className="text-stone-600 w-14 shrink-0">Lv {entry.level}</span>
                      <span className="text-stone-300">→ {name}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        )}
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
            disabled={doneDisabled}
            className="flex-1 py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-stone-100 font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
