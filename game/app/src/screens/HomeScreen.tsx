import type { RunResult } from '../types';

interface HomeScreenProps {
  recentRuns: RunResult[];
  onStart: () => void;
  onQuickPlay: () => void;
}

export function HomeScreen({ recentRuns, onStart, onQuickPlay }: HomeScreenProps) {
  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-900 text-white px-4 py-8">
      {/* Title */}
      <div className="mb-10 text-center">
        <div className="text-6xl mb-3">🐉</div>
        <h1 className="text-3xl font-bold text-red-400 tracking-tight">Blink Idle RPG</h1>
        <p className="text-slate-400 mt-2 text-sm">An autonomous idle battle simulation</p>
      </div>

      {/* Actions */}
      <div className="w-full max-w-xs flex flex-col gap-3 mb-8">
        <button
          onClick={onStart}
          className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-lg transition-colors shadow-lg"
        >
          ▶ Start a Run
        </button>
        <button
          onClick={onQuickPlay}
          className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-base transition-colors shadow-lg"
        >
          ⚡ Quick Play (Random Party)
        </button>
      </div>

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <div className="w-full max-w-xs">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Recent Runs
          </h2>
          <div className="flex flex-col gap-2">
            {recentRuns.slice(0, 3).map((run, i) => (
              <div
                key={i}
                className="bg-slate-800 rounded-lg px-4 py-3 flex justify-between items-center"
              >
                <span className="text-sm text-slate-300">
                  {run.victory ? '🏆 Victory' : '💀 Defeat'} · Tier {run.deepestTier}
                </span>
                <span className="text-sm font-bold text-amber-400">
                  {run.finalScore.toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-8 text-center text-slate-600 text-xs">
        <p>BRL-powered simulation engine · 3000 encounters</p>
      </div>
    </div>
  );
}
