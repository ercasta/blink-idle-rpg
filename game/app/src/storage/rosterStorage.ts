/**
 * IndexedDB-backed persistence for the player's hero roster.
 */

import type { HeroDefinition } from '../types';

const DB_NAME = 'blink-rpg';
const DB_VERSION = 1;
const STORE_NAME = 'data';
const ROSTER_KEY = 'hero-roster';

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

export async function loadRoster(): Promise<HeroDefinition[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(ROSTER_KEY);
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
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(roster, ROSTER_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.error('[rosterStorage] saveRoster failed:', err);
  }
}
