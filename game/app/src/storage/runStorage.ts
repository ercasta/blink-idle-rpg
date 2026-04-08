/**
 * IndexedDB-backed persistence for run results.
 * Each run is stored as an individual record in the 'runs' object store.
 * Migrates legacy data from v1 'data' store automatically (via db.ts).
 */

import { openDB, RUNS_STORE } from './db';
import type { RunResult } from '../types';

export async function saveRun(run: RunResult): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RUNS_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(RUNS_STORE).put(run);
    });
  } catch (err) {
    console.error('[runStorage] saveRun failed:', err);
  }
}

export async function loadAllRuns(): Promise<RunResult[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(RUNS_STORE, 'readonly');
      const req = tx.objectStore(RUNS_STORE).getAll();
      req.onsuccess = () => {
        const runs = (req.result as RunResult[]).sort(
          (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0),
        );
        resolve(runs);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('[runStorage] loadAllRuns failed:', err);
    return [];
  }
}

export async function loadRecentRuns(limit = 10): Promise<RunResult[]> {
  const all = await loadAllRuns();
  return all.slice(0, limit);
}

export async function toggleFavorite(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RUNS_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(RUNS_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const run = getReq.result as RunResult | undefined;
        if (run) {
          store.put({ ...run, favorited: !run.favorited });
        }
      };
    });
  } catch (err) {
    console.error('[runStorage] toggleFavorite failed:', err);
  }
}

export async function deleteRun(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RUNS_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(RUNS_STORE).delete(id);
    });
  } catch (err) {
    console.error('[runStorage] deleteRun failed:', err);
  }
}

/** Import a run from an external file; overwrites any existing run with the same id. */
export async function importRun(run: RunResult): Promise<void> {
  if (!run.id) {
    throw new Error('Imported run is missing an id field.');
  }
  return saveRun(run);
}

