import { useEffect, useRef, useState } from 'react';
import type { GameSnapshot, HeroDefinition, RunResult, RunType, NarrativeEntry, NarrativeLevel } from '../types';
import { ClassIcon, CrossedSwordsIcon, TrophyIcon, SkipIcon, ExpandIcon, ShrinkIcon } from '../components/icons';
import { heroSummary } from '../data/traits';

const STEP_INTERVAL_MS = 1000; // 1 second per checkpoint step

interface BattleScreenProps {
  snapshots: GameSnapshot[];
  prevSnapshots?: GameSnapshot[];
  heroes: HeroDefinition[];
  onComplete: (result: RunResult) => void;
  /** Run type: fight or story. Affects display labels. */
  runType?: RunType;
  /** Narrative log entries (story mode only). */
  narrativeLog?: NarrativeEntry[];
}

function buildResult(snapshots: GameSnapshot[]): RunResult {
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
    <div className="w-full bg-stone-700 rounded-full h-2">
      <div
        className="bg-amber-600 h-2 rounded-full transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function BattleScreen({ snapshots, prevSnapshots = [], heroes, onComplete, runType = 'fight', narrativeLog = [] }: BattleScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [verbosity, setVerbosity] = useState<NarrativeLevel>(2);
  const logEndRef = useRef<HTMLDivElement | null>(null);

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
      onComplete(buildResult(snapshots));
    }, 1500);
    return () => clearTimeout(t);
  }, [done, onComplete, snapshots]);

  function handleSkip() {
    if (timerRef.current) clearInterval(timerRef.current);
    onComplete(buildResult(snapshots));
  }

  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">
          {done
            ? current.victory
              ? <span className="inline-flex items-center gap-2"><TrophyIcon size={22}/> Victory!</span>
              : <span className="inline-flex items-center gap-2"><CrossedSwordsIcon size={22}/> {runType === 'story' ? 'Journey Completed' : 'Run Completed'}</span>
            : <span className="inline-flex items-center gap-2"><CrossedSwordsIcon size={22}/> {runType === 'story' ? 'Journey in Progress' : 'Battle in Progress'}</span>}
        </h1>
        <span className="text-stone-400 text-sm">
          {runType === 'story' ? `Day ${Math.min(stepIndex + 1, totalSteps)} / ${totalSteps}` : `Step ${Math.min(stepIndex + 1, totalSteps)} / ${totalSteps}`}
        </span>
      </div>

      {/* Progress bar */}
      <ProgressBar value={stepIndex + 1} max={totalSteps} />
      <p className="text-xs text-stone-500 mt-1 mb-5 text-right">
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
        <KpiCard label="Enemies Defeated" value={current.enemiesDefeated} />
        <KpiCard label="Bosses Defeated" value={current.bossesDefeated} />
        <KpiCard label="Hero Deaths" value={current.playerDeaths} />
      </div>

      {/* Hero levels */}
      <div className="bg-stone-800 border border-stone-700 rounded-xl p-4 mb-5">
        <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-3">
          Hero Levels
        </h2>
        <div className="flex flex-col gap-2">
          {heroes.map(hero => {
            const level = current.heroLevels[hero.name] ?? 1;
            return (
              <div key={hero.id} className="flex items-center justify-between">
                <span className="text-sm inline-flex items-center gap-1.5">
                  <ClassIcon heroClass={hero.heroClass} size={18}/> {hero.name}
                  <span className="text-stone-500 ml-1 text-xs">{heroSummary(hero.heroClass, hero.traits, hero.linePreference)}</span>
                </span>
                <span className="text-sm font-bold text-amber-400">Lv {level}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Narrative Log (story mode only) */}
      {runType === 'story' && narrativeLog.length > 0 && (
        <NarrativeLogPanel
          entries={narrativeLog}
          currentDay={Math.min(stepIndex + 1, totalSteps)}
          verbosity={verbosity}
          onVerbosityChange={setVerbosity}
          logEndRef={logEndRef}
        />
      )}

      {/* Skip button */}
      {!done && (
        <button
          onClick={handleSkip}
          className="w-full py-3 rounded-xl border border-stone-600 text-stone-400 hover:text-stone-100 hover:border-stone-400 text-sm transition-colors"
        >
          <span className="inline-flex items-center gap-2"><SkipIcon size={16}/> Skip to Results</span>
        </button>
      )}

      {done && (
        <div className="text-center text-stone-500 text-sm animate-pulse">
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
    <div className="bg-stone-800 border border-stone-700 rounded-xl p-3">
      <p className="text-stone-400 text-xs mb-1">{label}</p>
      <p className={`text-lg font-bold ${accent ? 'text-amber-400' : 'text-stone-100'}`}>
        {value}
      </p>
    </div>
  );
}

// ── Narrative Log Panel ─────────────────────────────────────────────────────

const VERBOSITY_LABELS: Record<NarrativeLevel, string> = {
  1: 'Headlines',
  2: 'Standard',
  3: 'Detailed',
};

function NarrativeLogPanel({
  entries,
  currentDay,
  verbosity,
  onVerbosityChange,
  logEndRef,
}: {
  entries: NarrativeEntry[];
  currentDay: number;
  verbosity: NarrativeLevel;
  onVerbosityChange: (level: NarrativeLevel) => void;
  logEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  // Filter entries by verbosity level and current day
  const visible = entries.filter(e => e.level <= verbosity && e.day <= currentDay);

  // Auto-scroll to bottom when new entries appear
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visible.length, logEndRef]);

  const controls = (
    <div className="flex gap-1 items-center">
      {([1, 2, 3] as NarrativeLevel[]).map(level => (
        <button
          key={level}
          onClick={() => onVerbosityChange(level)}
          className={`px-2 py-0.5 text-xs rounded-lg transition-colors ${
            verbosity === level
              ? 'bg-blue-700 text-blue-100'
              : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
          }`}
          title={VERBOSITY_LABELS[level]}
        >
          {VERBOSITY_LABELS[level]}
        </button>
      ))}
      <button
        onClick={() => setFullscreen(f => !f)}
        className="ml-1 p-0.5 text-stone-400 hover:text-blue-300 transition-colors"
        title={fullscreen ? 'Exit fullscreen' : 'Fullscreen log'}
      >
        {fullscreen ? <ShrinkIcon size={14} /> : <ExpandIcon size={14} />}
      </button>
    </div>
  );

  const logContent = (
    <>
      {visible.length === 0 && (
        <p className="text-stone-500 italic">The journey begins…</p>
      )}
      {visible.map((entry, i) => (
        <NarrativeLogEntry key={i} entry={entry} />
      ))}
      <div ref={logEndRef} />
    </>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-800/50">
          <h2 className="text-sm font-semibold text-blue-300 uppercase tracking-widest">
            📖 Story Log
          </h2>
          {controls}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 text-xs space-y-1 scrollbar-thin">
          {logContent}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-stone-800 border border-blue-800/50 rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-blue-300 uppercase tracking-widest">
          📖 Story Log
        </h2>
        {controls}
      </div>
      <div className="max-h-48 overflow-y-auto text-xs space-y-1 scrollbar-thin">
        {logContent}
      </div>
    </div>
  );
}

function NarrativeLogEntry({ entry }: { entry: NarrativeEntry }) {
  const levelStyles: Record<NarrativeLevel, string> = {
    1: 'text-amber-300 font-semibold',
    2: 'text-stone-200',
    3: 'text-stone-400 italic',
  };
  return (
    <div className={`${levelStyles[entry.level]} leading-relaxed`}>
      {entry.text}
    </div>
  );
}
