/**
 * World Data Loader — parses world data from the canonical BRL source.
 *
 * Loads and parses `story-world-data.brl` to extract WorldLocation, WorldPath,
 * WorldNpc, HeroArrivalComment, and BlockingEncounter entities.
 *
 * This is the BRL→TypeScript bridge for the persistent world system.
 * After calling `loadWorldData()`, the same data that was previously hardcoded
 * in worldData.ts is now loaded from the BRL file at runtime.
 */

import {
  parseEntities,
  getComponent,
  extractStringField,
  extractNumberField,
  extractBoolField,
  fetchBrlFile,
} from './brlParser';

import type {
  WorldLocation,
  WorldPath,
  WorldNpc,
  HeroArrivalComment,
  BlockingEncounter,
} from './worldData';

// ── Parsing functions ───────────────────────────────────────────────────────

function parseWorldLocations(text: string): WorldLocation[] {
  const entities = parseEntities(text);
  const locations: WorldLocation[] = [];

  for (const entity of entities) {
    const comp = getComponent(entity, 'WorldLocation');
    if (!comp) continue;

    locations.push({
      locationId: extractStringField(comp.body, 'locationId'),
      name: extractStringField(comp.body, 'name'),
      locationType: extractStringField(comp.body, 'locationType') as WorldLocation['locationType'],
      region: extractStringField(comp.body, 'region'),
      description: extractStringField(comp.body, 'description'),
      elementalAffinity: extractStringField(comp.body, 'elementalAffinity'),
      dangerLevel: extractNumberField(comp.body, 'dangerLevel') ?? 1,
      tags: extractStringField(comp.body, 'tags'),
    });
  }

  return locations;
}

function parseWorldPaths(text: string): WorldPath[] {
  const entities = parseEntities(text);
  const paths: WorldPath[] = [];

  for (const entity of entities) {
    const comp = getComponent(entity, 'WorldPath');
    if (!comp) continue;

    paths.push({
      pathId: extractStringField(comp.body, 'pathId'),
      fromLocationId: extractStringField(comp.body, 'fromLocationId'),
      toLocationId: extractStringField(comp.body, 'toLocationId'),
      pathType: extractStringField(comp.body, 'pathType'),
      travelHours: extractNumberField(comp.body, 'travelHours') ?? 3,
      dangerRating: extractNumberField(comp.body, 'dangerRating') ?? 1,
      description: extractStringField(comp.body, 'description'),
      encounterTags: extractStringField(comp.body, 'encounterTags'),
      bidirectional: extractBoolField(comp.body, 'bidirectional') ?? true,
    });
  }

  return paths;
}

function parseWorldNpcs(text: string): WorldNpc[] {
  const entities = parseEntities(text);
  const npcs: WorldNpc[] = [];

  for (const entity of entities) {
    const comp = getComponent(entity, 'WorldNpc');
    if (!comp) continue;

    npcs.push({
      npcId: extractStringField(comp.body, 'npcId'),
      name: extractStringField(comp.body, 'name'),
      role: extractStringField(comp.body, 'role'),
      personality: extractStringField(comp.body, 'personality'),
      homeLocationId: extractStringField(comp.body, 'homeLocationId'),
      additionalLocationIds: extractStringField(comp.body, 'additionalLocationIds'),
      greeting: extractStringField(comp.body, 'greeting'),
      description: extractStringField(comp.body, 'description'),
      canBeVillain: extractBoolField(comp.body, 'canBeVillain') ?? false,
      canBeAlly: extractBoolField(comp.body, 'canBeAlly') ?? true,
      canBeQuestGiver: extractBoolField(comp.body, 'canBeQuestGiver') ?? false,
    });
  }

  return npcs;
}

function parseHeroArrivalComments(text: string): HeroArrivalComment[] {
  const entities = parseEntities(text);
  const comments: HeroArrivalComment[] = [];

  for (const entity of entities) {
    const comp = getComponent(entity, 'HeroArrivalComment');
    if (!comp) continue;

    comments.push({
      commentId: extractStringField(comp.body, 'commentId'),
      triggerClass: extractStringField(comp.body, 'triggerClass'),
      triggerTrait: extractStringField(comp.body, 'triggerTrait'),
      triggerPolarity: extractStringField(comp.body, 'triggerPolarity'),
      elementalAffinity: extractStringField(comp.body, 'elementalAffinity'),
      locationTags: extractStringField(comp.body, 'locationTags'),
      comment: extractStringField(comp.body, 'comment'),
      sentiment: extractStringField(comp.body, 'sentiment'),
    });
  }

  return comments;
}

function parseBlockingEncounters(text: string): BlockingEncounter[] {
  const entities = parseEntities(text);
  const encounters: BlockingEncounter[] = [];

  for (const entity of entities) {
    const comp = getComponent(entity, 'BlockingEncounter');
    if (!comp) continue;

    encounters.push({
      blockingId: extractStringField(comp.body, 'blockingId'),
      pathId: extractStringField(comp.body, 'pathId'),
      matchPathType: extractStringField(comp.body, 'matchPathType'),
      locationId: extractStringField(comp.body, 'locationId'),
      encounterType: extractStringField(comp.body, 'encounterType'),
      description: extractStringField(comp.body, 'description'),
      resolutionType: extractStringField(comp.body, 'resolutionType'),
      enemies: extractStringField(comp.body, 'enemies'),
      difficultyModifier: extractNumberField(comp.body, 'difficultyModifier') ?? 0,
      narrativeOnBlock: extractStringField(comp.body, 'narrativeOnBlock'),
      narrativeOnResolve: extractStringField(comp.body, 'narrativeOnResolve'),
      triggerChance: extractNumberField(comp.body, 'triggerChance') ?? 0.3,
    });
  }

  return encounters;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface WorldDataSet {
  locations: WorldLocation[];
  paths: WorldPath[];
  npcs: WorldNpc[];
  heroArrivalComments: HeroArrivalComment[];
  blockingEncounters: BlockingEncounter[];
}

let worldDataCache: WorldDataSet | null = null;
let fetchPromise: Promise<WorldDataSet> | null = null;

/**
 * Load all world data from the BRL file.
 * Returns cached results on subsequent calls.
 */
export async function loadWorldData(): Promise<WorldDataSet> {
  if (worldDataCache) return worldDataCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const text = await fetchBrlFile('story-world-data.brl');
      const data: WorldDataSet = {
        locations: parseWorldLocations(text),
        paths: parseWorldPaths(text),
        npcs: parseWorldNpcs(text),
        heroArrivalComments: parseHeroArrivalComments(text),
        blockingEncounters: parseBlockingEncounters(text),
      };
      worldDataCache = data;
      return data;
    } catch (err) {
      console.error('Failed to load world data from story-world-data.brl:', err);
      // Return empty dataset — caller must handle gracefully
      worldDataCache = {
        locations: [],
        paths: [],
        npcs: [],
        heroArrivalComments: [],
        blockingEncounters: [],
      };
      return worldDataCache;
    }
  })();

  return fetchPromise;
}

/**
 * Synchronous access to cached world data.
 * Returns null if not yet loaded — call loadWorldData() first.
 */
export function getWorldData(): WorldDataSet | null {
  return worldDataCache;
}
