/**
 * Adventure Data Loader — parses adventure template data from BRL sources.
 *
 * Loads and parses:
 *   - `story-adventure-templates.brl` — ObjectiveTemplate, MilestoneTemplate,
 *     EventTemplate entities
 *   - `adventure-expansion-set-1.brl` and `expansion_pack_2.brl` —
 *     HeroEncounterTemplate entities
 *
 * This is the BRL→TypeScript bridge for the adventure quest system.
 * After calling `loadAdventureData()`, the same data that was previously
 * hardcoded in adventureQuest.ts is loaded from BRL files at runtime.
 * The hardcoded TypeScript arrays serve as fallback defaults for environments
 * where BRL files are unavailable (e.g. unit tests).
 */

import {
  parseEntities,
  getComponent,
  extractStringField,
  extractNumberField,
  extractBoolField,
  fetchBrlFile,
} from './brlParser';

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

// ── Parsing functions ────────────────────────────────────────────────────────

/** Parse a comma-separated BRL string field into a trimmed, non-empty string array. */
function parseCommaSeparated(value: string): string[] {
  return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
}

function parseObjectiveTemplates(text: string): ObjectiveTemplate[] {
  const entities = parseEntities(text);
  const objectives: ObjectiveTemplate[] = [];

  for (const entity of entities) {
    const comp = getComponent(entity, 'ObjectiveTemplate');
    if (!comp) continue;

    objectives.push({
      objectiveId: extractStringField(comp.body, 'objectiveId'),
      category: extractStringField(comp.body, 'category'),
      title: extractStringField(comp.body, 'title'),
      description: extractStringField(comp.body, 'description'),
      winCondition: extractStringField(comp.body, 'winCondition'),
      requiredSlots: parseCommaSeparated(extractStringField(comp.body, 'requiredSlots')),
      milestoneCategories: parseCommaSeparated(extractStringField(comp.body, 'milestoneCategories')),
    });
  }

  return objectives;
}

function parseMilestoneTemplates(text: string): MilestoneTemplate[] {
  const entities = parseEntities(text);
  const milestones: MilestoneTemplate[] = [];

  for (const entity of entities) {
    const comp = getComponent(entity, 'MilestoneTemplate');
    if (!comp) continue;

    milestones.push({
      milestoneId: extractStringField(comp.body, 'milestoneId'),
      category: extractStringField(comp.body, 'category'),
      title: extractStringField(comp.body, 'title'),
      description: extractStringField(comp.body, 'description'),
      completionType: extractStringField(comp.body, 'completionType'),
      completionKey: extractStringField(comp.body, 'completionKey'),
      bailoutDay: extractNumberField(comp.body, 'bailoutDay') ?? 3,
      bailoutDescription: extractStringField(comp.body, 'bailoutDescription'),
      compatibleObjectives: parseCommaSeparated(extractStringField(comp.body, 'compatibleObjectives')),
      eventSlots: extractNumberField(comp.body, 'eventSlots') ?? 2,
    });
  }

  return milestones;
}

function parseEventTemplates(text: string): EventTemplate[] {
  const entities = parseEntities(text);
  const events: EventTemplate[] = [];

  for (const entity of entities) {
    const comp = getComponent(entity, 'EventTemplate');
    if (!comp) continue;

    events.push({
      eventId: extractStringField(comp.body, 'eventId'),
      category: extractStringField(comp.body, 'category'),
      title: extractStringField(comp.body, 'title'),
      description: extractStringField(comp.body, 'description'),
      triggerType: extractStringField(comp.body, 'triggerType'),
      triggerLocation: extractStringField(comp.body, 'triggerLocation'),
      isKeyEvent: extractBoolField(comp.body, 'isKeyEvent') ?? false,
      rewardType: extractStringField(comp.body, 'rewardType'),
      narrativeOnTrigger: extractStringField(comp.body, 'narrativeOnTrigger'),
      narrativeOnComplete: extractStringField(comp.body, 'narrativeOnComplete'),
      difficultyModifier: extractNumberField(comp.body, 'difficultyModifier') ?? 0,
    });
  }

  return events;
}

function parseHeroEncounterTemplates(text: string): HeroEncounterTemplate[] {
  const entities = parseEntities(text);
  const encounters: HeroEncounterTemplate[] = [];

  for (const entity of entities) {
    const comp = getComponent(entity, 'HeroEncounterTemplate');
    if (!comp) continue;

    encounters.push({
      encounterId: extractStringField(comp.body, 'encounterId'),
      category: extractStringField(comp.body, 'category'),
      title: extractStringField(comp.body, 'title'),
      description: extractStringField(comp.body, 'description'),
      preferredClass: extractStringField(comp.body, 'preferredClass'),
      traitAxis: extractStringField(comp.body, 'traitAxis'),
      traitPolarity: extractStringField(comp.body, 'traitPolarity'),
      triggerType: extractStringField(comp.body, 'triggerType'),
      triggerLocation: extractStringField(comp.body, 'triggerLocation'),
      isKeyEvent: extractBoolField(comp.body, 'isKeyEvent') ?? false,
      buffType: extractStringField(comp.body, 'buffType'),
      buffAmount: extractNumberField(comp.body, 'buffAmount') ?? 10,
      narrativeOnMatch: extractStringField(comp.body, 'narrativeOnMatch'),
      narrativeOnComplete: extractStringField(comp.body, 'narrativeOnComplete'),
      difficultyModifier: extractNumberField(comp.body, 'difficultyModifier') ?? 0,
    });
  }

  return encounters;
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
 * Load all adventure template data from BRL files.
 * Returns cached results on subsequent calls.
 *
 * Sources:
 *   - `story-adventure-templates.brl` for objectives, milestones, events
 *   - `adventure-expansion-set-1.brl` and `expansion_pack_2.brl` for hero encounters
 */
export async function loadAdventureData(): Promise<AdventureDataSet> {
  if (adventureDataCache) return adventureDataCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const [templatesText, expansionSet1Text, expansionSet2Text] = await Promise.all([
        fetchBrlFile('story-adventure-templates.brl'),
        fetchBrlFile('adventure-expansion-set-1.brl'),
        fetchBrlFile('expansion_pack_2.brl'),
      ]);

      const heroEncounters = [
        ...parseHeroEncounterTemplates(expansionSet1Text),
        ...parseHeroEncounterTemplates(expansionSet2Text),
      ];

      const data: AdventureDataSet = {
        objectives: parseObjectiveTemplates(templatesText),
        milestones: parseMilestoneTemplates(templatesText),
        events: parseEventTemplates(templatesText),
        heroEncounters,
      };
      adventureDataCache = data;
      return data;
    } catch (err) {
      console.error(
        'Failed to load adventure data from BRL — falling back to hardcoded TypeScript defaults.',
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
