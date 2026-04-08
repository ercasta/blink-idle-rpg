/**
 * IndexedDB-backed persistence for run results.
 * Migrates data from the old localStorage key on first access.
 */

import type { RunResult } from '../types';

const DB_NAME = 'blink-rpg';
const DB_VERSION = 1;
const STORE_NAME = 'data';
const RUNS_KEY = 'recent-runs';
const MAX_SAVED_RUNS = 10;
const LEGACY_LS_KEY = 'blink-rpg-scores';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) return;
    const runs = JSON.parse(raw) as RunResult[];
    if (!Array.isArray(runs) || runs.length === 0) {
      localStorage.removeItem(LEGACY_LS_KEY);
      return;
    }
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(runs.slice(0, MAX_SAVED_RUNS), RUNS_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    localStorage.removeItem(LEGACY_LS_KEY);
  } catch (err) {
    console.error('[runStorage] Migration from localStorage failed:', err);
    /* ignore migration errors */
  }
}

export async function loadRecentRuns(): Promise<RunResult[]> {
  try {
    const db = await openDB();
    await migrateFromLocalStorage(db);
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(RUNS_KEY);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('[runStorage] loadRecentRuns failed:', err);
    return [];
  }
}

export async function saveRun(result: RunResult): Promise<RunResult[]> {
  try {
    const existing = await loadRecentRuns();
    const updated = [result, ...existing].slice(0, MAX_SAVED_RUNS);
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(updated, RUNS_KEY);
      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => resolve(updated);
    });
  } catch (err) {
    console.error('[runStorage] saveRun failed:', err);
    return [];
  }
}
