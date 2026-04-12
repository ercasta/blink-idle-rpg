/**
 * Adventure Quest Generation — deterministic quest composition from a seed.
 *
 * Generates objectives, milestones, events, NPC/item/villain bindings,
 * and narrative passages. All content is deterministic: the same seed
 * always produces the same adventure structure.
 *
 * This module implements the composition algorithm described in
 * doc/game-design/adventure-design.md.
 */

import type { AdventureDefinition, HeroDefinition, HeroTraits } from '../types';
import { DEFAULT_ENVIRONMENT_SETTINGS } from '../types';

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

const OBJECTIVE_TEMPLATES: readonly ObjectiveTemplate[] = [
  {
    objectiveId: 'rescue_npc',
    category: 'rescue',
    title: 'Rescue the {npc_name}',
    description: 'Rumours say {npc_name}, the {npc_role}, has been captured by {captor_name}\'s forces. The party must find and rescue {npc_name} before it is too late.|Word has come that {captor_name} holds {npc_name} prisoner. Only the party can save them.|{npc_name}, beloved {npc_role}, has vanished. {captor_name} is surely behind it.',
    winCondition: 'npc_rescued',
    requiredSlots: ['npc_name', 'npc_role', 'captor_name'],
    milestoneCategories: ['information', 'combat', 'exploration', 'social'],
  },
  {
    objectiveId: 'retrieve_artifact',
    category: 'retrieve',
    title: 'Retrieve the {item_name}',
    description: 'The {item_name}, {item_origin}, has been lost to the wilds. {quest_giver} has asked the party to recover it before it falls into the wrong hands.|{quest_giver} speaks of the {item_name} — an artifact of immense power. It must be found.',
    winCondition: 'item_delivered',
    requiredSlots: ['item_name', 'item_origin', 'quest_giver'],
    milestoneCategories: ['exploration', 'combat', 'information', 'social'],
  },
  {
    objectiveId: 'defeat_villain',
    category: 'defeat',
    title: 'Stop {villain_name}',
    description: '{villain_name}, {villain_title}, threatens the land with {threat_desc}. The party must track down and defeat {villain_name} before it is too late.|The shadow of {villain_name} grows longer each day. Someone must put an end to {threat_desc}.',
    winCondition: 'boss_defeated',
    requiredSlots: ['villain_name', 'villain_title', 'threat_desc'],
    milestoneCategories: ['combat', 'information', 'exploration', 'social'],
  },
  {
    objectiveId: 'lift_curse',
    category: 'rescue',
    title: 'Lift the Curse of {curse_name}',
    description: 'A terrible curse — the {curse_name} — has befallen {cursed_location}. {npc_name} begs the party to find the cure.|The {curse_name} spreads through {cursed_location}. Only by finding the source can the party end this blight.',
    winCondition: 'curse_lifted',
    requiredSlots: ['curse_name', 'cursed_location', 'npc_name', 'npc_role'],
    milestoneCategories: ['information', 'exploration', 'social', 'combat'],
  },
  {
    objectiveId: 'escort_caravan',
    category: 'escort',
    title: "Escort the {npc_name}'s Caravan",
    description: '{npc_name} needs safe passage for a caravan carrying {cargo_desc} to {destination_name}. The road is dangerous — the party must protect them.|The caravan must reach {destination_name} with its precious {cargo_desc}. {npc_name} is counting on you.',
    winCondition: 'destination_reached',
    requiredSlots: ['npc_name', 'npc_role', 'cargo_desc', 'destination_name'],
    milestoneCategories: ['combat', 'social', 'exploration'],
  },
  {
    objectiveId: 'seal_portal',
    category: 'defeat',
    title: 'Seal the {portal_name}',
    description: 'An ancient portal — the {portal_name} — has opened at {portal_location}, spewing creatures from beyond. The party needs {seal_item} to seal it shut.|The {portal_name} pulses with dark energy at {portal_location}. Without the {seal_item}, this world is doomed.',
    winCondition: 'portal_sealed',
    requiredSlots: ['portal_name', 'portal_location', 'seal_item'],
    milestoneCategories: ['exploration', 'combat', 'information'],
  },
];

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

const MILESTONE_TEMPLATES: readonly MilestoneTemplate[] = [
  {
    milestoneId: 'gather_intel',
    category: 'information',
    title: 'Seek the {info_name}',
    description: 'To progress, the party must seek information. Travellers on the road may know something, or perhaps the archives of a nearby town hold clues.|Information is the key. The party must find someone — or something — that holds the answer.',
    completionType: 'npc_talked',
    completionKey: 'intel_gathered',
    bailoutDay: 3,
    bailoutDescription: 'An old traveller approaches the camp and shares critical information.',
    compatibleObjectives: ['rescue', 'retrieve', 'defeat', 'escort'],
    eventSlots: 2,
  },
  {
    milestoneId: 'find_key_item',
    category: 'exploration',
    title: 'Find the {item_name}',
    description: 'A critical item lies hidden in the wilds. The party must search the surrounding area to find it.|Somewhere out there, the {item_name} waits. The party must be thorough in their search.',
    completionType: 'item_found',
    completionKey: 'key_item_found',
    bailoutDay: 3,
    bailoutDescription: 'The item washes up at the edge of the next town, found by a helpful local.',
    compatibleObjectives: ['retrieve', 'rescue', 'defeat', 'escort'],
    eventSlots: 3,
  },
  {
    milestoneId: 'clear_dungeon',
    category: 'combat',
    title: 'Clear the {dungeon_name}',
    description: 'The path forward is blocked by hostile forces occupying {dungeon_name}. The party must clear them out.|{dungeon_name} is crawling with enemies. The party must fight through.',
    completionType: 'area_cleared',
    completionKey: 'dungeon_cleared',
    bailoutDay: 4,
    bailoutDescription: 'A cave-in reveals an alternate path, bypassing the remaining enemies.',
    compatibleObjectives: ['defeat', 'rescue', 'retrieve'],
    eventSlots: 3,
  },
  {
    milestoneId: 'win_duel',
    category: 'combat',
    title: 'Defeat {rival_name} in Combat',
    description: '{rival_name} stands in the party\'s way and will not be moved by words alone.|The only way past {rival_name} is through strength. Prepare for battle.',
    completionType: 'duel_won',
    completionKey: 'rival_defeated',
    bailoutDay: 3,
    bailoutDescription: 'The rival is distracted by another threat and withdraws.',
    compatibleObjectives: ['defeat', 'rescue', 'escort'],
    eventSlots: 2,
  },
  {
    milestoneId: 'solve_riddle',
    category: 'social',
    title: 'Solve the Riddle of {riddle_name}',
    description: 'An ancient puzzle blocks the way — the Riddle of {riddle_name}. The party must use their wits.|The riddle has stumped many before. Perhaps the party can succeed where others failed.',
    completionType: 'puzzle_solved',
    completionKey: 'riddle_solved',
    bailoutDay: 2,
    bailoutDescription: 'A wandering scholar provides the answer to the riddle.',
    compatibleObjectives: ['retrieve', 'rescue', 'defeat'],
    eventSlots: 2,
  },
  {
    milestoneId: 'negotiate_passage',
    category: 'social',
    title: 'Convince {npc_name} to Help',
    description: '{npc_name} holds the key to the next step, but must be persuaded.|The party must find common ground with {npc_name} to earn their cooperation.',
    completionType: 'npc_persuaded',
    completionKey: 'passage_negotiated',
    bailoutDay: 3,
    bailoutDescription: 'A mutual threat forces an uneasy cooperation.',
    compatibleObjectives: ['rescue', 'escort', 'retrieve', 'defeat'],
    eventSlots: 2,
  },
  {
    milestoneId: 'survive_ambush',
    category: 'combat',
    title: 'Survive the {threat_name} Ambush',
    description: 'The party walks into a trap — a {threat_name} ambush! They must survive.|Enemies spring from the shadows. The party must fight their way out.',
    completionType: 'ambush_survived',
    completionKey: 'ambush_cleared',
    bailoutDay: 2,
    bailoutDescription: 'Reinforcements arrive just in time to scatter the ambushers.',
    compatibleObjectives: ['defeat', 'escort', 'rescue'],
    eventSlots: 2,
  },
  {
    milestoneId: 'retrieve_fragment',
    category: 'exploration',
    title: 'Recover a Fragment of {item_name}',
    description: 'A fragment of the {item_name} is hidden nearby. The party must locate and retrieve it.|The fragment calls out with a faint magical pulse. The party must follow it.',
    completionType: 'item_found',
    completionKey: 'fragment_recovered',
    bailoutDay: 3,
    bailoutDescription: 'The fragment\'s magic pulls it toward the party on its own.',
    compatibleObjectives: ['retrieve', 'rescue', 'defeat'],
    eventSlots: 2,
  },
  {
    milestoneId: 'escort_survivor',
    category: 'social',
    title: 'Escort {npc_name} to Safety',
    description: '{npc_name} is in danger and must be escorted to safety. The party must protect them on the road.|The journey is perilous, but {npc_name} must reach safety.',
    completionType: 'npc_escorted',
    completionKey: 'survivor_escorted',
    bailoutDay: 3,
    bailoutDescription: 'The survivor finds their own way to safety through a hidden path.',
    compatibleObjectives: ['rescue', 'escort'],
    eventSlots: 2,
  },
  {
    milestoneId: 'decipher_map',
    category: 'information',
    title: 'Decipher the Ancient Map',
    description: 'An ancient map holds the secret to the next destination, but it is written in a forgotten script.|The map is old and faded. The party must find a way to read its hidden message.',
    completionType: 'puzzle_solved',
    completionKey: 'map_deciphered',
    bailoutDay: 2,
    bailoutDescription: 'A mysterious figure appears and translates the map before vanishing.',
    compatibleObjectives: ['retrieve', 'rescue', 'defeat', 'escort'],
    eventSlots: 2,
  },
];

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

const EVENT_TEMPLATES: readonly EventTemplate[] = [
  // Key events
  {
    eventId: 'duel_rival',
    category: 'combat',
    title: 'Duel with {rival_name}',
    description: '{rival_name} challenges the party to single combat!',
    triggerType: 'location_enter',
    triggerLocation: 'wilderness',
    isKeyEvent: true,
    rewardType: 'quest_item',
    narrativeOnTrigger: '{rival_name} steps from the shadows, blade drawn. "You will go no further!"|A figure blocks the road ahead — {rival_name}, eyes burning with determination.',
    narrativeOnComplete: '{rival_name} falls to their knees, defeated. The path is clear.|With a final clash of steel, {rival_name} yields.',
    difficultyModifier: 1,
  },
  {
    eventId: 'search_ruins',
    category: 'search',
    title: 'Search the {ruin_name}',
    description: 'The party must search {ruin_name} for clues or items.',
    triggerType: 'location_enter',
    triggerLocation: 'wilderness',
    isKeyEvent: true,
    rewardType: 'quest_item',
    narrativeOnTrigger: 'The crumbling walls of {ruin_name} loom ahead. Something important lies within.|{ruin_name} stands silent and waiting. The party begins their search.',
    narrativeOnComplete: 'After a thorough search of {ruin_name}, the party finds what they seek.|Hidden beneath rubble in {ruin_name}, a glint of light reveals the prize.',
    difficultyModifier: 0,
  },
  {
    eventId: 'interrogate_prisoner',
    category: 'social',
    title: 'Question the {npc_name}',
    description: 'A captured prisoner — {npc_name} — may have vital information.',
    triggerType: 'town_visit',
    triggerLocation: 'town',
    isKeyEvent: true,
    rewardType: 'quest_info',
    narrativeOnTrigger: 'In the town jail, {npc_name} sits behind iron bars. "I know what you seek," they whisper.|{npc_name} eyes the party warily. "Ask your questions. But I want something in return."',
    narrativeOnComplete: '{npc_name} reveals everything — names, places, plans. The party now knows where to go.|After careful questioning, {npc_name} gives up the crucial details.',
    difficultyModifier: 0,
  },
  {
    eventId: 'decode_inscription',
    category: 'puzzle',
    title: 'Decipher the {inscription_name}',
    description: 'An ancient inscription holds a vital clue.',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: true,
    rewardType: 'quest_info',
    narrativeOnTrigger: 'Strange symbols cover the stone — the {inscription_name}. The party studies them intently.|The {inscription_name} glows faintly in the dim light. Its secrets must be unlocked.',
    narrativeOnComplete: 'With careful study, the party deciphers the {inscription_name}. The message is clear.|The inscription yields its meaning at last — a revelation that changes everything.',
    difficultyModifier: 0,
  },
  {
    eventId: 'ancient_guardian',
    category: 'combat',
    title: 'Face the Ancient Guardian',
    description: 'A powerful guardian bars the way forward.',
    triggerType: 'location_enter',
    triggerLocation: 'wilderness',
    isKeyEvent: true,
    rewardType: 'quest_item',
    narrativeOnTrigger: 'The ground trembles. An ancient guardian rises from the earth, eyes blazing with eldritch light.|A massive stone figure awakens, blocking the path. It will not let the party pass without a fight.',
    narrativeOnComplete: 'The guardian crumbles, its purpose fulfilled. The way forward is open.|With a final shudder, the guardian falls. Among the rubble, the party finds their prize.',
    difficultyModifier: 2,
  },
  {
    eventId: 'ritual_site',
    category: 'discovery',
    title: 'Investigate the Ritual Site',
    description: 'A mysterious ritual site holds clues to the quest.',
    triggerType: 'location_enter',
    triggerLocation: 'wilderness',
    isKeyEvent: true,
    rewardType: 'quest_info',
    narrativeOnTrigger: 'Dark circles and strange runes mark this clearing. A ritual was performed here recently.|The air crackles with residual energy. Whatever happened here, it left traces.',
    narrativeOnComplete: 'The ritual site reveals its secrets. The party pieces together what happened — and what must be done next.|Among the ritual components, the party finds exactly the information they needed.',
    difficultyModifier: 0,
  },
  {
    eventId: 'library_research',
    category: 'puzzle',
    title: 'Research in the {location_name} Archives',
    description: 'The town archives may hold the answers the party seeks.',
    triggerType: 'town_visit',
    triggerLocation: 'town',
    isKeyEvent: true,
    rewardType: 'quest_info',
    narrativeOnTrigger: 'The dusty shelves of the {location_name} archives stretch endlessly. Somewhere in here is the answer.|The archivist eyes the party suspiciously, then reluctantly grants access.',
    narrativeOnComplete: 'Hours of research pay off — a dusty tome reveals the crucial information.|In a forgotten corner of the archives, the party finds exactly what they need.',
    difficultyModifier: 0,
  },
  // Side events
  {
    eventId: 'ambush_scouts',
    category: 'combat',
    title: 'Intercept {enemy_name} Scouts',
    description: 'Enemy scouts are spotted ahead. Engaging them could yield useful supplies.',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    rewardType: 'score_bonus',
    narrativeOnTrigger: 'Movement in the underbrush — {enemy_name} scouts, three of them, moving fast.|The party spots {enemy_name} scouts on the ridge. An opportunity presents itself.',
    narrativeOnComplete: 'The scouts are dealt with quickly. They were carrying useful supplies.|The {enemy_name} scouts fall. Among their belongings, the party finds a few useful items.',
    difficultyModifier: 1,
  },
  {
    eventId: 'tavern_rumour',
    category: 'social',
    title: 'Overhear a Rumour at {location_name}',
    description: 'A whispered conversation in a tavern catches the party\'s attention.',
    triggerType: 'town_visit',
    triggerLocation: 'town',
    isKeyEvent: false,
    rewardType: 'quest_info',
    narrativeOnTrigger: 'At the tavern in {location_name}, a hooded stranger leans close and whispers a rumour.|Over cheap ale at {location_name}, the party catches fragments of an interesting conversation.',
    narrativeOnComplete: 'The rumour proves true — a small but valuable piece of the puzzle falls into place.|The whispered tale leads to a useful insight.',
    difficultyModifier: 0,
  },
  {
    eventId: 'hidden_cache',
    category: 'search',
    title: 'Discover a Hidden Cache',
    description: 'A hidden cache of supplies is found along the road.',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    rewardType: 'score_bonus',
    narrativeOnTrigger: 'A loose stone in a ruined wall catches the eye. Behind it — a hidden cache!|Beneath a fallen tree, the glint of metal reveals a buried cache.',
    narrativeOnComplete: 'The cache contains old but serviceable supplies. A welcome find.|The party divides the cache\'s contents and presses on.',
    difficultyModifier: 0,
  },
  {
    eventId: 'wounded_traveller',
    category: 'social',
    title: 'Aid a Wounded Traveller',
    description: 'A wounded traveller on the road needs the party\'s help.',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    rewardType: 'score_bonus',
    narrativeOnTrigger: 'A figure lies by the roadside, clutching a wounded leg. "Please… help me."|The party finds a wounded traveller. They look like they\'ve been through something terrible.',
    narrativeOnComplete: 'The traveller, grateful, shares a useful tip before parting ways.|"Thank you," the traveller says, bandaged and steadier. "Let me tell you something in return…"',
    difficultyModifier: 0,
  },
  {
    eventId: 'merchant_bargain',
    category: 'social',
    title: 'Bargain with {npc_name}',
    description: 'A merchant offers to trade — at a price.',
    triggerType: 'town_visit',
    triggerLocation: 'town',
    isKeyEvent: false,
    rewardType: 'score_bonus',
    narrativeOnTrigger: '{npc_name} spreads a collection of wares across the table. "Everything has a price, friend."|"Well, well," {npc_name} says, eyeing the party. "I think we can do business."',
    narrativeOnComplete: 'A deal is struck. Both sides walk away satisfied.|After much haggling, {npc_name} and the party reach an agreement.',
    difficultyModifier: 0,
  },
  {
    eventId: 'trap_corridor',
    category: 'puzzle',
    title: 'Navigate the Trapped Passage',
    description: 'A corridor full of traps blocks the party\'s path.',
    triggerType: 'location_enter',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    rewardType: 'score_bonus',
    narrativeOnTrigger: 'Click. The floor shifts beneath the party\'s feet — a trapped passage!|Dart holes and pressure plates line the narrow corridor. Careful now…',
    narrativeOnComplete: 'With steady nerves, the party navigates the traps unscathed.|The last trap is disarmed. The party emerges on the other side, intact.',
    difficultyModifier: 0,
  },
  {
    eventId: 'beast_hunt',
    category: 'combat',
    title: 'Hunt the {creature_name}',
    description: 'A dangerous beast roams the area. Hunting it would prove the party\'s strength.',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    rewardType: 'score_bonus',
    narrativeOnTrigger: 'Tracks in the mud — fresh ones. The {creature_name} is nearby.|A chilling howl echoes through the trees. The {creature_name} hunts here.',
    narrativeOnComplete: 'The {creature_name} is slain. The party takes a trophy as proof.|After a fierce fight, the {creature_name} falls. The road is safer now.',
    difficultyModifier: 1,
  },
  {
    eventId: 'signal_fire',
    category: 'discovery',
    title: 'Light the Signal Fire',
    description: 'An old signal tower stands atop the hill. Lighting it may draw allies.',
    triggerType: 'location_enter',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    rewardType: 'score_bonus',
    narrativeOnTrigger: 'An old signal tower crowns the nearby hill. Its beacon has been dark for years.|The tower stands forgotten. But someone maintained the firewood inside.',
    narrativeOnComplete: 'The signal fire blazes to life, visible for miles. Help may come.|Flames climb the beacon. A distant answering light flickers on the horizon.',
    difficultyModifier: 0,
  },
];

// ── NPC pool ────────────────────────────────────────────────────────────────

interface NpcEntry {
  name: string;
  role: string;
  personality: string;
  greeting: string;
}

const NPC_POOL: readonly NpcEntry[] = [
  { name: 'Eldara', role: 'sage', personality: 'mysterious', greeting: 'I have been expecting you, travellers.' },
  { name: 'Brother Marek', role: 'healer', personality: 'kind', greeting: 'Welcome, friends. How can I ease your burden?' },
  { name: 'Captain Voss', role: 'guard captain', personality: 'gruff', greeting: 'State your business. Quickly.' },
  { name: 'Lira Swiftfoot', role: 'scout', personality: 'anxious', greeting: 'You should not be here. It\'s not safe.' },
  { name: 'Theron the Grey', role: 'scholar', personality: 'stoic', greeting: 'Knowledge is both weapon and shield.' },
  { name: 'Mira Coalhand', role: 'blacksmith', personality: 'gruff', greeting: 'Need something fixed? Or broken?' },
  { name: 'Senna Brightleaf', role: 'herbalist', personality: 'kind', greeting: 'Nature provides all the remedies one needs.' },
  { name: 'Darvok Ironjaw', role: 'mercenary', personality: 'stoic', greeting: 'Gold talks. Everything else walks.' },
  { name: 'Pip Thistlewick', role: 'innkeeper', personality: 'kind', greeting: 'Come in, come in! Warm ale and a warm fire await!' },
  { name: 'Zara Nightwhisper', role: 'spy', personality: 'mysterious', greeting: 'I know why you\'re here. The question is — do you?' },
  { name: 'Father Aldric', role: 'priest', personality: 'kind', greeting: 'The light watches over all who seek it.' },
  { name: 'Kessa Dunewood', role: 'ranger', personality: 'stoic', greeting: 'The wilds speak to those who listen.' },
  { name: 'Grint Ashborn', role: 'miner', personality: 'gruff', greeting: 'Down in the deep, we learn what\'s real.' },
  { name: 'Lyssa Moonveil', role: 'enchantress', personality: 'mysterious', greeting: 'The veil between worlds is thin tonight.' },
  { name: 'Rowan Flint', role: 'caravan master', personality: 'anxious', greeting: 'You\'ve come to help? Please say you have.' },
  { name: 'Dagna Stonehelm', role: 'weaponsmith', personality: 'gruff', greeting: 'If you\'re buying, make it quick.' },
  { name: 'Fenwick Holloway', role: 'diplomat', personality: 'kind', greeting: 'Let us speak calmly and find common ground.' },
  { name: 'Shara Embervine', role: 'alchemist', personality: 'mysterious', greeting: 'Every potion tells a story. What\'s yours?' },
  { name: 'Old Tormund', role: 'fisherman', personality: 'stoic', greeting: 'The river takes and gives in equal measure.' },
  { name: 'Ylva Icemere', role: 'huntress', personality: 'gruff', greeting: 'Track, kill, survive. Simple.' },
];

// ── Villain pool ────────────────────────────────────────────────────────────

interface VillainEntry {
  name: string;
  title: string;
  threatDesc: string;
}

const VILLAIN_POOL: readonly VillainEntry[] = [
  { name: 'Malachar', title: 'the Undying', threatDesc: 'draining life from the land itself' },
  { name: 'The Hollow King', title: 'Scourge of the North', threatDesc: 'raising an army of the restless dead' },
  { name: 'Xanthara', title: 'the Veiled', threatDesc: 'infiltrating the kingdom from within' },
  { name: 'Gorthak', title: 'the Breaker', threatDesc: 'uniting the savage hordes of the wilds' },
  { name: 'Lady Seraphine', title: 'the Betrayer', threatDesc: 'twisting holy magic to dark ends' },
  { name: 'Vrynn', title: 'the Whisper', threatDesc: 'spreading plague through poison and shadow' },
  { name: 'The Iron Prophet', title: 'Herald of Ruin', threatDesc: 'summoning an ancient and terrible evil' },
  { name: 'Draegon Ashclaw', title: 'the Last Flame', threatDesc: 'burning entire regions to ash' },
  { name: 'Nocturne', title: 'the Dreamwalker', threatDesc: 'trapping minds in endless nightmares' },
  { name: 'Grimjaw', title: 'the Devourer', threatDesc: 'consuming all light in the deep places' },
];

// ── Item pool ───────────────────────────────────────────────────────────────

interface ItemEntry {
  name: string;
  origin: string;
}

const ITEM_POOL: readonly ItemEntry[] = [
  { name: 'Sunstone Amulet', origin: 'Forged in the First Age by the Sun Priests' },
  { name: 'Everflame Lantern', origin: 'A lantern that burns without fuel, guiding the lost' },
  { name: 'Ironheart Shield', origin: 'Carried by the last Knight of the Silver Order' },
  { name: 'Tome of Whispers', origin: 'Contains the spoken memories of a dying oracle' },
  { name: 'Crystal of Binding', origin: 'A gem that can seal any portal between worlds' },
  { name: "Serpent's Fang Dagger", origin: 'Carved from the tooth of the Great Wyrm' },
  { name: 'Map of the Veil', origin: 'Shows paths hidden from mortal eyes' },
  { name: 'Crown of Thorns', origin: 'Worn by those who would command the wild' },
  { name: 'Emberstone Ring', origin: 'Warm to the touch — said to ward off curses' },
  { name: 'Vial of Starlight', origin: 'Collected at the peak of Mount Celeste' },
  { name: 'Rusted Compass', origin: 'Always points toward the nearest danger' },
  { name: 'Bone Whistle', origin: 'Summons a spectral ally when blown at midnight' },
  { name: 'Silvered Mirror', origin: 'Reveals the true form of any who gaze into it' },
  { name: 'Cloak of Ashes', origin: 'Renders the wearer invisible to the undead' },
  { name: 'Hearthstone Shard', origin: 'A fragment of the world\'s first hearth' },
];

// ── Location / creature / misc pools ────────────────────────────────────────

const LOCATION_FLAVOUR_POOL = [
  'the Sunken Crypt', 'Ashveil Tower', 'the Shattered Hall', 'Blackmoss Cavern',
  'the Hollow Spire', 'Greywater Depths', 'the Ruined Chapel', 'Thornkeep Ruins',
  'the Echoing Mines', 'Silverwind Shrine', 'the Charred Pit', 'Moonfall Cloister',
];

const CREATURE_POOL = [
  'Razorback Wyvern', 'Shadowstalker', 'Iron Golem', 'Venomfang Spider',
  'Dire Wolf', 'Cave Troll', 'Frost Wraith', 'Blight Hound',
  'Stone Basilisk', 'Ember Drake',
];

const ENEMY_NAME_POOL = [
  'Bandit', 'Cultist', 'Goblin', 'Undead', 'Orc',
  'Dark Elf', 'Mercenary', 'Raider', 'Outlaw', 'Brigand',
];

const CURSE_POOL = [
  'the Withering', 'the Ashen Blight', 'Hollow Eyes', 'the Rotwood',
  'Nightfall Madness', 'the Frost Veil', 'Crimson Tears', 'the Silence',
];

const PORTAL_POOL = [
  'Rift of Shadows', 'Gate of Chains', 'Veil Tear', 'Nexus of the Damned',
  'the Obsidian Door', 'Abyssal Gate', 'Breach of Stars', 'the Hungering Maw',
];

const RIDDLE_POOL = [
  'the Three Locks', 'the Stone Faces', 'the Moonlight Path',
  'the Whispering Doors', 'the Weight of Souls', 'the Mirror Bridge',
];

const THREAT_POOL = [
  'Goblin', 'Bandit', 'Undead', 'Orc', 'Dark Elf',
  'Brigand', 'Cultist', 'Wild Beast', 'Shadow',
];

const INFO_POOL = [
  'lost trail', 'hidden passage', 'enemy weakness', 'ancient map',
  'coded message', 'trade route', 'escape plan', 'ritual incantation',
];

const INSCRIPTION_POOL = [
  'Inscription of Ages', 'Runes of Warding', 'Prophecy Stone',
  'Sunken Glyphs', 'Star Chart', 'Bone Carvings', 'Elder Script',
];

const CARGO_POOL = [
  'medical supplies', 'weapons and armour', 'sacred relics',
  'rare herbs', 'gold and silver', 'ancient texts',
];

const DESTINATION_POOL = [
  'Silverhold', 'the Northern Refuge', 'Port Ashwind', 'the Mountain Keep',
  'Dawnspire Citadel', 'the Free City', 'the Eastern Frontier', 'Haven\'s Edge',
];

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

const HERO_ENCOUNTER_TEMPLATES: readonly HeroEncounterTemplate[] = [
  // ── CLASS-SPECIFIC ENCOUNTERS (6) ─────────────────────────────────────────

  // 1. Warrior — Hold the Line
  {
    encounterId: 'warrior_hold_the_line',
    category: 'class',
    title: 'Hold the Line at {dungeon_name}',
    description: 'A narrow pass near {dungeon_name} is about to be overrun. Only a warrior\'s strength and discipline can hold long enough for the party to prepare.',
    preferredClass: 'Warrior',
    traitAxis: '',
    traitPolarity: '',
    triggerType: 'travel_segment',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'defense',
    buffAmount: 12,
    narrativeOnMatch: '{hero_name} plants their feet, raises their shield, and bellows a war cry. The enemy wave crashes against them — and breaks. A warrior born and bred.',
    narrativeOnComplete: 'The pass holds. The party pushes forward with renewed confidence, their defenses bolstered by the warrior\'s stand.',
    difficultyModifier: 1,
  },
  // 2. Mage — Arcane Resonance
  {
    encounterId: 'mage_arcane_resonance',
    category: 'class',
    title: 'The Arcane Wards of {location_name}',
    description: 'Ancient arcane wards block the path through {location_name}. Only someone fluent in magical theory can unravel them safely.',
    preferredClass: 'Mage',
    traitAxis: '',
    traitPolarity: '',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'attack',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} traces the ward patterns with practiced fingers, recognizing the sigil structure immediately. The wards dissolve in a cascade of harmless sparks. Only a true mage could have done that.',
    narrativeOnComplete: 'The residual arcane energy infuses the party, sharpening their strikes for the battles ahead.',
    difficultyModifier: 0,
  },
  // 3. Ranger — Track the Hidden Path
  {
    encounterId: 'ranger_hidden_path',
    category: 'class',
    title: 'The Hidden Trail to {destination_name}',
    description: 'The road is destroyed. Somewhere in this wilderness, a hidden game trail leads to {destination_name}, but only a skilled tracker can find it.',
    preferredClass: 'Ranger',
    traitAxis: '',
    traitPolarity: '',
    triggerType: 'travel_segment',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'speed',
    buffAmount: 15,
    narrativeOnMatch: '{hero_name} kneels beside a barely-visible track, brushes aside dead leaves, and nods. \'This way.\' A ranger\'s eyes miss nothing in the wild.',
    narrativeOnComplete: 'The hidden path saves the party hours of travel. Their pace quickens with a new sense of urgency.',
    difficultyModifier: 0,
  },
  // 4. Paladin — Trial of Devotion
  {
    encounterId: 'paladin_trial_devotion',
    category: 'class',
    title: 'The Shrine of {npc_name}',
    description: 'A sacred shrine dedicated to {npc_name}\'s patron deity radiates protective light. Only one who has sworn holy vows can receive its blessing.',
    preferredClass: 'Paladin',
    traitAxis: '',
    traitPolarity: '',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'healing',
    buffAmount: 15,
    narrativeOnMatch: '{hero_name} kneels before the shrine, recites an oath of devotion, and the light intensifies. The shrine recognizes a true paladin\'s faith.',
    narrativeOnComplete: 'Divine warmth spreads through the party. Wounds close a little faster, spirits lift. The paladin\'s devotion protects them all.',
    difficultyModifier: 0,
  },
  // 5. Rogue — Steal the Plans
  {
    encounterId: 'rogue_steal_plans',
    category: 'class',
    title: 'Infiltrate {villain_name}\'s Camp',
    description: '{villain_name}\'s scouts have made camp nearby. Their orders contain critical intelligence — but stealing them requires stealth and quick hands.',
    preferredClass: 'Rogue',
    traitAxis: '',
    traitPolarity: '',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'crit',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} slips into the enemy camp like a shadow, lifts the orders from under the captain\'s nose, and returns without a sound. Only a rogue could pull that off.',
    narrativeOnComplete: 'The stolen plans reveal enemy weaknesses. The party\'s strikes become more precise and deadly.',
    difficultyModifier: 0,
  },
  // 6. Cleric — Consecrate the Ground
  {
    encounterId: 'cleric_consecrate_ground',
    category: 'class',
    title: 'The Defiled Graveyard near {location_name}',
    description: 'Restless dead stir in a desecrated graveyard near {location_name}. A holy ritual could put them to rest — but only a true servant of the divine can perform it.',
    preferredClass: 'Cleric',
    traitAxis: '',
    traitPolarity: '',
    triggerType: 'location_enter',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'defense',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} raises their holy symbol and chants the Rite of Passing. The restless spirits sigh and fade. A cleric\'s calling answered.',
    narrativeOnComplete: 'The consecrated ground emanates a protective aura. The party feels safer, their resolve strengthened.',
    difficultyModifier: 0,
  },

  // ── TRAIT-POLARIZATION ENCOUNTERS (24) ────────────────────────────────────

  // --- pm axis: Physical (negative) vs Magical (positive) ---

  // 7. Physical (pm negative)
  {
    encounterId: 'trait_physical_gate',
    category: 'trait',
    title: 'The Sealed Gate of {dungeon_name}',
    description: 'A massive iron gate blocks the entrance to {dungeon_name}. No key exists — only raw physical might can force it open.',
    preferredClass: '',
    traitAxis: 'pm',
    traitPolarity: 'negative',
    triggerType: 'location_enter',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'attack',
    buffAmount: 8,
    narrativeOnMatch: '{hero_name} grips the gate bars and heaves with all their might. Metal groans and bends. Their physical prowess makes the impossible look easy.',
    narrativeOnComplete: 'The gate yields. Raw strength has opened the way, and the party\'s morale — and striking power — surges.',
    difficultyModifier: 1,
  },
  // 8. Magical (pm positive)
  {
    encounterId: 'trait_magical_spring',
    category: 'trait',
    title: 'The Mana Spring at {location_name}',
    description: 'A shimmering spring of raw mana bubbles up from the earth at {location_name}. Only someone attuned to magical forces can safely harness its energy.',
    preferredClass: '',
    traitAxis: 'pm',
    traitPolarity: 'positive',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'attack',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} extends a hand over the spring and channels its energy with practiced ease. Their magical attunement lets them draw power without risk.',
    narrativeOnComplete: 'The mana spring\'s energy courses through the party, amplifying their attacks with arcane resonance.',
    difficultyModifier: 0,
  },

  // --- od axis: Offensive (negative) vs Defensive (positive) ---

  // 9. Offensive (od negative)
  {
    encounterId: 'trait_offensive_charge',
    category: 'trait',
    title: 'Ambush at the {dungeon_name} Bridge',
    description: 'Enemy forces guard a critical bridge near {dungeon_name}. A daring aggressive charge could scatter them before they organize.',
    preferredClass: '',
    traitAxis: 'od',
    traitPolarity: 'negative',
    triggerType: 'travel_segment',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'attack',
    buffAmount: 12,
    narrativeOnMatch: '{hero_name} leads the charge without hesitation, striking hard and fast. Their offensive instincts turn a dangerous standoff into a rout.',
    narrativeOnComplete: 'The bridge is taken. The party\'s aggressive momentum carries forward, their attacks sharper than ever.',
    difficultyModifier: 1,
  },
  // 10. Defensive (od positive)
  {
    encounterId: 'trait_defensive_wall',
    category: 'trait',
    title: 'Protect the Caravan at {destination_name}',
    description: 'A caravan bound for {destination_name} is under attack. Someone must organize the defense and hold until reinforcements arrive.',
    preferredClass: '',
    traitAxis: 'od',
    traitPolarity: 'positive',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'defense',
    buffAmount: 12,
    narrativeOnMatch: '{hero_name} takes command of the defense, positioning defenders and shoring up weak points. Their defensive instincts are flawless.',
    narrativeOnComplete: 'The caravan is saved. The grateful merchants share supplies, and the party\'s defensive posture is strengthened.',
    difficultyModifier: 1,
  },

  // --- sa axis: Supportive (negative) vs Attacker (positive) ---

  // 11. Supportive (sa negative)
  {
    encounterId: 'trait_supportive_heal',
    category: 'trait',
    title: 'The Wounded of {location_name}',
    description: 'The people of {location_name} have been hit by a raid. Many are wounded and need tending. A compassionate, supportive soul could make all the difference.',
    preferredClass: '',
    traitAxis: 'sa',
    traitPolarity: 'negative',
    triggerType: 'town_visit',
    triggerLocation: 'town',
    isKeyEvent: false,
    buffType: 'healing',
    buffAmount: 12,
    narrativeOnMatch: '{hero_name} moves among the wounded with gentle hands and quiet words of comfort. Their supportive nature brings hope where there was none.',
    narrativeOnComplete: 'The grateful townsfolk share their best healing salves. The party\'s recovery abilities are enhanced.',
    difficultyModifier: 0,
  },
  // 12. Attacker (sa positive)
  {
    encounterId: 'trait_attacker_champion',
    category: 'trait',
    title: 'Challenge of the {creature_name}',
    description: 'A fearsome {creature_name} has claimed this territory. Defeating it requires a fighter\'s killer instinct — someone who lives to attack.',
    preferredClass: '',
    traitAxis: 'sa',
    traitPolarity: 'positive',
    triggerType: 'travel_segment',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'attack',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} steps forward eagerly, weapon raised. Their aggressive fighting spirit is exactly what\'s needed. Strike first, strike hard.',
    narrativeOnComplete: 'The {creature_name} falls. The party\'s offensive power grows, fueled by the thrill of the kill.',
    difficultyModifier: 2,
  },

  // --- rc axis: Risky (negative) vs Cautious (positive) ---

  // 13. Risky (rc negative)
  {
    encounterId: 'trait_risky_leap',
    category: 'trait',
    title: 'The Chasm near {dungeon_name}',
    description: 'A deep chasm splits the path. A crumbling bridge offers passage, but it could collapse at any moment. Only someone bold enough to take the risk can cross first.',
    preferredClass: '',
    traitAxis: 'rc',
    traitPolarity: 'negative',
    triggerType: 'travel_segment',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'speed',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} doesn\'t hesitate — they sprint across the crumbling bridge as stones fall into the void. A risk-taker through and through.',
    narrativeOnComplete: 'The crossing is secured. The party\'s boldness is rewarded with faster progress through the treacherous terrain.',
    difficultyModifier: 1,
  },
  // 14. Cautious (rc positive)
  {
    encounterId: 'trait_cautious_signs',
    category: 'trait',
    title: 'The Trapped Corridor of {dungeon_name}',
    description: 'The corridor ahead is lined with ancient traps. Rushing through would be suicide. Someone with a cautious eye must spot the triggers.',
    preferredClass: '',
    traitAxis: 'rc',
    traitPolarity: 'positive',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'defense',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} examines every flagstone, every wall groove, with painstaking patience. Their caution saves the party from a dozen hidden traps.',
    narrativeOnComplete: 'The corridor is navigated safely. The party\'s careful approach leaves them better protected against future hazards.',
    difficultyModifier: 0,
  },

  // --- fw axis: Fire (negative) vs Water (positive) ---

  // 15. Fire (fw negative)
  {
    encounterId: 'trait_fire_barrier',
    category: 'trait',
    title: 'The Flame Barrier at {location_name}',
    description: 'A wall of magical fire blocks the path. Someone with an affinity for fire magic might be able to command the flames to part.',
    preferredClass: '',
    traitAxis: 'fw',
    traitPolarity: 'negative',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'attack',
    buffAmount: 8,
    narrativeOnMatch: '{hero_name} steps toward the inferno without flinching. They raise a hand and the flames bend to their will, parting like a curtain. Fire recognizes fire.',
    narrativeOnComplete: 'The flames leave an ember-glow on the party\'s weapons. Attacks burn hotter in the encounters ahead.',
    difficultyModifier: 0,
  },
  // 16. Water (fw positive)
  {
    encounterId: 'trait_water_flood',
    category: 'trait',
    title: 'The Flooded Passage near {dungeon_name}',
    description: 'Rising waters have flooded the only route through. Someone with a deep connection to water could calm the current and create safe passage.',
    preferredClass: '',
    traitAxis: 'fw',
    traitPolarity: 'positive',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'healing',
    buffAmount: 8,
    narrativeOnMatch: '{hero_name} kneels at the water\'s edge and places both palms on the surface. The raging current stills. Water answers to its own.',
    narrativeOnComplete: 'The calmed waters leave the party refreshed. A soothing energy enhances their natural recovery.',
    difficultyModifier: 0,
  },

  // --- we axis: Wind (negative) vs Earth (positive) ---

  // 17. Wind (we negative)
  {
    encounterId: 'trait_wind_storm',
    category: 'trait',
    title: 'The Storm above {location_name}',
    description: 'A violent storm rages, blocking all travel. Someone attuned to wind and weather could navigate through the eye of the storm.',
    preferredClass: '',
    traitAxis: 'we',
    traitPolarity: 'negative',
    triggerType: 'travel_segment',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'speed',
    buffAmount: 12,
    narrativeOnMatch: '{hero_name} reads the wind like an open book, guiding the party through gaps in the tempest. Wind is their element.',
    narrativeOnComplete: 'The storm passes. The party travels faster now, carried by favorable winds.',
    difficultyModifier: 0,
  },
  // 18. Earth (we positive)
  {
    encounterId: 'trait_earth_landslide',
    category: 'trait',
    title: 'The Landslide at {dungeon_name}',
    description: 'A massive landslide blocks the mountain pass. Someone with an affinity for earth and stone could find the weak points and clear a path.',
    preferredClass: '',
    traitAxis: 'we',
    traitPolarity: 'positive',
    triggerType: 'location_enter',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'defense',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} places a hand against the rubble and feels the stone\'s grain. With precise strikes at key stress points, the blockage crumbles. Earth speaks to earth.',
    narrativeOnComplete: 'The cleared path reveals mineral deposits. The party\'s armor and resilience benefit from the earth\'s gift.',
    difficultyModifier: 0,
  },

  // --- ld axis: Light (negative) vs Darkness (positive) ---

  // 19. Light (ld negative)
  {
    encounterId: 'trait_light_purify',
    category: 'trait',
    title: 'The Corrupted Shrine near {location_name}',
    description: 'A once-holy shrine near {location_name} has been corrupted by dark magic. Someone aligned with the light could purify it and restore its power.',
    preferredClass: '',
    traitAxis: 'ld',
    traitPolarity: 'negative',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'healing',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} channels radiant energy into the shrine. The corruption burns away like morning mist. Their connection to the light is undeniable.',
    narrativeOnComplete: 'The purified shrine bathes the party in restorative light. Healing comes easier in the days ahead.',
    difficultyModifier: 0,
  },
  // 20. Darkness (ld positive)
  {
    encounterId: 'trait_darkness_shadow',
    category: 'trait',
    title: 'The Shadow Passage beneath {dungeon_name}',
    description: 'A shortcut through the shadow realm lies beneath {dungeon_name}. Only someone comfortable in darkness can guide the party safely through.',
    preferredClass: '',
    traitAxis: 'ld',
    traitPolarity: 'positive',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'crit',
    buffAmount: 8,
    narrativeOnMatch: '{hero_name} steps into the darkness without fear. Where others see only void, they see paths and shapes. Darkness is their ally.',
    narrativeOnComplete: 'Emerging from the shadow realm, the party carries a predator\'s edge. Their strikes find vital points more easily.',
    difficultyModifier: 0,
  },

  // --- co axis: Chaos (negative) vs Order (positive) ---

  // 21. Chaos (co negative)
  {
    encounterId: 'trait_chaos_tide',
    category: 'trait',
    title: 'The Chaotic Battlefield near {location_name}',
    description: 'A three-way battle rages near {location_name}. In the confusion, someone who thrives in chaos could turn the situation to the party\'s advantage.',
    preferredClass: '',
    traitAxis: 'co',
    traitPolarity: 'negative',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'crit',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} dives into the melee, weaving between factions, exploiting every opening. Where others see chaos, they see opportunity.',
    narrativeOnComplete: 'The battlefield clears. The party emerges with spoils and sharper instincts. Chaos favored the bold.',
    difficultyModifier: 1,
  },
  // 22. Order (co positive)
  {
    encounterId: 'trait_order_militia',
    category: 'trait',
    title: 'Rally the People of {destination_name}',
    description: 'The people of {destination_name} are panicked and disorganized. Someone with a talent for order and structure could form them into a functioning militia.',
    preferredClass: '',
    traitAxis: 'co',
    traitPolarity: 'positive',
    triggerType: 'town_visit',
    triggerLocation: 'town',
    isKeyEvent: false,
    buffType: 'defense',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} takes charge, assigning roles and drilling formations with calm authority. Order from chaos — their natural gift.',
    narrativeOnComplete: 'The militia holds. Grateful citizens provide the party with reinforced equipment, bolstering their defenses.',
    difficultyModifier: 0,
  },

  // --- sh axis: Sly (negative) vs Honorable (positive) ---

  // 23. Sly (sh negative)
  {
    encounterId: 'trait_sly_poison',
    category: 'trait',
    title: 'Sabotage {villain_name}\'s Supplies',
    description: '{villain_name}\'s forward camp stores supplies for the next assault. A cunning, sly operative could sabotage them without being detected.',
    preferredClass: '',
    traitAxis: 'sh',
    traitPolarity: 'negative',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'attack',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} moves through the shadows, tainting rations and dulling blades. No honor in it — but devastating effectiveness. A sly mind at work.',
    narrativeOnComplete: 'The sabotage weakens the enemy for future battles. The party\'s attacks hit harder against debilitated foes.',
    difficultyModifier: 0,
  },
  // 24. Honorable (sh positive)
  {
    encounterId: 'trait_honor_challenge',
    category: 'trait',
    title: 'The Honor Duel at {location_name}',
    description: 'An enemy captain offers single combat at {location_name}. An honorable response could earn respect — and valuable information — from the enemy ranks.',
    preferredClass: '',
    traitAxis: 'sh',
    traitPolarity: 'positive',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'xp',
    buffAmount: 15,
    narrativeOnMatch: '{hero_name} steps forward and accepts the duel with a formal salute. Their sense of honor earns the respect of friend and foe alike.',
    narrativeOnComplete: 'The duel is won fairly. The defeated captain shares intelligence, and the party gains invaluable experience.',
    difficultyModifier: 1,
  },

  // --- rm axis: Range (negative) vs Melee (positive) ---

  // 25. Range (rm negative)
  {
    encounterId: 'trait_range_sniper',
    category: 'trait',
    title: 'Overwatch at the {dungeon_name} Pass',
    description: 'Enemy scouts patrol the pass below {dungeon_name}. A skilled ranged combatant could pick them off from the high ground without alerting the main force.',
    preferredClass: '',
    traitAxis: 'rm',
    traitPolarity: 'negative',
    triggerType: 'travel_segment',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'attack',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} takes position on the ridge, nocking an arrow with practiced ease. Each shot finds its mark. At range, they are untouchable.',
    narrativeOnComplete: 'The scouts fall before they can raise the alarm. The party\'s ranged precision carries forward into future encounters.',
    difficultyModifier: 0,
  },
  // 26. Melee (rm positive)
  {
    encounterId: 'trait_melee_break',
    category: 'trait',
    title: 'The Barricade at {location_name}',
    description: 'A fortified barricade blocks the road to {location_name}. Arrows and spells bounce off. Someone must close the distance and break through in close combat.',
    preferredClass: '',
    traitAxis: 'rm',
    traitPolarity: 'positive',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'attack',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} charges the barricade with a devastating roar, weapon swinging in wide arcs. In melee range, they are a force of nature.',
    narrativeOnComplete: 'The barricade splinters. Close-quarters dominance gives the party an edge in the fights to come.',
    difficultyModifier: 1,
  },

  // --- ai axis: Absorb (negative) vs Inflict (positive) ---

  // 27. Absorb (ai negative)
  {
    encounterId: 'trait_absorb_storm',
    category: 'trait',
    title: 'The Elemental Bombardment at {location_name}',
    description: 'A magical bombardment rains down on the party\'s position at {location_name}. Someone who can absorb punishment must shield the group.',
    preferredClass: '',
    traitAxis: 'ai',
    traitPolarity: 'negative',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'defense',
    buffAmount: 12,
    narrativeOnMatch: '{hero_name} stands firm as magical energy crashes against them. They absorb blow after blow, shielding the party. A living wall.',
    narrativeOnComplete: 'The bombardment ends. The party\'s resilience is reinforced by the defender\'s example.',
    difficultyModifier: 1,
  },
  // 28. Inflict (ai positive)
  {
    encounterId: 'trait_inflict_strike',
    category: 'trait',
    title: 'The {creature_name}\'s Lair',
    description: 'A massive {creature_name} guards a critical passage. It seems invincible — unless someone can spot and exploit its weakness.',
    preferredClass: '',
    traitAxis: 'ai',
    traitPolarity: 'positive',
    triggerType: 'location_enter',
    triggerLocation: 'wilderness',
    isKeyEvent: false,
    buffType: 'crit',
    buffAmount: 10,
    narrativeOnMatch: '{hero_name} studies the beast with predator\'s eyes, then strikes at the gap between armor plates. Maximum damage, minimum effort. Born to inflict pain.',
    narrativeOnComplete: 'The beast falls, revealing the passage beyond. The party\'s critical strike ability is honed by the lesson.',
    difficultyModifier: 2,
  },

  // --- af axis: Area (negative) vs Focus (positive) ---

  // 29. Area (af negative)
  {
    encounterId: 'trait_area_scatter',
    category: 'trait',
    title: 'The {enemy_name} Horde at {location_name}',
    description: 'A vast horde of {enemy_name} blocks the way. Individual combat is futile — someone must unleash devastating area attacks to scatter them.',
    preferredClass: '',
    traitAxis: 'af',
    traitPolarity: 'negative',
    triggerType: 'travel_segment',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'attack',
    buffAmount: 8,
    narrativeOnMatch: '{hero_name} unleashes a sweeping attack that catches dozens of enemies at once. Their talent for area devastation turns the tide.',
    narrativeOnComplete: 'The horde scatters. The party pushes through, their area combat tactics refined for the battles ahead.',
    difficultyModifier: 1,
  },
  // 30. Focus (af positive)
  {
    encounterId: 'trait_focus_duel',
    category: 'trait',
    title: 'Duel {villain_name}\'s Lieutenant',
    description: '{villain_name}\'s most dangerous lieutenant challenges the party to single combat. Only someone with razor-sharp focus on a single target can prevail.',
    preferredClass: '',
    traitAxis: 'af',
    traitPolarity: 'positive',
    triggerType: 'location_enter',
    triggerLocation: 'any',
    isKeyEvent: false,
    buffType: 'crit',
    buffAmount: 12,
    narrativeOnMatch: '{hero_name} locks eyes with the lieutenant and tunes out everything else. One target, total focus. The duel ends in a single devastating exchange.',
    narrativeOnComplete: 'The lieutenant falls. The party\'s ability to focus fire on priority targets is sharpened.',
    difficultyModifier: 2,
  },
];

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

  // 1. Draw objective
  const objective = OBJECTIVE_TEMPLATES[rng.next() % OBJECTIVE_TEMPLATES.length];

  // 2. Determine milestone count (5 or 6)
  const milestoneCount = rng.intRange(5, 6);

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

  // Draw NPC
  const npc = NPC_POOL[rng.next() % NPC_POOL.length];
  bindings['npc_name'] = npc.name;
  bindings['npc_role'] = npc.role;
  bindings['npc_personality'] = npc.personality;

  // Draw a second NPC for quest_giver
  const npc2 = NPC_POOL[rng.next() % NPC_POOL.length];
  bindings['quest_giver'] = npc2.name;

  // Draw villain
  const villain = VILLAIN_POOL[rng.next() % VILLAIN_POOL.length];
  bindings['villain_name'] = villain.name;
  bindings['villain_title'] = villain.title;
  bindings['threat_desc'] = villain.threatDesc;
  bindings['captor_name'] = `${villain.name} ${villain.title}`;

  // Draw item
  const item = ITEM_POOL[rng.next() % ITEM_POOL.length];
  bindings['item_name'] = item.name;
  bindings['item_origin'] = item.origin;

  // Draw location flavour
  bindings['dungeon_name'] = rng.pick(LOCATION_FLAVOUR_POOL);
  bindings['ruin_name'] = rng.pick(LOCATION_FLAVOUR_POOL);
  bindings['location_name'] = rng.pick(LOCATION_FLAVOUR_POOL);

  // Draw creature
  bindings['creature_name'] = rng.pick(CREATURE_POOL);

  // Draw enemy type
  bindings['enemy_name'] = rng.pick(ENEMY_NAME_POOL);

  // Draw rival (reuse NPC pool)
  const rival = NPC_POOL[rng.next() % NPC_POOL.length];
  bindings['rival_name'] = rival.name;

  // Draw miscellaneous slots
  bindings['curse_name'] = rng.pick(CURSE_POOL);
  bindings['cursed_location'] = rng.pick(LOCATION_FLAVOUR_POOL);
  bindings['portal_name'] = rng.pick(PORTAL_POOL);
  bindings['portal_location'] = rng.pick(LOCATION_FLAVOUR_POOL);
  bindings['seal_item'] = rng.pick(ITEM_POOL).name;
  bindings['riddle_name'] = rng.pick(RIDDLE_POOL);
  bindings['threat_name'] = rng.pick(THREAT_POOL);
  bindings['info_name'] = rng.pick(INFO_POOL);
  bindings['inscription_name'] = rng.pick(INSCRIPTION_POOL);
  bindings['cargo_desc'] = rng.pick(CARGO_POOL);
  bindings['destination_name'] = rng.pick(DESTINATION_POOL);

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
  for (const heroEnc of quest.heroEncounters) {
    if (heroEnc.isCompleted && heroEnc.triggerDay > 0) {
      // Encounter trigger — headline (Level 1)
      emit(heroEnc.triggerDay, 3, 1,
        `⭐ ${heroEnc.title}`);
      // Goal description and match reason (Level 2 — Standard)
      emit(heroEnc.triggerDay, 3, 2,
        heroEnc.description);
      emit(heroEnc.triggerDay, 4, 2,
        `🌟 ${heroEnc.matchReason}`);
      // What happens — hero in action (Level 3 — Detailed)
      emit(heroEnc.triggerDay, 5, 3,
        heroEnc.narrativeOnMatch);
      // Outcome: passed + buff granted (Level 2 — Standard)
      emit(heroEnc.triggerDay, 6, 2,
        `✅ Passed: ${heroEnc.narrativeOnComplete} (+${heroEnc.buffAmount}% ${heroEnc.buffType} buff, +${QUEST_HERO_ENCOUNTER_BONUS} points)`);
    } else if (!heroEnc.isCompleted && heroEnc.triggerDay > 0) {
      // Encounter was scheduled but the adventure ended before it triggered
      emit(maxDay, 9, 2,
        `❌ ${heroEnc.title}: Not reached — the party completed their objective before this encounter could be attempted.`);
    }
  }

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
