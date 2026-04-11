/**
 * Shared IndexedDB connection for the Blink Idle RPG app.
 *
 * DB version history:
 *   v1 – single 'data' key-value store (roster + runs bundled under one key)
 *   v2 – adds 'runs' object store (keyPath: 'id') for individual run records;
 *         migrates the old 'recent-runs' array from the 'data' store.
 *   v3 – adds 'leaderboard' object store (keyPath: 'adventureId') for per-adventure leaderboards.
 */

export const DB_NAME = 'blink-rpg';
export const DB_VERSION = 3;
export const DATA_STORE = 'data';
export const RUNS_STORE = 'runs';
export const LEADERBOARD_STORE = 'leaderboard';

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = req.transaction!;

      // Ensure the legacy key-value store exists
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE);
      }

      // Create the new per-run store
      if (!db.objectStoreNames.contains(RUNS_STORE)) {
        db.createObjectStore(RUNS_STORE, { keyPath: 'id' });

        // Migrate runs from v1 'recent-runs' entry
        if ((event as IDBVersionChangeEvent).oldVersion === 1) {
          const dataStore = tx.objectStore(DATA_STORE);
          const getReq = dataStore.get('recent-runs');
          getReq.onsuccess = () => {
            const oldRuns = getReq.result;
            if (Array.isArray(oldRuns)) {
              const runsStore = tx.objectStore(RUNS_STORE);
              const now = Date.now();
              oldRuns.forEach((run: Record<string, unknown>, i: number) => {
                runsStore.put({
                  ...run,
                  id: `legacy-${now}-${i}`,
                  timestamp: now - (oldRuns.length - i) * 60_000,
                  favorited: false,
                  heroes: [],
                  mode: 'normal',
                });
              });
            }
          };
        }
      }

      // Create the leaderboard store (v3+)
      if (!db.objectStoreNames.contains(LEADERBOARD_STORE)) {
        db.createObjectStore(LEADERBOARD_STORE, { keyPath: 'adventureId' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
