/**
 * World Data — TypeScript representation of the persistent world.
 *
 * This module provides typed access to world locations, paths, NPCs, hero
 * arrival comments, and blocking encounters for use in narrative generation
 * and quest composition.
 *
 * **BRL is the single source of truth.**  Call `initWorldData()` to load
 * data from `story-world-data.brl` at runtime.  The hardcoded data below
 * serves as a fallback for environments where BRL files are unavailable
 * (e.g. unit tests).
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

// ── World Locations (15) ────────────────────────────────────────────────────
// Fallback data — overridden when initWorldData() loads from BRL.

export let WORLD_LOCATIONS: readonly WorldLocation[] = [
  {
    locationId: 'ashfall_town', name: 'Ashfall', locationType: 'town',
    region: 'volcanic_wastes',
    description: 'The trading town of Ashfall sits at the edge of the volcanic wastes, its stone buildings streaked with soot. The air is thick with the smell of sulfur, and the distant glow of lava lights the southern sky. Merchants hawk fire-resistant cloaks and dragonglass trinkets in the market square.',
    elementalAffinity: 'fire', dangerLevel: 1, tags: 'volcanic,warm,trade',
  },
  {
    locationId: 'ironhold', name: 'Ironhold', locationType: 'town',
    region: 'northern_highlands',
    description: 'Ironhold clings to the mountainside like a fortress carved from the rock itself. The rhythmic clang of hammers echoes from the forges below, and the air tastes of iron and cold stone. The town\'s walls have never been breached.',
    elementalAffinity: 'earth', dangerLevel: 2, tags: 'mountain,mining,fortified',
  },
  {
    locationId: 'mistshore', name: 'Mistshore', locationType: 'town',
    region: 'eastern_coast',
    description: 'Mistshore is a harbour town perpetually draped in sea fog. The sound of waves and creaking hulls fills the air, and lanterns glow dimly along the docks. Fishermen mend nets while sailors trade stories of what lurks beneath the tides.',
    elementalAffinity: 'water', dangerLevel: 1, tags: 'coastal,fishing,fog',
  },
  {
    locationId: 'dawnspire', name: 'Dawnspire', locationType: 'town',
    region: 'central_plains',
    description: 'Dawnspire rises from the plains like a beacon, its white spire catching the first light of every morning. Pilgrims and scholars gather here to study the ancient texts housed in the Grand Archive. The air shimmers with faint traces of divine magic.',
    elementalAffinity: 'light', dangerLevel: 1, tags: 'holy,pilgrimage,archives',
  },
  {
    locationId: 'thornfield', name: 'Thornfield', locationType: 'town',
    region: 'western_forest',
    description: 'A sturdy market town at the forest\'s edge, Thornfield serves as the last outpost of civilisation before the deep woods. Thorn hedges line every wall, and the townsfolk keep watchfires burning through the night. Trade caravans rest here before venturing east or west.',
    elementalAffinity: 'neutral', dangerLevel: 2, tags: 'forest,market,border',
  },
  {
    locationId: 'ember_hollow', name: 'Ember Hollow', locationType: 'wilderness',
    region: 'volcanic_wastes',
    description: 'The ground here seeps with volcanic heat, and jets of steam burst from cracks in the dark rock. Pools of molten stone glow in the deeper caverns. Few creatures thrive here, but those that do are forged in fire.',
    elementalAffinity: 'fire', dangerLevel: 3, tags: 'volcanic,caverns,sulfur',
  },
  {
    locationId: 'galeridge', name: 'Galeridge', locationType: 'wilderness',
    region: 'northern_highlands',
    description: 'An exposed ridge high in the northern mountains, Galeridge is a place where the wind never stops. The rocky terrain offers little shelter, and the gusts can knock a person off their feet. On clear days, the view stretches to the distant coast.',
    elementalAffinity: 'wind', dangerLevel: 3, tags: 'mountain,exposed,windy',
  },
  {
    locationId: 'deeproot', name: 'Deeproot', locationType: 'wilderness',
    region: 'western_forest',
    description: 'The ancient forest of Deeproot is older than any kingdom. Trees tower hundreds of feet overhead, their roots forming a tangled labyrinth. The canopy is so thick that even at noon the forest floor lies in twilight. Something ancient sleeps here.',
    elementalAffinity: 'earth', dangerLevel: 3, tags: 'forest,ancient,overgrown',
  },
  {
    locationId: 'shadowmere', name: 'Shadowmere', locationType: 'wilderness',
    region: 'eastern_coast',
    description: 'A perpetual twilight hangs over Shadowmere. The twisted trees rise from dark, still water, their branches draped with pale moss. Something watches from the fog \u2014 the party can feel it.',
    elementalAffinity: 'darkness', dangerLevel: 4, tags: 'swamp,cursed,fog',
  },
  {
    locationId: 'radiant_glade', name: 'Radiant Glade', locationType: 'shrine',
    region: 'central_plains',
    description: 'Shafts of golden light pierce the canopy, illuminating a clearing of impossible beauty. The shrine at the centre hums with a gentle warmth, and the grass here grows thick and green. Even the most hardened warrior feels a moment of peace.',
    elementalAffinity: 'light', dangerLevel: 2, tags: 'holy,clearing,healing',
  },
  {
    locationId: 'sunken_crypt', name: 'The Sunken Crypt', locationType: 'dungeon',
    region: 'eastern_coast',
    description: 'Half-submerged in brackish water, the Sunken Crypt was once a grand mausoleum. Barnacles crust the stone columns, and the water is cold and black. The dead here do not rest easily.',
    elementalAffinity: 'darkness', dangerLevel: 4, tags: 'underground,flooded,undead',
  },
  {
    locationId: 'stormcrest', name: 'Stormcrest', locationType: 'ruins',
    region: 'northern_highlands',
    description: 'Once a proud watchtower, Stormcrest is now a ruin battered by endless wind. The stones are worn smooth, and the remaining walls groan with each gust. Lightning scars mark every surface. The view from the summit stretches to the horizon.',
    elementalAffinity: 'wind', dangerLevel: 4, tags: 'mountain,ruined,exposed',
  },
  {
    locationId: 'obsidian_reach', name: 'Obsidian Reach', locationType: 'fortress',
    region: 'volcanic_wastes',
    description: 'A fortress of black volcanic glass rises from a sea of cooled lava flows. The walls shimmer with heat haze, and the gates are carved with warnings in a dead language. Whatever lives inside commands fire itself.',
    elementalAffinity: 'fire', dangerLevel: 5, tags: 'volcanic,fortified,final',
  },
  {
    locationId: 'glimmer_falls', name: 'Glimmer Falls', locationType: 'wilderness',
    region: 'eastern_coast',
    description: 'A hidden waterfall cascades into a crystal-clear pool surrounded by mossy rocks. The spray catches the light, creating permanent rainbows in the mist. The water here is said to have restorative properties.',
    elementalAffinity: 'water', dangerLevel: 2, tags: 'waterfall,peaceful,hidden',
  },
  {
    locationId: 'murks_end', name: "Murk's End", locationType: 'ruins',
    region: 'western_forest',
    description: 'The ruins of a forgotten settlement swallowed by the marsh. Rotting timber frames jut from the mud like the ribs of a great beast. Strange lights dance in the fog at night, luring the unwary deeper into the mire.',
    elementalAffinity: 'darkness', dangerLevel: 5, tags: 'swamp,ruined,cursed',
  },
];

// ── World Paths (25) ────────────────────────────────────────────────────────

export let WORLD_PATHS: readonly WorldPath[] = [
  { pathId: 'ashfall_ember', fromLocationId: 'ashfall_town', toLocationId: 'ember_hollow', pathType: 'imperial_road', travelHours: 3, dangerRating: 2, description: 'A well-maintained trade road cuts through the volcanic wastes, marked by obsidian mile-posts. Ash drifts across the paving stones.', encounterTags: 'volcanic,fire,bandit', bidirectional: true },
  { pathId: 'ashfall_ironhold', fromLocationId: 'ashfall_town', toLocationId: 'ironhold', pathType: 'mountain_pass', travelHours: 5, dangerRating: 3, description: 'A steep mountain trail winds upward from the volcanic lowlands into the cold heights of the northern highlands. The air thins as the path climbs.', encounterTags: 'mountain,orc,ogre', bidirectional: true },
  { pathId: 'ashfall_thornfield', fromLocationId: 'ashfall_town', toLocationId: 'thornfield', pathType: 'forest_trail', travelHours: 4, dangerRating: 2, description: 'The trail winds through scrubland that gradually gives way to dense forest. The volcanic heat fades as the canopy closes overhead.', encounterTags: 'forest,goblin,wolf', bidirectional: true },
  { pathId: 'ember_obsidian', fromLocationId: 'ember_hollow', toLocationId: 'obsidian_reach', pathType: 'underground_tunnel', travelHours: 4, dangerRating: 4, description: 'A lava tube carved by ancient eruptions leads deep beneath the volcanic wastes. The walls glow faintly with residual heat, and the air is stifling.', encounterTags: 'underground,fire,demon', bidirectional: true },
  { pathId: 'ember_galeridge', fromLocationId: 'ember_hollow', toLocationId: 'galeridge', pathType: 'mountain_pass', travelHours: 5, dangerRating: 3, description: 'The path ascends sharply from the volcanic basin, crossing a barren ridge where nothing grows. The wind picks up as the altitude increases.', encounterTags: 'mountain,wind,dragon', bidirectional: true },
  { pathId: 'ironhold_galeridge', fromLocationId: 'ironhold', toLocationId: 'galeridge', pathType: 'mountain_pass', travelHours: 3, dangerRating: 3, description: 'A well-trodden miners\' path connects the two highland locations. Cairns mark the way through the rocky terrain.', encounterTags: 'mountain,orc,troll', bidirectional: true },
  { pathId: 'ironhold_dawnspire', fromLocationId: 'ironhold', toLocationId: 'dawnspire', pathType: 'imperial_road', travelHours: 4, dangerRating: 1, description: 'The Imperial Highway descends from the highlands into the central plains. Well-patrolled and paved with white stone, it is the safest route in the realm.', encounterTags: 'road,merchant,patrol', bidirectional: true },
  { pathId: 'ironhold_stormcrest', fromLocationId: 'ironhold', toLocationId: 'stormcrest', pathType: 'mountain_pass', travelHours: 4, dangerRating: 4, description: 'A treacherous climb along narrow ledges and crumbling stairs leads to the ruined watchtower of Stormcrest. The wind howls through the gaps.', encounterTags: 'mountain,wind,undead', bidirectional: true },
  { pathId: 'dawnspire_radiant', fromLocationId: 'dawnspire', toLocationId: 'radiant_glade', pathType: 'imperial_road', travelHours: 2, dangerRating: 1, description: 'A pilgrim\'s path lined with prayer flags leads from Dawnspire to the sacred glade. The road is peaceful and the air warm.', encounterTags: 'holy,pilgrim,peaceful', bidirectional: true },
  { pathId: 'dawnspire_thornfield', fromLocationId: 'dawnspire', toLocationId: 'thornfield', pathType: 'imperial_road', travelHours: 3, dangerRating: 1, description: 'The western highway passes through gentle farmland. Wheat fields sway on either side, and the road is busy with wagons.', encounterTags: 'road,merchant,bandit', bidirectional: true },
  { pathId: 'dawnspire_mistshore', fromLocationId: 'dawnspire', toLocationId: 'mistshore', pathType: 'imperial_road', travelHours: 4, dangerRating: 1, description: 'The eastern highway follows a river valley down to the coast. The mist thickens as the road approaches the harbour.', encounterTags: 'road,river,merchant', bidirectional: true },
  { pathId: 'thornfield_deeproot', fromLocationId: 'thornfield', toLocationId: 'deeproot', pathType: 'forest_trail', travelHours: 3, dangerRating: 3, description: 'A narrow trail plunges into the deep forest. The path grows darker and more overgrown with every mile. Old claw marks scar the trees.', encounterTags: 'forest,goblin,wolf,treant', bidirectional: true },
  { pathId: 'thornfield_murks', fromLocationId: 'thornfield', toLocationId: 'murks_end', pathType: 'marsh_track', travelHours: 5, dangerRating: 4, description: 'The track south of Thornfield descends into swampy lowlands. Wooden planks bridge the worst bogs, but many are rotting. Foul vapours rise from the murk.', encounterTags: 'swamp,undead,zombie,poison', bidirectional: true },
  { pathId: 'mistshore_shadowmere', fromLocationId: 'mistshore', toLocationId: 'shadowmere', pathType: 'coastal_path', travelHours: 3, dangerRating: 3, description: 'The coastal path south of Mistshore hugs the shoreline before veering inland through increasingly marshy terrain. The fog grows thicker.', encounterTags: 'coastal,swamp,smuggler', bidirectional: true },
  { pathId: 'mistshore_glimmer', fromLocationId: 'mistshore', toLocationId: 'glimmer_falls', pathType: 'coastal_path', travelHours: 2, dangerRating: 1, description: 'A pleasant coastal walk leads to a hidden cove where a waterfall tumbles from the cliffs. The path is sheltered and the going easy.', encounterTags: 'coastal,peaceful,water', bidirectional: true },
  { pathId: 'mistshore_sunken', fromLocationId: 'mistshore', toLocationId: 'sunken_crypt', pathType: 'underground_tunnel', travelHours: 3, dangerRating: 4, description: 'A half-flooded passage beneath the docks leads to the ancient crypt. Seawater seeps through the crumbling walls, and the darkness is absolute.', encounterTags: 'underground,undead,water', bidirectional: true },
  { pathId: 'galeridge_stormcrest', fromLocationId: 'galeridge', toLocationId: 'stormcrest', pathType: 'mountain_pass', travelHours: 3, dangerRating: 4, description: 'The exposed ridge path between Galeridge and Stormcrest offers no shelter from the relentless wind. One misstep means a long fall.', encounterTags: 'mountain,wind,dragon', bidirectional: true },
  { pathId: 'galeridge_obsidian', fromLocationId: 'galeridge', toLocationId: 'obsidian_reach', pathType: 'mountain_pass', travelHours: 5, dangerRating: 5, description: 'The most dangerous path in the realm descends from the frozen heights into the volcanic fortress region. Lava flows and ice storms alternate unpredictably.', encounterTags: 'mountain,fire,wind,dragon,demon', bidirectional: true },
  { pathId: 'deeproot_murks', fromLocationId: 'deeproot', toLocationId: 'murks_end', pathType: 'marsh_track', travelHours: 4, dangerRating: 4, description: 'The forest floor gradually gives way to sucking mud and standing water. The trees thin but the danger thickens \u2014 Murk\'s End is not a place found by accident.', encounterTags: 'swamp,forest,undead,poison', bidirectional: true },
  { pathId: 'deeproot_shadowmere', fromLocationId: 'deeproot', toLocationId: 'shadowmere', pathType: 'forest_trail', travelHours: 4, dangerRating: 3, description: 'An overgrown trail connects the ancient forest to the coastal swamps. The transition is gradual \u2014 the trees grow more twisted, and pools of dark water appear.', encounterTags: 'forest,swamp,darkness', bidirectional: true },
  { pathId: 'shadowmere_sunken', fromLocationId: 'shadowmere', toLocationId: 'sunken_crypt', pathType: 'marsh_track', travelHours: 3, dangerRating: 4, description: 'The path from Shadowmere to the Sunken Crypt is barely a path at all \u2014 more a series of half-submerged stepping stones through the black water.', encounterTags: 'swamp,undead,darkness', bidirectional: true },
  { pathId: 'shadowmere_murks', fromLocationId: 'shadowmere', toLocationId: 'murks_end', pathType: 'marsh_track', travelHours: 4, dangerRating: 5, description: 'The deepest, darkest stretch of marshland connects these two cursed places. Strange lights beckon travellers off the path, and the mud seems to pull at every step.', encounterTags: 'swamp,undead,darkness,cursed', bidirectional: true },
  { pathId: 'glimmer_radiant', fromLocationId: 'glimmer_falls', toLocationId: 'radiant_glade', pathType: 'forest_trail', travelHours: 3, dangerRating: 2, description: 'A gentle inland trail follows a stream uphill from the falls to the sacred glade. Wildflowers line the path, and birdsong fills the air.', encounterTags: 'forest,water,peaceful', bidirectional: true },
  { pathId: 'stormcrest_obsidian', fromLocationId: 'stormcrest', toLocationId: 'obsidian_reach', pathType: 'mountain_pass', travelHours: 4, dangerRating: 5, description: 'From the ruined watchtower, a perilous descent leads to the volcanic fortress. The path crosses a field of cooling lava, and the heat is almost unbearable.', encounterTags: 'mountain,fire,demon,dragon', bidirectional: true },
  { pathId: 'radiant_deeproot', fromLocationId: 'radiant_glade', toLocationId: 'deeproot', pathType: 'forest_trail', travelHours: 3, dangerRating: 2, description: 'The trail from the sacred glade enters the forest proper. The golden light of the glade fades gradually as the ancient canopy closes overhead.', encounterTags: 'forest,earth,peaceful', bidirectional: true },
];

// ── World NPCs (20) ─────────────────────────────────────────────────────────

export let WORLD_NPCS: readonly WorldNpc[] = [
  { npcId: 'eldara', name: 'Eldara', role: 'sage', personality: 'mysterious', homeLocationId: 'dawnspire', additionalLocationIds: 'radiant_glade', greeting: 'The stars spoke of your coming. Ask your question \u2014 but be sure you want the answer.', description: 'An ageless woman with silver hair and knowing eyes. She speaks in riddles but her counsel is always true.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'brother_marek', name: 'Brother Marek', role: 'healer', personality: 'kind', homeLocationId: 'dawnspire', additionalLocationIds: 'radiant_glade', greeting: 'Welcome, travellers. You look weary \u2014 sit, and let me tend to your wounds.', description: 'A gentle monk in simple robes, always with healing herbs at hand. His quiet strength has saved countless lives.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'captain_voss', name: 'Captain Voss', role: 'guard_captain', personality: 'gruff', homeLocationId: 'ironhold', additionalLocationIds: '', greeting: "State your business. I haven't got all day.", description: 'A scarred veteran with a no-nonsense demeanour. He runs Ironhold\'s guard with iron discipline and grudging fairness.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'lira_swiftfoot', name: 'Lira Swiftfoot', role: 'scout', personality: 'anxious', homeLocationId: 'thornfield', additionalLocationIds: 'deeproot,galeridge', greeting: 'Shh! Did you hear that? No? Good. Good. Come, but stay quiet.', description: 'A skittish half-elf scout who knows every trail in the western forests. She sees danger in every shadow \u2014 and she\'s usually right.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: false },
  { npcId: 'theron_grey', name: 'Theron the Grey', role: 'scholar', personality: 'stoic', homeLocationId: 'dawnspire', additionalLocationIds: 'mistshore', greeting: 'Knowledge is the only true weapon. I trust you wield it wisely.', description: 'An elderly scholar with ink-stained fingers and a vast memory. He has spent decades studying the ancient texts of Dawnspire\'s archive.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'mira_coalhand', name: 'Mira Coalhand', role: 'blacksmith', personality: 'gruff', homeLocationId: 'ironhold', additionalLocationIds: '', greeting: 'Need something fixed? Put it on the bench. Otherwise, move along.', description: "Ironhold's master smith, as tough as the metal she works. Her blades are sought after across the realm.", canBeVillain: false, canBeAlly: true, canBeQuestGiver: false },
  { npcId: 'senna_brightleaf', name: 'Senna Brightleaf', role: 'herbalist', personality: 'kind', homeLocationId: 'deeproot', additionalLocationIds: 'thornfield', greeting: 'Oh, come in! I have just the tea to soothe those tired muscles.', description: 'A warm-hearted wood elf who gathers rare herbs from the deep forest. She knows every plant by name and speaks to them like old friends.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'darvok_ironjaw', name: 'Darvok Ironjaw', role: 'mercenary', personality: 'stoic', homeLocationId: 'ashfall_town', additionalLocationIds: 'ember_hollow', greeting: 'You need steel or information? I deal in both.', description: 'A battle-scarred dwarf mercenary who has survived more campaigns than he can count. He says little but misses nothing.', canBeVillain: true, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'pip_thistlewick', name: 'Pip Thistlewick', role: 'innkeeper', personality: 'kind', homeLocationId: 'thornfield', additionalLocationIds: '', greeting: "Welcome to the Thorny Rest! Ale's fresh and the beds are mostly clean.", description: 'A cheerful halfling innkeeper with a talent for overhearing things. Half the rumours in Thornfield pass through his tavern.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'zara_nightwhisper', name: 'Zara Nightwhisper', role: 'spy', personality: 'mysterious', homeLocationId: 'shadowmere', additionalLocationIds: 'mistshore', greeting: 'You did not see me. But I have been watching you.', description: 'A shadow operative whose true allegiances are known to none. She trades in secrets and always has an escape route planned.', canBeVillain: true, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'father_aldric', name: 'Father Aldric', role: 'priest', personality: 'kind', homeLocationId: 'radiant_glade', additionalLocationIds: 'dawnspire', greeting: 'The light welcomes all who seek it. How may I aid your journey?', description: 'The keeper of the Radiant Glade shrine. His faith is unshakeable and his kindness extends to all \u2014 even those who do not deserve it.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'kessa_dunewood', name: 'Kessa Dunewood', role: 'ranger', personality: 'stoic', homeLocationId: 'deeproot', additionalLocationIds: 'glimmer_falls', greeting: 'Tread softly here. The forest watches.', description: 'A taciturn ranger who has patrolled the deep forest for decades. She speaks rarely but her arrows speak loudly.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'grint_ashborn', name: 'Grint Ashborn', role: 'miner', personality: 'gruff', homeLocationId: 'ember_hollow', additionalLocationIds: 'ironhold', greeting: "Watch your step. The ground's hollow here \u2014 one wrong move and you're a smear.", description: 'A tough old dwarf who mines the volcanic caves for rare ores. He knows every tunnel in Ember Hollow and most of the ways to die in them.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'lyssa_moonveil', name: 'Lyssa Moonveil', role: 'enchantress', personality: 'mysterious', homeLocationId: 'mistshore', additionalLocationIds: 'shadowmere', greeting: 'The veil between worlds grows thin here. Can you feel it?', description: 'An ethereal woman who seems to exist partly in another realm. Her enchantments are powerful but her motives are inscrutable.', canBeVillain: true, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'rowan_flint', name: 'Rowan Flint', role: 'caravan_master', personality: 'anxious', homeLocationId: 'ashfall_town', additionalLocationIds: 'ironhold,thornfield', greeting: "Safe travels? Ha! There's no such thing. But we press on, don't we?", description: 'A nervous but capable caravan master who runs trade routes between the major towns. He always expects the worst \u2014 and prepares accordingly.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'dagna_stonehelm', name: 'Dagna Stonehelm', role: 'weaponsmith', personality: 'gruff', homeLocationId: 'ironhold', additionalLocationIds: 'ashfall_town', greeting: "Looking for a weapon? I forge the best in the highlands. Don't insult me by haggling.", description: 'A proud dwarven weaponsmith who considers each blade a work of art. Cross her and she\'ll add your name to her list of grudges.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: false },
  { npcId: 'fenwick_holloway', name: 'Fenwick Holloway', role: 'diplomat', personality: 'kind', homeLocationId: 'dawnspire', additionalLocationIds: 'mistshore', greeting: 'Ah, new faces! How wonderful. Dawnspire welcomes all who come in peace.', description: 'A silver-tongued diplomat who can negotiate a truce between sworn enemies. His pleasant demeanour masks a razor-sharp mind.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'shara_embervine', name: 'Shara Embervine', role: 'alchemist', personality: 'mysterious', homeLocationId: 'ember_hollow', additionalLocationIds: 'ashfall_town', greeting: "Careful with that vial \u2014 it's not labelled because I ran out of skull-and-crossbones stickers.", description: 'An alchemist who thrives in the volcanic heat, using rare minerals from the lava caves in her concoctions. Her potions are potent \u2014 and unpredictable.', canBeVillain: true, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'old_tormund', name: 'Old Tormund', role: 'fisherman', personality: 'stoic', homeLocationId: 'mistshore', additionalLocationIds: 'glimmer_falls', greeting: 'The sea gives and the sea takes. Today it gave me your company.', description: 'A weathered fisherman who has sailed every cove along the eastern coast. He knows the waters better than any chart, and tells tales of things beneath the waves.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
  { npcId: 'ylva_icemere', name: 'Ylva Icemere', role: 'huntress', personality: 'gruff', homeLocationId: 'galeridge', additionalLocationIds: 'stormcrest', greeting: "You're loud. Everything within a mile knows you're here. Come, follow \u2014 and try to be quiet.", description: 'A fierce huntress who stalks the mountain ridges. She survived a dragon attack that killed her entire hunting party, and has hunted alone since.', canBeVillain: false, canBeAlly: true, canBeQuestGiver: true },
];

// ── Hero Arrival Comments (40) ──────────────────────────────────────────────

export let HERO_ARRIVAL_COMMENTS: readonly HeroArrivalComment[] = [
  // Class-based (18)
  { commentId: 'cleric_darkness', triggerClass: 'Cleric', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'darkness', locationTags: '', comment: "{hero_name} shudders. 'I hate this darkness. The light of the divine feels so distant here.'", sentiment: 'negative' },
  { commentId: 'cleric_light', triggerClass: 'Cleric', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'light', locationTags: '', comment: "{hero_name} closes their eyes and breathes deeply. 'The divine presence is strong here. We are blessed.'", sentiment: 'positive' },
  { commentId: 'cleric_water', triggerClass: 'Cleric', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'water', locationTags: '', comment: "{hero_name} cups the water in their hands. 'Water cleanses all. There is healing here.'", sentiment: 'positive' },
  { commentId: 'paladin_light', triggerClass: 'Paladin', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'light', locationTags: '', comment: "{hero_name} breathes deeply. 'I can feel the grace of the divine in this place. We are protected here.'", sentiment: 'positive' },
  { commentId: 'paladin_darkness', triggerClass: 'Paladin', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'darkness', locationTags: '', comment: "{hero_name} grips their weapon tightly. 'Evil festers here. Stay vigilant \u2014 we walk on unholy ground.'", sentiment: 'negative' },
  { commentId: 'paladin_fire', triggerClass: 'Paladin', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'fire', locationTags: '', comment: "{hero_name} shields their eyes from the heat. 'This flame is not divine. It burns without purpose.'", sentiment: 'negative' },
  { commentId: 'ranger_earth', triggerClass: 'Ranger', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'earth', locationTags: '', comment: "{hero_name} kneels to touch the earth. 'The ground remembers old paths. We are not the first to walk here.'", sentiment: 'positive' },
  { commentId: 'ranger_wind', triggerClass: 'Ranger', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'wind', locationTags: '', comment: "{hero_name} reads the wind. 'The currents carry scents from far away. Something large has passed this way recently.'", sentiment: 'neutral' },
  { commentId: 'ranger_darkness', triggerClass: 'Ranger', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'darkness', locationTags: '', comment: "{hero_name} scans the treeline. 'My instincts say we're being watched. This is not a place to linger.'", sentiment: 'negative' },
  { commentId: 'mage_fire', triggerClass: 'Mage', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'fire', locationTags: '', comment: "{hero_name} smiles. 'Such raw elemental power... I could study this place for years.'", sentiment: 'positive' },
  { commentId: 'mage_wind', triggerClass: 'Mage', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'wind', locationTags: '', comment: "{hero_name} raises a hand and lets the wind curl around their fingers. 'The ley lines are turbulent here. Casting will be... interesting.'", sentiment: 'neutral' },
  { commentId: 'mage_earth', triggerClass: 'Mage', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'earth', locationTags: '', comment: "{hero_name} frowns. 'The earth here resists magic. My spells may not fly as far.'", sentiment: 'negative' },
  { commentId: 'warrior_wind', triggerClass: 'Warrior', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'wind', locationTags: '', comment: "{hero_name} braces against the wind. 'This gale would knock a lesser fighter off their feet.'", sentiment: 'neutral' },
  { commentId: 'warrior_earth', triggerClass: 'Warrior', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'earth', locationTags: '', comment: "{hero_name} stamps the ground approvingly. 'Solid footing. This is good ground for a fight.'", sentiment: 'positive' },
  { commentId: 'warrior_fire', triggerClass: 'Warrior', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'fire', locationTags: '', comment: "{hero_name} wipes the sweat from their brow. 'Fighting in this heat will test our endurance.'", sentiment: 'neutral' },
  { commentId: 'guardian_earth', triggerClass: 'Guardian', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'earth', locationTags: '', comment: "{hero_name} surveys the terrain. 'Good defensive ground. If trouble comes, we can hold here.'", sentiment: 'positive' },
  { commentId: 'guardian_fire', triggerClass: 'Guardian', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'fire', locationTags: '', comment: "{hero_name} eyes the molten ground warily. 'This is no place to make a stand. We should move quickly.'", sentiment: 'negative' },
  { commentId: 'guardian_light', triggerClass: 'Guardian', triggerTrait: '', triggerPolarity: '', elementalAffinity: 'light', locationTags: '', comment: "{hero_name} nods with quiet satisfaction. 'A sacred place. My shield arm feels stronger already.'", sentiment: 'positive' },
  // Trait-based (22)
  { commentId: 'od_neg_darkness', triggerClass: '', triggerTrait: 'od', triggerPolarity: 'negative', elementalAffinity: 'darkness', locationTags: '', comment: "{hero_name} moves to the front. 'Stay close. I'll shield us from whatever lurks in these shadows.'", sentiment: 'negative' },
  { commentId: 'od_pos_fire', triggerClass: '', triggerTrait: 'od', triggerPolarity: 'positive', elementalAffinity: 'fire', locationTags: '', comment: "{hero_name} grins at the volcanic landscape. 'Fire and fury \u2014 my kind of place.'", sentiment: 'positive' },
  { commentId: 'rc_neg_fire', triggerClass: '', triggerTrait: 'rc', triggerPolarity: 'negative', elementalAffinity: 'fire', locationTags: '', comment: "{hero_name} hesitates at the edge of the volcanic basin. 'Perhaps we should find another way around...'", sentiment: 'negative' },
  { commentId: 'rc_pos_darkness', triggerClass: '', triggerTrait: 'rc', triggerPolarity: 'positive', elementalAffinity: 'darkness', locationTags: '', comment: "{hero_name} peers into the darkness with excitement. 'What secrets does this place hold? Only one way to find out!'", sentiment: 'positive' },
  { commentId: 'sa_pos_fire', triggerClass: '', triggerTrait: 'sa', triggerPolarity: 'positive', elementalAffinity: 'fire', locationTags: '', comment: "{hero_name} gathers the party. 'The heat could be dangerous. Let me check everyone's water supplies.'", sentiment: 'neutral' },
  { commentId: 'sa_neg_fire', triggerClass: '', triggerTrait: 'sa', triggerPolarity: 'negative', elementalAffinity: 'fire', locationTags: '', comment: "{hero_name} grins at the hellish landscape. 'Fitting place for a battle. Let them come.'", sentiment: 'positive' },
  { commentId: 'pm_pos_earth', triggerClass: '', triggerTrait: 'pm', triggerPolarity: 'positive', elementalAffinity: 'earth', locationTags: '', comment: "{hero_name} flexes. 'Solid ground beneath my feet. This is where I fight best.'", sentiment: 'positive' },
  { commentId: 'pm_neg_wind', triggerClass: '', triggerTrait: 'pm', triggerPolarity: 'negative', elementalAffinity: 'wind', locationTags: '', comment: "{hero_name} feels the magical currents. 'The wind carries power here. My spells will fly far.'", sentiment: 'positive' },
  { commentId: 'sh_pos_light', triggerClass: '', triggerTrait: 'sh', triggerPolarity: 'positive', elementalAffinity: 'light', locationTags: '', comment: "{hero_name} kneels briefly. 'A place of truth and honour. I feel strengthened here.'", sentiment: 'positive' },
  { commentId: 'sh_neg_darkness', triggerClass: '', triggerTrait: 'sh', triggerPolarity: 'negative', elementalAffinity: 'darkness', locationTags: '', comment: "{hero_name} blends into the shadows. 'Finally, somewhere I can work properly.'", sentiment: 'positive' },
  { commentId: 'sh_pos_darkness', triggerClass: '', triggerTrait: 'sh', triggerPolarity: 'positive', elementalAffinity: 'darkness', locationTags: '', comment: "{hero_name} looks uncomfortable. 'This place reeks of dishonour. I shall not lower my guard.'", sentiment: 'negative' },
  { commentId: 'sh_neg_light', triggerClass: '', triggerTrait: 'sh', triggerPolarity: 'negative', elementalAffinity: 'light', locationTags: '', comment: "{hero_name} squints in the brightness. 'Too exposed. Nowhere to hide. I don't like it.'", sentiment: 'negative' },
  { commentId: 'co_neg_wind', triggerClass: '', triggerTrait: 'co', triggerPolarity: 'negative', elementalAffinity: 'wind', locationTags: '', comment: "{hero_name} laughs as the wind whips their hair. 'Chaos on the wind! Anything could happen here.'", sentiment: 'positive' },
  { commentId: 'co_pos_earth', triggerClass: '', triggerTrait: 'co', triggerPolarity: 'positive', elementalAffinity: 'earth', locationTags: '', comment: "{hero_name} studies the terrain methodically. 'Stable ground, defensible position. Good order.'", sentiment: 'positive' },
  { commentId: 'od_neg_water', triggerClass: '', triggerTrait: 'od', triggerPolarity: 'negative', elementalAffinity: 'water', locationTags: '', comment: "{hero_name} watches the water's edge. 'We should secure this position. Attacks could come from any direction.'", sentiment: 'neutral' },
  { commentId: 'rc_neg_darkness', triggerClass: '', triggerTrait: 'rc', triggerPolarity: 'negative', elementalAffinity: 'darkness', locationTags: '', comment: "{hero_name} peers into the gloom. 'Every instinct says to turn back. We should listen.'", sentiment: 'negative' },
  { commentId: 'sa_pos_light', triggerClass: '', triggerTrait: 'sa', triggerPolarity: 'positive', elementalAffinity: 'light', locationTags: '', comment: "{hero_name} smiles warmly. 'This light reminds me why we fight. Let me tend to everyone's wounds while we're here.'", sentiment: 'positive' },
  { commentId: 'pm_pos_fire', triggerClass: '', triggerTrait: 'pm', triggerPolarity: 'positive', elementalAffinity: 'fire', locationTags: '', comment: "{hero_name} rolls their shoulders. 'The heat stirs the blood. My blade arm feels strong.'", sentiment: 'positive' },
  { commentId: 'pm_neg_earth', triggerClass: '', triggerTrait: 'pm', triggerPolarity: 'negative', elementalAffinity: 'earth', locationTags: '', comment: "{hero_name} probes the magical wards in the stone. 'Ancient enchantments still linger. Fascinating.'", sentiment: 'positive' },
  { commentId: 'od_pos_wind', triggerClass: '', triggerTrait: 'od', triggerPolarity: 'positive', elementalAffinity: 'wind', locationTags: '', comment: "{hero_name} draws their weapon. 'The wind masks sound. Perfect for an ambush \u2014 theirs or ours.'", sentiment: 'neutral' },
  { commentId: 'rc_pos_fire', triggerClass: '', triggerTrait: 'rc', triggerPolarity: 'positive', elementalAffinity: 'fire', locationTags: '', comment: "{hero_name} strides forward eagerly. 'The danger here is palpable. My kind of challenge!'", sentiment: 'positive' },
  { commentId: 'sa_neg_darkness', triggerClass: '', triggerTrait: 'sa', triggerPolarity: 'negative', elementalAffinity: 'darkness', locationTags: '', comment: "{hero_name} cracks their knuckles. 'Whatever's hiding in this dark, it should be afraid of us.'", sentiment: 'positive' },
];

// ── Blocking Encounters (6) ─────────────────────────────────────────────────

export let BLOCKING_ENCOUNTERS: readonly BlockingEncounter[] = [
  { blockingId: 'troll_bridge', pathId: '', matchPathType: 'river_crossing,marsh_track', locationId: '', encounterType: 'combat', description: 'A massive river troll emerges from beneath the bridge, blocking the crossing.', resolutionType: 'defeat', enemies: 'River Troll', difficultyModifier: 1, narrativeOnBlock: 'A massive troll rises from the river, water cascading from its hide. It bellows a challenge that echoes off the canyon walls. The bridge is impassable until the creature is dealt with.', narrativeOnResolve: 'The troll collapses with a thunderous crash, its bulk sliding into the river below. The bridge is clear.', triggerChance: 0.3 },
  { blockingId: 'bandit_toll', pathId: '', matchPathType: 'imperial_road', locationId: '', encounterType: 'social', description: 'A group of bandits has set up a roadblock, demanding payment for passage.', resolutionType: 'persuade', enemies: 'Bandit Leader,Bandit', difficultyModifier: 0, narrativeOnBlock: "Armed figures step from behind makeshift barricades. Their leader, a scarred woman in mismatched armour, raises a hand. 'Toll road, friends. Fifty gold or turn around.'", narrativeOnResolve: 'The bandits part reluctantly, allowing the party to pass. Whether through silver tongue or silver coins, the road is open.', triggerChance: 0.25 },
  { blockingId: 'rockslide', pathId: '', matchPathType: 'mountain_pass', locationId: '', encounterType: 'puzzle', description: 'A fresh rockslide has completely blocked the narrow mountain pass.', resolutionType: 'solve', enemies: '', difficultyModifier: 0, narrativeOnBlock: 'Boulders and rubble fill the pass from wall to wall. The rockslide looks recent \u2014 dust still hangs in the air. There may be a way to clear a path, but it will take strength and cleverness.', narrativeOnResolve: 'With combined effort, the party manages to shift enough rock to squeeze through. The pass is narrow but navigable.', triggerChance: 0.35 },
  { blockingId: 'haunted_crossing', pathId: '', matchPathType: 'marsh_track', locationId: '', encounterType: 'combat', description: 'Restless spirits rise from the marsh, barring passage through the swamp.', resolutionType: 'defeat', enemies: 'Wraith,Ghost', difficultyModifier: 1, narrativeOnBlock: 'Pale figures rise from the dark water, their hollow eyes fixed on the party. The temperature drops sharply, and the path ahead is choked with spectral mist. There is no going around \u2014 only through.', narrativeOnResolve: 'The last spirit dissolves with a mournful wail. The spectral mist lifts, and the path through the marsh is clear once more.', triggerChance: 0.3 },
  { blockingId: 'guardian_gate', pathId: '', matchPathType: '', locationId: 'obsidian_reach,sunken_crypt', encounterType: 'combat', description: 'An ancient stone guardian blocks the entrance to a fortified location.', resolutionType: 'defeat', enemies: 'Stone Guardian', difficultyModifier: 2, narrativeOnBlock: 'The ground shakes as a massive stone figure uncurls from the gateway, its eyes blazing with ancient enchantments. It raises a fist the size of a barrel. This guardian was placed here to protect something \u2014 and it takes its duty seriously.', narrativeOnResolve: 'The guardian crumbles to rubble, its enchantment finally spent. The gate stands open.', triggerChance: 0.5 },
  { blockingId: 'enchanted_wall', pathId: '', matchPathType: 'underground_tunnel', locationId: '', encounterType: 'puzzle', description: 'A shimmering magical barrier seals the tunnel ahead.', resolutionType: 'solve', enemies: '', difficultyModifier: 0, narrativeOnBlock: 'The tunnel ahead shimmers with a translucent barrier of woven magic. Runes pulse along its surface, and the air crackles with static. Brute force will not work here \u2014 the barrier must be unravelled.', narrativeOnResolve: 'The last rune fades and the barrier dissolves like morning mist. The tunnel stretches ahead, dark and silent.', triggerChance: 0.4 },
];

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

// Build indexes from the hardcoded fallback data at module load time
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
 * the BRL file data.  If the BRL file is unavailable, the hardcoded
 * fallback data remains in place.
 *
 * Safe to call multiple times — subsequent calls return the cached result.
 */
export async function initWorldData(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const data = await loadWorldData();

    // Only replace data if the BRL load returned non-empty results
    if (data.locations.length > 0) WORLD_LOCATIONS = data.locations;
    if (data.paths.length > 0)     WORLD_PATHS = data.paths;
    if (data.npcs.length > 0)      WORLD_NPCS = data.npcs;
    if (data.heroArrivalComments.length > 0) HERO_ARRIVAL_COMMENTS = data.heroArrivalComments;
    if (data.blockingEncounters.length > 0)  BLOCKING_ENCOUNTERS = data.blockingEncounters;

    // Rebuild indexes with the new data
    _rebuildIndexes();
  })();

  return _initPromise;
}
