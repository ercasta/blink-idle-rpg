import type { RunResult } from '../types';

interface ResultsScreenProps {
  result: RunResult;
  onPlayAgain: () => void;
  onHome: () => void;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ResultsScreen({ result, onPlayAgain, onHome }: ResultsScreenProps) {
  const { finalScore, victory, enemiesDefeated, playerDeaths, bossesDefeated, totalTime, deepestTier, deepestWave } = result;

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white px-4 py-8">
      {/* Outcome */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">{victory ? '🏆' : '💀'}</div>
        <h1 className="text-2xl font-bold mb-1">
          {victory ? 'Victory!' : 'Run Complete'}
        </h1>
        <p className="text-4xl font-extrabold text-amber-400">
          {finalScore.toLocaleString()}
          <span className="text-lg text-slate-400 font-normal ml-1">pts</span>
        </p>
      </div>

      {/* KPI table */}
      <div className="bg-slate-800 rounded-xl px-5 py-3 mb-6">
        <Row label="Deepest Tier" value={deepestTier} />
        <Row label="Deepest Wave" value={deepestWave} />
        <Row label="Enemies Defeated" value={enemiesDefeated} />
        <Row label="Bosses Killed" value={bossesDefeated} />
        <Row label="Hero Deaths" value={playerDeaths} />
        <Row label="Simulation Time" value={formatTime(totalTime)} />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onPlayAgain}
          className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-lg transition-colors"
        >
          ▶ Play Again
        </button>
        <button
          onClick={onHome}
          className="w-full py-3 rounded-xl border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
