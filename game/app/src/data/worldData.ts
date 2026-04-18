/**
 * World Data — TypeScript representation of the persistent world.
 *
 * This module provides typed access to world locations, paths, NPCs, hero
 * arrival comments, and blocking encounters for use in narrative generation
 * and quest composition.
 *
 * **BRL is the single source of truth.**  Call `initWorldData()` to load
 * data from `story-world-data.brl` at runtime before using any world data.
 * There are no hardcoded fallbacks — BRL files must be available.
 *
 * See doc/game-design/world-design.md for the full design specification.
 */

import { loadWorldData } from './worldDataLoader';

// ── Types ───────────────────────────────────────────────────────────────────

export interface WorldLocation {
  locationId: string;
  name: string;
  locationType: 'town' | 'wilderness' | 'dungeon' | 'shrine' | 'ruins' | 'fortress';
  region: string;
  description: string;
  elementalAffinity: string;
  dangerLevel: number;
  tags: string;
}

export interface WorldPath {
  pathId: string;
  fromLocationId: string;
  toLocationId: string;
  pathType: string;
  travelHours: number;
  dangerRating: number;
  description: string;
  encounterTags: string;
  bidirectional: boolean;
}

export interface WorldNpc {
  npcId: string;
  name: string;
  role: string;
  personality: string;
  homeLocationId: string;
  additionalLocationIds: string;
  greeting: string;
  description: string;
  canBeVillain: boolean;
  canBeAlly: boolean;
  canBeQuestGiver: boolean;
}

export interface HeroArrivalComment {
  commentId: string;
  triggerClass: string;
  triggerTrait: string;
  triggerPolarity: string;
  elementalAffinity: string;
  locationTags: string;
  comment: string;
  sentiment: string;
}

export interface BlockingEncounter {
  blockingId: string;
  pathId: string;
  matchPathType: string;
  locationId: string;
  encounterType: string;
  description: string;
  resolutionType: string;
  enemies: string;
  difficultyModifier: number;
  narrativeOnBlock: string;
  narrativeOnResolve: string;
  triggerChance: number;
}

// ── World data arrays ────────────────────────────────────────────────────────
// Populated by initWorldData() from BRL.  No hardcoded fallbacks — BRL is
// the single source of truth.

export let WORLD_LOCATIONS: readonly WorldLocation[] = [];
export let WORLD_PATHS: readonly WorldPath[] = [];
export let WORLD_NPCS: readonly WorldNpc[] = [];
export let HERO_ARRIVAL_COMMENTS: readonly HeroArrivalComment[] = [];
export let BLOCKING_ENCOUNTERS: readonly BlockingEncounter[] = [];

// ── Lookup helpers ──────────────────────────────────────────────────────────

/** Index: locationId → WorldLocation */
let _locationById = new Map<string, WorldLocation>();

/** Index: npcId → WorldNpc */
let _npcById = new Map<string, WorldNpc>();

/** Adjacency: locationId → [{neighbor, path}] */
let _adjacency = new Map<string, { neighborId: string; path: WorldPath }[]>();

/**
 * Rebuild all internal lookup indexes from the current data arrays.
 * Called automatically at module load and again after initWorldData().
 */
function _rebuildIndexes() {
  _locationById = new Map<string, WorldLocation>();
  for (const loc of WORLD_LOCATIONS) _locationById.set(loc.locationId, loc);

  _npcById = new Map<string, WorldNpc>();
  for (const npc of WORLD_NPCS) _npcById.set(npc.npcId, npc);

  _adjacency = new Map<string, { neighborId: string; path: WorldPath }[]>();
  for (const p of WORLD_PATHS) {
    if (!_adjacency.has(p.fromLocationId)) _adjacency.set(p.fromLocationId, []);
    _adjacency.get(p.fromLocationId)!.push({ neighborId: p.toLocationId, path: p });
    if (p.bidirectional) {
      if (!_adjacency.has(p.toLocationId)) _adjacency.set(p.toLocationId, []);
      _adjacency.get(p.toLocationId)!.push({ neighborId: p.fromLocationId, path: p });
    }
  }
}

// Build empty indexes at module load time (will be populated by initWorldData)
_rebuildIndexes();

export function getLocationById(id: string): WorldLocation | undefined {
  return _locationById.get(id);
}

export function getNpcById(id: string): WorldNpc | undefined {
  return _npcById.get(id);
}

export function getNeighbors(locationId: string): { neighborId: string; path: WorldPath }[] {
  return _adjacency.get(locationId) ?? [];
}

/** Get all world location names (for use as location flavour pool). */
export function getAllLocationNames(): string[] {
  return WORLD_LOCATIONS.map(l => l.name);
}

/** Get all town locations. */
export function getTowns(): WorldLocation[] {
  return WORLD_LOCATIONS.filter(l => l.locationType === 'town');
}

/** Get unique regions. */
export function getRegions(): string[] {
  return [...new Set(WORLD_LOCATIONS.map(l => l.region))];
}

/**
 * Select a connected subgraph of world locations for an adventure map.
 *
 * Algorithm (per world-design.md "Map Selection"):
 * 1. Select starting region by seed.
 * 2. Pick a town from that region.
 * 3. BFS/expand from the starting town via world paths to select 8-12 locations.
 * 4. Assign layers by distance from start.
 * 5. The most distant high-danger location is the final destination.
 *
 * Returns locations in travel order (start → ... → final destination).
 */
export function selectWorldMap(
  seedNum: number,
  targetCount: number = 10,
): { locations: WorldLocation[]; paths: WorldPath[]; finalDestination: WorldLocation } {
  const regions = getRegions();
  const startRegion = regions[seedNum % regions.length];

  // Pick a town from the starting region
  const regionTowns = WORLD_LOCATIONS.filter(
    l => l.region === startRegion && l.locationType === 'town',
  );
  // Fallback: if no town in region, pick any town
  const towns = regionTowns.length > 0 ? regionTowns : getTowns();
  const startTown = towns[(seedNum >>> 4) % towns.length];

  // BFS to discover reachable locations
  const visited = new Set<string>([startTown.locationId]);
  const queue: string[] = [startTown.locationId];
  const orderedLocations: WorldLocation[] = [startTown];
  const selectedPaths: WorldPath[] = [];
  const layerMap = new Map<string, number>([[startTown.locationId, 0]]);

  let idx = 0;
  while (idx < queue.length && orderedLocations.length < targetCount) {
    const currentId = queue[idx++];
    const currentLayer = layerMap.get(currentId) ?? 0;
    const neighbors = getNeighbors(currentId);

    // Deterministic shuffle of neighbors using seed
    const sorted = [...neighbors].sort((a, b) => {
      const ha = ((seedNum * 2654435761 + a.neighborId.charCodeAt(0) * 2246822519) >>> 0) & 0xFFFF;
      const hb = ((seedNum * 2654435761 + b.neighborId.charCodeAt(0) * 2246822519) >>> 0) & 0xFFFF;
      return ha - hb;
    });

    for (const { neighborId, path } of sorted) {
      if (visited.has(neighborId)) continue;
      if (orderedLocations.length >= targetCount) break;

      const loc = getLocationById(neighborId);
      if (!loc) continue;

      visited.add(neighborId);
      queue.push(neighborId);
      orderedLocations.push(loc);
      selectedPaths.push(path);
      layerMap.set(neighborId, currentLayer + 1);
    }
  }

  // Find final destination: most distant high-danger location
  let finalDest = orderedLocations[orderedLocations.length - 1];
  let bestScore = 0;
  for (const loc of orderedLocations) {
    const layer = layerMap.get(loc.locationId) ?? 0;
    const score = layer * 10 + loc.dangerLevel;
    if (score > bestScore) {
      bestScore = score;
      finalDest = loc;
    }
  }

  // Reorder: move final destination to the end if it isn't already
  if (finalDest.locationId !== orderedLocations[orderedLocations.length - 1].locationId) {
    const fIdx = orderedLocations.findIndex(l => l.locationId === finalDest.locationId);
    if (fIdx >= 0) {
      orderedLocations.splice(fIdx, 1);
      orderedLocations.push(finalDest);
    }
  }

  return { locations: orderedLocations, paths: selectedPaths, finalDestination: finalDest };
}

/**
 * Find the path connecting two locations, if any.
 */
export function findPath(fromId: string, toId: string): WorldPath | undefined {
  const neighbors = getNeighbors(fromId);
  return neighbors.find(n => n.neighborId === toId)?.path;
}

/**
 * Get NPCs present at a given location (home or additional).
 */
export function getNpcsAtLocation(locationId: string): WorldNpc[] {
  return WORLD_NPCS.filter(npc => {
    if (npc.homeLocationId === locationId) return true;
    if (npc.additionalLocationIds) {
      return npc.additionalLocationIds.split(',').some(id => id.trim() === locationId);
    }
    return false;
  });
}

/**
 * Select hero arrival comments matching a hero's class/traits and a location.
 * Returns comments ranked by match quality.
 */
export function selectArrivalComments(
  heroClass: string,
  heroTraits: Record<string, number>,
  location: WorldLocation,
): HeroArrivalComment[] {
  const matches: { comment: HeroArrivalComment; score: number }[] = [];

  for (const c of HERO_ARRIVAL_COMMENTS) {
    // Must match elemental affinity or location tags
    const elementMatch = c.elementalAffinity === location.elementalAffinity;
    const tagMatch = c.locationTags !== '' &&
      c.locationTags.split(',').some(tag => location.tags.includes(tag.trim()));
    if (!elementMatch && !tagMatch) continue;

    if (c.triggerClass !== '') {
      // Class-based comment
      if (c.triggerClass === heroClass) {
        matches.push({ comment: c, score: 100 });
      }
    } else if (c.triggerTrait !== '') {
      // Trait-based comment
      const traitValue = heroTraits[c.triggerTrait] ?? 0;
      if (c.triggerPolarity === 'positive' && traitValue > 0) {
        matches.push({ comment: c, score: Math.abs(traitValue) });
      } else if (c.triggerPolarity === 'negative' && traitValue < 0) {
        matches.push({ comment: c, score: Math.abs(traitValue) });
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.map(m => m.comment);
}

/**
 * Find blocking encounters matching a path or location entry.
 */
export function findBlockingEncounters(
  pathType?: string,
  pathId?: string,
  locationId?: string,
): BlockingEncounter[] {
  return BLOCKING_ENCOUNTERS.filter(enc => {
    if (pathId && enc.pathId && enc.pathId === pathId) return true;
    if (pathType && enc.matchPathType) {
      const types = enc.matchPathType.split(',').map(s => s.trim());
      if (types.includes(pathType)) return true;
    }
    if (locationId && enc.locationId) {
      const locs = enc.locationId.split(',').map(s => s.trim());
      if (locs.includes(locationId)) return true;
    }
    return false;
  });
}

/** Path type → terrain description for narrative. */
export const PATH_TYPE_DESCRIPTIONS: Record<string, string> = {
  imperial_road: 'the paved imperial highway',
  mountain_pass: 'a narrow mountain pass',
  forest_trail: 'a winding forest trail',
  coastal_path: 'a coastal path along the shore',
  underground_tunnel: 'dark underground passages',
  river_crossing: 'a ford across the river',
  marsh_track: 'a treacherous marsh track',
};

// ── BRL initialization ─────────────────────────────────────────────────────

let _initPromise: Promise<void> | null = null;

/**
 * Load world data from the canonical BRL source (`story-world-data.brl`).
 *
 * After calling this function, all exported data arrays (WORLD_LOCATIONS,
 * WORLD_PATHS, etc.) and their dependent lookup functions are backed by
 * the BRL file data.  BRL is the single source of truth — this function
 * must be called before any world data is accessed.
 *
 * Safe to call multiple times — subsequent calls return the cached result.
 */
export async function initWorldData(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const data = await loadWorldData();

    WORLD_LOCATIONS = data.locations;
    WORLD_PATHS = data.paths;
    WORLD_NPCS = data.npcs;
    HERO_ARRIVAL_COMMENTS = data.heroArrivalComments;
    BLOCKING_ENCOUNTERS = data.blockingEncounters;

    // Rebuild indexes with the new data
    _rebuildIndexes();
  })();

  return _initPromise;
}
