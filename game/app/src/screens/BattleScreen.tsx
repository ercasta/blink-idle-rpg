import { useEffect, useRef, useState } from 'react';
import type { GameSnapshot, HeroDefinition, RunResult, HeroPath } from '../types';

const STEP_INTERVAL_MS = 1000; // 1 second per checkpoint step

interface BattleScreenProps {
  snapshots: GameSnapshot[];
  prevSnapshots?: GameSnapshot[];
  heroes: HeroDefinition[];
  heroPaths: HeroPath[];
  onComplete: (result: RunResult) => void;
}

function buildResult(snapshots: GameSnapshot[], heroPaths: HeroPath[]): RunResult {
  const final = snapshots[snapshots.length - 1];
  const maxTier = Math.max(...snapshots.map(s => s.currentTier));
  const maxWave = Math.max(...snapshots.map(s => s.currentWave));
  return {
    snapshots,
    finalScore: final.score,
    victory: final.victory,
    enemiesDefeated: final.enemiesDefeated,
    playerDeaths: final.playerDeaths,
    bossesDefeated: final.bossesDefeated,
    totalTime: final.simulationTime,
    deepestTier: maxTier,
    deepestWave: maxWave,
    heroPaths,
  };
}

function ScoreDelta({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined) return null;
  const delta = current - previous;
  if (delta === 0) return <span className="text-slate-500 text-xs ml-2">↔ same as prev</span>;
  const positive = delta > 0;
  return (
    <span className={`text-xs ml-2 ${positive ? 'text-green-400' : 'text-red-400'}`}>
      {positive ? '▲' : '▼'} {Math.abs(delta).toLocaleString()}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-700 rounded-full h-2">
      <div
        className="bg-red-500 h-2 rounded-full transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function BattleScreen({ snapshots, prevSnapshots = [], heroes, heroPaths, onComplete }: BattleScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSteps = snapshots.length;
  const current = snapshots[stepIndex] ?? snapshots[0];
  const prevSnap = prevSnapshots[stepIndex];

  useEffect(() => {
    if (snapshots.length === 0) return;

    timerRef.current = setInterval(() => {
      setStepIndex(prev => {
        const next = prev + 1;
        if (next >= totalSteps) {
          if (timerRef.current) clearInterval(timerRef.current);
          setDone(true);
          return prev;
        }
        return next;
      });
    }, STEP_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [snapshots, totalSteps]);

  // Auto-navigate when done + short pause
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      onComplete(buildResult(snapshots, heroPaths));
    }, 1500);
    return () => clearTimeout(t);
  }, [done, onComplete, snapshots, heroPaths]);

  function handleSkip() {
    if (timerRef.current) clearInterval(timerRef.current);
    onComplete(buildResult(snapshots, heroPaths));
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">
          {done
            ? current.victory ? '🏆 Victory!' : '⚔️ Run Completed'
            : '⚔️ Battle in Progress'}
        </h1>
        <span className="text-slate-400 text-sm">
          Step {Math.min(stepIndex + 1, totalSteps)} / {totalSteps}
        </span>
      </div>

      {/* Progress bar */}
      <ProgressBar value={stepIndex + 1} max={totalSteps} />
      <p className="text-xs text-slate-500 mt-1 mb-5 text-right">
        {Math.round(((stepIndex + 1) / totalSteps) * 100)}% complete
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <KpiCard
          label="Score"
          value={
            <>
              {current.score.toLocaleString()}
              <ScoreDelta current={current.score} previous={prevSnap?.score} />
            </>
          }
          accent
        />
        <KpiCard label="Tier · Wave" value={`${current.currentTier} · ${current.currentWave}`} />
        <KpiCard label="Enemies Defeated" value={current.enemiesDefeated} />
        <KpiCard label="Bosses Defeated" value={current.bossesDefeated} />
        <KpiCard label="Hero Deaths" value={current.playerDeaths} />
        <KpiCard label="Sim Time" value={`${current.simulationTime.toFixed(0)}s`} />
      </div>

      {/* Hero levels */}
      <div className="bg-slate-800 rounded-xl p-4 mb-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Hero Levels
        </h2>
        <div className="flex flex-col gap-2">
          {heroes.map(hero => {
            const level = current.heroLevels[hero.name] ?? 1;
            return (
              <div key={hero.id} className="flex items-center justify-between">
                <span className="text-sm">
                  {hero.emoji} {hero.name}
                  <span className="text-slate-500 ml-1 text-xs">{hero.heroClass}</span>
                </span>
                <span className="text-sm font-bold text-amber-400">Lv {level}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skip button */}
      {!done && (
        <button
          onClick={handleSkip}
          className="w-full py-3 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 text-sm transition-colors"
        >
          ⏭ Skip to Results
        </button>
      )}

      {done && (
        <div className="text-center text-slate-500 text-sm animate-pulse">
          Loading results…
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-3">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`text-lg font-bold ${accent ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
