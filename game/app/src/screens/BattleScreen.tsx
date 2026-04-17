import { useEffect, useRef, useState } from 'react';
import type { GameSnapshot, HeroDefinition, RunResult, HeroPath, RunType, NarrativeEntry, NarrativeLevel, StoryStep } from '../types';
import { ClassIcon, CrossedSwordsIcon, TrophyIcon, SkipIcon, ExpandIcon, ShrinkIcon } from '../components/icons';
import { heroSummary } from '../data/traits';

const STEP_INTERVAL_MS = 1000; // 1 second per checkpoint step

interface BattleScreenProps {
  snapshots: GameSnapshot[];
  prevSnapshots?: GameSnapshot[];
  heroes: HeroDefinition[];
  heroPaths: HeroPath[];
  onComplete: (result: RunResult) => void;
  /** Run type: fight or story. Affects display labels. */
  runType?: RunType;
  /** Narrative log entries (story mode only). */
  narrativeLog?: NarrativeEntry[];
  /** Story steps for granular step-by-step navigation (story mode only). */
  storySteps?: StoryStep[];
}

// ── Top-level dispatcher ────────────────────────────────────────────────────

export function BattleScreen(props: BattleScreenProps) {
  if (props.runType === 'story') {
    return <ImmersiveStoryView {...props} />;
  }
  return <FightBattleView {...props} />;
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
    <div className="w-full bg-stone-700 rounded-full h-2">
      <div
        className="bg-amber-600 h-2 rounded-full transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Fight mode battle view (original layout) ────────────────────────────────

function FightBattleView({ snapshots, prevSnapshots = [], heroes, heroPaths, onComplete, runType = 'fight', narrativeLog = [] }: BattleScreenProps) {
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
      onComplete(buildResult(snapshots, heroPaths));
    }, 1500);
    return () => clearTimeout(t);
  }, [done, onComplete, snapshots, heroPaths]);

  function handleSkip() {
    if (timerRef.current) clearInterval(timerRef.current);
    onComplete(buildResult(snapshots, heroPaths));
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

const NARRATIVE_LEVELS: NarrativeLevel[] = [1, 2, 3];

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
      {NARRATIVE_LEVELS.map(level => (
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

// ── Step type display helpers ────────────────────────────────────────────────

const STEP_TYPE_ICONS: Record<string, string> = {
  journey_start: '🏰',
  day_start: '🌅',
  departure: '🚶',
  travel: '🛤️',
  encounter: '⚔️',
  blocking_encounter: '🚧',
  arrival: '📍',
  town_rest: '🏨',
  camp: '🏕️',
  night_ambush: '🌙',
  day_end: '🌙',
  journey_end: '🏁',
};

const STEP_TYPE_LABELS: Record<string, string> = {
  journey_start: 'Journey Begins',
  day_start: 'Day Starts',
  departure: 'Departing',
  travel: 'Travelling',
  encounter: 'Encounter',
  blocking_encounter: 'Blocked!',
  arrival: 'Arrived',
  town_rest: 'Resting at Town',
  camp: 'Camping',
  night_ambush: 'Night Ambush!',
  day_end: 'Day Ends',
  journey_end: 'Journey Ends',
};

// ── Immersive Story View (step-based navigation) ────────────────────────────

function ImmersiveStoryView({ snapshots, prevSnapshots = [], heroes, narrativeLog = [], heroPaths, onComplete, storySteps = [] }: BattleScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [verbosity, setVerbosity] = useState<NarrativeLevel>(2);
  const [questPanelOpen, setQuestPanelOpen] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  const totalSteps = storySteps.length;
  const currentStep = storySteps[stepIndex] ?? storySteps[0];
  const isLastStep = stepIndex >= totalSteps - 1;

  // Filter narrative entries for current step by verbosity
  const stepEntries = currentStep
    ? currentStep.narrativeEntries.filter(e => e.level <= verbosity)
    : [];

  // Scroll log to top whenever the step changes
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [stepIndex]);

  // ── Navigation handlers ─────────────────────────────────────────────────

  function handleNextStep() {
    if (isLastStep) {
      onComplete(buildResult(snapshots, heroPaths));
    } else {
      setStepIndex(prev => prev + 1);
    }
  }

  function handlePrevStep() {
    setStepIndex(prev => Math.max(0, prev - 1));
  }

  function handleNextDay() {
    if (!currentStep) return;
    const currentDay = currentStep.day;
    // Find first step of the next day
    const nextDayIdx = storySteps.findIndex((s, i) => i > stepIndex && s.day > currentDay);
    if (nextDayIdx >= 0) {
      setStepIndex(nextDayIdx);
    } else {
      // Go to last step
      setStepIndex(totalSteps - 1);
    }
  }

  function handlePrevDay() {
    if (!currentStep) return;
    const currentDay = currentStep.day;
    if (currentDay <= 1 && stepIndex === 0) return;
    // Find first step of the previous day (or beginning of current day)
    const firstOfCurrentDay = storySteps.findIndex(s => s.day === currentDay);
    if (stepIndex > firstOfCurrentDay) {
      // Go to start of current day
      setStepIndex(firstOfCurrentDay);
    } else {
      // Go to start of previous day
      const prevDay = currentDay - 1;
      const firstOfPrevDay = storySteps.findIndex(s => s.day === prevDay);
      if (firstOfPrevDay >= 0) {
        setStepIndex(firstOfPrevDay);
      } else {
        setStepIndex(0);
      }
    }
  }

  if (!currentStep) {
    // Fallback to old day-based view if no steps available
    return <ImmersiveStoryViewLegacy
      snapshots={snapshots}
      prevSnapshots={prevSnapshots}
      heroes={heroes}
      narrativeLog={narrativeLog}
      heroPaths={heroPaths}
      onComplete={onComplete}
    />;
  }

  const score = currentStep.score;

  // Collect all completed and active milestones up to current step
  const completedMilestones = currentStep.completedMilestones ?? [];
  const activeMilestone = currentStep.activeMilestone;
  const questObjective = currentStep.questObjective;

  return (
    <div className="flex flex-col h-screen bg-stone-900 text-stone-100 overflow-hidden">
      {/* Score bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-700 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-amber-400 font-bold text-sm">{score.toLocaleString()} pts</span>
        </div>
        <span className="text-stone-400 text-sm">Day {currentStep.day} • Step {stepIndex + 1}/{totalSteps}</span>
      </div>

      {/* Location / Encounter band */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-stone-700/50 bg-stone-800/50 shrink-0">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="shrink-0">{STEP_TYPE_ICONS[currentStep.type] ?? '📍'}</span>
          <span className="text-stone-300 truncate font-medium">
            {currentStep.locationName}
          </span>
          {currentStep.destinationName && (
            <span className="text-stone-500 truncate">
              → {currentStep.destinationName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {currentStep.encounterName && (
            <span className="text-red-400 text-xs font-semibold px-2 py-0.5 bg-red-900/30 rounded-lg truncate max-w-40">
              {currentStep.isBlocking ? '🚧 ' : '⚔️ '}{currentStep.encounterName}
            </span>
          )}
          <span className="text-stone-500 text-xs">
            {STEP_TYPE_LABELS[currentStep.type] ?? currentStep.type}
          </span>
        </div>
      </div>

      {/* Quest / Milestones expandable panel */}
      {questObjective && (
        <div className="border-b border-stone-700/50 shrink-0">
          <button
            onClick={() => setQuestPanelOpen(!questPanelOpen)}
            className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-blue-300 hover:bg-stone-800/80 transition-colors"
          >
            <span className="font-semibold uppercase tracking-widest">
              📜 {questObjective}
            </span>
            <span className="text-stone-500">
              {questPanelOpen ? '▲' : '▼'}
            </span>
          </button>
          {questPanelOpen && (
            <div className="px-4 pb-2 space-y-1">
              {activeMilestone && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-amber-400">▸</span>
                  <span className="text-amber-300">{activeMilestone}</span>
                  <span className="text-stone-500">(active)</span>
                </div>
              )}
              {completedMilestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-green-400">✓</span>
                  <span className="text-stone-400 line-through">{m}</span>
                </div>
              ))}
              {completedMilestones.length === 0 && !activeMilestone && (
                <div className="text-xs text-stone-500 italic">No milestones yet</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full-screen narrative log — shows current step's entries */}
      <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-4 text-sm space-y-1.5">
        {stepEntries.length === 0 ? (
          <p className="text-stone-500 italic">No events at this step.</p>
        ) : (
          stepEntries.map((entry, i) => <NarrativeLogEntry key={`${entry.day}-${entry.hour}-${entry.level}-${i}`} entry={entry} />)
        )}
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-stone-700 shrink-0 gap-2">
        {/* Verbosity toggle */}
        <div className="flex gap-1 shrink-0">
          {NARRATIVE_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setVerbosity(level)}
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
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevDay}
            disabled={stepIndex === 0}
            className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-stone-700 text-stone-300 hover:bg-stone-600"
            title="Previous Day"
          >
            ⏪
          </button>
          <button
            onClick={handlePrevStep}
            disabled={stepIndex === 0}
            className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-stone-700 text-stone-300 hover:bg-stone-600"
            title="Previous Step"
          >
            ◀
          </button>
          <button
            onClick={handleNextStep}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-amber-700 hover:bg-amber-600 text-stone-100"
            title={isLastStep ? 'View Results' : 'Next Step'}
          >
            {isLastStep ? 'Results' : '▶'}
          </button>
          <button
            onClick={handleNextDay}
            disabled={isLastStep}
            className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-stone-700 text-stone-300 hover:bg-stone-600"
            title="Next Day"
          >
            ⏩
          </button>
          {!isLastStep && (
            <button
              onClick={() => onComplete(buildResult(snapshots, heroPaths))}
              className="ml-1 text-xs text-stone-500 hover:text-stone-300 transition-colors inline-flex items-center gap-1"
              title="Skip to results"
            >
              <SkipIcon size={12} /> Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Legacy day-based Story View (fallback when no steps) ────────────────────

function ImmersiveStoryViewLegacy({ snapshots, prevSnapshots = [], narrativeLog = [], heroPaths, onComplete }: BattleScreenProps) {
  const [dayIndex, setDayIndex] = useState(0);
  const [verbosity, setVerbosity] = useState<NarrativeLevel>(2);
  const logRef = useRef<HTMLDivElement | null>(null);

  const totalDays = snapshots.length;
  const currentDay = dayIndex + 1;
  const current = snapshots[dayIndex] ?? snapshots[0];
  const prevSnap = prevSnapshots[dayIndex];
  const isLastDay = dayIndex >= totalDays - 1;

  // Show only current day's entries filtered by verbosity
  const dayEntries = narrativeLog.filter(e => e.level <= verbosity && e.day === currentDay);

  // Scroll log to top whenever the day changes
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [dayIndex]);

  function handleNext() {
    if (isLastDay) {
      onComplete(buildResult(snapshots, heroPaths));
    } else {
      setDayIndex(prev => prev + 1);
    }
  }

  const score = current.score;
  const delta = prevSnap !== undefined ? score - prevSnap.score : null;

  return (
    <div className="flex flex-col h-screen bg-stone-900 text-stone-100 overflow-hidden">
      {/* Thin top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-700 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-amber-400 font-bold text-sm">{score.toLocaleString()} pts</span>
          {delta !== null && delta !== 0 && (
            <span className={`text-xs font-bold ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {delta > 0 ? '▲' : '▼'}
            </span>
          )}
        </div>
        <span className="text-stone-400 text-sm">Day {currentDay}</span>
      </div>

      {/* Full-screen narrative log — shows only current day */}
      <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-4 text-sm space-y-1.5">
        {dayEntries.length === 0 ? (
          <p className="text-stone-500 italic">No events recorded for this day.</p>
        ) : (
          dayEntries.map((entry, i) => <NarrativeLogEntry key={`${entry.day}-${entry.hour}-${entry.level}-${i}`} entry={entry} />)
        )}
      </div>

      {/* Bottom controls: verbosity + skip/Next/Results button */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-stone-700 shrink-0 gap-3">
        <div className="flex gap-1">
          {NARRATIVE_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setVerbosity(level)}
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
        </div>
        <div className="flex items-center gap-2">
          {!isLastDay && (
            <button
              onClick={() => onComplete(buildResult(snapshots, heroPaths))}
              className="text-xs text-stone-500 hover:text-stone-300 transition-colors inline-flex items-center gap-1"
              title="Skip to results"
            >
              <SkipIcon size={12} /> Skip to Results
            </button>
          )}
          <button
            onClick={handleNext}
            className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-stone-100 font-bold text-sm transition-colors"
          >
            {isLastDay ? 'View Results' : 'Next Day →'}
          </button>
        </div>
      </div>
    </div>
  );
}
