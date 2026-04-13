import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { TRAIT_AXES, TRAIT_MIN, TRAIT_MAX, defaultTraits, randomTraits, computeBaseStats, computeLinePreference, computeRole, heroSummary } from '../data/traits';
import type { HeroDefinition, HeroClass, HeroTraits, LinePreference, HeroRole } from '../types';
import { ALL_LINE_PREFERENCES, ALL_ROLES } from '../types';
import { generateRandomHero } from '../data/heroes';
import { generateHeroDescription, encodeHeroToParams } from '../data/heroDescription';
import type { SharedHeroData } from '../data/heroDescription';
import { printHeroFigurine } from '../utils/heroFigurine';
import { ClassIcon, HeroesIcon, DiceIcon, TrashIcon, StarIcon } from '../components/icons';

const ALL_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

// Kept for backward-compatibility hero object construction (emoji field is stored in hero data).
const CLASS_EMOJIS: Record<HeroClass, string> = {
  Warrior: '⚔️', Mage: '🧙', Ranger: '🏹', Paladin: '🛡️', Rogue: '🗡️', Cleric: '🙏',
};

// ── Hero sharing helpers ──────────────────────────────────────────────────────

function getHeroShareUrl(hero: HeroDefinition): string {
  const params = encodeHeroToParams({
    name: hero.name,
    heroClass: hero.heroClass,
    traits: hero.traits,
    adventuresPlayed: hero.adventuresPlayed,
  });
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

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

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
  const [printing, setPrinting] = useState(false);
  const url = getHeroShareUrl(hero);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

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

  async function handlePrint() {
    setPrinting(true);
    try {
      await printHeroFigurine(hero);
    } catch (e) {
      console.error('[HeroShareModal] PDF generation failed', e);
    } finally {
      setPrinting(false);
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
          onClick={handlePrint}
          disabled={printing}
          className="w-full py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {printing ? '⏳ Generating…' : '🖨️ Print Figurine'}
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
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

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
  const [filterLine, setFilterLine] = useState<LinePreference | ''>('');
  const [filterRole, setFilterRole] = useState<HeroRole | ''>('');
  const [filterFavourites, setFilterFavourites] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'adventures'>('name');
  const [editingHero, setEditingHero] = useState<HeroDefinition | null>(null);
  // For create: a new hero being configured before adding
  const [draftHero, setDraftHero] = useState<HeroDefinition | null>(() => {
    if (!sharedHero) return null;
    return {
      id: `hero-${crypto.randomUUID()}`,
      name: sharedHero.name,
      heroClass: sharedHero.heroClass,
      description: generateHeroDescription(sharedHero.heroClass, sharedHero.traits),
      role: computeRole(sharedHero.heroClass, sharedHero.traits),
      emoji: CLASS_EMOJIS[sharedHero.heroClass],
      stats: computeBaseStats(sharedHero.heroClass, sharedHero.traits),
      traits: sharedHero.traits,
      linePreference: computeLinePreference(sharedHero.traits),
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

  function toggleFavourite(id: string) {
    onRosterChange(roster.map(h => h.id === id ? { ...h, favourite: !h.favourite } : h));
  }

  function openCreate() {
    setDraftHero(generateRandomHero());
    setView('create');
  }

  function randomizeDraftTraits() {
    if (!draftHero) return;
    const newTraits = randomTraits();
    setDraftHero({ ...draftHero, traits: newTraits, stats: computeBaseStats(draftHero.heroClass, newTraits), role: computeRole(draftHero.heroClass, newTraits), linePreference: computeLinePreference(newTraits) });
  }

  function resetDraftTraits() {
    if (!draftHero) return;
    const newTraits = defaultTraits();
    setDraftHero({ ...draftHero, traits: newTraits, stats: computeBaseStats(draftHero.heroClass, newTraits), role: computeRole(draftHero.heroClass, newTraits), linePreference: computeLinePreference(newTraits) });
  }

  function setDraftTrait(key: keyof HeroTraits, value: number) {
    if (!draftHero) return;
    const newTraits = { ...draftHero.traits, [key]: value };
    setDraftHero({ ...draftHero, traits: newTraits, stats: computeBaseStats(draftHero.heroClass, newTraits), role: computeRole(draftHero.heroClass, newTraits), linePreference: computeLinePreference(newTraits) });
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
      role: computeRole(heroClass, draftHero.traits),
      stats: computeBaseStats(heroClass, draftHero.traits),
      linePreference: computeLinePreference(draftHero.traits),
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
                  onClick={() => setEditingHero(prev => {
                    if (!prev) return prev;
                    const newTraits = prev.traits;
                    return { ...prev, heroClass: hc, emoji: CLASS_EMOJIS[hc], role: computeRole(hc, newTraits), stats: computeBaseStats(hc, newTraits), linePreference: computeLinePreference(newTraits) };
                  })}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    editingHero.heroClass === hc
                      ? 'bg-amber-700 border-amber-500 text-stone-100'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:border-stone-400'
                  }`}
                >
                  <span className="inline-flex items-center gap-1"><ClassIcon heroClass={hc} size={12}/> {hc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <TraitEditor
          hero={editingHero}
          traits={editingHero.traits}
          onChangeTrait={(key, val) =>
            setEditingHero(prev => {
              if (!prev) return prev;
              const newTraits = { ...prev.traits, [key]: val };
              return { ...prev, traits: newTraits, stats: computeBaseStats(prev.heroClass, newTraits), role: computeRole(prev.heroClass, newTraits), linePreference: computeLinePreference(newTraits) };
            })
          }
          onReset={() =>
            setEditingHero(prev => {
              if (!prev) return prev;
              const newTraits = defaultTraits();
              return { ...prev, traits: newTraits, stats: computeBaseStats(prev.heroClass, newTraits), role: computeRole(prev.heroClass, newTraits), linePreference: computeLinePreference(newTraits) };
            })
          }
          onDone={() => saveEdit({
            ...editingHero,
            description: generateHeroDescription(editingHero.heroClass, editingHero.traits),
            stats: computeBaseStats(editingHero.heroClass, editingHero.traits),
            role: computeRole(editingHero.heroClass, editingHero.traits),
            linePreference: computeLinePreference(editingHero.traits),
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
                  <span className="inline-flex items-center gap-1"><ClassIcon heroClass={hc} size={12}/> {hc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Hero info card */}
        <div className="bg-stone-800 border border-stone-700 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <ClassIcon heroClass={draftHero.heroClass} size={32}/>
            <div>
              <div className="font-bold text-lg">{draftHero.name || 'Unnamed Hero'}</div>
              <div className="text-xs text-stone-400">{heroSummary(draftHero.heroClass, draftHero.traits, draftHero.linePreference)}</div>
            </div>
          </div>
        </div>

        {/* Trait editor */}
        <p className="text-xs text-stone-500 mb-3">Customize this hero's traits, or randomize them.</p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={randomizeDraftTraits}
            className="flex-1 py-2 rounded-lg border border-stone-600 text-stone-300 hover:text-stone-100 hover:border-stone-400 text-sm transition-colors"
          >
            <span className="inline-flex items-center gap-1.5"><DiceIcon size={16}/> Random Traits</span>
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

  const filteredRoster = roster
    .filter(hero => {
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
          <div className="flex flex-wrap gap-2">
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value as HeroClass | '')}
              className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-300 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="">All Classes</option>
              {ALL_CLASSES.map(hc => <option key={hc} value={hc}>{hc}</option>)}
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
            <HeroesIcon size={48} className="text-stone-600"/>
            <p className="text-sm text-center">No heroes yet.<br />Tap above to create your first hero.</p>
          </div>
        )}
        {roster.length > 0 && filteredRoster.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-500 py-12">
            <p className="text-sm text-center">No heroes match your filters.</p>
          </div>
        )}
        {filteredRoster.map((hero) => {
          const adventuresPlayed = hero.adventuresPlayed ?? 0;
          return (
          <div key={hero.id} className="flex gap-2">
            <div className="flex-1 bg-stone-800 border border-stone-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <ClassIcon heroClass={hero.heroClass} size={32}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{hero.name}</span>
                    <span className="text-xs text-stone-400">{heroSummary(hero.heroClass, hero.traits, hero.linePreference)}</span>
                    {hero.favourite && (
                      <StarIcon size={12} filled className="text-amber-400"/>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {adventuresPlayed} adventure{adventuresPlayed !== 1 ? 's' : ''} played
                  </p>
                </div>
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
                onClick={() => toggleFavourite(hero.id)}
                className={`flex-1 px-3 bg-stone-800 border rounded-xl transition-colors ${
                  hero.favourite
                    ? 'border-amber-500 text-amber-400 hover:border-amber-400'
                    : 'border-stone-700 text-stone-400 hover:border-amber-500 hover:text-amber-400'
                }`}
                title={hero.favourite ? 'Remove from favourites' : 'Add to favourites'}
              >
                <StarIcon size={18} filled={hero.favourite}/>
              </button>
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
                <TrashIcon size={18}/>
              </button>
            </div>
          </div>
          );
        })}
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
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center gap-3 mb-4">
        <ClassIcon heroClass={hero.heroClass} size={32}/>
        <div>
          <div className="font-bold">{hero.name}</div>
          <div className="text-xs text-stone-400">{heroSummary(hero.heroClass, hero.traits, hero.linePreference)}</div>
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
