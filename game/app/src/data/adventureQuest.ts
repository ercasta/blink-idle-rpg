/**
 * Adventure Quest Generation — deterministic quest composition from a seed.
 *
 * Generates objectives, milestones, events, NPC/item/villain bindings,
 * and narrative passages. All content is deterministic: the same seed
 * always produces the same adventure structure.
 *
 * This module implements the composition algorithm described in
 * doc/game-design/adventure-design.md.
 *
 * **BRL is the single source of truth.**  Call `initAdventureData()` before
 * using any quest-generation functions.  Template data is loaded from BRL files
 * at runtime; the arrays below are empty until `initAdventureData()` resolves.
 */

import type { AdventureDefinition, HeroDefinition, HeroTraits } from '../types';
import { DEFAULT_ENVIRONMENT_SETTINGS } from '../types';
import { WORLD_NPCS, selectWorldMap } from './worldData';
import type { WorldNpc } from './worldData';
import { loadAdventureData } from './adventureDataLoader';

// ── Deterministic PRNG (splitmix32) ─────────────────────────────────────────

/** Simple 32-bit deterministic PRNG (splitmix32). */
class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  /** Return next pseudo-random 32-bit unsigned integer. */
  next(): number {
    this.state = (this.state + 0x9e3779b9) >>> 0;
    let z = this.state;
    z = (z ^ (z >>> 16)) >>> 0;
    z = Math.imul(z, 0x85ebca6b) >>> 0;
    z = (z ^ (z >>> 13)) >>> 0;
    z = Math.imul(z, 0xc2b2ae35) >>> 0;
    z = (z ^ (z >>> 16)) >>> 0;
    return z >>> 0;
  }
  /** Return integer in [min, max] inclusive. */
  intRange(min: number, max: number): number {
    return min + (this.next() % (max - min + 1));
  }
  /** Shuffle array in place (Fisher–Yates). */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.next() % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** Pick one element from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.next() % arr.length];
  }
  /** Pick variant from a `|`-separated string. */
  pickVariant(text: string): string {
    const parts = text.split('|');
    return parts[this.next() % parts.length].trim();
  }
}

// ── Seed computation ────────────────────────────────────────────────────────

/** DJB2-style hash for adventure seed computation. */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Compute adventure seed from definition.
 * If the definition has an explicit seed, use it; otherwise derive deterministically.
 */
export function computeAdventureSeed(adv: Pick<AdventureDefinition, 'name' | 'mode' | 'requiredHeroCount' | 'allowedClasses' | 'environmentSettings' | 'seed'>): number {
  if (adv.seed !== undefined && adv.seed !== null) {
    return adv.seed >>> 0;
  }
  const env = adv.environmentSettings ?? DEFAULT_ENVIRONMENT_SETTINGS;
  const envStr = `${env.physicalPct},${env.magicalPct},${env.firePct},${env.waterPct},${env.windPct},${env.earthPct},${env.lightPct},${env.darknessPct}`;
  const classes = [...adv.allowedClasses].sort().join(',');
  const input = `${adv.name}|quest|${adv.mode}|${adv.requiredHeroCount}|${classes}|${envStr}`;
  return djb2Hash(input);
}

// ── Content pools ───────────────────────────────────────────────────────────

// ── Objective templates ─────────────────────────────────────────────────────

interface ObjectiveTemplate {
  objectiveId: string;
  category: string;
  title: string;
  description: string;
  winCondition: string;
  requiredSlots: string[];
  milestoneCategories: string[];
}

// Loaded from BRL via initAdventureData(). See story-adventure-templates.brl.
let OBJECTIVE_TEMPLATES: readonly ObjectiveTemplate[] = [];

// ── Milestone templates ─────────────────────────────────────────────────────

interface MilestoneTemplate {
  milestoneId: string;
  category: string;
  title: string;
  description: string;
  completionType: string;
  completionKey: string;
  bailoutDay: number;
  bailoutDescription: string;
  compatibleObjectives: string[];
  eventSlots: number;
}

// Loaded from BRL via initAdventureData(). See story-adventure-templates.brl.
let MILESTONE_TEMPLATES: readonly MilestoneTemplate[] = [];

// ── Event templates ─────────────────────────────────────────────────────────

interface EventTemplate {
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

// Loaded from BRL via initAdventureData(). See story-adventure-templates.brl.
let EVENT_TEMPLATES: readonly EventTemplate[] = [];
// ── NPC pool (derived from World NPCs at runtime) ───────────────────────────

interface NpcEntry {
  name: string;
  role: string;
  personality: string;
  greeting: string;
}

/** Convert world NPCs to quest NPC entries.  Lazy-computed on first use
 *  (after initWorldData() has populated WORLD_NPCS from BRL). */
function getNpcPool(): readonly NpcEntry[] {
  return WORLD_NPCS.map((npc: WorldNpc) => ({
    name: npc.name,
    role: npc.role.replace(/_/g, ' '),
    personality: npc.personality,
    greeting: npc.greeting,
  }));
}

// ── Content pools (loaded from BRL via initAdventureData) ───────────────────
// All content pools are defined in story-quest-pools.brl.  They are compiled
// to adventure-data.json at build time and loaded at runtime.

interface VillainEntry {
  name: string;
  title: string;
  threatDesc: string;
}

interface ItemEntry {
  name: string;
  origin: string;
}

let VILLAIN_POOL: readonly VillainEntry[] = [];
let ITEM_POOL: readonly ItemEntry[] = [];
let CREATURE_POOL: readonly string[] = [];
let ENEMY_NAME_POOL: readonly string[] = [];
let CURSE_POOL: readonly string[] = [];
let PORTAL_POOL: readonly string[] = [];
let RIDDLE_POOL: readonly string[] = [];
let THREAT_POOL: readonly string[] = [];
let INFO_POOL: readonly string[] = [];
let INSCRIPTION_POOL: readonly string[] = [];
let CARGO_POOL: readonly string[] = [];

// ── Hero encounter templates ────────────────────────────────────────────────
// 30 encounters: 6 class-specific + 24 trait-polarization (one per pole of each
// of 12 trait axes). These encounters select the best-matching hero from the
// party and highlight why that hero's class or traits were decisive. Completing
// a hero encounter grants a buff for the rest of the adventure.

interface HeroEncounterTemplate {
  encounterId: string;
  category: 'class' | 'trait';
  title: string;
  description: string;
  /** Required class for class-based encounters (empty for trait-based). */
  preferredClass: string;
  /** Trait axis key (e.g. 'pm') for trait-based encounters (empty for class). */
  traitAxis: string;
  /** 'positive' or 'negative' polarity (empty for class-based). */
  traitPolarity: 'positive' | 'negative' | '';
  triggerType: string;
  triggerLocation: string;
  isKeyEvent: boolean;
  buffType: 'attack' | 'defense' | 'speed' | 'crit' | 'healing' | 'xp';
  buffAmount: number;
  /** Narrative explaining why this hero was the best match. */
  narrativeOnMatch: string;
  /** Narrative on encounter completion. */
  narrativeOnComplete: string;
  difficultyModifier: number;
}

// Loaded from BRL via initAdventureData(). See adventure-expansion-set-1.brl and expansion-pack-2.brl.
let HERO_ENCOUNTER_TEMPLATES: readonly HeroEncounterTemplate[] = [];
// ── Hero encounter matching ─────────────────────────────────────────────────

/** Trait axis labels for narrative descriptions. */
const TRAIT_AXIS_LABELS: Record<string, { negative: string; positive: string }> = {
  pm: { negative: 'physical prowess', positive: 'magical attunement' },
  od: { negative: 'offensive instincts', positive: 'defensive mastery' },
  sa: { negative: 'supportive nature', positive: 'aggressive fighting spirit' },
  rc: { negative: 'bold risk-taking', positive: 'careful caution' },
  fw: { negative: 'fire affinity', positive: 'water affinity' },
  we: { negative: 'wind attunement', positive: 'earth attunement' },
  ld: { negative: 'connection to light', positive: 'comfort in darkness' },
  co: { negative: 'chaos adaptability', positive: 'sense of order' },
  sh: { negative: 'sly cunning', positive: 'sense of honor' },
  rm: { negative: 'ranged precision', positive: 'melee dominance' },
  ai: { negative: 'ability to absorb punishment', positive: 'talent for inflicting damage' },
  af: { negative: 'area attack prowess', positive: 'single-target focus' },
};

/** Result of matching a hero encounter to a party. */
interface HeroEncounterMatch {
  encounter: HeroEncounterTemplate;
  heroName: string;
  heroClass: string;
  matchScore: number;
  matchReason: string;
}

/**
 * Score how well a hero matches a hero encounter template.
 * Higher scores indicate a better match.
 */
function scoreHeroForEncounter(
  hero: { name: string; heroClass: string; traits: HeroTraits },
  encounter: HeroEncounterTemplate,
): { score: number; reason: string } {
  if (encounter.category === 'class') {
    if (hero.heroClass === encounter.preferredClass) {
      return { score: 100, reason: `As a ${hero.heroClass}, ${hero.name} is perfectly suited for this challenge.` };
    }
    return { score: 0, reason: '' };
  }

  // Trait-based matching
  const axis = encounter.traitAxis as keyof HeroTraits;
  const traitValue = hero.traits[axis] ?? 0;
  const labels = TRAIT_AXIS_LABELS[encounter.traitAxis];

  if (encounter.traitPolarity === 'negative') {
    // Lower (more negative) trait values are better
    const score = Math.max(0, -traitValue); // 0..16
    const label = labels?.negative ?? encounter.traitAxis;
    return {
      score,
      reason: score > 0 ? `${hero.name}'s ${label} makes them the ideal choice.` : '',
    };
  } else {
    // Higher (more positive) trait values are better
    const score = Math.max(0, traitValue); // 0..15
    const label = labels?.positive ?? encounter.traitAxis;
    return {
      score,
      reason: score > 0 ? `${hero.name}'s ${label} makes them the ideal choice.` : '',
    };
  }
}

/**
 * Find the best matching hero for a hero encounter template.
 * Returns the match result with the highest score, or null if no hero matches.
 */
function findBestHeroMatch(
  heroes: readonly { name: string; heroClass: string; traits: HeroTraits }[],
  encounter: HeroEncounterTemplate,
): HeroEncounterMatch | null {
  let bestMatch: HeroEncounterMatch | null = null;

  for (const hero of heroes) {
    const { score, reason } = scoreHeroForEncounter(hero, encounter);
    if (score > 0 && (bestMatch === null || score > bestMatch.matchScore)) {
      bestMatch = {
        encounter,
        heroName: hero.name,
        heroClass: hero.heroClass,
        matchScore: score,
        matchReason: reason,
      };
    }
  }

  return bestMatch;
}

/**
 * Select hero encounters for an adventure. Ensures at least 5 encounters
 * are selected, deterministically based on the adventure seed.
 * Encounters are chosen to maximize party coverage (each hero gets a chance).
 */
function selectHeroEncounters(
  rng: Rng,
  heroes: readonly { name: string; heroClass: string; traits: HeroTraits }[],
  _bindings: Record<string, string>,
  targetCount: number = 7,
): HeroEncounterMatch[] {
  const selected: HeroEncounterMatch[] = [];
  const usedEncounterIds = new Set<string>();
  const heroUseCounts = new Map<string, number>();

  // Initialize hero use counts
  for (const hero of heroes) {
    heroUseCounts.set(hero.name, 0);
  }

  // Shuffle encounter templates deterministically
  const shuffled = rng.shuffle([...HERO_ENCOUNTER_TEMPLATES]);

  // First pass: try to get at least one encounter per hero in the party
  for (const hero of heroes) {
    for (const enc of shuffled) {
      if (usedEncounterIds.has(enc.encounterId)) continue;
      const { score, reason } = scoreHeroForEncounter(hero, enc);
      if (score > 0) {
        selected.push({
          encounter: enc,
          heroName: hero.name,
          heroClass: hero.heroClass,
          matchScore: score,
          matchReason: reason,
        });
        usedEncounterIds.add(enc.encounterId);
        heroUseCounts.set(hero.name, (heroUseCounts.get(hero.name) ?? 0) + 1);
        break;
      }
    }
  }

  // Second pass: fill up to targetCount, preferring encounters that match
  // heroes with the fewest encounters so far
  for (const enc of shuffled) {
    if (selected.length >= targetCount) break;
    if (usedEncounterIds.has(enc.encounterId)) continue;

    const match = findBestHeroMatch(heroes, enc);
    if (match) {
      selected.push(match);
      usedEncounterIds.add(enc.encounterId);
      heroUseCounts.set(match.heroName, (heroUseCounts.get(match.heroName) ?? 0) + 1);
    }
  }

  // Ensure we have at least 5 (relax matching — assign any hero even without a match)
  if (selected.length < 5) {
    for (const enc of shuffled) {
      if (selected.length >= 5) break;
      if (usedEncounterIds.has(enc.encounterId)) continue;
      // Pick the first available hero (no trait/class requirement)
      const hero = heroes[0];
      selected.push({
        encounter: enc,
        heroName: hero.name,
        heroClass: hero.heroClass,
        matchScore: 1,
        matchReason: `${hero.name} steps forward to face this challenge.`,
      });
      usedEncounterIds.add(enc.encounterId);
    }
  }

  return selected;
}

/** A resolved hero encounter within a quest. */
export interface QuestHeroEncounter {
  encounterId: string;
  title: string;
  description: string;
  heroName: string;
  heroClass: string;
  matchReason: string;
  narrativeOnMatch: string;
  narrativeOnComplete: string;
  buffType: string;
  buffAmount: number;
  /** Day the encounter triggers (0 = not yet assigned). */
  triggerDay: number;
  /** Whether the encounter has been completed. */
  isCompleted: boolean;
}

// ── Quest types ─────────────────────────────────────────────────────────────

/** A single quest event within a milestone. */
export interface QuestEvent {
  eventId: string;
  title: string;
  description: string;
  isKeyEvent: boolean;
  triggerType: string;
  triggerLocation: string;
  rewardType: string;
  narrativeOnTrigger: string;
  narrativeOnComplete: string;
  difficultyModifier: number;
  /** Day the event was triggered (0 = not yet). */
  triggeredDay: number;
  /** Day the event was completed (0 = not yet). */
  completedDay: number;
}

/** A milestone in the quest chain. */
export interface QuestMilestone {
  milestoneId: string;
  milestoneIndex: number;
  title: string;
  description: string;
  completionType: string;
  completionKey: string;
  targetLayer: number;
  bailoutDay: number;
  bailoutDescription: string;
  events: QuestEvent[];
  isActive: boolean;
  isCompleted: boolean;
  completedViaBailout: boolean;
  activationDay: number;
}

/** The full quest structure for an adventure. */
export interface AdventureQuest {
  seed: number;
  objectiveId: string;
  objectiveTitle: string;
  objectiveDescription: string;
  objectiveWinCondition: string;
  milestones: QuestMilestone[];
  slotBindings: Record<string, string>;
  isComplete: boolean;
  /** Hero-matched encounters selected for this adventure. */
  heroEncounters: QuestHeroEncounter[];
}

// ── Composition algorithm ───────────────────────────────────────────────────

/**
 * Resolve slot tokens in a string. Replaces {slot_name} with bound values.
 */
function resolveSlots(text: string, bindings: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_match, slotName: string) => {
    return bindings[slotName] ?? `{${slotName}}`;
  });
}

// ── BRL data initialisation ──────────────────────────────────────────────────

let _initAdventurePromise: Promise<void> | null = null;

/**
 * Load adventure template data from BRL files.
 *
 * Loads objectives, milestones, events from `story-adventure-templates.brl`
 * and hero encounters from `adventure-expansion-set-1.brl` + `expansion-pack-2.brl`.
 *
 * Must be called (and awaited) before any quest-generation functions are used.
 * BRL is the single source of truth — there are no hardcoded fallbacks.
 *
 * Safe to call multiple times — subsequent calls return the cached result.
 */
export async function initAdventureData(): Promise<void> {
  if (_initAdventurePromise) return _initAdventurePromise;

  _initAdventurePromise = (async () => {
    const data = await loadAdventureData();
    OBJECTIVE_TEMPLATES = data.objectives;
    MILESTONE_TEMPLATES = data.milestones;
    EVENT_TEMPLATES = data.events;
    HERO_ENCOUNTER_TEMPLATES = data.heroEncounters as HeroEncounterTemplate[];
    // Load quest content pools from BRL
    if (data.questPools) {
      VILLAIN_POOL = data.questPools.villains;
      ITEM_POOL = data.questPools.items;
      CREATURE_POOL = data.questPools.creatures;
      ENEMY_NAME_POOL = data.questPools.enemyNames;
      CURSE_POOL = data.questPools.curses;
      PORTAL_POOL = data.questPools.portals;
      RIDDLE_POOL = data.questPools.riddles;
      THREAT_POOL = data.questPools.threats;
      INFO_POOL = data.questPools.infos;
      INSCRIPTION_POOL = data.questPools.inscriptions;
      CARGO_POOL = data.questPools.cargos;
    }
  })();

  return _initAdventurePromise;
}

/**
 * Generate a complete adventure quest structure from a seed.
 *
 * This is the core composition algorithm described in the design document.
 * It is fully deterministic: the same seed always produces the same quest.
 *
 * @param seed - Adventure seed for deterministic generation
 * @param heroes - Optional party heroes for hero-matched encounter selection.
 *   When provided, at least 5 hero encounters are selected and matched to
 *   the best-fitting hero based on class and trait polarization.
 */
export function generateAdventureQuest(
  seed: number,
  heroes?: readonly Pick<HeroDefinition, 'name' | 'heroClass' | 'traits'>[],
): AdventureQuest {
  const rng = new Rng(seed);

  // NPC pool is derived from world NPCs at runtime (after initWorldData)
  const NPC_POOL = getNpcPool();

  // 1. Draw objective
  const objective = OBJECTIVE_TEMPLATES[rng.next() % OBJECTIVE_TEMPLATES.length];

  // 2. Determine milestone count (7–9, extended from 5–6 by ×1.5 for longer adventures)
  const milestoneCount = rng.intRange(7, 9);

  // 3. Draw milestones compatible with objective
  const compatibleMilestones = MILESTONE_TEMPLATES.filter(m =>
    m.compatibleObjectives.some(cat => cat === objective.category),
  );
  const shuffledMilestones = rng.shuffle([...compatibleMilestones]);
  const selectedMilestones = shuffledMilestones.slice(0, Math.min(milestoneCount, shuffledMilestones.length));

  // Pad with random milestones if not enough compatible ones
  if (selectedMilestones.length < milestoneCount) {
    const remaining = MILESTONE_TEMPLATES.filter(
      m => !selectedMilestones.some(s => s.milestoneId === m.milestoneId),
    );
    const extra = rng.shuffle([...remaining]).slice(0, milestoneCount - selectedMilestones.length);
    selectedMilestones.push(...extra);
  }

  // 4. For each milestone, draw events
  const keyEvents = EVENT_TEMPLATES.filter(e => e.isKeyEvent);
  const sideEvents = EVENT_TEMPLATES.filter(e => !e.isKeyEvent);

  const milestoneEvents: EventTemplate[][] = [];
  const usedKeyEventIds = new Set<string>();
  const usedSideEventIds = new Set<string>();

  for (const milestone of selectedMilestones) {
    const eventCount = milestone.eventSlots;
    const events: EventTemplate[] = [];

    // Pick a key event (preferring matching category, falling back to any)
    const matchingKeyEvents = keyEvents.filter(
      e => !usedKeyEventIds.has(e.eventId) &&
        (e.category === milestone.category || e.category === 'discovery'),
    );
    const anyKeyEvents = keyEvents.filter(e => !usedKeyEventIds.has(e.eventId));
    const keyPool = matchingKeyEvents.length > 0 ? matchingKeyEvents : anyKeyEvents;
    if (keyPool.length > 0) {
      const key = keyPool[rng.next() % keyPool.length];
      events.push(key);
      usedKeyEventIds.add(key.eventId);
    } else {
      // Fallback: reuse a key event (shouldn't normally happen)
      events.push(keyEvents[rng.next() % keyEvents.length]);
    }

    // Fill remaining with side events
    const availableSide = sideEvents.filter(e => !usedSideEventIds.has(e.eventId));
    const shuffledSide = rng.shuffle([...availableSide]);
    for (let i = 0; i < eventCount - 1 && i < shuffledSide.length; i++) {
      events.push(shuffledSide[i]);
      usedSideEventIds.add(shuffledSide[i].eventId);
    }

    milestoneEvents.push(events);
  }

  // 5. Collect required slots and draw values
  const bindings: Record<string, string> = {};

  // NPC role exclusivity tracking (per world-design.md)
  const usedNpcNames = new Set<string>();

  // Draw NPC (with exclusivity — skip already-used NPCs)
  const npcIdx = rng.next() % NPC_POOL.length;
  const npc = NPC_POOL[npcIdx];
  usedNpcNames.add(npc.name);
  bindings['npc_name'] = npc.name;
  bindings['npc_role'] = npc.role;
  bindings['npc_personality'] = npc.personality;

  // Draw a second NPC for quest_giver (ensure different from first NPC)
  let npc2Idx = rng.next() % NPC_POOL.length;
  let npc2 = NPC_POOL[npc2Idx];
  // Try to avoid reusing the same NPC
  for (let attempt = 0; attempt < 5 && usedNpcNames.has(npc2.name); attempt++) {
    npc2Idx = rng.next() % NPC_POOL.length;
    npc2 = NPC_POOL[npc2Idx];
  }
  usedNpcNames.add(npc2.name);
  bindings['quest_giver'] = npc2.name;

  // Draw villain (from VILLAIN_POOL — separate namespace, no exclusivity conflict)
  const villain = VILLAIN_POOL[rng.next() % VILLAIN_POOL.length];
  bindings['villain_name'] = villain.name;
  bindings['villain_title'] = villain.title;
  bindings['threat_desc'] = villain.threatDesc;
  bindings['captor_name'] = `${villain.name} ${villain.title}`;

  // Draw item
  const item = ITEM_POOL[rng.next() % ITEM_POOL.length];
  bindings['item_name'] = item.name;
  bindings['item_origin'] = item.origin;

  // Draw location flavour — use world location names
  // Select a submap for this seed to assign locations to quest slots
  const worldMap = selectWorldMap(seed, 12);
  const mapLocationNames = worldMap.locations.map(l => l.name);
  bindings['dungeon_name'] = rng.pick(mapLocationNames);
  bindings['ruin_name'] = rng.pick(mapLocationNames);
  bindings['location_name'] = rng.pick(mapLocationNames);

  // Draw creature
  bindings['creature_name'] = rng.pick(CREATURE_POOL);

  // Draw enemy type
  bindings['enemy_name'] = rng.pick(ENEMY_NAME_POOL);

  // Draw rival (reuse NPC pool, with exclusivity)
  let rivalIdx = rng.next() % NPC_POOL.length;
  let rival = NPC_POOL[rivalIdx];
  // Try to avoid reusing NPCs already assigned to quest roles
  for (let attempt = 0; attempt < 5 && usedNpcNames.has(rival.name); attempt++) {
    rivalIdx = rng.next() % NPC_POOL.length;
    rival = NPC_POOL[rivalIdx];
  }
  usedNpcNames.add(rival.name);
  bindings['rival_name'] = rival.name;

  // Draw miscellaneous slots — use world location names for location-based slots
  bindings['curse_name'] = rng.pick(CURSE_POOL);
  bindings['cursed_location'] = rng.pick(mapLocationNames);
  bindings['portal_name'] = rng.pick(PORTAL_POOL);
  bindings['portal_location'] = rng.pick(mapLocationNames);
  bindings['seal_item'] = rng.pick(ITEM_POOL).name;
  bindings['riddle_name'] = rng.pick(RIDDLE_POOL);
  bindings['threat_name'] = rng.pick(THREAT_POOL);
  bindings['info_name'] = rng.pick(INFO_POOL);
  bindings['inscription_name'] = rng.pick(INSCRIPTION_POOL);
  bindings['cargo_desc'] = rng.pick(CARGO_POOL);
  bindings['destination_name'] = rng.pick(mapLocationNames);

  // 6. Resolve all template text
  const resolvedObjectiveTitle = resolveSlots(rng.pickVariant(objective.title), bindings);
  const resolvedObjectiveDesc = resolveSlots(rng.pickVariant(objective.description), bindings);

  // 7. Build milestone and event structures
  const milestones: QuestMilestone[] = selectedMilestones.map((tmpl, idx) => {
    const targetLayer = milestoneCount <= 1
      ? 1
      : 1 + Math.round(idx * 2.0 / (milestoneCount - 1));
    const events: QuestEvent[] = milestoneEvents[idx].map(evtTmpl => ({
      eventId: evtTmpl.eventId,
      title: resolveSlots(rng.pickVariant(evtTmpl.title), bindings),
      description: resolveSlots(rng.pickVariant(evtTmpl.description), bindings),
      isKeyEvent: evtTmpl.isKeyEvent,
      triggerType: evtTmpl.triggerType,
      triggerLocation: evtTmpl.triggerLocation,
      rewardType: evtTmpl.rewardType,
      narrativeOnTrigger: resolveSlots(rng.pickVariant(evtTmpl.narrativeOnTrigger), bindings),
      narrativeOnComplete: resolveSlots(rng.pickVariant(evtTmpl.narrativeOnComplete), bindings),
      difficultyModifier: evtTmpl.difficultyModifier,
      triggeredDay: 0,
      completedDay: 0,
    }));

    return {
      milestoneId: tmpl.milestoneId,
      milestoneIndex: idx,
      title: resolveSlots(rng.pickVariant(tmpl.title), bindings),
      description: resolveSlots(rng.pickVariant(tmpl.description), bindings),
      completionType: tmpl.completionType,
      completionKey: tmpl.completionKey,
      targetLayer,
      bailoutDay: tmpl.bailoutDay,
      bailoutDescription: resolveSlots(tmpl.bailoutDescription, bindings),
      events,
      isActive: false,
      isCompleted: false,
      completedViaBailout: false,
      activationDay: 0,
    };
  });

  // 8. Select hero-matched encounters (if party heroes are provided)
  const heroEncounters: QuestHeroEncounter[] = [];
  if (heroes && heroes.length > 0) {
    const heroEncounterRng = new Rng(seed + 0xBEEF);  // Separate RNG stream for hero encounters
    const matches = selectHeroEncounters(heroEncounterRng, heroes, bindings);

    // Distribute encounters across the adventure days (spread evenly)
    const daySpacing = Math.max(2, Math.floor(STORY_TOTAL_DAYS / (matches.length + 1)));
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const enc = match.encounter;
      const triggerDay = Math.min(STORY_TOTAL_DAYS - 1, daySpacing * (i + 1));

      // Resolve slot tokens in encounter text, including hero_name
      const encBindings = { ...bindings, hero_name: match.heroName };
      heroEncounters.push({
        encounterId: enc.encounterId,
        title: resolveSlots(enc.title, encBindings),
        description: resolveSlots(enc.description, encBindings),
        heroName: match.heroName,
        heroClass: match.heroClass,
        matchReason: match.matchReason,
        narrativeOnMatch: resolveSlots(enc.narrativeOnMatch, encBindings),
        narrativeOnComplete: resolveSlots(enc.narrativeOnComplete, encBindings),
        buffType: enc.buffType,
        buffAmount: enc.buffAmount,
        triggerDay,
        isCompleted: false,
      });
    }
  }

  return {
    seed,
    objectiveId: objective.objectiveId,
    objectiveTitle: resolvedObjectiveTitle,
    objectiveDescription: resolvedObjectiveDesc,
    objectiveWinCondition: objective.winCondition,
    milestones,
    slotBindings: bindings,
    isComplete: false,
    heroEncounters,
  };
}

// ── Quest scoring constants ─────────────────────────────────────────────────

/** Points for completing a milestone normally. */
export const QUEST_MILESTONE_NORMAL_BONUS = 150;
/** Points for completing a milestone via bail-out. */
export const QUEST_MILESTONE_BAILOUT_BONUS = 50;
/** Points for completing a side event. */
export const QUEST_SIDE_EVENT_BONUS = 75;
/** Points for completing the objective. */
export const QUEST_OBJECTIVE_BONUS = 300;
/** Bonus for completing all milestones without bail-outs. */
export const QUEST_ALL_NORMAL_BONUS = 200;
/** Points per quest item collected. */
export const QUEST_ITEM_BONUS = 25;
/** Bonus points per day remaining when objective is completed ahead of schedule. */
export const QUEST_EARLY_COMPLETION_POINTS_PER_DAY = 50;
/** Points for completing a hero-matched encounter. */
export const QUEST_HERO_ENCOUNTER_BONUS = 100;

// ── Quest simulation (deterministic from seed + game data) ──────────────────

/** Seed offset to separate quest generation randomness from simulation randomness. */
const SIMULATION_SEED_OFFSET = 0x12345;
/** Minimum locations-per-day rate for trigger calculations. */
const MIN_LOCATIONS_PER_DAY = 0.3;
/** Total days in story mode (matches engine constant). */
const STORY_TOTAL_DAYS = 30;
/** Expected max encounters for encounter intensity scaling. */
const EXPECTED_MAX_ENCOUNTERS = 120;
/** Maximum seed value (32-bit unsigned). */
export const MAX_SEED_VALUE = 4294967295;

/** Result of simulating quest progress during a story run. */
export interface QuestSimResult {
  quest: AdventureQuest;
  totalQuestScore: number;
  milestoneCompletions: number;
  bailoutCount: number;
  sideEventsCompleted: number;
  heroEncountersCompleted: number;
  objectiveCompleted: boolean;
  /** Day (1-based) on which the objective was completed, if applicable. */
  objectiveCompletionDay?: number;
}

/**
 * Simulate quest progress deterministically during a story mode run.
 *
 * Uses the seed, total encounters, and story KPI inputs to determine
 * when milestones and events trigger/complete. This mirrors what would
 * happen if the BRL rules were running.
 *
 * @param heroes - Optional party heroes for hero-matched encounter selection.
 */
export function simulateQuestProgress(
  seed: number,
  totalEncounters: number,
  locationsVisited: number,
  heroes?: readonly Pick<HeroDefinition, 'name' | 'heroClass' | 'traits'>[],
): QuestSimResult {
  const quest = generateAdventureQuest(seed, heroes);
  const rng = new Rng(seed + SIMULATION_SEED_OFFSET);

  let totalQuestScore = 0;
  let bailoutCount = 0;
  let sideEventsCompleted = 0;
  let heroEncountersCompleted = 0;

  // Simulate milestone progression based on day/encounters
  const locationsPerDay = Math.max(MIN_LOCATIONS_PER_DAY, locationsVisited / STORY_TOTAL_DAYS);
  // Use totalEncounters to modulate event trigger chances
  const encounterIntensity = Math.min(1.0, totalEncounters / EXPECTED_MAX_ENCOUNTERS);

  // Activate first milestone on day 1
  if (quest.milestones.length > 0) {
    quest.milestones[0].isActive = true;
    quest.milestones[0].activationDay = 1;
  }

  for (let day = 1; day <= STORY_TOTAL_DAYS; day++) {
    // Check each active milestone
    for (const milestone of quest.milestones) {
      if (!milestone.isActive || milestone.isCompleted) continue;

      // Check events within milestone
      for (const event of milestone.events) {
        if (event.completedDay > 0) continue; // Already completed

        // Determine if event triggers today based on trigger type and progress
        const daysSinceActivation = day - milestone.activationDay;
        const progressFraction = daysSinceActivation / (milestone.bailoutDay + 1);
        const locationsVisitedSoFar = Math.floor(day * locationsPerDay);

        let triggerChance = 0;
        if (event.triggerType === 'town_visit') {
          triggerChance = (locationsVisitedSoFar > milestone.targetLayer ? 0.4 : 0.2) * (0.5 + 0.5 * encounterIntensity);
        } else if (event.triggerType === 'travel_segment') {
          triggerChance = (0.3 + progressFraction * 0.3) * (0.5 + 0.5 * encounterIntensity);
        } else if (event.triggerType === 'location_enter') {
          triggerChance = (locationsVisitedSoFar >= milestone.targetLayer ? 0.35 : 0.15) * (0.5 + 0.5 * encounterIntensity);
        } else {
          triggerChance = (0.25 + progressFraction * 0.2) * (0.5 + 0.5 * encounterIntensity);
        }

        // Trigger check
        if (event.triggeredDay === 0) {
          const roll = (rng.next() % 100) / 100;
          if (roll < triggerChance) {
            event.triggeredDay = day;
          }
          continue;
        }

        // Complete check (triggered events complete on next opportunity)
        if (event.triggeredDay > 0 && event.completedDay === 0) {
          const completeChance = event.isKeyEvent ? 0.6 : 0.7;
          const roll = (rng.next() % 100) / 100;
          if (roll < completeChance + progressFraction * 0.2) {
            event.completedDay = day;
            if (!event.isKeyEvent) {
              sideEventsCompleted++;
              totalQuestScore += QUEST_SIDE_EVENT_BONUS;
            }
          }
        }
      }

      // Check if key event is completed → milestone completes
      const keyEvent = milestone.events.find(e => e.isKeyEvent);
      if (keyEvent && keyEvent.completedDay > 0 && !milestone.isCompleted) {
        milestone.isCompleted = true;
        totalQuestScore += QUEST_MILESTONE_NORMAL_BONUS;
        _activateNextMilestone(quest, milestone.milestoneIndex, day);
      }

      // Bail-out check
      if (!milestone.isCompleted && day >= milestone.activationDay + milestone.bailoutDay) {
        milestone.isCompleted = true;
        milestone.completedViaBailout = true;
        bailoutCount++;
        totalQuestScore += QUEST_MILESTONE_BAILOUT_BONUS;
        // Auto-complete key event
        if (keyEvent && keyEvent.completedDay === 0) {
          keyEvent.triggeredDay = day;
          keyEvent.completedDay = day;
        }
        _activateNextMilestone(quest, milestone.milestoneIndex, day);
      }
    }

    // Simulate hero encounters for this day
    for (const heroEnc of quest.heroEncounters) {
      if (!heroEnc.isCompleted && heroEnc.triggerDay === day) {
        heroEnc.isCompleted = true;
        heroEncountersCompleted++;
        totalQuestScore += QUEST_HERO_ENCOUNTER_BONUS;
      }
    }
  }

  // Check objective completion
  const allMilestonesComplete = quest.milestones.every(m => m.isCompleted);
  let objectiveCompletionDay: number | undefined;
  if (allMilestonesComplete) {
    quest.isComplete = true;
    totalQuestScore += QUEST_OBJECTIVE_BONUS;

    // Determine the day the objective was completed (day after last milestone's key event)
    const lastMilestone = quest.milestones[quest.milestones.length - 1];
    if (lastMilestone) {
      const lastKeyCompletionDay = lastMilestone.completedViaBailout
        ? lastMilestone.activationDay + lastMilestone.bailoutDay
        : lastMilestone.events
            .filter(e => e.isKeyEvent)
            .reduce((max, e) => Math.max(max, e.completedDay), lastMilestone.activationDay + 1);
      objectiveCompletionDay = Math.min(lastKeyCompletionDay + 1, STORY_TOTAL_DAYS);
    }

    // Bonus for no bail-outs
    if (bailoutCount === 0) {
      totalQuestScore += QUEST_ALL_NORMAL_BONUS;
    }
  }

  // Quest item bonuses (one per completed key event)
  const questItemCount = quest.milestones.filter(m => m.isCompleted && !m.completedViaBailout).length;
  totalQuestScore += questItemCount * QUEST_ITEM_BONUS;

  return {
    quest,
    totalQuestScore,
    milestoneCompletions: quest.milestones.filter(m => m.isCompleted).length,
    bailoutCount,
    sideEventsCompleted,
    heroEncountersCompleted,
    objectiveCompleted: quest.isComplete,
    objectiveCompletionDay,
  };
}

function _activateNextMilestone(quest: AdventureQuest, completedIndex: number, day: number): void {
  const nextIndex = completedIndex + 1;
  if (nextIndex < quest.milestones.length) {
    quest.milestones[nextIndex].isActive = true;
    quest.milestones[nextIndex].activationDay = day;
  }
}

// ── Quest narrative generation ──────────────────────────────────────────────

import type { NarrativeEntry, NarrativeLevel } from '../types';

/**
 * Generate quest-related narrative entries to weave into the story log.
 * These entries are interleaved with the base story narrative based on
 * the quest simulation results.
 *
 * @param maxDay - Only emit entries up to and including this day (defaults to
 *   STORY_TOTAL_DAYS). Used when the run ends early due to objective completion.
 */
export function generateQuestNarrative(questResult: QuestSimResult, maxDay: number = STORY_TOTAL_DAYS): NarrativeEntry[] {
  const entries: NarrativeEntry[] = [];
  const quest = questResult.quest;

  function emit(day: number, hour: number, level: NarrativeLevel, text: string) {
    if (day <= maxDay) {
      entries.push({ day, hour, level, text });
    }
  }

  // Objective introduction (day 1)
  emit(1, 1, 1, `⚔️ Quest: ${quest.objectiveTitle}`);
  emit(1, 1, 2, quest.objectiveDescription);

  // First milestone activation
  if (quest.milestones.length > 0) {
    const m = quest.milestones[0];
    emit(1, 2, 1, `📋 Milestone 1/${quest.milestones.length}: ${m.title}`);
    emit(1, 2, 2, m.description);
  }

  // Process each milestone
  for (const milestone of quest.milestones) {
    // Milestone activation (after the first one)
    if (milestone.milestoneIndex > 0 && milestone.activationDay > 0) {
      emit(milestone.activationDay, 1, 1,
        `📋 Milestone ${milestone.milestoneIndex + 1}/${quest.milestones.length}: ${milestone.title}`);
      emit(milestone.activationDay, 1, 2, milestone.description);
    }

    // Events within milestone
    for (const event of milestone.events) {
      if (event.triggeredDay > 0) {
        const level: NarrativeLevel = event.isKeyEvent ? 2 : 3;
        emit(event.triggeredDay, 4, level, `🔔 ${event.title}: ${event.narrativeOnTrigger}`);
      }
      if (event.completedDay > 0) {
        const level: NarrativeLevel = event.isKeyEvent ? 2 : 3;
        emit(event.completedDay, 6, level, `✅ ${event.title}: ${event.narrativeOnComplete}`);
      }
    }

    // Milestone completion
    if (milestone.isCompleted) {
      const completionDay = milestone.completedViaBailout
        ? milestone.activationDay + milestone.bailoutDay
        : Math.max(...milestone.events.filter(e => e.isKeyEvent).map(e => e.completedDay), milestone.activationDay + 1);

      if (milestone.completedViaBailout) {
        emit(completionDay, 8, 1,
          `⏳ Milestone ${milestone.milestoneIndex + 1} completed via bail-out: ${milestone.bailoutDescription} (+${QUEST_MILESTONE_BAILOUT_BONUS} points)`);
      } else {
        emit(completionDay, 8, 1,
          `🏆 Milestone ${milestone.milestoneIndex + 1} completed! (+${QUEST_MILESTONE_NORMAL_BONUS} points)`);
      }
    }
  }

  // Hero-matched encounters
  // Both completed and not-completed encounters are now fully handled by BRL:
  // completed encounters are emitted as blocking_encounter steps integrated
  // into the timeline, and unreached encounters are emitted during
  // story_finalize via emitUnreachedEncounters().

  // Objective completion
  if (quest.isComplete) {
    const lastMilestone = quest.milestones[quest.milestones.length - 1];
    const completionDay = lastMilestone
      ? (lastMilestone.completedViaBailout
          ? lastMilestone.activationDay + lastMilestone.bailoutDay
          : lastMilestone.events
              .filter(e => e.isKeyEvent)
              .reduce((max, e) => Math.max(max, e.completedDay), lastMilestone.activationDay + 1))
      : 30;

    const objectiveDay = Math.min(completionDay + 1, 30);
    emit(objectiveDay, 0, 1,
      `🎉 Objective Complete: ${quest.objectiveTitle}! (+${QUEST_OBJECTIVE_BONUS} points)`);
    if (questResult.bailoutCount === 0) {
      emit(objectiveDay, 0, 2,
        `🌟 All milestones completed without bail-outs! (+${QUEST_ALL_NORMAL_BONUS} bonus points)`);
    }

    // Early completion bonus if objective finished before the final day
    if (questResult.objectiveCompletionDay !== undefined && questResult.objectiveCompletionDay < STORY_TOTAL_DAYS) {
      const daysRemaining = STORY_TOTAL_DAYS - questResult.objectiveCompletionDay;
      const earlyBonus = daysRemaining * QUEST_EARLY_COMPLETION_POINTS_PER_DAY;
      emit(objectiveDay, 1, 1,
        `⚡ Mission accomplished ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} ahead of schedule! (+${earlyBonus} early completion bonus)`);
    }
  }

  // Sort by day, then hour
  entries.sort((a, b) => a.day - b.day || a.hour - b.hour);

  return entries;
}
