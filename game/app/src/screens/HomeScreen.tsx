import type { RunResult } from '../types';

interface HomeScreenProps {
  recentRuns: RunResult[];
  onStart: () => void;
  onQuickPlay: () => void;
  onManageRoster: () => void;
  onManageAdventures: () => void;
  onViewHistory: () => void;
  onReplayRun: (run: RunResult) => void;
}

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function HomeScreen({ recentRuns, onStart, onQuickPlay, onManageRoster, onManageAdventures, onViewHistory, onReplayRun }: HomeScreenProps) {
  return (
    <div className="flex flex-col items-center min-h-screen bg-stone-900 text-stone-100 px-4 py-8">
      {/* Title */}
      <div className="mb-8 text-center">
        <div className="text-6xl mb-3">🐉</div>
        <h1 className="text-3xl font-bold text-amber-500 tracking-tight">Blink Idle RPG</h1>
        <p className="text-stone-400 mt-2 text-sm">An autonomous idle battle simulation</p>
      </div>

      {/* Game explanation */}
      <div className="w-full max-w-xs bg-stone-800 border border-stone-700 rounded-xl px-4 py-4 mb-6 text-stone-300 text-sm leading-relaxed space-y-2">
        <p>
          Build a roster of heroes, each defined by 12 personality traits that shape their stats,
          skills and combat behaviour. No tapping required — your heroes fight on their own.
        </p>
        <p>
          Create adventures that define the difficulty, party size, and allowed hero classes.
          Send your party in and watch the simulation unfold wave by wave.
        </p>
      </div>

      {/* Actions */}
      <div className="w-full max-w-xs flex flex-col gap-3 mb-8">
        <button
          onClick={onStart}
          className="w-full py-4 rounded-xl bg-amber-700 hover:bg-amber-600 text-stone-100 font-bold text-lg transition-colors shadow-lg"
        >
          ▶ Start a Run
        </button>
        <div className="flex gap-2">
          <button
            onClick={onManageRoster}
            className="flex-1 py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 font-bold text-sm transition-colors shadow-lg"
          >
            🧑‍🤝‍🧑 Heroes
          </button>
          <button
            onClick={onManageAdventures}
            className="flex-1 py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 font-bold text-sm transition-colors shadow-lg"
          >
            🗺️ Adventures
          </button>
        </div>
        <button
          onClick={onQuickPlay}
          className="w-full py-3 rounded-xl bg-stone-600 hover:bg-stone-500 text-stone-100 font-bold text-base transition-colors shadow-lg"
        >
          ⚡ Quick Play
        </button>
        <button
          onClick={onViewHistory}
          className="w-full py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-300 font-bold text-base transition-colors shadow-lg border border-stone-600"
        >
          📋 Run History
        </button>
      </div>

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <div className="w-full max-w-xs">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-widest mb-3">
            Recent Runs
          </h2>
          <div className="flex flex-col gap-2">
            {recentRuns.slice(0, 3).map((run, i) => (
              <div
                key={run.id ?? i}
                className="bg-stone-800 rounded-lg px-4 py-3 flex justify-between items-center border border-stone-700"
              >
                <div className="flex flex-col">
                  <span className="text-sm text-stone-300">
                    {run.adventure ? run.adventure.name : '⚔️'} · Tier {run.deepestTier}
                  </span>
                  {run.timestamp && (
                    <span className="text-xs text-stone-500">{formatDate(run.timestamp)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-400">
                    {run.finalScore.toLocaleString()} pts
                  </span>
                  <button
                    onClick={() => onReplayRun(run)}
                    className="py-1 px-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-stone-100 text-xs font-bold transition-colors"
                  >
                    ▶
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-8 text-center text-stone-600 text-xs space-y-2">
        <p>BRL-powered simulation engine · 3000 encounters</p>
        <a
          href="https://github.com/ercasta/blink-idle-rpg"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-300 transition-colors"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          ercasta/blink-idle-rpg
        </a>
      </div>
    </div>
  );
}
