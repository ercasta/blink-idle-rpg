import type { RunResult } from '../types';

interface HomeScreenProps {
  recentRuns: RunResult[];
  onStart: () => void;
  onQuickPlay: () => void;
  onManageRoster: () => void;
}

export function HomeScreen({ recentRuns, onStart, onQuickPlay, onManageRoster }: HomeScreenProps) {
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
          Send your party into battle and watch the simulation unfold wave by wave. Heroes grow
          stronger as they level up, picking skills that match their traits. How deep can your
          party reach?
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
        <button
          onClick={onManageRoster}
          className="w-full py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 font-bold text-base transition-colors shadow-lg"
        >
          🧑‍🤝‍🧑 Manage Hero Roster
        </button>
        <button
          onClick={onQuickPlay}
          className="w-full py-3 rounded-xl bg-stone-600 hover:bg-stone-500 text-stone-100 font-bold text-base transition-colors shadow-lg"
        >
          ⚡ Quick Play (Random Party)
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
                key={i}
                className="bg-stone-800 rounded-lg px-4 py-3 flex justify-between items-center border border-stone-700"
              >
                <span className="text-sm text-stone-300">
                  ⚔️ · Tier {run.deepestTier}
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
      <div className="mt-auto pt-8 text-center text-stone-600 text-xs">
        <p>BRL-powered simulation engine · 3000 encounters</p>
      </div>
    </div>
  );
}
