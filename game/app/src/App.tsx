/**
 * Blink Idle RPG — main app entry point.
 *
 * Simple state-machine router: no URL routing needed for v1.
 *
 * Flow:
 *   home → mode-select → party-select → (simulation) → battle → results
 *   home → (quick play: random party + normal mode) → battle → results
 */

import { useState, useCallback, useEffect } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ModeSelectScreen } from './screens/ModeSelectScreen';
import { PartySelectScreen } from './screens/PartySelectScreen';
import { BattleScreen } from './screens/BattleScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { runSimulation } from './engine/WasmSimEngine';
import { generateRandomParty } from './data/heroes';
import { GAME_MODES } from './data/gameModes';
import { loadRecentRuns, saveRun } from './storage/runStorage';
import type { AppScreen, GameMode, HeroDefinition, GameSnapshot, RunResult } from './types';

export default function App() {
  const [screen, setScreen] = useState<AppScreen | 'loading' | 'error'>('home');
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [selectedHeroes, setSelectedHeroes] = useState<HeroDefinition[]>([]);
  const [snapshots, setSnapshots] = useState<GameSnapshot[]>([]);
  const [prevSnapshots, setPrevSnapshots] = useState<GameSnapshot[]>([]);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunResult[]>([]);
  const [loadingMessage] = useState('Running simulation…');
  const [error, setError] = useState<string | null>(null);

  // Load recent runs from IndexedDB on first mount
  useEffect(() => {
    loadRecentRuns().then(setRecentRuns);
  }, []);

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
      const snaps = await runSimulation(randomHeroes, 'normal');
      setSnapshots(snaps);
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
      const snaps = await runSimulation(heroes, selectedMode);
      setSnapshots(snaps);
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

  // ── Render ──────────────────────────────────────────────────────────────

  if (screen === 'home') {
    return <HomeScreen recentRuns={recentRuns} onStart={startRun} onQuickPlay={quickPlay} />;
  }

  if (screen === 'mode-select') {
    return <ModeSelectScreen onSelect={onModeSelected} onBack={goHome} />;
  }

  if (screen === 'party-select') {
    return (
      <PartySelectScreen
        onStart={onPartySelected}
        onBack={() => setScreen('mode-select')}
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
        onComplete={onBattleComplete}
      />
    );
  }

  if (screen === 'results' && runResult) {
    return (
      <ResultsScreen
        result={runResult}
        onPlayAgain={playAgain}
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
