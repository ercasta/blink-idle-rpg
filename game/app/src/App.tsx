/**
 * Blink Idle RPG — main app entry point.
 *
 * Simple state-machine router: no URL routing needed for v1.
 *
 * Flow:
 *   home → mode-select → party-select → (simulation) → battle → results
 */

import { useState, useCallback, useEffect } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ModeSelectScreen } from './screens/ModeSelectScreen';
import { PartySelectScreen } from './screens/PartySelectScreen';
import { BattleScreen } from './screens/BattleScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { runSimulation } from './engine/WasmSimEngine';
import { GAME_MODES } from './data/gameModes';
import type { AppScreen, GameMode, HeroDefinition, GameSnapshot, RunResult } from './types';

const SCORES_KEY = 'blink-rpg-scores';
const MAX_SAVED_RUNS = 10;

function loadRecentRuns(): RunResult[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    return raw ? (JSON.parse(raw) as RunResult[]) : [];
  } catch {
    return [];
  }
}

function saveRun(result: RunResult): RunResult[] {
  const runs = loadRecentRuns();
  const updated = [result, ...runs].slice(0, MAX_SAVED_RUNS);
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(updated));
  } catch {
    /* ignore quota errors */
  }
  return updated;
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen | 'loading' | 'error'>('home');
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [selectedHeroes, setSelectedHeroes] = useState<HeroDefinition[]>([]);
  const [snapshots, setSnapshots] = useState<GameSnapshot[]>([]);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunResult[]>([]);
  const [loadingMessage] = useState('Running simulation…');
  const [error, setError] = useState<string | null>(null);

  // Load recent runs from localStorage on first mount
  useEffect(() => {
    setRecentRuns(loadRecentRuns());
  }, []);

  // ── Navigation helpers ──────────────────────────────────────────────────

  function goHome() {
    setScreen('home');
    setError(null);
  }

  function startRun() {
    setScreen('mode-select');
  }

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

      const snaps = await runSimulation(heroes, selectedMode);
      setSnapshots(snaps);
      setScreen('battle');
    } catch (e) {
      console.error('[App] Simulation error:', e);
      setError(e instanceof Error ? e.message : String(e));
      setScreen('error');
    }
  }, [selectedMode]);

  const onBattleComplete = useCallback((result: RunResult) => {
    setRunResult(result);
    const updated = saveRun(result);
    setRecentRuns(updated);
    setScreen('results');
  }, []);

  function playAgain() {
    setScreen('mode-select');
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (screen === 'home') {
    return <HomeScreen recentRuns={recentRuns} onStart={startRun} />;
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
