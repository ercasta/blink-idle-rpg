import { Fragment, useState } from 'react';
import type { RunResult, HeroPath } from '../types';

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
  const { finalScore, victory, enemiesDefeated, playerDeaths, bossesDefeated, totalTime, deepestTier, deepestWave, heroPaths } = result;
  const [expandedHero, setExpandedHero] = useState<string | null>(null);

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white px-4 py-8">
      {/* Outcome */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">{victory ? '🏆' : '⚔️'}</div>
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

      {/* Hero Paths */}
      {heroPaths && heroPaths.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
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
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
      >
        <div>
          <span className="font-bold">{heroName}</span>
          <span className="text-xs text-slate-400 ml-2">{heroClass}</span>
        </div>
        <span className="text-slate-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700">
          {/* Final stats */}
          <div className="mt-3 mb-3">
            <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Final Stats</h3>
            <div className="grid grid-cols-5 gap-1 text-xs text-center">
              {(['str', 'dex', 'int', 'con', 'wis'] as const).map(stat => (
                <div key={stat} className="bg-slate-700/50 rounded p-1.5">
                  <div className="text-slate-400 uppercase" style={{ fontSize: '0.6rem' }}>{stat}</div>
                  <div className="font-bold text-amber-400">{finalStats[stat]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Skills learned */}
          {skillEntries.length > 0 && (
            <div>
              <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Skills Learned</h3>
              <div className="flex flex-col gap-1">
                {skillEntries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-mono w-8">Lv{entry.level}</span>
                    <span className="text-slate-200">{entry.skillChosen}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stat gains per level (compact) */}
          <div className="mt-3">
            <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-2">Stat Growth (per level-up)</h3>
            <div className="max-h-40 overflow-y-auto">
              <div className="grid grid-cols-6 gap-x-1 text-xs text-center">
                <div className="text-slate-500 font-semibold">Lv</div>
                <div className="text-slate-500 font-semibold">STR</div>
                <div className="text-slate-500 font-semibold">DEX</div>
                <div className="text-slate-500 font-semibold">INT</div>
                <div className="text-slate-500 font-semibold">CON</div>
                <div className="text-slate-500 font-semibold">WIS</div>
                {entries.slice(0, 20).map((entry, i) => (
                  <Fragment key={i}>
                    <div className="text-slate-500">{entry.level}</div>
                    <div className="text-green-400">+{entry.statsGained.str}</div>
                    <div className="text-green-400">+{entry.statsGained.dex}</div>
                    <div className="text-green-400">+{entry.statsGained.int}</div>
                    <div className="text-green-400">+{entry.statsGained.con}</div>
                    <div className="text-green-400">+{entry.statsGained.wis}</div>
                  </Fragment>
                ))}
              </div>
              {entries.length > 20 && (
                <p className="text-slate-500 text-xs mt-1 text-center">
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
