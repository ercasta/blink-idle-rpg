/**
 * IndexedDB-backed persistence for the player's hero roster.
 */

import { openDB, DATA_STORE } from './db';
import type { HeroDefinition } from '../types';

const ROSTER_KEY = 'hero-roster';

export async function loadRoster(): Promise<HeroDefinition[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DATA_STORE, 'readonly');
      const req = tx.objectStore(DATA_STORE).get(ROSTER_KEY);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('[rosterStorage] loadRoster failed:', err);
    return [];
  }
}

export async function saveRoster(roster: HeroDefinition[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DATA_STORE, 'readwrite');
      tx.objectStore(DATA_STORE).put(roster, ROSTER_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[rosterStorage] saveRoster failed:', err);
  }
}
