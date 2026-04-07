/**
 * Pure JavaScript simulation engine — fallback when WASM is not available.
 *
 * Implements the same combat logic described in the BRL game rules:
 *   • Attack loop with speed-based intervals
 *   • Defense reduction, critical hits, shield absorption
 *   • Class-specific skills with cooldowns and mana costs
 *   • Health/mana regeneration
 *   • Enemy spawning with tier progression
 *   • Leveling and stat growth
 *   • 10-second hero respawn on death
 *
 * Produces 30 snapshots, one every 100 enemies defeated (3000 total encounters).
 */

import type { GameSnapshot, HeroDefinition, GameMode } from '../types';

// ── Hero stats per class ────────────────────────────────────────────────────

const CLASS_BASE_HP: Record<string, number> = {
  Warrior: 160, Mage: 90, Ranger: 110, Paladin: 140, Rogue: 105, Cleric: 120,
};

const CLASS_BASE_DAMAGE: Record<string, number> = {
  Warrior: 22, Mage: 30, Ranger: 18, Paladin: 16, Rogue: 20, Cleric: 13,
};

const CLASS_BASE_DEFENSE: Record<string, number> = {
  Warrior: 8, Mage: 2, Ranger: 5, Paladin: 9, Rogue: 4, Cleric: 6,
};

const CLASS_SKILLS: Record<string, [string, string, string, string]> = {
  Warrior: ['power_strike', 'shield_bash', 'defensive_stance', 'execute'],
  Mage:    ['fireball', 'frost_bolt', 'arcane_blast', 'mana_shield'],
  Ranger:  ['arrow_shot', 'multi_shot', 'evade', 'trap'],
  Paladin: ['holy_strike', 'divine_shield', 'consecrate', 'lay_on_hands'],
  Rogue:   ['backstab', 'smoke_bomb', 'poison_blade', 'shadowstep'],
  Cleric:  ['heal', 'smite', 'divine_favor', 'holy_word'],
};

const CLASS_ATTACK_SPEED: Record<string, number> = {
  Warrior: 0.9, Mage: 0.6, Ranger: 1.1, Paladin: 0.7, Rogue: 1.3, Cleric: 0.6,
};

// ── Game mode spawn configs ─────────────────────────────────────────────────

interface ModeConfig {
  bossEveryKills: number; tierProgressionKills: number;
  healthScaleRate: number; damageScaleRate: number; initialEnemyCount: number;
  retreatTimePenalty: number; deathTimePenaltyMultiplier: number; fleeCooldown: number;
  pointsPerKill: number; pointsPerWave: number; pointsPerBoss: number;
  pointsLostPerDeath: number; pointsLostPerRetreat: number; pointsLostPerPenaltySecond: number;
  timeBonusPoints: number; timeBonusInterval: number;
}

const MODE_CONFIGS: Record<GameMode, ModeConfig> = {
  normal: {
    bossEveryKills: 100, tierProgressionKills: 50,
    healthScaleRate: 200, damageScaleRate: 300, initialEnemyCount: 5,
    retreatTimePenalty: 10.0, deathTimePenaltyMultiplier: 5.0, fleeCooldown: 5.0,
    pointsPerKill: 10, pointsPerWave: 50, pointsPerBoss: 500,
    pointsLostPerDeath: 100, pointsLostPerRetreat: 50, pointsLostPerPenaltySecond: 2,
    timeBonusPoints: 1000, timeBonusInterval: 10.0,
  },
  easy: {
    bossEveryKills: 150, tierProgressionKills: 75,
    healthScaleRate: 100, damageScaleRate: 150, initialEnemyCount: 3,
    retreatTimePenalty: 5.0, deathTimePenaltyMultiplier: 3.0, fleeCooldown: 5.0,
    pointsPerKill: 5, pointsPerWave: 25, pointsPerBoss: 250,
    pointsLostPerDeath: 50, pointsLostPerRetreat: 25, pointsLostPerPenaltySecond: 1,
    timeBonusPoints: 500, timeBonusInterval: 15.0,
  },
  hard: {
    bossEveryKills: 75, tierProgressionKills: 40,
    healthScaleRate: 300, damageScaleRate: 450, initialEnemyCount: 7,
    retreatTimePenalty: 15.0, deathTimePenaltyMultiplier: 7.0, fleeCooldown: 5.0,
    pointsPerKill: 15, pointsPerWave: 75, pointsPerBoss: 1000,
    pointsLostPerDeath: 200, pointsLostPerRetreat: 100, pointsLostPerPenaltySecond: 5,
    timeBonusPoints: 2000, timeBonusInterval: 5.0,
  },
};

// ── Enemy template data ─────────────────────────────────────────────────────

const ENEMY_TEMPLATES = [
  { tier: 1, name: 'Goblin Scout',      hp: 60,  dmg: 8,  def: 2,  spd: 1.0, exp: 25,  boss: false },
  { tier: 2, name: 'Orc Raider',        hp: 90,  dmg: 12, def: 4,  spd: 0.8, exp: 35,  boss: false },
  { tier: 2, name: 'Dark Wolf',         hp: 75,  dmg: 14, def: 3,  spd: 1.2, exp: 40,  boss: false },
  { tier: 3, name: 'Skeleton Warrior',  hp: 110, dmg: 16, def: 5,  spd: 0.7, exp: 50,  boss: false },
  { tier: 3, name: 'Dark Mage',         hp: 80,  dmg: 22, def: 3,  spd: 0.5, exp: 75,  boss: false },
  { tier: 4, name: 'Troll Berserker',   hp: 180, dmg: 22, def: 7,  spd: 0.6, exp: 80,  boss: false },
  { tier: 5, name: 'Demon Knight',      hp: 250, dmg: 30, def: 10, spd: 0.7, exp: 150, boss: false },
  { tier: 6, name: 'Ancient Dragon',    hp: 400, dmg: 40, def: 12, spd: 0.8, exp: 300, boss: false },
  { tier: 6, name: 'Dragon Lord Vexar', hp: 500, dmg: 40, def: 15, spd: 0.8, exp: 500, boss: true  },
];

// ── Entity types ────────────────────────────────────────────────────────────

interface CombatEntity {
  id: number;
  name: string;
  heroClass: string;
  isPlayer: boolean;
  level: number;
  experience: number;
  experienceToLevel: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  damage: number;
  defense: number;
  attackSpeed: number;
  critChance: number;
  critMultiplier: number;
  skills: [string, string, string, string];
  skillCooldowns: [number, number, number, number];
  target: CombatEntity | null;
  alive: boolean;
  respawnTime: number; // sim time when hero respawns (-1 = not dead)
  // Buffs
  damageBonus: number;
  defenseBonus: number;
  hasteBonus: number;
  shieldAmount: number;
  regenAmount: number;
  // Timers
  nextAttackTime: number;
  nextSkillTime: number;
  nextManaRegenTime: number;
  nextHealthRegenTime: number;
  // Enemy-specific
  tier: number;
  isBoss: boolean;
  expReward: number;
  isTemplate: boolean;
  // Stats
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  wisdom: number;
}

// ── Seeded PRNG (xoshiro256** compatible with WASM engine) ──────────────────

class PRNG {
  private s: BigInt64Array;
  constructor(seed = 42) {
    this.s = new BigInt64Array(4);
    // SplitMix64 to seed xoshiro state
    let s = BigInt(seed);
    for (let i = 0; i < 4; i++) {
      s += 0x9e3779b97f4a7c15n;
      let z = s;
      z = (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n;
      z = (z ^ (z >> 27n)) * 0x94d049bb133111ebn;
      z = z ^ (z >> 31n);
      this.s[i] = z;
    }
  }

  next(): number {
    const s = this.s;
    const result = BigInt.asUintN(64, (BigInt.asUintN(64, s[1] * 5n) << 7n | BigInt.asUintN(64, s[1] * 5n) >> 57n) * 9n);
    const t = BigInt.asUintN(64, s[1] << 17n);
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t;
    s[3] = BigInt.asUintN(64, (s[3] << 45n) | (BigInt.asUintN(64, s[3]) >> 19n));
    return Number(BigInt.asUintN(53, result)) / (2 ** 53);
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

// ── JS Simulation ───────────────────────────────────────────────────────────

const CHECKPOINT_INTERVAL = 100;  // enemies per checkpoint
const TOTAL_CHECKPOINTS = 30;     // 30 checkpoints = 3000 encounters
const MAX_ENCOUNTERS = CHECKPOINT_INTERVAL * TOTAL_CHECKPOINTS;
const RESPAWN_DELAY = 10.0;       // 10 seconds to respawn heroes
const MANA_REGEN_INTERVAL = 2.0;  // mana regen every 2s
const HEALTH_REGEN_INTERVAL = 3.0;
const SKILL_USE_INTERVAL = 3.0;   // try skill every 3s
const MAX_SIM_TIME = 100000;      // safety limit

export function runJsSimulation(
  selectedHeroes: HeroDefinition[],
  mode: GameMode,
): GameSnapshot[] {
  const cfg = MODE_CONFIGS[mode] ?? MODE_CONFIGS.normal;
  const rng = new PRNG(42);

  // Create hero entities
  const heroes: CombatEntity[] = selectedHeroes.map((hero, i) => {
    const hc = hero.heroClass;
    const baseHp  = CLASS_BASE_HP[hc]    ?? 100;
    const baseDmg = CLASS_BASE_DAMAGE[hc] ?? 15;
    const baseDef = CLASS_BASE_DEFENSE[hc] ?? 5;
    const baseSpd = CLASS_ATTACK_SPEED[hc] ?? 1.0;
    const skills  = CLASS_SKILLS[hc] ?? ['basic_attack', '', '', ''];

    const conBonus = Math.floor((hero.stats.constitution - 10) * 5);
    const intBonus = Math.floor((hero.stats.intelligence - 10) * 3);
    const strBonus = Math.floor((hero.stats.strength - 10) * 2);
    const dexBonus = (hero.stats.dexterity - 10) * 0.05;
    const wisBonus = Math.floor((hero.stats.wisdom - 10) * 5);

    const maxHp      = Math.max(50,  baseHp  + conBonus);
    const damage     = Math.max(5,   baseDmg + strBonus + intBonus);
    const defense    = Math.max(0,   baseDef + Math.floor(hero.stats.constitution - 10));
    const attackSpeed = Math.max(0.3, baseSpd + dexBonus);
    const maxMana    = Math.max(50,  100 + wisBonus);
    const critChance = Math.min(0.5, 0.05 + hero.stats.dexterity * 0.01);

    return {
      id: i + 1,
      name: hero.name,
      heroClass: hc,
      isPlayer: true,
      level: 1,
      experience: 0,
      experienceToLevel: 100,
      hp: maxHp,
      maxHp,
      mana: maxMana,
      maxMana,
      damage,
      defense,
      attackSpeed,
      critChance,
      critMultiplier: 1.5,
      skills: [...skills] as [string, string, string, string],
      skillCooldowns: [0, 0, 0, 0],
      target: null,
      alive: true,
      respawnTime: -1,
      damageBonus: 0,
      defenseBonus: 0,
      hasteBonus: 0,
      shieldAmount: 0,
      regenAmount: 0,
      nextAttackTime: 0.1 * (i + 1),
      nextSkillTime: 2.0 + i * 0.5,
      nextManaRegenTime: 1.0,
      nextHealthRegenTime: 3.0,
      tier: 0,
      isBoss: false,
      expReward: 0,
      isTemplate: false,
      strength: hero.stats.strength,
      dexterity: hero.stats.dexterity,
      intelligence: hero.stats.intelligence,
      constitution: hero.stats.constitution,
      wisdom: hero.stats.wisdom,
    };
  });

  // Game state
  let simTime = 0;
  let enemiesDefeated = 0;
  let playerDeaths = 0;
  let currentTier = 1;
  let currentWave = 1;
  let bossesDefeated = 0;
  let score = 0;
  let gameOver = false;
  let victory = false;

  const enemies: CombatEntity[] = [];
  let nextEnemyId = 200;

  // Spawn helper
  function spawnEnemy(tier: number): CombatEntity {
    const templates = ENEMY_TEMPLATES.filter(t => t.tier === tier && !t.boss);
    const tmpl = templates.length > 0
      ? templates[Math.floor(rng.next() * templates.length)]
      : ENEMY_TEMPLATES[0];

    // Scale stats with total enemies defeated (gradual progression)
    const scaleF = 1 + enemiesDefeated / cfg.healthScaleRate;
    const dmgScale = 1 + enemiesDefeated / cfg.damageScaleRate;

    const e: CombatEntity = {
      id: nextEnemyId++,
      name: tmpl.name,
      heroClass: 'Monster',
      isPlayer: false,
      level: tier,
      experience: 0,
      experienceToLevel: 999,
      hp: Math.floor(tmpl.hp * scaleF),
      maxHp: Math.floor(tmpl.hp * scaleF),
      mana: 0,
      maxMana: 0,
      damage: Math.floor(tmpl.dmg * dmgScale),
      defense: tmpl.def + tier,
      attackSpeed: tmpl.spd,
      critChance: 0.05,
      critMultiplier: 1.5,
      skills: ['', '', '', ''],
      skillCooldowns: [0, 0, 0, 0],
      target: null,
      alive: true,
      respawnTime: -1,
      damageBonus: 0,
      defenseBonus: 0,
      hasteBonus: 0,
      shieldAmount: 0,
      regenAmount: 0,
      nextAttackTime: simTime + 1.0 / tmpl.spd,
      nextSkillTime: Infinity,
      nextManaRegenTime: Infinity,
      nextHealthRegenTime: Infinity,
      tier: tmpl.tier,
      isBoss: tmpl.boss,
      expReward: tmpl.exp,
      isTemplate: false,
      strength: 8,
      dexterity: 8,
      intelligence: 4,
      constitution: 8,
      wisdom: 4,
    };
    enemies.push(e);
    return e;
  }

  function spawnBoss(): CombatEntity {
    const tmpl = ENEMY_TEMPLATES.find(t => t.boss) ?? ENEMY_TEMPLATES[ENEMY_TEMPLATES.length - 1];
    const scaleF = 1 + enemiesDefeated / cfg.healthScaleRate;
    const dmgScale = 1 + enemiesDefeated / cfg.damageScaleRate;

    const e: CombatEntity = {
      id: nextEnemyId++,
      name: tmpl.name,
      heroClass: 'Boss',
      isPlayer: false,
      level: tmpl.tier,
      experience: 0,
      experienceToLevel: 999,
      hp: Math.floor(tmpl.hp * scaleF),
      maxHp: Math.floor(tmpl.hp * scaleF),
      mana: 0,
      maxMana: 0,
      damage: Math.floor(tmpl.dmg * dmgScale),
      defense: tmpl.def + tmpl.tier * 2,
      attackSpeed: tmpl.spd,
      critChance: 0.1,
      critMultiplier: 2.0,
      skills: ['', '', '', ''],
      skillCooldowns: [0, 0, 0, 0],
      target: null,
      alive: true,
      respawnTime: -1,
      damageBonus: 0,
      defenseBonus: 0,
      hasteBonus: 0,
      shieldAmount: 0,
      regenAmount: 0,
      nextAttackTime: simTime + 1.0 / tmpl.spd,
      nextSkillTime: Infinity,
      nextManaRegenTime: Infinity,
      nextHealthRegenTime: Infinity,
      tier: tmpl.tier,
      isBoss: true,
      expReward: tmpl.exp,
      isTemplate: false,
      strength: 12,
      dexterity: 10,
      intelligence: 8,
      constitution: 12,
      wisdom: 8,
    };
    enemies.push(e);
    return e;
  }

  // Target assignment
  function assignTargets() {
    const aliveHeroes = heroes.filter(h => h.alive);
    const aliveEnemies = enemies.filter(e => e.alive);

    for (const hero of aliveHeroes) {
      if (!hero.target || !hero.target.alive) {
        hero.target = aliveEnemies.length > 0
          ? aliveEnemies[Math.floor(rng.next() * aliveEnemies.length)]
          : null;
      }
    }
    for (const enemy of aliveEnemies) {
      if (!enemy.target || !enemy.target.alive) {
        enemy.target = aliveHeroes.length > 0
          ? aliveHeroes[Math.floor(rng.next() * aliveHeroes.length)]
          : null;
      }
    }
  }

  // Combat damage
  function dealDamage(attacker: CombatEntity, target: CombatEntity) {
    if (!target.alive) return;
    let rawDmg = attacker.damage + attacker.damageBonus;
    let effectiveDef = target.defense + target.defenseBonus;
    let dmg = Math.max(1, rawDmg - effectiveDef);

    // Critical hit
    if (rng.next() < attacker.critChance) {
      dmg = Math.floor(dmg * attacker.critMultiplier);
    }

    // Shield absorption
    if (target.shieldAmount > 0) {
      if (target.shieldAmount >= dmg) {
        target.shieldAmount -= dmg;
        dmg = 0;
      } else {
        dmg -= target.shieldAmount;
        target.shieldAmount = 0;
      }
    }

    target.hp -= dmg;
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      handleDeath(target);
    }
  }

  function handleDeath(entity: CombatEntity) {
    if (entity.isPlayer) {
      playerDeaths++;
      entity.respawnTime = simTime + RESPAWN_DELAY;
      score -= cfg.pointsLostPerDeath;
    } else {
      enemiesDefeated++;
      // Grant XP to all living heroes
      const aliveHeroes = heroes.filter(h => h.alive);
      for (const hero of aliveHeroes) {
        hero.experience += entity.expReward;
        checkLevelUp(hero);
      }
      // Score
      if (entity.isBoss) {
        bossesDefeated++;
        score += cfg.pointsPerBoss;
        if (entity.name === 'Dragon Lord Vexar') {
          victory = true;
          gameOver = true;
        }
      } else {
        score += cfg.pointsPerKill;
      }
      // Remove from enemies array
      const idx = enemies.indexOf(entity);
      if (idx >= 0) enemies.splice(idx, 1);
      // Spawn replacement if under limit
      if (enemiesDefeated < MAX_ENCOUNTERS && !gameOver) {
        spawnEnemy(currentTier);
      }
      // Tier progression
      if (enemiesDefeated % cfg.tierProgressionKills === 0 && currentTier < 6) {
        currentTier++;
        currentWave++;
      }
      // Boss spawning
      if (enemiesDefeated > 0 && enemiesDefeated % cfg.bossEveryKills === 0 && !gameOver) {
        spawnBoss();
      }
    }
  }

  function checkLevelUp(hero: CombatEntity) {
    while (hero.experience >= hero.experienceToLevel) {
      hero.level++;
      hero.experience -= hero.experienceToLevel;
      hero.experienceToLevel = Math.floor(hero.experienceToLevel * 1.5);
      // Stat increases on level up
      hero.maxHp += 10;
      hero.hp = Math.min(hero.hp + 10, hero.maxHp);
      hero.damage += 2;
      hero.defense += 1;
      hero.maxMana += 5;
    }
  }

  // Skill usage
  function useSkill(hero: CombatEntity) {
    // Try each skill slot in order
    for (let slot = 0; slot < 4; slot++) {
      if (hero.skillCooldowns[slot] <= 0) {
        const skillName = hero.skills[slot];
        if (applySkill(hero, skillName, slot)) {
          return;
        }
      }
    }
  }

  function applySkill(hero: CombatEntity, skillName: string, slot: number): boolean {
    const target = hero.target;

    switch (skillName) {
      // ── Warrior ──
      case 'power_strike':
        hero.damageBonus += Math.floor(hero.damage / 2);
        hero.skillCooldowns[slot] = 8;
        scheduleBuff(hero, 'damageBonus', Math.floor(hero.damage / 2), 6);
        return true;

      case 'shield_bash':
        if (target?.alive) {
          target.defenseBonus -= 3;
          hero.skillCooldowns[slot] = 10;
          scheduleBuff(target, 'defenseRestore', 3, 5);
        }
        return true;

      case 'defensive_stance':
        hero.defenseBonus += 5;
        hero.skillCooldowns[slot] = 12;
        scheduleBuff(hero, 'defenseBonus', 5, 8);
        return true;

      case 'execute':
        if (target?.alive && target.hp < target.maxHp / 3) {
          dealDamage({ ...hero, damage: hero.damage * 2, damageBonus: 0, critChance: hero.critChance + 0.3 } as CombatEntity, target);
          hero.skillCooldowns[slot] = 15;
          return true;
        }
        return false;

      // ── Mage ──
      case 'fireball':
        if (hero.mana >= 20 && target?.alive) {
          hero.mana -= 20;
          const fireDmg = hero.damage + hero.intelligence * 2;
          target.hp -= Math.max(1, fireDmg - target.defense - target.defenseBonus);
          if (target.hp <= 0) { target.hp = 0; target.alive = false; handleDeath(target); }
          hero.skillCooldowns[slot] = 6;
          return true;
        }
        return false;

      case 'frost_bolt':
        if (hero.mana >= 15 && target?.alive) {
          hero.mana -= 15;
          const frostDmg = hero.damage + hero.intelligence;
          target.hp -= Math.max(1, frostDmg - target.defense - target.defenseBonus);
          target.hasteBonus -= 0.3;
          if (target.hp <= 0) { target.hp = 0; target.alive = false; handleDeath(target); }
          hero.skillCooldowns[slot] = 8;
          scheduleBuff(target, 'hasteRestore', 0.3, 5);
          return true;
        }
        return false;

      case 'arcane_blast':
        if (hero.mana >= 25 && target?.alive) {
          hero.mana -= 25;
          const blastDmg = hero.damage * 2 + hero.intelligence * 3;
          target.hp -= Math.max(1, blastDmg - target.defense - target.defenseBonus);
          if (target.hp <= 0) { target.hp = 0; target.alive = false; handleDeath(target); }
          hero.skillCooldowns[slot] = 10;
          return true;
        }
        return false;

      case 'mana_shield':
        if (hero.mana >= 30) {
          hero.mana -= 30;
          hero.shieldAmount += 40 + hero.intelligence * 2;
          hero.skillCooldowns[slot] = 15;
          return true;
        }
        return false;

      // ── Ranger ──
      case 'arrow_shot':
        if (target?.alive) {
          const arrowDmg = hero.damage + hero.dexterity;
          target.hp -= Math.max(1, arrowDmg - target.defense - target.defenseBonus);
          if (target.hp <= 0) { target.hp = 0; target.alive = false; handleDeath(target); }
          hero.skillCooldowns[slot] = 5;
          return true;
        }
        return false;

      case 'multi_shot': {
        const aliveEnemies = enemies.filter(e => e.alive);
        const hits = aliveEnemies.slice(0, 3);
        for (const e of hits) {
          const multiDmg = Math.floor(hero.damage / 2) + hero.dexterity;
          e.hp -= Math.max(1, multiDmg - e.defense - e.defenseBonus);
          if (e.hp <= 0) { e.hp = 0; e.alive = false; handleDeath(e); }
        }
        hero.skillCooldowns[slot] = 10;
        return true;
      }

      case 'evade':
        hero.defenseBonus += 4;
        hero.hasteBonus += 0.3;
        hero.skillCooldowns[slot] = 12;
        scheduleBuff(hero, 'evadeEnd', 0, 6);
        return true;

      case 'trap':
        if (target?.alive) {
          const trapDmg = hero.damage + hero.dexterity * 2;
          target.hp -= Math.max(1, trapDmg - target.defense - target.defenseBonus);
          if (target.hp <= 0) { target.hp = 0; target.alive = false; handleDeath(target); }
          hero.skillCooldowns[slot] = 15;
          return true;
        }
        return false;

      // ── Paladin ──
      case 'holy_strike':
        if (target?.alive) {
          const holyDmg = hero.damage + hero.wisdom;
          target.hp -= Math.max(1, holyDmg - target.defense - target.defenseBonus);
          if (target.hp <= 0) { target.hp = 0; target.alive = false; handleDeath(target); }
          hero.hp = Math.min(hero.maxHp, hero.hp + 5 + hero.wisdom);
          hero.skillCooldowns[slot] = 6;
          return true;
        }
        return false;

      case 'divine_shield':
        hero.shieldAmount += 30 + hero.wisdom * 3;
        hero.skillCooldowns[slot] = 12;
        return true;

      case 'consecrate': {
        const aliveEnemies2 = enemies.filter(e => e.alive);
        const hits2 = aliveEnemies2.slice(0, 4);
        for (const e of hits2) {
          const consecDmg = hero.wisdom * 2;
          e.hp -= Math.max(1, consecDmg - e.defense);
          if (e.hp <= 0) { e.hp = 0; e.alive = false; handleDeath(e); }
        }
        hero.skillCooldowns[slot] = 10;
        return true;
      }

      case 'lay_on_hands': {
        const aliveHeroes = heroes.filter(h => h.alive);
        let lowest = hero;
        for (const h of aliveHeroes) {
          if (h.hp < lowest.hp) lowest = h;
        }
        lowest.hp = Math.min(lowest.maxHp, lowest.hp + 50 + hero.wisdom * 4);
        hero.skillCooldowns[slot] = 20;
        return true;
      }

      // ── Rogue ──
      case 'backstab':
        if (target?.alive) {
          const backstabDmg = hero.damage * 2 + hero.dexterity * 2;
          target.hp -= Math.max(1, backstabDmg - target.defense - target.defenseBonus);
          if (target.hp <= 0) { target.hp = 0; target.alive = false; handleDeath(target); }
          hero.skillCooldowns[slot] = 5;
          return true;
        }
        return false;

      case 'smoke_bomb':
        hero.defenseBonus += 6;
        hero.hasteBonus += 0.4;
        hero.skillCooldowns[slot] = 10;
        scheduleBuff(hero, 'smokeEnd', 0, 5);
        return true;

      case 'poison_blade': {
        const poisonBonus = 3 + Math.floor(hero.dexterity / 2);
        hero.damageBonus += poisonBonus;
        hero.skillCooldowns[slot] = 12;
        scheduleBuff(hero, 'damageBonus', poisonBonus, 8);
        return true;
      }

      case 'shadowstep':
        if (target?.alive) {
          const shadowDmg = hero.damage * 3;
          target.hp -= Math.max(1, shadowDmg - target.defense - target.defenseBonus);
          if (target.hp <= 0) { target.hp = 0; target.alive = false; handleDeath(target); }
          hero.skillCooldowns[slot] = 15;
          return true;
        }
        return false;

      // ── Cleric ──
      case 'heal':
        if (hero.mana >= 15) {
          hero.mana -= 15;
          const aliveHeroes3 = heroes.filter(h => h.alive);
          let lowest3 = hero;
          for (const h of aliveHeroes3) {
            if (h.hp / h.maxHp < lowest3.hp / lowest3.maxHp) lowest3 = h;
          }
          lowest3.hp = Math.min(lowest3.maxHp, lowest3.hp + 20 + hero.wisdom * 3);
          hero.skillCooldowns[slot] = 4;
          return true;
        }
        return false;

      case 'smite':
        if (hero.mana >= 10 && target?.alive) {
          hero.mana -= 10;
          const smiteDmg = hero.damage + hero.wisdom * 2;
          target.hp -= Math.max(1, smiteDmg - target.defense - target.defenseBonus);
          if (target.hp <= 0) { target.hp = 0; target.alive = false; handleDeath(target); }
          hero.skillCooldowns[slot] = 6;
          return true;
        }
        return false;

      case 'divine_favor':
        if (hero.mana >= 20) {
          hero.mana -= 20;
          for (const h of heroes.filter(h2 => h2.alive)) {
            h.regenAmount += 3;
          }
          hero.skillCooldowns[slot] = 15;
          return true;
        }
        return false;

      case 'holy_word':
        if (hero.mana >= 35) {
          hero.mana -= 35;
          for (const h of heroes.filter(h2 => h2.alive)) {
            h.hp = Math.min(h.maxHp, h.hp + 30 + hero.wisdom * 2);
          }
          hero.skillCooldowns[slot] = 20;
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  // Delayed buff removal queue
  const buffRemovals: { time: number; target: CombatEntity; type: string; amount: number }[] = [];

  function scheduleBuff(target: CombatEntity, type: string, amount: number, duration: number) {
    buffRemovals.push({ time: simTime + duration, target, type, amount });
  }

  function processBuffRemovals() {
    for (let i = buffRemovals.length - 1; i >= 0; i--) {
      if (simTime >= buffRemovals[i].time) {
        const br = buffRemovals.splice(i, 1)[0];
        if (!br.target.alive) continue;
        switch (br.type) {
          case 'damageBonus':
            br.target.damageBonus = Math.max(0, br.target.damageBonus - br.amount);
            break;
          case 'defenseBonus':
            br.target.defenseBonus = Math.max(0, br.target.defenseBonus - br.amount);
            break;
          case 'defenseRestore':
            br.target.defenseBonus += br.amount;
            break;
          case 'hasteRestore':
            br.target.hasteBonus += br.amount;
            break;
          case 'evadeEnd':
            br.target.defenseBonus -= 4;
            br.target.hasteBonus -= 0.3;
            break;
          case 'smokeEnd':
            br.target.defenseBonus -= 6;
            br.target.hasteBonus -= 0.4;
            break;
        }
      }
    }
  }

  // ── Initial spawn ─────────────────────────────────────────────────────────

  for (let i = 0; i < cfg.initialEnemyCount; i++) {
    spawnEnemy(1);
  }
  assignTargets();

  // ── Main simulation loop ──────────────────────────────────────────────────

  const snapshots: GameSnapshot[] = [];
  let checkpointsReached = 0;
  const DT = 0.1; // simulation tick size (100ms)

  while (enemiesDefeated < MAX_ENCOUNTERS && !gameOver && simTime < MAX_SIM_TIME) {
    simTime += DT;

    // Process buff removals
    processBuffRemovals();

    // Respawn dead heroes
    for (const hero of heroes) {
      if (!hero.alive && hero.respawnTime > 0 && simTime >= hero.respawnTime) {
        hero.alive = true;
        hero.hp = hero.maxHp;
        hero.mana = hero.maxMana;
        hero.respawnTime = -1;
        hero.damageBonus = 0;
        hero.defenseBonus = 0;
        hero.hasteBonus = 0;
        hero.shieldAmount = 0;
        hero.regenAmount = 0;
        hero.nextAttackTime = simTime + 0.5;
        hero.nextSkillTime = simTime + 2;
        hero.nextManaRegenTime = simTime + 1;
        hero.nextHealthRegenTime = simTime + 3;
      }
    }

    // Target assignment
    assignTargets();

    // Hero attacks
    for (const hero of heroes) {
      if (!hero.alive) continue;
      if (simTime >= hero.nextAttackTime) {
        if (hero.target?.alive) {
          dealDamage(hero, hero.target);
        }
        const totalSpeed = Math.max(0.1, hero.attackSpeed + hero.hasteBonus);
        hero.nextAttackTime = simTime + 1.0 / totalSpeed;
      }
    }

    // Enemy attacks
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (simTime >= enemy.nextAttackTime) {
        if (enemy.target?.alive) {
          dealDamage(enemy, enemy.target);
        }
        const totalSpeed = Math.max(0.1, enemy.attackSpeed + enemy.hasteBonus);
        enemy.nextAttackTime = simTime + 1.0 / totalSpeed;
      }
    }

    // Skill usage
    for (const hero of heroes) {
      if (!hero.alive) continue;
      if (simTime >= hero.nextSkillTime) {
        // Tick cooldowns
        for (let s = 0; s < 4; s++) {
          hero.skillCooldowns[s] = Math.max(0, hero.skillCooldowns[s] - SKILL_USE_INTERVAL);
        }
        useSkill(hero);
        hero.nextSkillTime = simTime + SKILL_USE_INTERVAL;
      }
    }

    // Mana regeneration
    for (const hero of heroes) {
      if (!hero.alive) continue;
      if (simTime >= hero.nextManaRegenTime) {
        hero.mana = Math.min(hero.maxMana, hero.mana + 5);
        hero.nextManaRegenTime = simTime + MANA_REGEN_INTERVAL;
      }
    }

    // Health regeneration
    for (const hero of heroes) {
      if (!hero.alive) continue;
      if (simTime >= hero.nextHealthRegenTime) {
        const regen = 2 + hero.regenAmount;
        hero.hp = Math.min(hero.maxHp, hero.hp + regen);
        hero.nextHealthRegenTime = simTime + HEALTH_REGEN_INTERVAL;
      }
    }

    // Clean up dead enemies from the list
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i].alive) enemies.splice(i, 1);
    }

    // Checkpoint tracking
    const nextCheckpoint = (checkpointsReached + 1) * CHECKPOINT_INTERVAL;
    if (enemiesDefeated >= nextCheckpoint) {
      checkpointsReached++;
      const heroLevels: Record<string, number> = {};
      for (const hero of heroes) {
        heroLevels[hero.name] = hero.level;
      }
      snapshots.push({
        step: checkpointsReached,
        simulationTime: simTime,
        enemiesDefeated,
        score: Math.max(0, score),
        currentTier,
        currentWave,
        heroLevels,
        bossesDefeated,
        playerDeaths,
        isGameOver: gameOver,
        victory,
      });
    }

    // Safety: if no enemies and no heroes alive, respawn will happen eventually
    if (enemies.length === 0 && enemiesDefeated < MAX_ENCOUNTERS && !gameOver) {
      spawnEnemy(currentTier);
      assignTargets();
    }
  }

  // Final snapshot
  const heroLevels: Record<string, number> = {};
  for (const hero of heroes) {
    heroLevels[hero.name] = hero.level;
  }
  snapshots.push({
    step: snapshots.length + 1,
    simulationTime: simTime,
    enemiesDefeated,
    score: Math.max(0, score),
    currentTier,
    currentWave,
    heroLevels,
    bossesDefeated,
    playerDeaths,
    isGameOver: gameOver || enemiesDefeated >= MAX_ENCOUNTERS,
    victory,
  });

  return snapshots;
}
