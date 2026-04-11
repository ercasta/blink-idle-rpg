import { useState, useRef, useEffect } from 'react';
import type { AdventureDefinition, HeroClass } from '../types';
import { decodeAdventureFromParams } from '../data/adventureDescription';
import { ClassIcon, MapIcon, HeroesIcon, TrophyIcon } from '../components/icons';

const ALL_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

const MODE_BADGE: Record<string, string> = {
  easy:   'bg-green-800 text-green-200',
  normal: 'bg-amber-800 text-amber-200',
  hard:   'bg-red-900 text-red-200',
  custom: 'bg-purple-800 text-purple-200',
};

const MODE_LABEL: Record<string, string> = {
  easy: 'Easy', normal: 'Normal', hard: 'Hard', custom: 'Custom',
};

interface AdventureSelectScreenProps {
  adventures: AdventureDefinition[];
  onSelect: (adventure: AdventureDefinition) => void;
  onJoinAdventure: (adventure: AdventureDefinition) => void;
  onManageAdventures: () => void;
  onViewLeaderboard: (adventure: AdventureDefinition) => void;
  onBack: () => void;
}

// ── Join-via-link modal ───────────────────────────────────────────────────────

function JoinModal({
  onJoin,
  onClose,
}: {
  onJoin: (adv: AdventureDefinition) => void;
  onClose: () => void;
}) {
  const [linkText, setLinkText] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleJoin() {
    setError('');
    let adv: AdventureDefinition | null = null;
    let urlParseError = false;
    try {
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
    onJoin(adv);
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
        <h2 className="font-bold text-base text-stone-100">Join Adventure</h2>
        <p className="text-xs text-stone-400">
          Paste the adventure share link. The adventure will be added to your list and selected.
        </p>

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
          onClick={handleJoin}
          disabled={!linkText.trim()}
          className="w-full py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-stone-100 text-sm font-bold transition-colors disabled:opacity-40"
        >
          Join
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

// ── Main screen ───────────────────────────────────────────────────────────────

function ClassPips({ classes }: { classes: HeroClass[] }) {
  const allAllowed = classes.length === ALL_CLASSES.length;
  if (allAllowed) {
    return <span className="text-xs text-stone-400">All classes</span>;
  }
  return (
    <span className="text-xs text-stone-400 flex items-center gap-0.5">
      {classes.map(c => (
        <span key={c} title={c}><ClassIcon heroClass={c} size={14}/></span>
      ))}
    </span>
  );
}

export function AdventureSelectScreen({
  adventures,
  onSelect,
  onJoinAdventure,
  onManageAdventures,
  onViewLeaderboard,
  onBack,
}: AdventureSelectScreenProps) {
  const [showJoin, setShowJoin] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
      {/* Join modal */}
      {showJoin && (
        <JoinModal
          onJoin={onJoinAdventure}
          onClose={() => setShowJoin(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="text-stone-400 hover:text-stone-100 text-2xl leading-none"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Choose an Adventure</h1>
      </div>
      <p className="text-stone-500 text-xs mb-4">
        Select an adventure to begin, then assemble your party.
      </p>

      {adventures.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-12">
          <MapIcon size={48} className="text-stone-500"/>
          <p className="text-stone-400 text-sm">
            You have no adventures yet.<br />Create one in the Adventure Manager.
          </p>
          <button
            onClick={onManageAdventures}
            className="px-6 py-3 bg-amber-700 hover:bg-amber-600 rounded-xl font-bold transition-colors text-stone-100"
          >
            Manage Adventures
          </button>
        </div>
      ) : (
        <>
          {/* Adventure list */}
          <div className="flex flex-col gap-3 flex-1">
            {adventures.map((adv) => (
              <div
                key={adv.id}
                className="w-full bg-stone-800 rounded-xl border border-stone-700 overflow-hidden"
              >
                <button
                  onClick={() => onSelect(adv)}
                  className="w-full text-left hover:bg-stone-700 p-4 transition-colors hover:border-amber-600"
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
                        {MODE_LABEL[adv.mode] ?? adv.mode}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-2 text-xs text-stone-400">
                    <span className="inline-flex items-center gap-1"><HeroesIcon size={13}/> {adv.requiredHeroCount} {adv.requiredHeroCount === 1 ? 'hero' : 'heroes'}</span>
                    <ClassPips classes={adv.allowedClasses} />
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed line-clamp-2">
                    {adv.description.split('\n\n')[0]}
                  </p>
                </button>
                <div className="px-4 pb-3 pt-0">
                  <button
                    onClick={() => onViewLeaderboard(adv)}
                    className="text-xs text-stone-500 hover:text-amber-400 inline-flex items-center gap-1 transition-colors"
                  >
                    <TrophyIcon size={12}/> Leaderboard
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Manage / Join links */}
          <div className="pt-4 mt-4 border-t border-stone-800 flex justify-center gap-6">
            <button
              onClick={onManageAdventures}
              className="text-sm text-stone-500 hover:text-stone-300 underline transition-colors"
            >
              <span className="inline-flex items-center gap-1"><MapIcon size={14}/> Manage Adventures</span>
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="text-sm text-stone-500 hover:text-stone-300 underline transition-colors"
            >
              🔗 Join via Link
            </button>
          </div>
        </>
      )}
    </div>
  );
}
