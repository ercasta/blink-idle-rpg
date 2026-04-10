import { useRef } from 'react';
import type { RunResult } from '../types';
import { PlayIcon, SkullIcon, MountainIcon, CrossedSwordsIcon, HeroesIcon, DownloadIcon, ImportIcon, TrashIcon, StarIcon, HistoryIcon } from '../components/icons';

interface RunHistoryScreenProps {
  runs: RunResult[];
  onBack: () => void;
  onReplayRun: (run: RunResult) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteRun: (id: string) => void;
  onImportRun: (run: RunResult) => void;
}

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadRun(run: RunResult) {
  const json = JSON.stringify(run, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `blink-run-${run.id ?? 'unknown'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function RunCard({
  run,
  onReplay,
  onToggleFavorite,
  onDelete,
}: {
  run: RunResult;
  onReplay: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const modeBadge =
    run.mode === 'easy'
      ? <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Easy</span>
      : run.mode === 'hard'
      ? <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Hard</span>
      : <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Normal</span>;
  const heroNames = (run.heroes ?? []).map(h => h.name).join(', ') || '—';

  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 flex flex-col gap-2">
      {/* Top row: score + timestamp */}
      <div className="flex justify-between items-start">
        <div>
          <span className="text-amber-400 font-bold text-lg">
            {run.finalScore.toLocaleString()} pts
          </span>
          <span className="text-stone-500 text-xs ml-2">{modeBadge}</span>
        </div>
        <span className="text-stone-500 text-xs">{formatDate(run.timestamp)}</span>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-stone-400">
        <span className="inline-flex items-center gap-1"><MountainIcon size={14}/> Tier {run.deepestTier}</span>
        <span className="inline-flex items-center gap-1"><CrossedSwordsIcon size={14}/> Wave {run.deepestWave}</span>
        <span className="inline-flex items-center gap-1"><SkullIcon size={14}/> {run.enemiesDefeated} killed</span>
      </div>

      {/* Heroes */}
      {heroNames !== '—' && (
        <div className="text-xs text-stone-400 truncate inline-flex items-center gap-1"><HeroesIcon size={14}/> {heroNames}</div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-1 flex-wrap">
        <button
          onClick={onReplay}
          className="flex-1 min-w-[70px] py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-stone-100 text-xs font-bold transition-colors"
        >
          <span className="inline-flex items-center gap-1.5"><PlayIcon size={12}/> Replay</span>
        </button>
        <button
          onClick={onToggleFavorite}
          className={`flex-1 min-w-[70px] py-1.5 rounded-lg text-xs font-bold transition-colors border ${
            run.favorited
              ? 'bg-amber-500/20 border-amber-500 text-amber-400 hover:bg-amber-500/30'
              : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
          }`}
        >
          {run.favorited
            ? <span className="inline-flex items-center gap-1"><StarIcon size={12} filled/> Saved</span>
            : <span className="inline-flex items-center gap-1"><StarIcon size={12}/> Save</span>}
        </button>
        <button
          onClick={() => downloadRun(run)}
          className="flex-1 min-w-[70px] py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs font-bold transition-colors border border-stone-600"
        >
          <span className="inline-flex items-center gap-1"><DownloadIcon size={12}/> Export</span>
        </button>
        <button
          onClick={onDelete}
          className="py-1.5 px-3 rounded-lg bg-stone-700 hover:bg-red-900 text-stone-400 hover:text-red-300 text-xs font-bold transition-colors border border-stone-600"
        >
          <TrashIcon size={16}/>
        </button>
      </div>
    </div>
  );
}

export function RunHistoryScreen({
  runs,
  onBack,
  onReplayRun,
  onToggleFavorite,
  onDeleteRun,
  onImportRun,
}: RunHistoryScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const favorites = runs.filter(r => r.favorited);
  const nonFavorites = runs.filter(r => !r.favorited);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-imported
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const run = JSON.parse(ev.target?.result as string) as RunResult;
        if (
          typeof run.id !== 'string' ||
          !Array.isArray(run.snapshots) ||
          typeof run.finalScore !== 'number'
        ) {
          alert('Invalid run file: missing required fields (id, snapshots, or finalScore).');
          return;
        }
        onImportRun(run);
      } catch {
        alert('Failed to parse run file. Please ensure it is a valid JSON file exported from Blink Idle RPG.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-stone-400 hover:text-stone-100 transition-colors text-sm"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-amber-500 flex-1">Run History</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="py-1.5 px-3 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs font-bold transition-colors border border-stone-600"
        >
          <span className="inline-flex items-center gap-1"><ImportIcon size={12}/> Import</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {runs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-500 gap-3">
          <HistoryIcon size={48} className="text-stone-600"/>
          <p className="text-sm">No runs saved yet.</p>
          <p className="text-xs text-stone-600">
            Complete a run to see it here, or import an exported file.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 pb-8">
          {/* Favorites */}
          {favorites.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-3">
                <span className="inline-flex items-center gap-1"><StarIcon size={12} filled/> Favorites</span>
              </h2>
              <div className="flex flex-col gap-3">
                {favorites.map(run => (
                  <RunCard
                    key={run.id}
                    run={run}
                    onReplay={() => onReplayRun(run)}
                    onToggleFavorite={() => run.id && onToggleFavorite(run.id)}
                    onDelete={() => run.id && onDeleteRun(run.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All other runs */}
          {nonFavorites.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-3">
                {favorites.length > 0 ? 'Other Runs' : 'All Runs'}
              </h2>
              <div className="flex flex-col gap-3">
                {nonFavorites.map(run => (
                  <RunCard
                    key={run.id}
                    run={run}
                    onReplay={() => onReplayRun(run)}
                    onToggleFavorite={() => run.id && onToggleFavorite(run.id)}
                    onDelete={() => run.id && onDeleteRun(run.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
