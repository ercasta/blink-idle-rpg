/**
 * IndexedDB-backed persistence for the player's adventure list.
 */

import { openDB, DATA_STORE } from './db';
import type { AdventureDefinition } from '../types';

const ADVENTURE_KEY = 'adventures';

export async function loadAdventures(): Promise<AdventureDefinition[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DATA_STORE, 'readonly');
      const req = tx.objectStore(DATA_STORE).get(ADVENTURE_KEY);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('[adventureStorage] loadAdventures failed:', err);
    return [];
  }
}

export async function saveAdventures(adventures: AdventureDefinition[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DATA_STORE, 'readwrite');
      tx.objectStore(DATA_STORE).put(adventures, ADVENTURE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[adventureStorage] saveAdventures failed:', err);
  }
}
