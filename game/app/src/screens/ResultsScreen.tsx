import { useState } from 'react';
import type { RunResult, HeroPath, HeroDefinition } from '../types';
import { CrossedSwordsIcon, RepeatIcon, PlayIcon, DownloadIcon, StarIcon, TrophyIcon } from '../components/icons';
import { heroSummary } from '../data/traits';

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

export function ResultsScreen({ result, prevResult, leaderboardPosition, isNewBest, onPlayAgain, onRerun, onHome, onToggleFavorite, onViewLeaderboard }: ResultsScreenProps) {
  const { finalScore, enemiesDefeated, playerDeaths, bossesDefeated, heroPaths } = result;
  const [expandedHero, setExpandedHero] = useState<string | null>(null);

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
        </div>
      )}

      {/* Hero Paths */}
      {heroPaths && heroPaths.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-3">
            Hero Paths
          </h2>
          <div className="flex flex-col gap-2">
            {heroPaths.map(path => {
              const matchingHero = result.heroes?.find(h => h.name === path.heroName);
              return (
              <HeroPathCard
                key={path.heroName}
                path={path}
                hero={matchingHero}
                expanded={expandedHero === path.heroName}
                onToggle={() => setExpandedHero(
                  expandedHero === path.heroName ? null : path.heroName
                )}
              />
              );
            })}
          </div>
        </div>
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

// ── Hero Path Card ──────────────────────────────────────────────────────────

function HeroPathCard({
  path,
  hero,
  expanded,
  onToggle,
}: {
  path: HeroPath;
  hero?: HeroDefinition;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { heroName, heroClass, entries } = path;
  const summary = hero ? heroSummary(hero.heroClass, hero.traits, hero.linePreference) : heroClass;
  const skillEntries = entries.filter(e => e.skillChosen);

  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-stone-700/50 transition-colors"
      >
        <div>
          <span className="font-bold">{heroName}</span>
          <span className="text-xs text-stone-400 ml-2">{summary}</span>
        </div>
        <span className="text-stone-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-stone-700">
          {/* Skills learned */}
          {skillEntries.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs text-stone-400 uppercase tracking-wider mb-2">Skills Learned</h3>
              <div className="flex flex-col gap-1">
                {skillEntries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-stone-500 font-mono w-8">Lv{entry.level}</span>
                    <span className="text-stone-200">{entry.skillChosen}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
