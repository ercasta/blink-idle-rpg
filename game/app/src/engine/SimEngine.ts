/**
 * JS Engine adapter — wraps @blink/engine BlinkGame to implement the
 * ISimEngine contract: run the BRL simulation to completion and return
 * N progress snapshots captured at ProgressCheckpoint events.
 *
 * Architecture note: This is the v1 implementation.  The v2 WASM adapter
 * will implement the same interface but run in a Web Worker.
 */

import { BlinkGame } from '@blink/engine';
import type { GameSnapshot, HeroDefinition, GameMode } from '../types';

/** Base stats for each hero class used when adding heroes to the simulation. */
const CLASS_BASE_HP: Record<string, number> = {
  Warrior: 160,
  Mage: 90,
  Ranger: 110,
  Paladin: 140,
  Rogue: 105,
  Cleric: 120,
};

const CLASS_BASE_DAMAGE: Record<string, number> = {
  Warrior: 22,
  Mage: 30,
  Ranger: 18,
  Paladin: 16,
  Rogue: 20,
  Cleric: 13,
};

const CLASS_BASE_DEFENSE: Record<string, number> = {
  Warrior: 8,
  Mage: 2,
  Ranger: 5,
  Paladin: 9,
  Rogue: 4,
  Cleric: 6,
};

const CLASS_SKILLS: Record<string, [string, string, string, string]> = {
  Warrior: ['power_strike', 'shield_bash', 'defensive_stance', 'execute'],
  Mage: ['fireball', 'frost_bolt', 'arcane_blast', 'mana_shield'],
  Ranger: ['arrow_shot', 'multi_shot', 'evade', 'trap'],
  Paladin: ['holy_strike', 'divine_shield', 'consecrate', 'lay_on_hands'],
  Rogue: ['backstab', 'smoke_bomb', 'poison_blade', 'shadowstep'],
  Cleric: ['heal', 'smite', 'divine_favor', 'holy_word'],
};

/**
 * Run the BRL simulation to completion, capturing snapshots at each
 * ProgressCheckpoint event.  Returns the array of snapshots.
 */
export async function runSimulation(
  irUrl: string,
  selectedHeroes: HeroDefinition[],
  mode: GameMode
): Promise<GameSnapshot[]> {
  // ── 1. Fetch & load IR ──────────────────────────────────────────────────
  const ir = await fetch(irUrl).then(r => {
    if (!r.ok) throw new Error(`Failed to load IR from ${irUrl}: ${r.statusText}`);
    return r.json();
  });

  const game = BlinkGame.createSync({ debug: false });
  game.loadRulesFromObject(ir);

  // ── 2. Inject selected heroes into the world ────────────────────────────
  // We find the hero template entities (from BRL initial state) and patch
  // them, or add new ones when the selected heroes are from our pre-built set.
  //
  // Strategy: find the existing hero entities (they have Character + Team +
  // HeroTemplate components) and replace them with our selected heroes.
  // Simpler: directly schedule a startup initialisation after GameStart.
  //
  // Since the IR already has hero entities defined in heroes.brl, we
  // need to deactivate the pre-existing ones and add ours.  The cleanest
  // approach for v1 is to load the IR normally (which gives 4 template
  // heroes) and just let them stand — the selected hero set controls which
  // classes appear via HeroTemplate.
  //
  // For now, we inject heroes by adding new entities with Character/Health/
  // Stats/Skills/Team/Target/Buffs/Combat components before scheduling GameStart.

  // Remove pre-built hero template instances that were loaded from IR
  // (templates have HeroTemplate.isTemplate = true and Team.isPlayer = true).
  // We'll leave enemy templates and config entities alone.
  const heroTemplateIds = game.query('HeroTemplate', 'Team');
  for (const id of heroTemplateIds) {
    const team = game.getComponent(id, 'Team');
    const template = game.getComponent(id, 'HeroTemplate');
    if (team && template && (team as Record<string, unknown>)['isPlayer'] === true &&
        (template as Record<string, unknown>)['isTemplate'] === true) {
      // Mark as inactive by setting health to 0 and template flag
      // (a cleaner approach would be to despawn, but engine API exposes addComponent not despawn)
      game.scheduleEvent('RemoveEntity', 0.001, { fields: { target: id as unknown as number } });
    }
  }

  // Inject selected heroes as new entities
  selectedHeroes.forEach((hero, _i) => {
    const heroClass = hero.heroClass;
    const skills = CLASS_SKILLS[heroClass] ?? ['basic_attack', '', '', ''];
    const baseHp = CLASS_BASE_HP[heroClass] ?? 100;
    const baseDmg = CLASS_BASE_DAMAGE[heroClass] ?? 15;
    const baseDef = CLASS_BASE_DEFENSE[heroClass] ?? 5;

    // Calculate HP from constitution bonus
    const conBonus = Math.floor((hero.stats.constitution - 10) * 5);
    const intBonus = Math.floor((hero.stats.intelligence - 10) * 3);
    const strBonus = Math.floor((hero.stats.strength - 10) * 2);

    const maxHp = Math.max(50, baseHp + conBonus);
    const damage = Math.max(5, baseDmg + strBonus + intBonus);
    const defense = Math.max(0, baseDef + Math.floor((hero.stats.constitution - 10)));

    // Use the engine's scheduleEvent to inject hero data via a synthetic
    // event at time 0.  Since we can't directly add entities, we use the
    // existing CreateHero event if defined, or we set initial state.
    //
    // Simplest approach: add the entity via scheduleEvent with the internal
    // "CreateEntity" mechanic... but that's not available in the public API.
    //
    // Alternative: load the hero as part of loadRulesFromObject initial_state
    // override.  We'll do that by merging entities into the IR before loading.
    // But we already called loadRulesFromObject above.
    //
    // Cleanest v1 solution: patch the IR before loading to include our heroes.
    // We'll restructure to do the hero injection BEFORE loading the IR.
    void maxHp; void damage; void defense; void skills;
  });

  // Clean up — restart fresh with hero injection baked in
  return runSimulationInternal(irUrl, selectedHeroes, mode);
}

/**
 * Internal implementation that merges heroes into the IR before loading.
 */
async function runSimulationInternal(
  irUrl: string,
  selectedHeroes: HeroDefinition[],
  _mode: GameMode
): Promise<GameSnapshot[]> {
  // ── Fetch IR ─────────────────────────────────────────────────────────────
  const ir = await fetch(irUrl).then(r => r.json()) as {
    initial_state?: { entities: Array<Record<string, unknown>> };
    [key: string]: unknown;
  };

  // ── Build hero entity definitions ────────────────────────────────────────
  const heroEntities = selectedHeroes.map((hero, i) => {
    const heroClass = hero.heroClass;
    const skills = CLASS_SKILLS[heroClass] ?? ['basic_attack', '', '', ''];
    const baseHp = CLASS_BASE_HP[heroClass] ?? 100;
    const baseDmg = CLASS_BASE_DAMAGE[heroClass] ?? 15;
    const baseDef = CLASS_BASE_DEFENSE[heroClass] ?? 5;

    const conBonus = Math.floor((hero.stats.constitution - 10) * 5);
    const intBonus = Math.floor((hero.stats.intelligence - 10) * 3);
    const strBonus = Math.floor((hero.stats.strength - 10) * 2);

    const maxHp = Math.max(50, baseHp + conBonus);
    const damage = Math.max(5, baseDmg + strBonus + intBonus);
    const defense = Math.max(0, baseDef + Math.floor((hero.stats.constitution - 10)));
    const maxMana = 100 + Math.floor((hero.stats.wisdom - 10) * 5);

    return {
      id: 1000 + i,    // high IDs to avoid collision with IR entities
      components: {
        Character: {
          name: hero.name,
          class: hero.heroClass,
          level: 1,
          experience: 0,
          experienceToLevel: 100,
        },
        Health: { current: maxHp, max: maxHp },
        Mana: { current: maxMana, max: maxMana },
        Stats: {
          strength: hero.stats.strength,
          dexterity: hero.stats.dexterity,
          intelligence: hero.stats.intelligence,
          constitution: hero.stats.constitution,
          wisdom: hero.stats.wisdom,
        },
        Combat: {
          damage,
          defense,
          attackSpeed: 1.0 + (hero.stats.dexterity - 10) * 0.05,
          critChance: 0.05 + (hero.stats.dexterity - 10) * 0.01,
          critMultiplier: 1.5,
        },
        Target: { entity: null },
        Team: { id: 'player', isPlayer: true },
        Skills: {
          skill1: skills[0],
          skill2: skills[1],
          skill3: skills[2],
          skill4: skills[3],
          skillPoints: 0,
        },
        Buffs: {
          damageBonus: 0,
          defenseBonus: 0,
          hasteBonus: 0.0,
          shieldAmount: 0,
          regenAmount: 0,
        },
        SkillCooldown: {
          skill1Cooldown: 0.0,
          skill2Cooldown: 0.0,
          skill3Cooldown: 0.0,
          skill4Cooldown: 0.0,
        },
      },
    };
  });

  // ── Remove pre-built hero entities from IR initial state ─────────────────
  // Heroes in the IR have a HeroTemplate component with isTemplate=true.
  // We strip them out so only our injected heroes participate.
  if (ir.initial_state) {
    ir.initial_state.entities = (ir.initial_state.entities as Array<Record<string, unknown>>).filter((e) => {
      const comps = e['components'] as Record<string, unknown> | undefined;
      if (!comps) return true;
      const heroTemplate = comps['HeroTemplate'] as Record<string, unknown> | undefined;
      if (!heroTemplate) return true;
      // Remove if it's a player hero template (keep enemy templates)
      const team = comps['Team'] as Record<string, unknown> | undefined;
      return !(team && team['isPlayer'] === true);
    });

    // Append our hero entities
    ir.initial_state.entities.push(...heroEntities);
  }

  // ── Create and configure game ─────────────────────────────────────────────
  const game = BlinkGame.createSync({ debug: false });
  game.loadRulesFromObject(ir);

  // ── Collect snapshots at ProgressCheckpoint events ───────────────────────
  const snapshots: GameSnapshot[] = [];

  const unsub = game.onSimulation((evt) => {
    if (evt.type === 'step' && evt.event?.eventType === 'ProgressCheckpoint') {
      const fields = evt.event.fields ?? {};
      const step = (fields['step'] as number) ?? snapshots.length + 1;
      snapshots.push(captureSnapshot(game, step));
    }
  });

  // ── Schedule GameStart and run to completion ──────────────────────────────
  game.scheduleEvent('GameStart', 0);
  game.runUntilComplete(500_000);
  unsub();

  // ── Capture final state as last snapshot ─────────────────────────────────
  const finalStep = snapshots.length + 1;
  snapshots.push(captureSnapshot(game, finalStep));

  // ── Clean up ──────────────────────────────────────────────────────────────
  game.destroy();

  return snapshots;
}

/** Build a GameSnapshot from current engine state. */
function captureSnapshot(game: BlinkGame, step: number): GameSnapshot {
  // Query game state entity
  const gameStateIds = game.query('GameState');
  const runStatsIds = game.query('RunStats');
  const scoreIds = game.query('Score');

  let enemiesDefeated = 0;
  let currentTier = 1;
  let currentWave = 1;
  let playerDeaths = 0;
  let isGameOver = false;
  let victory = false;
  let bossesDefeated = 0;
  let simulationTime = 0;
  let score = 0;

  if (gameStateIds.length > 0) {
    const gs = game.getComponent(gameStateIds[0], 'GameState') as Record<string, unknown>;
    if (gs) {
      enemiesDefeated = (gs['enemiesDefeated'] as number) ?? 0;
      currentTier = (gs['currentTier'] as number) ?? 1;
      currentWave = (gs['currentWave'] as number) ?? 1;
      playerDeaths = (gs['playerDeaths'] as number) ?? 0;
      isGameOver = (gs['gameOver'] as boolean) ?? false;
      victory = (gs['victory'] as boolean) ?? false;
    }
  }

  if (runStatsIds.length > 0) {
    const rs = game.getComponent(runStatsIds[0], 'RunStats') as Record<string, unknown>;
    if (rs) {
      simulationTime = (rs['simulationTime'] as number) ?? 0;
    }
  }

  if (scoreIds.length > 0) {
    const sc = game.getComponent(scoreIds[0], 'Score') as Record<string, unknown>;
    if (sc) {
      score = (sc['total'] as number) ?? 0;
      bossesDefeated = (sc['bossesDefeated'] as number) ?? 0;
    }
  }

  // Collect hero levels
  const heroLevels: Record<string, number> = {};
  const heroIds = game.query('Character', 'Team');
  for (const id of heroIds) {
    const team = game.getComponent(id, 'Team') as Record<string, unknown>;
    const char = game.getComponent(id, 'Character') as Record<string, unknown>;
    if (team && char && (team['isPlayer'] as boolean)) {
      const name = (char['name'] as string) ?? `Hero${id}`;
      heroLevels[name] = (char['level'] as number) ?? 1;
    }
  }

  return {
    step,
    simulationTime,
    enemiesDefeated,
    score,
    currentTier,
    currentWave,
    heroLevels,
    bossesDefeated,
    playerDeaths,
    isGameOver,
    victory,
  };
}
