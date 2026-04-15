/**
 * Adventure Data Loader — loads pre-compiled adventure template data from JSON.
 *
 * At build time, `scripts/compile-game-data.js` reads the adventure BRL files
 * and produces `public/game-data/adventure-data.json`.  This module fetches that
 * pre-compiled JSON at runtime, avoiding any BRL parsing in the browser.
 */

// ── Exported types (mirrors the interfaces in adventureQuest.ts) ─────────────

export interface ObjectiveTemplate {
  objectiveId: string;
  category: string;
  title: string;
  description: string;
  winCondition: string;
  /** Comma-separated slot names parsed into an array. */
  requiredSlots: string[];
  /** Comma-separated milestone categories parsed into an array. */
  milestoneCategories: string[];
}

export interface MilestoneTemplate {
  milestoneId: string;
  category: string;
  title: string;
  description: string;
  completionType: string;
  completionKey: string;
  bailoutDay: number;
  bailoutDescription: string;
  /** Comma-separated objective categories parsed into an array. */
  compatibleObjectives: string[];
  eventSlots: number;
}

export interface EventTemplate {
  eventId: string;
  category: string;
  title: string;
  description: string;
  triggerType: string;
  triggerLocation: string;
  isKeyEvent: boolean;
  rewardType: string;
  narrativeOnTrigger: string;
  narrativeOnComplete: string;
  difficultyModifier: number;
}

export interface HeroEncounterTemplate {
  encounterId: string;
  category: string;
  title: string;
  description: string;
  preferredClass: string;
  traitAxis: string;
  traitPolarity: string;
  triggerType: string;
  triggerLocation: string;
  isKeyEvent: boolean;
  buffType: string;
  buffAmount: number;
  narrativeOnMatch: string;
  narrativeOnComplete: string;
  difficultyModifier: number;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface AdventureDataSet {
  objectives: ObjectiveTemplate[];
  milestones: MilestoneTemplate[];
  events: EventTemplate[];
  heroEncounters: HeroEncounterTemplate[];
}

let adventureDataCache: AdventureDataSet | null = null;
let fetchPromise: Promise<AdventureDataSet> | null = null;

/**
 * Load all adventure template data from the pre-compiled JSON file.
 * Returns cached results on subsequent calls.
 */
export async function loadAdventureData(): Promise<AdventureDataSet> {
  if (adventureDataCache) return adventureDataCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ?? '/';
      const url = `${base}game-data/adventure-data.json`.replace('//', '/');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch adventure-data.json: ${res.status}`);
      const data: AdventureDataSet = await res.json();
      adventureDataCache = data;
      return data;
    } catch (err) {
      console.error(
        'Failed to load adventure data from adventure-data.json. Quest generation will not work until this is resolved.',
        err,
      );
      adventureDataCache = {
        objectives: [],
        milestones: [],
        events: [],
        heroEncounters: [],
      };
      return adventureDataCache;
    }
  })();

  return fetchPromise;
}

/**
 * Synchronous access to cached adventure data.
 * Returns null if not yet loaded — call loadAdventureData() first.
 */
export function getAdventureData(): AdventureDataSet | null {
  return adventureDataCache;
}
