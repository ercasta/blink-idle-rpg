#!/usr/bin/env node
/**
 * compile-game-data.js
 *
 * Build-time script: extract entity data from BRL source files and produce
 * pre-compiled JSON data files served by the React app at runtime.
 *
 * This replaces runtime BRL parsing (brlParser.ts + data loaders fetching
 * raw BRL) with a build-time step that produces structured JSON.
 * The game app only loads the compiled JSON — it never parses BRL.
 *
 * Outputs (to game/app/public/game-data/):
 *   enemies.json        — EnemyTemplate[]
 *   scenarios.json      — Record<string, ModeConfig>
 *   hero-classes.json   — { classes: Record<string,HeroClassData>, balanceConfig }
 *   adventure-data.json — { objectives, milestones, events, heroEncounters }
 *   world-data.json     — { locations, paths, npcs, heroArrivalComments, blockingEncounters }
 *   skills.json         — SkillEntry[]
 *
 * Usage:
 *   node scripts/compile-game-data.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const BRL_DIR = path.join(ROOT, 'game', 'brl');
const OUT_DIR = path.join(ROOT, 'game', 'app', 'public', 'game-data');

// ── BRL parsing helpers ───────────────────────────────────────────────────────

function extractStringField(block, field) {
  const re = new RegExp(`\\b${field}:\\s*"([^"]*)"`, 's');
  const m = block.match(re);
  return m ? m[1] : '';
}

function extractNumberField(block, field) {
  const re = new RegExp(`\\b${field}:\\s*(-?[\\d.]+)d?\\b`);
  const m = block.match(re);
  return m ? parseFloat(m[1]) : undefined;
}

function extractBoolField(block, field) {
  const re = new RegExp(`\\b${field}:\\s*(true|false)\\b`);
  const m = block.match(re);
  return m ? m[1] === 'true' : undefined;
}

function extractComponent(entityBody, componentName) {
  const re = new RegExp(`\\b${componentName}\\s*\\{`);
  const m = re.exec(entityBody);
  if (!m) return undefined;

  let depth = 1;
  let pos = m.index + m[0].length;
  const start = pos;
  while (pos < entityBody.length && depth > 0) {
    if (entityBody[pos] === '{') depth++;
    if (entityBody[pos] === '}') depth--;
    pos++;
  }
  return entityBody.slice(start, pos - 1);
}

/**
 * Parse all top-level entities from raw BRL text.
 * Returns [{ name, components: [{name, body}] }]
 */
function parseEntities(text) {
  const entities = [];
  const entityDeclRe = /(?:let\s+)?(\w+)(?:\s*:\s*\w+)?\s*=\s*new\s+entity\s*\{/g;
  let m;

  while ((m = entityDeclRe.exec(text)) !== null) {
    const name = m[1];
    const bodyStart = m.index + m[0].length;

    let depth = 1;
    let pos = bodyStart;
    while (pos < text.length && depth > 0) {
      if (text[pos] === '{') depth++;
      if (text[pos] === '}') depth--;
      pos++;
    }

    const entityBody = text.slice(bodyStart, pos - 1);

    const components = [];
    const componentRe = /\b([A-Z]\w*)\s*\{/g;
    let cm;

    while ((cm = componentRe.exec(entityBody)) !== null) {
      const compName = cm[1];
      const compBodyStart = cm.index + cm[0].length;

      let compDepth = 1;
      let compPos = compBodyStart;
      while (compPos < entityBody.length && compDepth > 0) {
        if (entityBody[compPos] === '{') compDepth++;
        if (entityBody[compPos] === '}') compDepth--;
        compPos++;
      }

      components.push({
        name: compName,
        body: entityBody.slice(compBodyStart, compPos - 1),
      });

      componentRe.lastIndex = compPos;
    }

    entities.push({ name, components });
  }

  return entities;
}

function getComponent(entity, componentName) {
  return entity.components.find(c => c.name === componentName);
}

function readBrl(filename) {
  return fs.readFileSync(path.join(BRL_DIR, filename), 'utf8');
}

// ── enemies.json ─────────────────────────────────────────────────────────────

function compileEnemies() {
  const text = readBrl('enemies.brl');
  const entities = parseEntities(text);
  const templates = [];
  let nextId = 100;

  for (const entity of entities) {
    const character    = getComponent(entity, 'Character');
    const health       = getComponent(entity, 'Health');
    const combat       = getComponent(entity, 'Combat');
    const enemy        = getComponent(entity, 'Enemy');
    const enemyTemplate = getComponent(entity, 'EnemyTemplate');
    const stats        = getComponent(entity, 'Stats');
    const manaComp     = getComponent(entity, 'Mana');
    const finalBoss    = getComponent(entity, 'FinalBoss');

    if (!character || !health || !combat || !enemy || !enemyTemplate) continue;

    const isTemplate = extractBoolField(enemyTemplate.body, 'isTemplate');
    if (isTemplate !== true) continue;

    templates.push({
      id:             nextId++,
      tier:           extractNumberField(enemy.body, 'tier')           ?? 1,
      name:           extractStringField(character.body, 'name'),
      hp:             extractNumberField(health.body, 'max')           ?? 100,
      dmg:            extractNumberField(combat.body, 'damage')        ?? 10,
      def:            extractNumberField(combat.body, 'defense')       ?? 2,
      spd:            extractNumberField(combat.body, 'attackSpeed')   ?? 1.0,
      exp:            extractNumberField(enemy.body, 'expReward')      ?? 25,
      boss:           extractBoolField(enemy.body, 'isBoss')           ?? false,
      finalBoss:      finalBoss !== undefined,
      stats: {
        strength:      extractNumberField(stats?.body ?? '', 'strength')      ?? 8,
        dexterity:     extractNumberField(stats?.body ?? '', 'dexterity')     ?? 8,
        intelligence:  extractNumberField(stats?.body ?? '', 'intelligence')  ?? 4,
        constitution:  extractNumberField(stats?.body ?? '', 'constitution')  ?? 8,
        wisdom:        extractNumberField(stats?.body ?? '', 'wisdom')        ?? 4,
      },
      mana:           extractNumberField(manaComp?.body ?? '', 'max')  ?? 0,
      critChance:     extractNumberField(combat.body, 'critChance')    ?? 0.05,
      critMultiplier: extractNumberField(combat.body, 'critMultiplier') ?? 1.5,
    });
  }

  return templates;
}

// ── scenarios.json ────────────────────────────────────────────────────────────

function parseScenarioConfig(text) {
  const entities = parseEntities(text);

  let spawnConfig = { bossEveryKills: 100, tierProgressionKills: 500, healthScaleRate: 80, damageScaleRate: 60, initialEnemyCount: 5 };
  let fleeConfig  = { retreatTimePenalty: 10.0, deathTimePenaltyMultiplier: 2.0, fleeCooldown: 5.0 };
  let scoringRules = { pointsPerKill: 10, pointsPerWave: 50, pointsPerBoss: 500, pointsLostPerDeath: 30, pointsLostPerRetreat: 50, pointsLostPerPenaltySecond: 2, timeBonusPoints: 1000, timeBonusInterval: 10.0 };

  for (const entity of entities) {
    const spawn = getComponent(entity, 'SpawnConfig');
    if (spawn) {
      spawnConfig = {
        bossEveryKills:        extractNumberField(spawn.body, 'bossEveryKills')        ?? spawnConfig.bossEveryKills,
        tierProgressionKills:  extractNumberField(spawn.body, 'tierProgressionKills')  ?? spawnConfig.tierProgressionKills,
        healthScaleRate:       extractNumberField(spawn.body, 'healthScaleRate')       ?? spawnConfig.healthScaleRate,
        damageScaleRate:       extractNumberField(spawn.body, 'damageScaleRate')       ?? spawnConfig.damageScaleRate,
        initialEnemyCount:     extractNumberField(spawn.body, 'initialEnemyCount')     ?? spawnConfig.initialEnemyCount,
      };
    }

    const flee = getComponent(entity, 'FleeConfig');
    if (flee) {
      fleeConfig = {
        retreatTimePenalty:          extractNumberField(flee.body, 'retreatTimePenalty')          ?? fleeConfig.retreatTimePenalty,
        deathTimePenaltyMultiplier:  extractNumberField(flee.body, 'deathTimePenaltyMultiplier')  ?? fleeConfig.deathTimePenaltyMultiplier,
        fleeCooldown:                extractNumberField(flee.body, 'fleeCooldown')                ?? fleeConfig.fleeCooldown,
      };
    }

    const scoring = getComponent(entity, 'ScoringRules');
    if (scoring) {
      scoringRules = {
        pointsPerKill:            extractNumberField(scoring.body, 'pointsPerKill')            ?? scoringRules.pointsPerKill,
        pointsPerWave:            extractNumberField(scoring.body, 'pointsPerWave')            ?? scoringRules.pointsPerWave,
        pointsPerBoss:            extractNumberField(scoring.body, 'pointsPerBoss')            ?? scoringRules.pointsPerBoss,
        pointsLostPerDeath:       extractNumberField(scoring.body, 'pointsLostPerDeath')       ?? scoringRules.pointsLostPerDeath,
        pointsLostPerRetreat:     extractNumberField(scoring.body, 'pointsLostPerRetreat')     ?? scoringRules.pointsLostPerRetreat,
        pointsLostPerPenaltySecond: extractNumberField(scoring.body, 'pointsLostPerPenaltySecond') ?? scoringRules.pointsLostPerPenaltySecond,
        timeBonusPoints:          extractNumberField(scoring.body, 'timeBonusPoints')          ?? scoringRules.timeBonusPoints,
        timeBonusInterval:        extractNumberField(scoring.body, 'timeBonusInterval')        ?? scoringRules.timeBonusInterval,
      };
    }
  }

  return { ...spawnConfig, ...fleeConfig, ...scoringRules };
}

function compileScenarios() {
  return {
    normal: parseScenarioConfig(readBrl('scenario-normal.brl')),
    easy:   parseScenarioConfig(readBrl('scenario-easy.brl')),
    hard:   parseScenarioConfig(readBrl('scenario-hard.brl')),
  };
}

// ── hero-classes.json ─────────────────────────────────────────────────────────

function compileHeroClasses() {
  const text = readBrl('hero-classes.brl');
  const entities = parseEntities(text);
  const classes = {};
  let balanceConfig = { elementThreshold: 5 };

  for (const entity of entities) {
    const balComp = getComponent(entity, 'HeroBalanceConfig');
    if (balComp) {
      balanceConfig = {
        elementThreshold: extractNumberField(balComp.body, 'elementThreshold') ?? 5,
      };
      continue;
    }

    const classDef = getComponent(entity, 'HeroClassDef');
    if (!classDef) continue;

    const className = extractStringField(classDef.body, 'className');
    if (!className) continue;

    const combatComp = getComponent(entity, 'HeroBaseCombat');
    const skillsComp = getComponent(entity, 'HeroStartingSkills');
    const growthComp = getComponent(entity, 'HeroGrowthVector');

    classes[className] = {
      className,
      combat: {
        baseHp:          extractNumberField(combatComp?.body ?? '', 'baseHp')          ?? 100,
        baseDamage:      extractNumberField(combatComp?.body ?? '', 'baseDamage')      ?? 15,
        baseDefense:     extractNumberField(combatComp?.body ?? '', 'baseDefense')     ?? 5,
        baseAttackSpeed: extractNumberField(combatComp?.body ?? '', 'baseAttackSpeed') ?? 1.0,
      },
      skills: {
        skill1: extractStringField(skillsComp?.body ?? '', 'skill1'),
        skill2: extractStringField(skillsComp?.body ?? '', 'skill2'),
        skill3: extractStringField(skillsComp?.body ?? '', 'skill3'),
        skill4: extractStringField(skillsComp?.body ?? '', 'skill4'),
      },
      growth: {
        growthStr: extractNumberField(growthComp?.body ?? '', 'growthStr') ?? 0.2,
        growthDex: extractNumberField(growthComp?.body ?? '', 'growthDex') ?? 0.2,
        growthInt: extractNumberField(growthComp?.body ?? '', 'growthInt') ?? 0.2,
        growthCon: extractNumberField(growthComp?.body ?? '', 'growthCon') ?? 0.2,
        growthWis: extractNumberField(growthComp?.body ?? '', 'growthWis') ?? 0.2,
      },
    };
  }

  return { classes, balanceConfig };
}

// ── adventure-data.json ───────────────────────────────────────────────────────

function parseCommaSeparated(value) {
  return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
}

function parseObjectiveTemplates(text) {
  const entities = parseEntities(text);
  const objectives = [];
  for (const entity of entities) {
    const comp = getComponent(entity, 'ObjectiveTemplate');
    if (!comp) continue;
    objectives.push({
      objectiveId:         extractStringField(comp.body, 'objectiveId'),
      category:            extractStringField(comp.body, 'category'),
      title:               extractStringField(comp.body, 'title'),
      description:         extractStringField(comp.body, 'description'),
      winCondition:        extractStringField(comp.body, 'winCondition'),
      requiredSlots:       parseCommaSeparated(extractStringField(comp.body, 'requiredSlots')),
      milestoneCategories: parseCommaSeparated(extractStringField(comp.body, 'milestoneCategories')),
    });
  }
  return objectives;
}

function parseMilestoneTemplates(text) {
  const entities = parseEntities(text);
  const milestones = [];
  for (const entity of entities) {
    const comp = getComponent(entity, 'MilestoneTemplate');
    if (!comp) continue;
    milestones.push({
      milestoneId:          extractStringField(comp.body, 'milestoneId'),
      category:             extractStringField(comp.body, 'category'),
      title:                extractStringField(comp.body, 'title'),
      description:          extractStringField(comp.body, 'description'),
      completionType:       extractStringField(comp.body, 'completionType'),
      completionKey:        extractStringField(comp.body, 'completionKey'),
      bailoutDay:           extractNumberField(comp.body, 'bailoutDay')          ?? 3,
      bailoutDescription:   extractStringField(comp.body, 'bailoutDescription'),
      compatibleObjectives: parseCommaSeparated(extractStringField(comp.body, 'compatibleObjectives')),
      eventSlots:           extractNumberField(comp.body, 'eventSlots')          ?? 2,
    });
  }
  return milestones;
}

function parseEventTemplates(text) {
  const entities = parseEntities(text);
  const events = [];
  for (const entity of entities) {
    const comp = getComponent(entity, 'EventTemplate');
    if (!comp) continue;
    events.push({
      eventId:              extractStringField(comp.body, 'eventId'),
      category:             extractStringField(comp.body, 'category'),
      title:                extractStringField(comp.body, 'title'),
      description:          extractStringField(comp.body, 'description'),
      triggerType:          extractStringField(comp.body, 'triggerType'),
      triggerLocation:      extractStringField(comp.body, 'triggerLocation'),
      isKeyEvent:           extractBoolField(comp.body, 'isKeyEvent')            ?? false,
      rewardType:           extractStringField(comp.body, 'rewardType'),
      narrativeOnTrigger:   extractStringField(comp.body, 'narrativeOnTrigger'),
      narrativeOnComplete:  extractStringField(comp.body, 'narrativeOnComplete'),
      difficultyModifier:   extractNumberField(comp.body, 'difficultyModifier')  ?? 0,
    });
  }
  return events;
}

function parseHeroEncounterTemplates(text) {
  const entities = parseEntities(text);
  const encounters = [];
  for (const entity of entities) {
    const comp = getComponent(entity, 'HeroEncounterTemplate');
    if (!comp) continue;
    encounters.push({
      encounterId:         extractStringField(comp.body, 'encounterId'),
      category:            extractStringField(comp.body, 'category'),
      title:               extractStringField(comp.body, 'title'),
      description:         extractStringField(comp.body, 'description'),
      preferredClass:      extractStringField(comp.body, 'preferredClass'),
      traitAxis:           extractStringField(comp.body, 'traitAxis'),
      traitPolarity:       extractStringField(comp.body, 'traitPolarity'),
      triggerType:         extractStringField(comp.body, 'triggerType'),
      triggerLocation:     extractStringField(comp.body, 'triggerLocation'),
      isKeyEvent:          extractBoolField(comp.body, 'isKeyEvent')             ?? false,
      buffType:            extractStringField(comp.body, 'buffType'),
      buffAmount:          extractNumberField(comp.body, 'buffAmount')           ?? 10,
      narrativeOnMatch:    extractStringField(comp.body, 'narrativeOnMatch'),
      narrativeOnComplete: extractStringField(comp.body, 'narrativeOnComplete'),
      difficultyModifier:  extractNumberField(comp.body, 'difficultyModifier')  ?? 0,
    });
  }
  return encounters;
}

function parseQuestPools(text) {
  const entities = parseEntities(text);
  const villains = [];
  const items = [];
  const creatures = [];
  const enemyNames = [];
  const curses = [];
  const portals = [];
  const riddles = [];
  const threats = [];
  const infos = [];
  const inscriptions = [];
  const cargos = [];

  for (const entity of entities) {
    const villainComp = getComponent(entity, 'VillainEntry');
    if (villainComp) {
      villains.push({
        name:       extractStringField(villainComp.body, 'name'),
        title:      extractStringField(villainComp.body, 'title'),
        threatDesc: extractStringField(villainComp.body, 'threatDesc'),
      });
      continue;
    }
    const itemComp = getComponent(entity, 'ItemEntry');
    if (itemComp) {
      items.push({
        name:   extractStringField(itemComp.body, 'name'),
        origin: extractStringField(itemComp.body, 'origin'),
      });
      continue;
    }
    const creatureComp = getComponent(entity, 'CreatureEntry');
    if (creatureComp) {
      creatures.push(extractStringField(creatureComp.body, 'name'));
      continue;
    }
    const enemyNameComp = getComponent(entity, 'EnemyNameEntry');
    if (enemyNameComp) {
      enemyNames.push(extractStringField(enemyNameComp.body, 'name'));
      continue;
    }
    const curseComp = getComponent(entity, 'CurseEntry');
    if (curseComp) {
      curses.push(extractStringField(curseComp.body, 'name'));
      continue;
    }
    const portalComp = getComponent(entity, 'PortalEntry');
    if (portalComp) {
      portals.push(extractStringField(portalComp.body, 'name'));
      continue;
    }
    const riddleComp = getComponent(entity, 'RiddleEntry');
    if (riddleComp) {
      riddles.push(extractStringField(riddleComp.body, 'name'));
      continue;
    }
    const threatComp = getComponent(entity, 'ThreatEntry');
    if (threatComp) {
      threats.push(extractStringField(threatComp.body, 'name'));
      continue;
    }
    const infoComp = getComponent(entity, 'InfoEntry');
    if (infoComp) {
      infos.push(extractStringField(infoComp.body, 'name'));
      continue;
    }
    const inscComp = getComponent(entity, 'InscriptionEntry');
    if (inscComp) {
      inscriptions.push(extractStringField(inscComp.body, 'name'));
      continue;
    }
    const cargoComp = getComponent(entity, 'CargoEntry');
    if (cargoComp) {
      cargos.push(extractStringField(cargoComp.body, 'description'));
      continue;
    }
  }

  return { villains, items, creatures, enemyNames, curses, portals, riddles, threats, infos, inscriptions, cargos };
}

function compileAdventureData() {
  const templatesText   = readBrl('story-adventure-templates.brl');
  const expansion1Text  = readBrl('adventure-expansion-set-1.brl');
  const expansion2Text  = readBrl('expansion-pack-2.brl');
  const poolsText       = readBrl('story-quest-pools.brl');

  return {
    objectives:     parseObjectiveTemplates(templatesText),
    milestones:     parseMilestoneTemplates(templatesText),
    events:         parseEventTemplates(templatesText),
    heroEncounters: [
      ...parseHeroEncounterTemplates(expansion1Text),
      ...parseHeroEncounterTemplates(expansion2Text),
    ],
    questPools:     parseQuestPools(poolsText),
  };
}

// ── world-data.json ───────────────────────────────────────────────────────────

function compileWorldData() {
  const text = readBrl('story-world-data.brl');
  const entities = parseEntities(text);

  const locations = [];
  const paths = [];
  const npcs = [];
  const heroArrivalComments = [];
  const blockingEncounters = [];

  for (const entity of entities) {
    const locComp = getComponent(entity, 'WorldLocation');
    if (locComp) {
      locations.push({
        locationId:       extractStringField(locComp.body, 'locationId'),
        name:             extractStringField(locComp.body, 'name'),
        locationType:     extractStringField(locComp.body, 'locationType'),
        region:           extractStringField(locComp.body, 'region'),
        description:      extractStringField(locComp.body, 'description'),
        elementalAffinity: extractStringField(locComp.body, 'elementalAffinity'),
        dangerLevel:      extractNumberField(locComp.body, 'dangerLevel') ?? 1,
        tags:             extractStringField(locComp.body, 'tags'),
      });
      continue;
    }

    const pathComp = getComponent(entity, 'WorldPath');
    if (pathComp) {
      paths.push({
        pathId:           extractStringField(pathComp.body, 'pathId'),
        fromLocationId:   extractStringField(pathComp.body, 'fromLocationId'),
        toLocationId:     extractStringField(pathComp.body, 'toLocationId'),
        pathType:         extractStringField(pathComp.body, 'pathType'),
        travelHours:      extractNumberField(pathComp.body, 'travelHours')   ?? 3,
        dangerRating:     extractNumberField(pathComp.body, 'dangerRating')  ?? 1,
        description:      extractStringField(pathComp.body, 'description'),
        encounterTags:    extractStringField(pathComp.body, 'encounterTags'),
        bidirectional:    extractBoolField(pathComp.body, 'bidirectional')   ?? true,
      });
      continue;
    }

    const npcComp = getComponent(entity, 'WorldNpc');
    if (npcComp) {
      npcs.push({
        npcId:                  extractStringField(npcComp.body, 'npcId'),
        name:                   extractStringField(npcComp.body, 'name'),
        role:                   extractStringField(npcComp.body, 'role'),
        personality:            extractStringField(npcComp.body, 'personality'),
        homeLocationId:         extractStringField(npcComp.body, 'homeLocationId'),
        additionalLocationIds:  extractStringField(npcComp.body, 'additionalLocationIds'),
        greeting:               extractStringField(npcComp.body, 'greeting'),
        description:            extractStringField(npcComp.body, 'description'),
        canBeVillain:           extractBoolField(npcComp.body, 'canBeVillain')    ?? false,
        canBeAlly:              extractBoolField(npcComp.body, 'canBeAlly')       ?? true,
        canBeQuestGiver:        extractBoolField(npcComp.body, 'canBeQuestGiver') ?? false,
      });
      continue;
    }

    const arrComp = getComponent(entity, 'HeroArrivalComment');
    if (arrComp) {
      heroArrivalComments.push({
        commentId:         extractStringField(arrComp.body, 'commentId'),
        triggerClass:      extractStringField(arrComp.body, 'triggerClass'),
        triggerTrait:      extractStringField(arrComp.body, 'triggerTrait'),
        triggerPolarity:   extractStringField(arrComp.body, 'triggerPolarity'),
        elementalAffinity: extractStringField(arrComp.body, 'elementalAffinity'),
        locationTags:      extractStringField(arrComp.body, 'locationTags'),
        comment:           extractStringField(arrComp.body, 'comment'),
        sentiment:         extractStringField(arrComp.body, 'sentiment'),
      });
      continue;
    }

    const blockComp = getComponent(entity, 'BlockingEncounter');
    if (blockComp) {
      blockingEncounters.push({
        blockingId:           extractStringField(blockComp.body, 'blockingId'),
        pathId:               extractStringField(blockComp.body, 'pathId'),
        matchPathType:        extractStringField(blockComp.body, 'matchPathType'),
        locationId:           extractStringField(blockComp.body, 'locationId'),
        encounterType:        extractStringField(blockComp.body, 'encounterType'),
        description:          extractStringField(blockComp.body, 'description'),
        resolutionType:       extractStringField(blockComp.body, 'resolutionType'),
        enemies:              extractStringField(blockComp.body, 'enemies'),
        difficultyModifier:   extractNumberField(blockComp.body, 'difficultyModifier') ?? 0,
        narrativeOnBlock:     extractStringField(blockComp.body, 'narrativeOnBlock'),
        narrativeOnResolve:   extractStringField(blockComp.body, 'narrativeOnResolve'),
        triggerChance:        extractNumberField(blockComp.body, 'triggerChance')      ?? 0.3,
      });
    }
  }

  return { locations, paths, npcs, heroArrivalComments, blockingEncounters };
}

// ── skills.json ───────────────────────────────────────────────────────────────

function compileSkills() {
  const text = readBrl('skill-catalog.brl');
  const entries = [];

  const blockRe = /SkillInfo\s*\{([^}]*)\}/gs;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const block = m[1];
    const id = extractStringField(block, 'id');
    if (!id) continue;

    const prereqRaw = extractStringField(block, 'prerequisites');
    entries.push({
      id,
      name:         extractStringField(block, 'name'),
      description:  extractStringField(block, 'description'),
      skillType:    extractStringField(block, 'skillType'),
      prerequisites: prereqRaw ? prereqRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    });
  }

  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

const tasks = [
  { name: 'enemies.json',       fn: compileEnemies },
  { name: 'scenarios.json',     fn: compileScenarios },
  { name: 'hero-classes.json',  fn: compileHeroClasses },
  { name: 'adventure-data.json', fn: compileAdventureData },
  { name: 'world-data.json',    fn: compileWorldData },
  { name: 'skills.json',        fn: compileSkills },
];

let ok = true;
for (const { name, fn } of tasks) {
  try {
    const data = fn();
    const outPath = path.join(OUT_DIR, name);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`  ✓  ${name}  (${kb} KB)`);
  } catch (err) {
    console.error(`  ✗  ${name}: ${err.message}`);
    ok = false;
  }
}

if (!ok) {
  console.error('\n❌ Game data compilation failed.');
  process.exit(1);
}

console.log('\n✅ Game data compiled to game/app/public/game-data/');
