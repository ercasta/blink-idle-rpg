/**
 * Adventure Manager — create, edit, delete, and share Adventures.
 *
 * An Adventure bundles a game mode with custom settings, a required hero
 * count, and an allowed-class filter.  The player selects an adventure
 * before each run instead of manually choosing easy/normal/hard.
 */

import { useState, useMemo } from 'react';
import type { AdventureDefinition, GameMode, HeroClass, CustomModeSettings } from '../types';
import { DEFAULT_CUSTOM_SETTINGS } from '../types';
import { generateAdventureDescription } from '../data/adventureDescription';
import { generateRandomAdventure } from '../data/adventures';

const ALL_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

const CLASS_EMOJIS: Record<HeroClass, string> = {
  Warrior: '⚔️', Mage: '🧙', Ranger: '🏹', Paladin: '🛡️', Rogue: '🗡️', Cleric: '🙏',
};

const MODE_BADGE: Record<GameMode, string> = {
  easy:   'bg-green-800 text-green-200',
  normal: 'bg-amber-800 text-amber-200',
  hard:   'bg-red-900 text-red-200',
  custom: 'bg-purple-800 text-purple-200',
};

const MODE_LABEL: Record<GameMode, string> = {
  easy: 'Easy', normal: 'Normal', hard: 'Hard', custom: 'Custom',
};

// ── Draft type ────────────────────────────────────────────────────────────────

interface AdventureDraft {
  id?: string;                      // undefined = new
  name: string;
  mode: GameMode;
  customSettings: CustomModeSettings;
  requiredHeroCount: number;
  allowedClasses: HeroClass[];
}

function draftToDefinition(draft: AdventureDraft): AdventureDefinition {
  return {
    id: draft.id ?? `adventure-${crypto.randomUUID()}`,
    name: draft.name,
    mode: draft.mode,
    customSettings: draft.mode === 'custom' ? draft.customSettings : undefined,
    requiredHeroCount: draft.requiredHeroCount,
    allowedClasses: draft.allowedClasses,
    description: generateAdventureDescription({
      name: draft.name,
      mode: draft.mode,
      customSettings: draft.mode === 'custom' ? draft.customSettings : undefined,
      requiredHeroCount: draft.requiredHeroCount,
      allowedClasses: draft.allowedClasses,
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
  };
}

function defaultDraft(): AdventureDraft {
  return {
    name: '',
    mode: 'normal',
    customSettings: { ...DEFAULT_CUSTOM_SETTINGS },
    requiredHeroCount: 4,
    allowedClasses: [...ALL_CLASSES],
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

// ── Main component ────────────────────────────────────────────────────────────

interface AdventureScreenProps {
  adventures: AdventureDefinition[];
  onAdventuresChange: (adventures: AdventureDefinition[]) => void;
  onBack: () => void;
}

type ScreenView = 'list' | 'create' | 'edit';

export function AdventureScreen({
  adventures,
  onAdventuresChange,
  onBack,
}: AdventureScreenProps) {
  const [view, setView] = useState<ScreenView>('list');
  const [draft, setDraft] = useState<AdventureDraft>(defaultDraft);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live description preview
  const liveDescription = useMemo(
    () => generateAdventureDescription({
      name: draft.name || 'Unnamed Adventure',
      mode: draft.mode,
      customSettings: draft.mode === 'custom' ? draft.customSettings : undefined,
      requiredHeroCount: draft.requiredHeroCount,
      allowedClasses: draft.allowedClasses,
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

  function saveAdventure() {
    if (!draft.name.trim()) return;
    const adv = draftToDefinition(draft);
    if (view === 'edit' && draft.id) {
      onAdventuresChange(adventures.map(a => a.id === draft.id ? adv : a));
    } else {
      onAdventuresChange([...adventures, adv]);
    }
    setView('list');
    setDraft(defaultDraft());
  }

  function deleteAdventure(id: string) {
    onAdventuresChange(adventures.filter(a => a.id !== id));
  }

  function addRandomAdventure() {
    onAdventuresChange([...adventures, generateRandomAdventure()]);
  }

  function shareAdventure(adv: AdventureDefinition) {
    const json = JSON.stringify(adv, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopiedId(adv.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      window.prompt('Copy this JSON to share your adventure:', json);
    });
  }

  function importFromClipboard() {
    navigator.clipboard.readText().then((text) => {
      try {
        const parsed = JSON.parse(text) as Partial<AdventureDefinition>;
        if (!parsed.name || !parsed.mode) throw new Error('Invalid adventure JSON');
        const adv: AdventureDefinition = {
          id: `adventure-${crypto.randomUUID()}`,
          name: parsed.name,
          mode: parsed.mode,
          customSettings: parsed.customSettings,
          requiredHeroCount: parsed.requiredHeroCount ?? 4,
          allowedClasses: parsed.allowedClasses?.length ? parsed.allowedClasses : [...ALL_CLASSES],
          description: '',
        };
        adv.description = generateAdventureDescription(adv);
        onAdventuresChange([...adventures, adv]);
      } catch {
        alert('Could not import adventure — invalid JSON in clipboard.');
      }
    }).catch(() => {
      alert('Could not read clipboard. Try pasting JSON manually.');
    });
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
        <div className="flex items-center gap-3 mb-4">
          <button onClick={cancelForm} className="text-stone-400 hover:text-stone-100 text-2xl leading-none">
            ←
          </button>
          <h1 className="text-xl font-bold">{view === 'create' ? 'Create Adventure' : 'Edit Adventure'}</h1>
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
                    {CLASS_EMOJIS[hc]} {hc}
                  </button>
                );
              })}
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
          🎲
        </button>
        <button
          onClick={importFromClipboard}
          className="py-2.5 px-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm transition-colors"
          title="Import adventure from clipboard JSON"
        >
          📋
        </button>
      </div>

      {adventures.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
          <div className="text-5xl">🗺️</div>
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
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${MODE_BADGE[adv.mode] ?? ''}`}>
                  {MODE_LABEL[adv.mode]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-stone-400">
                <span>👥 {adv.requiredHeroCount} {adv.requiredHeroCount === 1 ? 'hero' : 'heroes'}</span>
                {adv.allowedClasses.length < ALL_CLASSES.length ? (
                  <span>{adv.allowedClasses.map(c => CLASS_EMOJIS[c]).join(' ')}</span>
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
                  onClick={() => shareAdventure(adv)}
                  className="flex-1 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-medium transition-colors"
                >
                  {copiedId === adv.id ? '✓ Copied!' : '📤 Share'}
                </button>
                <button
                  onClick={() => deleteAdventure(adv.id)}
                  className="py-1.5 px-3 rounded-lg bg-stone-700 hover:bg-red-900 text-stone-400 hover:text-red-300 text-xs font-medium transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
