/**
 * Blink Idle RPG — main app entry point.
 *
 * Simple state-machine router: no URL routing needed for v1.
 *
 * Flow:
 *   home → roster (hero management)
 *   home → mode-select → party-select → (simulation) → battle → results
 *   home → (quick play: random party + normal mode) → battle → results
 *   results → rerun (same heroes + same mode, skip selection)
 */

import { useState, useCallback, useEffect } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ModeSelectScreen } from './screens/ModeSelectScreen';
import { PartySelectScreen } from './screens/PartySelectScreen';
import { RosterScreen } from './screens/RosterScreen';
import { BattleScreen } from './screens/BattleScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { runSimulation } from './engine/WasmSimEngine';
import { generateRandomParty } from './data/heroes';
import { GAME_MODES } from './data/gameModes';
import { loadRecentRuns, saveRun } from './storage/runStorage';
import { loadRoster, saveRoster } from './storage/rosterStorage';
import type { AppScreen, GameMode, HeroDefinition, GameSnapshot, RunResult, HeroPath } from './types';

export default function App() {
  const [screen, setScreen] = useState<AppScreen | 'loading' | 'error'>('home');
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [selectedHeroes, setSelectedHeroes] = useState<HeroDefinition[]>([]);
  const [roster, setRoster] = useState<HeroDefinition[]>([]);
  const [snapshots, setSnapshots] = useState<GameSnapshot[]>([]);
  const [prevSnapshots, setPrevSnapshots] = useState<GameSnapshot[]>([]);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunResult[]>([]);
  const [heroPaths, setHeroPaths] = useState<HeroPath[]>([]);
  const [loadingMessage] = useState('Running simulation…');
  const [error, setError] = useState<string | null>(null);

  // Load recent runs and roster from IndexedDB on first mount
  useEffect(() => {
    loadRecentRuns().then(setRecentRuns);
    loadRoster().then(setRoster);
  }, []);

  // ── Roster helpers ──────────────────────────────────────────────────────

  function handleRosterChange(newRoster: HeroDefinition[]) {
    setRoster(newRoster);
    saveRoster(newRoster);
  }

  // ── Navigation helpers ──────────────────────────────────────────────────

  function goHome() {
    setScreen('home');
    setError(null);
  }

  function startRun() {
    setScreen('mode-select');
  }

  const quickPlay = useCallback(async () => {
    const randomHeroes = generateRandomParty();
    setSelectedHeroes(randomHeroes);
    setSelectedMode('normal');
    setScreen('loading');
    setError(null);

    try {
      const runs = await loadRecentRuns();
      setPrevSnapshots(runs[0]?.snapshots ?? []);
      const result = await runSimulation(randomHeroes, 'normal');
      setSnapshots(result.snapshots);
      setHeroPaths(result.heroPaths);
      setScreen('battle');
    } catch (e) {
      console.error('[App] Quick play simulation error:', e);
      setError(e instanceof Error ? e.message : String(e));
      setScreen('error');
    }
  }, []);

  function onModeSelected(mode: GameMode) {
    setSelectedMode(mode);
    setScreen('party-select');
  }

  const onPartySelected = useCallback(async (heroes: HeroDefinition[]) => {
    setSelectedHeroes(heroes);
    setScreen('loading');
    setError(null);

    try {
      const modeDef = GAME_MODES.find(m => m.id === selectedMode);
      if (!modeDef) throw new Error(`Unknown mode: ${selectedMode}`);

      const runs = await loadRecentRuns();
      setPrevSnapshots(runs[0]?.snapshots ?? []);
      const result = await runSimulation(heroes, selectedMode);
      setSnapshots(result.snapshots);
      setHeroPaths(result.heroPaths);
      setScreen('battle');
    } catch (e) {
      console.error('[App] Simulation error:', e);
      setError(e instanceof Error ? e.message : String(e));
      setScreen('error');
    }
  }, [selectedMode]);

  const onBattleComplete = useCallback(async (result: RunResult) => {
    setRunResult(result);
    const updated = await saveRun(result);
    setRecentRuns(updated);
    setScreen('results');
  }, []);

  function playAgain() {
    setScreen('mode-select');
  }

  const rerun = useCallback(async () => {
    if (selectedHeroes.length === 0) {
      setScreen('mode-select');
      return;
    }
    setScreen('loading');
    setError(null);

    try {
      const runs = await loadRecentRuns();
      setPrevSnapshots(runs[0]?.snapshots ?? []);
      const result = await runSimulation(selectedHeroes, selectedMode);
      setSnapshots(result.snapshots);
      setHeroPaths(result.heroPaths);
      setScreen('battle');
    } catch (e) {
      console.error('[App] Rerun simulation error:', e);
      setError(e instanceof Error ? e.message : String(e));
      setScreen('error');
    }
  }, [selectedHeroes, selectedMode]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (screen === 'home') {
    return (
      <HomeScreen
        recentRuns={recentRuns}
        onStart={startRun}
        onQuickPlay={quickPlay}
        onManageRoster={() => setScreen('roster')}
      />
    );
  }

  if (screen === 'roster') {
    return (
      <RosterScreen
        roster={roster}
        onRosterChange={handleRosterChange}
        onBack={goHome}
      />
    );
  }

  if (screen === 'mode-select') {
    return <ModeSelectScreen onSelect={onModeSelected} onBack={goHome} />;
  }

  if (screen === 'party-select') {
    return (
      <PartySelectScreen
        roster={roster}
        onStart={onPartySelected}
        onBack={() => setScreen('mode-select')}
        onManageRoster={() => setScreen('roster')}
      />
    );
  }

  if (screen === 'loading') {
    return <LoadingScreen message={loadingMessage} />;
  }

  if (screen === 'battle') {
    return (
      <BattleScreen
        snapshots={snapshots}
        prevSnapshots={prevSnapshots}
        heroes={selectedHeroes}
        heroPaths={heroPaths}
        onComplete={onBattleComplete}
      />
    );
  }

  if (screen === 'results' && runResult) {
    return (
      <ResultsScreen
        result={runResult}
        onPlayAgain={playAgain}
        onRerun={rerun}
        onHome={goHome}
      />
    );
  }

  if (screen === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white gap-4 px-6">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-xl font-bold text-red-400">Simulation Error</h1>
        <p className="text-slate-400 text-sm text-center">{error ?? 'An unknown error occurred.'}</p>
        <button
          onClick={goHome}
          className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold mt-2"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Fallback
  return <LoadingScreen />;
}
