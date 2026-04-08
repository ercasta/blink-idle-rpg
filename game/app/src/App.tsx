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
 *   home / results → run-history (view/manage all saved runs)
 *   run-history → replay (watch battle animation for a past run)
 *
 *   ?heroName=…&heroClass=…&pm=…  → roster (create with shared hero pre-loaded)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ModeSelectScreen } from './screens/ModeSelectScreen';
import { PartySelectScreen } from './screens/PartySelectScreen';
import { RosterScreen } from './screens/RosterScreen';
import { BattleScreen } from './screens/BattleScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { RunHistoryScreen } from './screens/RunHistoryScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { runSimulation } from './engine/WasmSimEngine';
import { generateRandomParty } from './data/heroes';
import { GAME_MODES } from './data/gameModes';
import { loadAllRuns, saveRun, toggleFavorite, deleteRun, importRun } from './storage/runStorage';
import { loadRoster, saveRoster } from './storage/rosterStorage';
import { decodeHeroFromParams } from './data/heroDescription';
import type { SharedHeroData } from './data/heroDescription';
import type { AppScreen, GameMode, HeroDefinition, GameSnapshot, RunResult, HeroPath } from './types';

export default function App() {
  const [screen, setScreen] = useState<AppScreen | 'loading' | 'error'>(() => {
    // If URL has a shared hero, start directly on roster
    const params = new URLSearchParams(window.location.search);
    if (decodeHeroFromParams(params)) return 'roster';
    return 'home';
  });
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [selectedHeroes, setSelectedHeroes] = useState<HeroDefinition[]>([]);
  const [roster, setRoster] = useState<HeroDefinition[]>([]);
  const [snapshots, setSnapshots] = useState<GameSnapshot[]>([]);
  const [prevSnapshots, setPrevSnapshots] = useState<GameSnapshot[]>([]);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [allRuns, setAllRuns] = useState<RunResult[]>([]);
  const [heroPaths, setHeroPaths] = useState<HeroPath[]>([]);
  const [loadingMessage] = useState('Running simulation…');
  const [error, setError] = useState<string | null>(null);
  // Shared hero decoded from URL params (consumed once roster opens)
  const [sharedHero] = useState<SharedHeroData | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return decodeHeroFromParams(params);
  });

  // Track whether the current battle is a replay of a saved run (no re-save on complete)
  const replayingRunRef = useRef<RunResult | null>(null);

  // Load all runs and roster from IndexedDB on first mount
  useEffect(() => {
    loadAllRuns().then(setAllRuns);
    loadRoster().then(setRoster);
    // Clear the share params from the URL without reloading
    if (sharedHero) {
      const url = window.location.origin + window.location.pathname;
      window.history.replaceState({}, '', url);
    }
  }, [sharedHero]);

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
    replayingRunRef.current = null;
    setScreen('loading');
    setError(null);

    try {
      const runs = await loadAllRuns();
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
    replayingRunRef.current = null;
    setScreen('loading');
    setError(null);

    try {
      const modeDef = GAME_MODES.find(m => m.id === selectedMode);
      if (!modeDef) throw new Error(`Unknown mode: ${selectedMode}`);

      const runs = await loadAllRuns();
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
    // If this was a replay, show the original saved run in results (no re-save)
    if (replayingRunRef.current) {
      setRunResult(replayingRunRef.current);
      replayingRunRef.current = null;
      setScreen('results');
      return;
    }

    const enrichedResult: RunResult = {
      ...result,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      favorited: false,
      heroes: selectedHeroes,
      mode: selectedMode,
    };
    setRunResult(enrichedResult);
    await saveRun(enrichedResult);
    loadAllRuns().then(setAllRuns);
    setScreen('results');
  }, [selectedHeroes, selectedMode]);

  function playAgain() {
    setScreen('mode-select');
  }

  const rerun = useCallback(async () => {
    if (selectedHeroes.length === 0) {
      setScreen('mode-select');
      return;
    }
    replayingRunRef.current = null;
    setScreen('loading');
    setError(null);

    try {
      const runs = await loadAllRuns();
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

  // ── Run history helpers ─────────────────────────────────────────────────

  function handleReplayRun(run: RunResult) {
    replayingRunRef.current = run;
    setSnapshots(run.snapshots);
    setHeroPaths(run.heroPaths);
    setSelectedHeroes(run.heroes ?? []);
    setSelectedMode(run.mode ?? 'normal');
    setPrevSnapshots([]);
    setScreen('battle');
  }

  async function handleToggleFavorite(id: string) {
    await toggleFavorite(id);
    const updated = await loadAllRuns();
    setAllRuns(updated);
    // Keep the results screen in sync if the same run is shown
    if (runResult?.id === id) {
      const updatedRun = updated.find(r => r.id === id);
      if (updatedRun) setRunResult(updatedRun);
    }
  }

  async function handleDeleteRun(id: string) {
    await deleteRun(id);
    loadAllRuns().then(setAllRuns);
  }

  async function handleImportRun(run: RunResult) {
    try {
      await importRun(run);
      loadAllRuns().then(setAllRuns);
    } catch (e) {
      console.error('[App] Import run failed:', e);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (screen === 'home') {
    return (
      <HomeScreen
        recentRuns={allRuns.slice(0, 3)}
        onStart={startRun}
        onQuickPlay={quickPlay}
        onManageRoster={() => setScreen('roster')}
        onViewHistory={() => setScreen('run-history')}
        onReplayRun={handleReplayRun}
      />
    );
  }

  if (screen === 'roster') {
    return (
      <RosterScreen
        roster={roster}
        onRosterChange={handleRosterChange}
        onBack={goHome}
        sharedHero={sharedHero}
      />
    );
  }

  if (screen === 'run-history') {
    return (
      <RunHistoryScreen
        runs={allRuns}
        onBack={goHome}
        onReplayRun={handleReplayRun}
        onToggleFavorite={handleToggleFavorite}
        onDeleteRun={handleDeleteRun}
        onImportRun={handleImportRun}
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
        onToggleFavorite={runResult.id ? handleToggleFavorite : undefined}
      />
    );
  }

  if (screen === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 text-stone-100 gap-4 px-6">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-xl font-bold text-amber-500">Simulation Error</h1>
        <p className="text-stone-400 text-sm text-center">{error ?? 'An unknown error occurred.'}</p>
        <button
          onClick={goHome}
          className="px-6 py-3 bg-amber-700 hover:bg-amber-600 rounded-xl font-bold mt-2 text-stone-100"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Fallback
  return <LoadingScreen />;
}
