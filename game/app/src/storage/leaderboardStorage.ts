/**
 * IndexedDB-backed persistence for per-adventure leaderboards.
 * Each adventure leaderboard is stored as a single record in the 'leaderboard' object store.
 * A leaderboard holds at most 10 entries, sorted by score descending.
 */

import { openDB, LEADERBOARD_STORE } from './db';
import type { AdventureLeaderboard, LeaderboardEntry, RunResult } from '../types';

export const LEADERBOARD_MAX_SIZE = 10;

export async function loadLeaderboard(adventureId: string): Promise<AdventureLeaderboard> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(LEADERBOARD_STORE, 'readonly');
      const req = tx.objectStore(LEADERBOARD_STORE).get(adventureId);
      req.onsuccess = () => {
        resolve(req.result ?? { adventureId, entries: [] });
      };
      req.onerror = () => resolve({ adventureId, entries: [] });
    });
  } catch (err) {
    console.error('[leaderboardStorage] loadLeaderboard failed:', err);
    return { adventureId, entries: [] };
  }
}

export async function loadAllLeaderboards(): Promise<AdventureLeaderboard[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(LEADERBOARD_STORE, 'readonly');
      const req = tx.objectStore(LEADERBOARD_STORE).getAll();
      req.onsuccess = () => resolve(req.result as AdventureLeaderboard[]);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('[leaderboardStorage] loadAllLeaderboards failed:', err);
    return [];
  }
}

export interface LeaderboardUpdateResult {
  /** 1-based position in the leaderboard, or null if outside top 10. */
  position: number | null;
  /** True if this run has a strictly higher score than any previous run on this adventure. */
  isNewBest: boolean;
  /** The updated leaderboard after inserting this run. */
  leaderboard: AdventureLeaderboard;
}

/**
 * Add a completed run to the adventure's leaderboard.
 * Keeps at most LEADERBOARD_MAX_SIZE entries, sorted by score descending.
 * Returns the run's final position and whether it is a new best score.
 */
export async function updateLeaderboard(run: RunResult): Promise<LeaderboardUpdateResult> {
  const adventureId = run.adventure?.id;
  if (!adventureId || !run.id) {
    return { position: null, isNewBest: false, leaderboard: { adventureId: adventureId ?? '', entries: [] } };
  }

  const existing = await loadLeaderboard(adventureId);
  const previousBestScore = existing.entries.length > 0 ? existing.entries[0].score : -Infinity;
  const isNewBest = run.finalScore > previousBestScore;

  const newEntry: LeaderboardEntry = {
    runId: run.id,
    score: run.finalScore,
    timestamp: run.timestamp ?? Date.now(),
    heroNames: run.heroes?.map(h => h.name) ?? [],
    victory: run.victory,
    runType: run.adventure?.runType ?? 'fight',
  };

  // Merge with existing entries (replace same runId if already present)
  const merged = [
    newEntry,
    ...existing.entries.filter(e => e.runId !== run.id),
  ];

  // Sort descending by score, then by timestamp descending (newer wins ties)
  merged.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);

  // Keep only the top N
  const entries = merged.slice(0, LEADERBOARD_MAX_SIZE);

  const position = entries.findIndex(e => e.runId === run.id);

  const leaderboard: AdventureLeaderboard = { adventureId, entries };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LEADERBOARD_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(LEADERBOARD_STORE).put(leaderboard);
    });
  } catch (err) {
    console.error('[leaderboardStorage] updateLeaderboard failed:', err);
  }

  return {
    position: position >= 0 ? position + 1 : null,
    isNewBest,
    leaderboard,
  };
}
