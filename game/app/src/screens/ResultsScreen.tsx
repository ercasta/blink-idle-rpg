import { Fragment, useState } from 'react';
import type { RunResult, HeroPath } from '../types';
import { CrossedSwordsIcon, RepeatIcon, PlayIcon, DownloadIcon, StarIcon } from '../components/icons';

interface ResultsScreenProps {
  result: RunResult;
  prevResult?: RunResult | null;
  onPlayAgain: () => void;
  onRerun: () => void;
  onHome: () => void;
  onToggleFavorite?: (id: string) => void;
}

function Row({ label, value, delta }: { label: string; value: string | number; delta?: number | null }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-stone-800 last:border-0">
      <span className="text-stone-400 text-sm">{label}</span>
      <span className="font-semibold text-stone-100 flex items-center gap-1.5">
        {value}
        {delta !== undefined && delta !== null && delta !== 0 && (
          <span className={`text-xs ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString()}
          </span>
        )}
      </span>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ResultsScreen({ result, prevResult, onPlayAgain, onRerun, onHome, onToggleFavorite }: ResultsScreenProps) {
  const { finalScore, enemiesDefeated, playerDeaths, bossesDefeated, totalTime, deepestTier, deepestWave, heroPaths } = result;
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
      </div>

      {/* KPI table */}
      <div className="bg-stone-800 border border-stone-700 rounded-xl px-5 py-3 mb-6">
        <Row label="Deepest Tier" value={deepestTier} delta={prevResult != null ? deepestTier - prevResult.deepestTier : null} />
        <Row label="Deepest Wave" value={deepestWave} delta={prevResult != null ? deepestWave - prevResult.deepestWave : null} />
        <Row label="Enemies Defeated" value={enemiesDefeated} delta={prevResult != null ? enemiesDefeated - prevResult.enemiesDefeated : null} />
        <Row label="Bosses Killed" value={bossesDefeated} delta={prevResult != null ? bossesDefeated - prevResult.bossesDefeated : null} />
        <Row label="Hero Deaths" value={playerDeaths} delta={prevResult != null ? -(playerDeaths - prevResult.playerDeaths) : null} />
        <Row label="Simulation Time" value={formatTime(totalTime)} />
      </div>

      {/* Hero Paths */}
      {heroPaths && heroPaths.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-3">
            Hero Paths
          </h2>
          <div className="flex flex-col gap-2">
            {heroPaths.map(path => (
              <HeroPathCard
                key={path.heroName}
                path={path}
                expanded={expandedHero === path.heroName}
                onToggle={() => setExpandedHero(
                  expandedHero === path.heroName ? null : path.heroName
                )}
              />
            ))}
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
  expanded,
  onToggle,
}: {
  path: HeroPath;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { heroName, heroClass, entries, finalStats } = path;
  const skillEntries = entries.filter(e => e.skillChosen);

  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-stone-700/50 transition-colors"
      >
        <div>
          <span className="font-bold">{heroName}</span>
          <span className="text-xs text-stone-400 ml-2">{heroClass}</span>
        </div>
        <span className="text-stone-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-stone-700">
          {/* Final stats */}
          <div className="mt-3 mb-3">
            <h3 className="text-xs text-stone-400 uppercase tracking-wider mb-2">Final Stats</h3>
            <div className="grid grid-cols-5 gap-1 text-xs text-center">
              {(['str', 'dex', 'int', 'con', 'wis'] as const).map(stat => (
                <div key={stat} className="bg-stone-700/50 rounded p-1.5">
                  <div className="text-stone-400 uppercase" style={{ fontSize: '0.6rem' }}>{stat}</div>
                  <div className="font-bold text-amber-400">{finalStats[stat]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Skills learned */}
          {skillEntries.length > 0 && (
            <div>
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

          {/* Stat gains per level (compact) */}
          <div className="mt-3">
            <h3 className="text-xs text-stone-400 uppercase tracking-wider mb-2">Stat Growth (per level-up)</h3>
            <div className="max-h-40 overflow-y-auto">
              <div className="grid grid-cols-6 gap-x-1 text-xs text-center">
                <div className="text-stone-500 font-semibold">Lv</div>
                <div className="text-stone-500 font-semibold">STR</div>
                <div className="text-stone-500 font-semibold">DEX</div>
                <div className="text-stone-500 font-semibold">INT</div>
                <div className="text-stone-500 font-semibold">CON</div>
                <div className="text-stone-500 font-semibold">WIS</div>
                {entries.slice(0, 20).map((entry, i) => (
                  <Fragment key={i}>
                    <div className="text-stone-500">{entry.level}</div>
                    <div className="text-green-400">+{entry.statsGained.str}</div>
                    <div className="text-green-400">+{entry.statsGained.dex}</div>
                    <div className="text-green-400">+{entry.statsGained.int}</div>
                    <div className="text-green-400">+{entry.statsGained.con}</div>
                    <div className="text-green-400">+{entry.statsGained.wis}</div>
                  </Fragment>
                ))}
              </div>
              {entries.length > 20 && (
                <p className="text-stone-500 text-xs mt-1 text-center">
                  … and {entries.length - 20} more levels
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
