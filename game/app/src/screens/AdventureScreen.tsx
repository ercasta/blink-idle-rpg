/**
 * Adventure Manager — create, edit, delete, and share Adventures.
 *
 * An Adventure bundles a game mode with custom settings, a required hero
 * count, and an allowed-class filter.  The player selects an adventure
 * before each run instead of manually choosing easy/normal/hard.
 *
 * Sharing now supports three modes:
 *   • Copy Link  – copies a full URL with adventure params to the clipboard
 *   • Share      – triggers the native share sheet (Web Share API)
 *   • QR Code    – shows a modal with a scannable QR code
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import type { AdventureDefinition, GameMode, HeroClass, CustomModeSettings, EnvironmentSettings, RunType } from '../types';
import { DEFAULT_CUSTOM_SETTINGS, DEFAULT_ENVIRONMENT_SETTINGS } from '../types';
import { generateAdventureDescription, encodeAdventureToParams, decodeAdventureFromParams } from '../data/adventureDescription';
import { generateRandomAdventure, randomAdventureName } from '../data/adventures';
import { MAX_SEED_VALUE } from '../data/adventureQuest';
import { ClassIcon, MapIcon, HeroesIcon, DiceIcon, PhysicalIcon, MagicalIcon, FireIcon, WaterIcon, WindIcon, EarthIcon, LightIcon, DarknessIcon, TrashIcon, ImportIcon } from '../components/icons';

const ALL_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

const MODE_BADGE: Record<GameMode, string> = {
  easy:   'bg-green-800 text-green-200',
  normal: 'bg-amber-800 text-amber-200',
  hard:   'bg-red-900 text-red-200',
  custom: 'bg-purple-800 text-purple-200',
};

const MODE_LABEL: Record<GameMode, string> = {
  easy: 'Easy', normal: 'Normal', hard: 'Hard', custom: 'Custom',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getShareUrl(adv: AdventureDefinition): string {
  const params = encodeAdventureToParams(adv);
  const base = window.location.origin + window.location.pathname;
  return `${base}?${params.toString()}`;
}

// ── Draft type ────────────────────────────────────────────────────────────────

interface AdventureDraft {
  id?: string;                      // undefined = new
  name: string;
  mode: GameMode;
  customSettings: CustomModeSettings;
  requiredHeroCount: number;
  allowedClasses: HeroClass[];
  environmentSettings: EnvironmentSettings;
  runType: RunType;
  seed?: number;                    // optional adventure seed
}

function draftToDefinition(draft: AdventureDraft): AdventureDefinition {
  return {
    id: draft.id ?? `adventure-${crypto.randomUUID()}`,
    name: draft.name,
    mode: draft.mode,
    customSettings: draft.mode === 'custom' ? draft.customSettings : undefined,
    requiredHeroCount: draft.requiredHeroCount,
    allowedClasses: draft.allowedClasses,
    environmentSettings: draft.environmentSettings,
    runType: draft.runType,
    seed: draft.seed,
    description: generateAdventureDescription({
      name: draft.name,
      mode: draft.mode,
      customSettings: draft.mode === 'custom' ? draft.customSettings : undefined,
      requiredHeroCount: draft.requiredHeroCount,
      allowedClasses: draft.allowedClasses,
      environmentSettings: draft.environmentSettings,
      runType: draft.runType,
    }),
  };
}

function adventureToDraft(adv: AdventureDefinition): AdventureDraft {
  return {
    id: adv.id,
    name: adv.name,
    mode: adv.mode,
    customSettings: adv.customSettings ?? DEFAULT_CUSTOM_SETTINGS,
    requiredHeroCount: adv.requiredHeroCount,
    allowedClasses: adv.allowedClasses,
    environmentSettings: adv.environmentSettings ?? { ...DEFAULT_ENVIRONMENT_SETTINGS },
    runType: adv.runType ?? 'fight',
    seed: adv.seed,
  };
}

function defaultDraft(): AdventureDraft {
  return {
    name: randomAdventureName(),
    mode: 'normal',
    customSettings: { ...DEFAULT_CUSTOM_SETTINGS },
    requiredHeroCount: 4,
    allowedClasses: [...ALL_CLASSES],
    environmentSettings: { ...DEFAULT_ENVIRONMENT_SETTINGS },
    runType: 'fight',
    seed: undefined,
  };
}

// ── Small reusable components ─────────────────────────────────────────────────

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
  const color = value > 0 ? 'text-red-300' : value < 0 ? 'text-green-300' : 'text-stone-300';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-stone-400">
        <span>{label}</span>
        <span className={`font-bold ${color}`}>{pct} vs Normal</span>
      </div>
      <input
        type="range" min={-50} max={50} step={5} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-purple-500"
      />
      <div className="flex justify-between text-xs text-stone-600">
        <span>−50%</span><span>0%</span><span>+50%</span>
      </div>
    </div>
  );
}

/** A percentage slider for environment settings (0–100%). */
function EnvSlider({
  label,
  value,
  onChange,
}: {
  label: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-stone-400">
        <span>{label}</span>
        <span className="font-bold text-stone-300">{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} step={5} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-cyan-500"
      />
      <div className="flex justify-between text-xs text-stone-600">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
  );
}

// ── QR Code Modal ─────────────────────────────────────────────────────────────

function QrModal({ adv, onClose }: { adv: AdventureDefinition; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const url = getShareUrl(adv);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 280, margin: 2 })
      .then(setDataUrl)
      .catch(e => console.error('[QrModal] QR generation failed', e));
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
          <span className="font-semibold text-stone-200">{adv.name}</span>
        </p>
        {dataUrl
          ? <img src={dataUrl} alt="Adventure QR Code" className="rounded-xl w-56 h-56" />
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

// ── Share Modal ───────────────────────────────────────────────────────────────

function ShareModal({
  adv,
  onClose,
}: {
  adv: AdventureDefinition;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const url = getShareUrl(adv);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link to share your adventure:', url);
    }
  }

  async function nativeShare() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: adv.name, text: `Join my adventure: ${adv.name}`, url });
      } catch {
        // user cancelled – ignore
      }
    } else {
      copyLink();
    }
  }

  if (showQr) {
    return <QrModal adv={adv} onClose={onClose} />;
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
        <h2 className="font-bold text-base text-stone-100">Share Adventure</h2>
        <p className="text-xs text-stone-400 text-center -mt-1">
          <span className="font-semibold text-stone-200">{adv.name}</span>
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

// ── Import-from-link Modal ────────────────────────────────────────────────────

function ImportModal({
  onImport,
  onClose,
}: {
  onImport: (adv: AdventureDefinition) => void;
  onClose: () => void;
}) {
  const [linkText, setLinkText] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleImport() {
    setError('');
    let adv: AdventureDefinition | null = null;
    let urlParseError = false;
    try {
      // Try parsing as full URL first
      const url = new URL(linkText.trim());
      adv = decodeAdventureFromParams(url.searchParams);
    } catch {
      urlParseError = true;
      // Not a valid URL — also try as raw param string (e.g. n=…&m=…)
      try {
        const params = new URLSearchParams(linkText.trim());
        adv = decodeAdventureFromParams(params);
        urlParseError = false;
      } catch {
        // ignore
      }
    }
    if (!adv) {
      setError(
        urlParseError
          ? 'Invalid URL format — paste the full share link.'
          : 'Adventure data missing or corrupted — check the link and try again.',
      );
      return;
    }
    onImport(adv);
    onClose();
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
        <h2 className="font-bold text-base text-stone-100">Import via Link</h2>
        <p className="text-xs text-stone-400">Paste the adventure share link below.</p>

        <input
          ref={inputRef}
          type="url"
          value={linkText}
          onChange={e => setLinkText(e.target.value)}
          placeholder="https://…?n=…"
          className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleImport}
          disabled={!linkText.trim()}
          className="w-full py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-stone-100 text-sm font-bold transition-colors disabled:opacity-40"
        >
          Import Adventure
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

// ── Overwrite Confirmation Modal ──────────────────────────────────────────────

function OverwriteConfirmModal({
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
          An adventure named{' '}
          <span className="font-semibold text-stone-200">"{name}"</span>{' '}
          already exists. Do you want to overwrite it?
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

// ── Main component ────────────────────────────────────────────────────────────

interface AdventureScreenProps {
  adventures: AdventureDefinition[];
  onAdventuresChange: (adventures: AdventureDefinition[]) => void;
  onViewLeaderboard: (adventure: AdventureDefinition) => void;
  onBack: () => void;
}

type ScreenView = 'list' | 'create' | 'edit';

export function AdventureScreen({
  adventures,
  onAdventuresChange,
  onViewLeaderboard,
  onBack,
}: AdventureScreenProps) {
  const [view, setView] = useState<ScreenView>('list');
  const [draft, setDraft] = useState<AdventureDraft>(defaultDraft);
  const [sharingAdv, setSharingAdv] = useState<AdventureDefinition | null>(null);
  const [showImport, setShowImport] = useState(false);
  // Overwrite confirmation: holds the pending adventure waiting for user confirmation
  const [pendingOverwrite, setPendingOverwrite] = useState<AdventureDefinition | null>(null);

  // Live description preview
  const liveDescription = useMemo(
    () => generateAdventureDescription({
      name: draft.name || 'Unnamed Adventure',
      mode: draft.mode,
      customSettings: draft.mode === 'custom' ? draft.customSettings : undefined,
      requiredHeroCount: draft.requiredHeroCount,
      allowedClasses: draft.allowedClasses,
      environmentSettings: draft.environmentSettings,
      runType: draft.runType,
    }),
    [draft],
  );

  function openCreate() {
    setDraft(defaultDraft());
    setView('create');
  }

  function openEdit(adv: AdventureDefinition) {
    setDraft(adventureToDraft(adv));
    setView('edit');
  }

  function cancelForm() {
    setView('list');
    setDraft(defaultDraft());
  }

  function commitSaveAdventure(adv: AdventureDefinition) {
    if (view === 'edit' && draft.id) {
      // Replace by id; also remove any other adventure with the same name (the duplicate)
      onAdventuresChange(
        adventures
          .filter(a => a.id === draft.id || a.name.trim().toLowerCase() !== adv.name.trim().toLowerCase())
          .map(a => a.id === draft.id ? adv : a),
      );
    } else {
      // Remove existing adventure with same name, then append new one
      onAdventuresChange([
        ...adventures.filter(a => a.name.trim().toLowerCase() !== adv.name.trim().toLowerCase()),
        adv,
      ]);
    }
    setView('list');
    setDraft(defaultDraft());
  }

  function saveAdventure() {
    if (!draft.name.trim()) return;
    const adv = draftToDefinition(draft);
    // Check for a duplicate name (ignoring the adventure currently being edited)
    const duplicate = adventures.find(
      a => a.name.trim().toLowerCase() === draft.name.trim().toLowerCase() && a.id !== draft.id,
    );
    if (duplicate) {
      setPendingOverwrite(adv);
      return;
    }
    commitSaveAdventure(adv);
  }

  function deleteAdventure(id: string) {
    onAdventuresChange(adventures.filter(a => a.id !== id));
  }

  function addRandomAdventure() {
    onAdventuresChange([...adventures, generateRandomAdventure()]);
  }

  function handleImportAdventure(adv: AdventureDefinition) {
    const duplicate = adventures.find(
      a => a.name.trim().toLowerCase() === adv.name.trim().toLowerCase(),
    );
    if (duplicate) {
      setPendingOverwrite(adv);
      return;
    }
    commitImportAdventure(adv);
  }

  function commitImportAdventure(adv: AdventureDefinition) {
    onAdventuresChange([
      ...adventures.filter(a => a.name.trim().toLowerCase() !== adv.name.trim().toLowerCase()),
      adv,
    ]);
  }

  function setDraftMode(mode: GameMode) {
    setDraft(prev => ({ ...prev, mode }));
  }

  function setDraftCustom<K extends keyof CustomModeSettings>(key: K, value: number) {
    setDraft(prev => ({
      ...prev,
      customSettings: { ...prev.customSettings, [key]: value },
    }));
  }

  function setDraftEnv<K extends keyof EnvironmentSettings>(key: K, value: number) {
    setDraft(prev => ({
      ...prev,
      environmentSettings: { ...prev.environmentSettings, [key]: value },
    }));
  }

  function toggleClass(hc: HeroClass) {
    setDraft(prev => {
      const has = prev.allowedClasses.includes(hc);
      if (has && prev.allowedClasses.length === 1) return prev; // keep at least 1
      return {
        ...prev,
        allowedClasses: has
          ? prev.allowedClasses.filter(c => c !== hc)
          : [...prev.allowedClasses, hc],
      };
    });
  }

  function toggleAllClasses() {
    setDraft(prev => ({
      ...prev,
      allowedClasses: prev.allowedClasses.length === ALL_CLASSES.length
        ? [prev.allowedClasses[0] ?? ALL_CLASSES[0]]
        : [...ALL_CLASSES],
    }));
  }

  // ── Form view (create / edit) ───────────────────────────────────────────────
  if (view === 'create' || view === 'edit') {
    return (
      <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
        {pendingOverwrite && (
          <OverwriteConfirmModal
            name={pendingOverwrite.name}
            onConfirm={() => {
              const adv = pendingOverwrite;
              setPendingOverwrite(null);
              commitSaveAdventure(adv);
            }}
            onCancel={() => setPendingOverwrite(null)}
          />
        )}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={cancelForm} className="text-stone-400 hover:text-stone-100 text-2xl leading-none">
            ←
          </button>
          <h1 className="text-xl font-bold">{view === 'create' ? 'Create Adventure' : 'Edit Adventure'}</h1>
          {view === 'edit' && draft.id && (
            <button
              onClick={() => {
                const adv = adventures.find(a => a.id === draft.id);
                if (adv) onViewLeaderboard(adv);
              }}
              className="ml-auto py-1.5 px-3 rounded-lg bg-stone-700 hover:bg-stone-600 text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors"
              title="View leaderboard"
            >
              🏆 Leaderboard
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
          {/* Name */}
          <div className="bg-stone-800 border border-stone-700 rounded-xl p-4">
            <label className="block text-xs text-stone-400 mb-1">Adventure Name</label>
            <input
              type="text"
              value={draft.name}
              maxLength={40}
              onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
              placeholder="The Forsaken Vale…"
              className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Run Type Toggle */}
          <div className="bg-stone-800 border border-stone-700 rounded-xl p-4">
            <label className="block text-xs text-stone-400 mb-2">Run Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['fight', 'story'] as RunType[]).map(rt => (
                <button
                  key={rt}
                  onClick={() => setDraft(prev => ({ ...prev, runType: rt }))}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors border ${
                    draft.runType === rt
                      ? rt === 'fight'
                        ? 'bg-red-800 text-red-200 border-transparent'
                        : 'bg-blue-800 text-blue-200 border-transparent'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:border-stone-400'
                  }`}
                >
                  {rt === 'fight' ? '⚔️ Fight Mode' : '📖 Story Mode'}
                </button>
              ))}
            </div>
            <p className="text-xs text-stone-500 mt-2">
              {draft.runType === 'story'
                ? 'A 30-day journey through a procedural map. Heroes vote on destinations and encounter enemies along the way.'
                : 'Classic mode — 3000 encounters of escalating combat. Race for the highest score.'}
            </p>
          </div>

          {/* Adventure Seed (story mode only) */}
          {draft.runType === 'story' && (
            <div className="bg-stone-800 border border-stone-700 rounded-xl p-4">
              <label className="block text-xs text-stone-400 mb-1">Adventure Seed</label>
              <p className="text-xs text-blue-300 mb-2">
                The seed determines the quest objectives, milestones, and narrative. Leave blank for an auto-generated seed based on adventure settings.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={draft.seed ?? ''}
                  onChange={e => {
                    const v = e.target.value.trim();
                    setDraft(prev => ({
                      ...prev,
                      seed: v === '' ? undefined : Math.max(0, Math.min(MAX_SEED_VALUE, parseInt(v, 10) || 0)),
                    }));
                  }}
                  placeholder="Auto (from settings)"
                  className="flex-1 bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => setDraft(prev => ({
                    ...prev,
                    seed: Math.floor(Math.random() * (MAX_SEED_VALUE + 1)),
                  }))}
                  className="py-2 px-3 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-medium transition-colors border border-stone-600"
                  title="Generate random seed"
                >
                  🎲
                </button>
                {draft.seed !== undefined && (
                  <button
                    onClick={() => setDraft(prev => ({ ...prev, seed: undefined }))}
                    className="py-2 px-3 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-400 hover:text-stone-200 text-xs font-medium transition-colors border border-stone-600"
                    title="Clear seed (use auto)"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Difficulty / Mode */}
          <div className="bg-stone-800 border border-stone-700 rounded-xl p-4">
            <label className="block text-xs text-stone-400 mb-2">Difficulty</label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {(['easy', 'normal', 'hard', 'custom'] as GameMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setDraftMode(m)}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    draft.mode === m
                      ? `${MODE_BADGE[m]} border-transparent`
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:border-stone-400'
                  }`}
                >
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>

            {/* Custom sliders */}
            {draft.mode === 'custom' && (
              <div className="flex flex-col gap-3 mt-3 border-t border-stone-700 pt-3">
                <p className="text-xs text-purple-300">Adjust parameters ±50% vs Normal baseline.</p>
                <PctSlider label="Hero Death Penalty" value={draft.customSettings.heroPenaltyPct}
                  onChange={v => setDraftCustom('heroPenaltyPct', v)} />
                <PctSlider label="Party Wipeout Penalty" value={draft.customSettings.wipeoutPenaltyPct}
                  onChange={v => setDraftCustom('wipeoutPenaltyPct', v)} />
                <PctSlider label="Experience Gain" value={draft.customSettings.expMultiplierPct}
                  onChange={v => setDraftCustom('expMultiplierPct', v)} />
                <PctSlider label="Encounter Difficulty" value={draft.customSettings.encounterDifficultyPct}
                  onChange={v => setDraftCustom('encounterDifficultyPct', v)} />
              </div>
            )}
          </div>

          {/* Hero count */}
          <div className="bg-stone-800 border border-stone-700 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs text-stone-400">Heroes Required</label>
              <span className="text-sm font-bold text-amber-400">{draft.requiredHeroCount}</span>
            </div>
            <input
              type="range" min={1} max={6} step={1} value={draft.requiredHeroCount}
              onChange={e => setDraft(prev => ({ ...prev, requiredHeroCount: Number(e.target.value) }))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-xs text-stone-600 mt-1">
              <span>1 (solo)</span><span>3–4</span><span>6 (full)</span>
            </div>
          </div>

          {/* Allowed classes */}
          <div className="bg-stone-800 border border-stone-700 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs text-stone-400">Allowed Classes</label>
              <button
                onClick={toggleAllClasses}
                className="text-xs text-stone-400 hover:text-stone-200 underline"
              >
                {draft.allowedClasses.length === ALL_CLASSES.length ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ALL_CLASSES.map(hc => {
                const selected = draft.allowedClasses.includes(hc);
                return (
                  <button
                    key={hc}
                    onClick={() => toggleClass(hc)}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      selected
                        ? 'bg-amber-700 border-amber-500 text-stone-100'
                        : 'bg-stone-700 border-stone-600 text-stone-400 hover:border-stone-400'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5"><ClassIcon heroClass={hc} size={14}/> {hc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Environment: unified per-element sliders */}
          <div className="bg-stone-800 border border-stone-700 rounded-xl p-4">
            <label className="block text-xs text-stone-400 mb-2">Environment</label>
            <p className="text-xs text-cyan-300 mb-3">
              Each slider controls the chance of encountering enemies that both deal AND resist that type. Sliders are independent — an adventure can have high fire and water simultaneously.
            </p>
            <div className="flex flex-col gap-3">
              <EnvSlider label={<span className="inline-flex items-center gap-1.5"><PhysicalIcon size={14}/> Physical</span>} value={draft.environmentSettings.physicalPct}
                onChange={v => setDraftEnv('physicalPct', v)} />
              <EnvSlider label={<span className="inline-flex items-center gap-1.5"><MagicalIcon size={14}/> Magical</span>} value={draft.environmentSettings.magicalPct}
                onChange={v => setDraftEnv('magicalPct', v)} />
              <EnvSlider label={<span className="inline-flex items-center gap-1.5"><FireIcon size={14}/> Fire</span>} value={draft.environmentSettings.firePct}
                onChange={v => setDraftEnv('firePct', v)} />
              <EnvSlider label={<span className="inline-flex items-center gap-1.5"><WaterIcon size={14}/> Water</span>} value={draft.environmentSettings.waterPct}
                onChange={v => setDraftEnv('waterPct', v)} />
              <EnvSlider label={<span className="inline-flex items-center gap-1.5"><WindIcon size={14}/> Wind</span>} value={draft.environmentSettings.windPct}
                onChange={v => setDraftEnv('windPct', v)} />
              <EnvSlider label={<span className="inline-flex items-center gap-1.5"><EarthIcon size={14}/> Earth</span>} value={draft.environmentSettings.earthPct}
                onChange={v => setDraftEnv('earthPct', v)} />
              <EnvSlider label={<span className="inline-flex items-center gap-1.5"><LightIcon size={14}/> Light</span>} value={draft.environmentSettings.lightPct}
                onChange={v => setDraftEnv('lightPct', v)} />
              <EnvSlider label={<span className="inline-flex items-center gap-1.5"><DarknessIcon size={14}/> Darkness</span>} value={draft.environmentSettings.darknessPct}
                onChange={v => setDraftEnv('darknessPct', v)} />
            </div>
          </div>

          {/* Live description preview */}
          <div className="bg-stone-800/60 border border-stone-700 rounded-xl p-4">
            <p className="text-xs text-stone-500 mb-2 uppercase tracking-widest">Description Preview</p>
            {liveDescription.split('\n\n').map((para, i) => (
              <p key={i} className="text-xs text-stone-400 leading-relaxed mb-2 last:mb-0">{para}</p>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div className="pt-4 mt-4 border-t border-stone-800">
          <button
            onClick={saveAdventure}
            disabled={!draft.name.trim() || draft.allowedClasses.length === 0}
            className="w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-amber-700 hover:bg-amber-600 text-stone-100"
          >
            {view === 'create' ? '✓ Add Adventure' : '✓ Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
      {/* Modals */}
      {sharingAdv && (
        <ShareModal adv={sharingAdv} onClose={() => setSharingAdv(null)} />
      )}
      {showImport && (
        <ImportModal
          onImport={handleImportAdventure}
          onClose={() => setShowImport(false)}
        />
      )}
      {pendingOverwrite && (
        <OverwriteConfirmModal
          name={pendingOverwrite.name}
          onConfirm={() => {
            const adv = pendingOverwrite;
            setPendingOverwrite(null);
            commitImportAdventure(adv);
          }}
          onCancel={() => setPendingOverwrite(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="text-stone-400 hover:text-stone-100 text-2xl leading-none">
          ←
        </button>
        <h1 className="text-xl font-bold">Adventure Manager</h1>
      </div>
      <p className="text-stone-500 text-xs mb-4">
        Create, customise, and share your adventures.
      </p>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={openCreate}
          className="flex-1 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-stone-100 font-bold text-sm transition-colors"
        >
          + New Adventure
        </button>
        <button
          onClick={addRandomAdventure}
          className="py-2.5 px-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm transition-colors"
          title="Generate a random adventure"
        >
          <DiceIcon size={18}/>
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="py-2.5 px-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm transition-colors"
          title="Import adventure from link"
        >
          <ImportIcon size={18}/>
        </button>
      </div>

      {adventures.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
          <MapIcon size={48} className="text-stone-500"/>
          <p className="text-stone-400 text-sm">No adventures yet.<br />Create your first one above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 flex-1">
          {adventures.map((adv) => (
            <div
              key={adv.id}
              className="bg-stone-800 border border-stone-700 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-bold text-base leading-tight">{adv.name}</span>
                <div className="flex gap-1.5 shrink-0">
                  {(adv.runType ?? 'fight') === 'story' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-800 text-blue-200">
                      📖 Story
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${MODE_BADGE[adv.mode] ?? ''}`}>
                    {MODE_LABEL[adv.mode]}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-stone-400">
                <span className="inline-flex items-center gap-1"><HeroesIcon size={13}/> {adv.requiredHeroCount} {adv.requiredHeroCount === 1 ? 'hero' : 'heroes'}</span>
                {adv.allowedClasses.length < ALL_CLASSES.length ? (
                  <span className="inline-flex items-center gap-0.5">{adv.allowedClasses.map(c => <ClassIcon key={c} heroClass={c} size={14}/>)}</span>
                ) : (
                  <span>All classes</span>
                )}
              </div>
              <p className="text-xs text-stone-500 leading-relaxed line-clamp-2 mb-3">
                {adv.description.split('\n\n')[0]}
              </p>
              {/* Action row */}
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(adv)}
                  className="flex-1 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-medium transition-colors"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => setSharingAdv(adv)}
                  className="flex-1 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-medium transition-colors"
                >
                  📤 Share
                </button>
                <button
                  onClick={() => onViewLeaderboard(adv)}
                  className="py-1.5 px-3 rounded-lg bg-stone-700 hover:bg-stone-600 text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors"
                  title="View leaderboard"
                >
                  🏆
                </button>
                <button
                  onClick={() => deleteAdventure(adv.id)}
                  className="py-1.5 px-3 rounded-lg bg-stone-700 hover:bg-red-900 text-stone-400 hover:text-red-300 text-xs font-medium transition-colors"
                >
                  <TrashIcon size={16}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
