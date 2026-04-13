import { useState } from 'react';
import type { RunResult, NarrativeEntry, NarrativeLevel } from '../types';
import { CrossedSwordsIcon, RepeatIcon, PlayIcon, DownloadIcon, StarIcon, TrophyIcon, ExpandIcon, ShrinkIcon } from '../components/icons';

interface ResultsScreenProps {
  result: RunResult;
  prevResult?: RunResult | null;
  /** 1-based leaderboard position, or null if outside top 10 */
  leaderboardPosition?: number | null;
  /** True if this run achieved a new best score for the adventure */
  isNewBest?: boolean;
  onPlayAgain: () => void;
  onRerun: () => void;
  onHome: () => void;
  onToggleFavorite?: (id: string) => void;
  onViewLeaderboard?: () => void;
  /** Narrative log entries (story mode only). */
  narrativeLog?: NarrativeEntry[];
}

function Row({ label, value, delta, lowerIsBetter }: { label: string; value: string | number; delta?: number | null; lowerIsBetter?: boolean }) {
  const isImprovement = lowerIsBetter ? (delta ?? 0) < 0 : (delta ?? 0) > 0;
  return (
    <div className="flex justify-between items-center py-2 border-b border-stone-800 last:border-0">
      <span className="text-stone-400 text-sm">{label}</span>
      <span className="font-semibold text-stone-100 flex items-center gap-1.5">
        {value}
        {delta !== undefined && delta !== null && delta !== 0 && (
          <span className={`text-xs ${isImprovement ? 'text-green-400' : 'text-red-400'}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString()}
          </span>
        )}
      </span>
    </div>
  );
}

export function ResultsScreen({ result, prevResult, leaderboardPosition, isNewBest, onPlayAgain, onRerun, onHome, onToggleFavorite, onViewLeaderboard, narrativeLog = [] }: ResultsScreenProps) {
  const { finalScore, enemiesDefeated, playerDeaths, bossesDefeated } = result;
  const [verbosity, setVerbosity] = useState<NarrativeLevel>(2);
  const [showFullLog, setShowFullLog] = useState(false);

  const scoreDelta = prevResult != null ? finalScore - prevResult.finalScore : null;

  function handleDownload() {
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blink-run-${result.id ?? Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasAdventure = Boolean(result.adventure);

  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-8">
      {/* Outcome */}
      <div className="text-center mb-8">
        <div className="mb-3 flex justify-center">
          <CrossedSwordsIcon size={48} className="text-amber-600"/>
        </div>
        <h1 className="text-2xl font-bold mb-1">
          {'Run Completed!'}
        </h1>
        <p className="text-4xl font-extrabold text-amber-400 flex items-center justify-center gap-2">
          {finalScore.toLocaleString()}
          <span className="text-lg text-stone-400 font-normal">pts</span>
          {scoreDelta !== null && scoreDelta !== 0 && (
            <span className={`text-xl font-bold ${scoreDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {scoreDelta > 0 ? '▲' : '▼'} {Math.abs(scoreDelta).toLocaleString()}
            </span>
          )}
        </p>
        {prevResult != null && scoreDelta === 0 && (
          <p className="text-xs text-stone-500 mt-1">↔ same score as previous run</p>
        )}

        {/* New best record celebration */}
        {isNewBest && (
          <div className="mt-3 flex items-center justify-center gap-2 text-amber-300 bg-amber-900/30 border border-amber-700 rounded-xl px-4 py-2">
            <TrophyIcon size={18} className="text-amber-400"/>
            <span className="font-bold text-sm">🎉 New Best Record!</span>
          </div>
        )}

        {/* Leaderboard position */}
        {hasAdventure && leaderboardPosition !== undefined && (
          <div className="mt-2">
            {leaderboardPosition !== null ? (
              <p className="text-sm font-semibold text-stone-300">
                <TrophyIcon size={14} className="inline text-amber-400 mr-1"/>
                Leaderboard: <span className="text-amber-400">#{leaderboardPosition}</span>
              </p>
            ) : (
              <p className="text-sm text-stone-500">Leaderboard: not qualified (outside top 10)</p>
            )}
          </div>
        )}
      </div>

      {/* KPI table */}
      <div className="bg-stone-800 border border-stone-700 rounded-xl px-5 py-3 mb-6">
        <Row label="Enemies Defeated" value={enemiesDefeated} delta={prevResult != null ? enemiesDefeated - prevResult.enemiesDefeated : null} />
        <Row label="Bosses Killed" value={bossesDefeated} delta={prevResult != null ? bossesDefeated - prevResult.bossesDefeated : null} />
        <Row label="Hero Deaths" value={playerDeaths} delta={prevResult != null ? playerDeaths - prevResult.playerDeaths : null} lowerIsBetter />
      </div>

      {/* Story mode KPIs */}
      {result.storyKpis && (
        <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-5 py-3 mb-6">
          <p className="text-xs text-blue-300 uppercase tracking-widest font-semibold mb-2">📖 Story Journey</p>
          <Row label="Days Travelled" value={result.storyKpis.currentDay} />
          <Row label="Locations Visited" value={`${result.storyKpis.locationsVisited} / ${result.storyKpis.totalLocations}`} />
          <Row label="Towns Rested" value={result.storyKpis.townsRested} />
          <Row label="Ambushes Survived" value={result.storyKpis.ambushesSurvived} />
          <Row label="Final Destination" value={result.storyKpis.finalDestinationReached ? '✓ Reached' : '✗ Not reached'} />
          <Row label="Exploration Bonus" value={`+${result.storyKpis.explorationBonus.toLocaleString()} pts`} />
          {result.storyKpis.earlyCompletionBonus != null && result.storyKpis.earlyCompletionBonus > 0 && (
            <Row label="⚡ Early Completion" value={`+${result.storyKpis.earlyCompletionBonus.toLocaleString()} pts`} />
          )}
        </div>
      )}

      {/* Narrative Log (story mode only) */}
      {narrativeLog.length > 0 && (
        <>
          {showFullLog && (
            <div className="fixed inset-0 z-50 bg-stone-900 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-blue-800/50">
                <p className="text-xs text-blue-300 uppercase tracking-widest font-semibold">📖 Story Log</p>
                <div className="flex gap-1 items-center">
                  {([1, 2, 3] as NarrativeLevel[]).map(level => (
                    <button
                      key={level}
                      onClick={() => setVerbosity(level)}
                      className={`px-2 py-0.5 text-xs rounded-lg transition-colors ${
                        verbosity === level
                          ? 'bg-blue-700 text-blue-100'
                          : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
                      }`}
                    >
                      {level === 1 ? 'Headlines' : level === 2 ? 'Standard' : 'Detailed'}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowFullLog(false)}
                    className="ml-1 p-0.5 text-stone-400 hover:text-blue-300 transition-colors"
                    title="Exit fullscreen"
                  >
                    <ShrinkIcon size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 text-xs space-y-1 scrollbar-thin">
                {narrativeLog.filter(e => e.level <= verbosity).map((entry, i) => (
                  <div
                    key={i}
                    className={`leading-relaxed ${
                      entry.level === 1 ? 'text-amber-300 font-semibold' :
                      entry.level === 3 ? 'text-stone-400 italic' :
                      'text-stone-200'
                    }`}
                  >
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-5 py-3 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-blue-300 uppercase tracking-widest font-semibold">📖 Story Log</p>
              <div className="flex gap-1 items-center">
                {([1, 2, 3] as NarrativeLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => setVerbosity(level)}
                    className={`px-2 py-0.5 text-xs rounded-lg transition-colors ${
                      verbosity === level
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
                    }`}
                  >
                    {level === 1 ? 'Headlines' : level === 2 ? 'Standard' : 'Detailed'}
                  </button>
                ))}
                <button
                  onClick={() => setShowFullLog(true)}
                  className="ml-1 p-0.5 text-stone-400 hover:text-blue-300 transition-colors"
                  title="Fullscreen log"
                >
                  <ExpandIcon size={14} />
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto text-xs space-y-1 scrollbar-thin">
              {narrativeLog.filter(e => e.level <= verbosity).map((entry, i) => (
                <div
                  key={i}
                  className={`leading-relaxed ${
                    entry.level === 1 ? 'text-amber-300 font-semibold' :
                    entry.level === 3 ? 'text-stone-400 italic' :
                    'text-stone-200'
                  }`}
                >
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onRerun}
          className="w-full py-4 rounded-xl bg-amber-700 hover:bg-amber-600 text-stone-100 font-bold text-lg transition-colors"
        >
          <span className="inline-flex items-center gap-2"><RepeatIcon size={18}/> Rerun (same heroes)</span>
        </button>
        <button
          onClick={onPlayAgain}
          className="w-full py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 font-bold transition-colors"
        >
          <span className="inline-flex items-center gap-2"><PlayIcon size={16}/> Play Again (new setup)</span>
        </button>
        {/* Leaderboard button */}
        {hasAdventure && onViewLeaderboard && (
          <button
            onClick={onViewLeaderboard}
            className="w-full py-3 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-100 font-bold transition-colors border border-stone-600"
          >
            <span className="inline-flex items-center gap-2"><TrophyIcon size={16}/> View Leaderboard</span>
          </button>
        )}
        {/* Favorite + Download row */}
        {result.id && (
          <div className="flex gap-3">
            {onToggleFavorite && (
              <button
                onClick={() => result.id && onToggleFavorite(result.id)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors border ${
                  result.favorited
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                }`}
              >
                {result.favorited
                  ? <span className="inline-flex items-center gap-1"><StarIcon size={14} filled/> Favorited</span>
                  : <span className="inline-flex items-center gap-1"><StarIcon size={14}/> Add to Favorites</span>}
              </button>
            )}
            <button
              onClick={handleDownload}
              className="flex-1 py-2.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-300 font-bold text-sm transition-colors border border-stone-600"
            >
              <span className="inline-flex items-center gap-1"><DownloadIcon size={14}/> Download Run</span>
            </button>
          </div>
        )}
        <button
          onClick={onHome}
          className="w-full py-3 rounded-xl border border-stone-600 text-stone-300 hover:text-stone-100 hover:border-stone-400 transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
