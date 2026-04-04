/**
 * Tests for Boss Spawn Requirements
 * Validates that Dragon Lord Vexar only appears after the tier-progression
 * condition is met (tier == maxTier in SpawnConfig).
 */

import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert';
import { BlinkGame } from '@blink/engine';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore – resolved via package.json dependencies
import { compileString } from '@blink/compiler-ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Compile the canonical BRL at test startup (avoids stale JSON artefacts)
// dist/ is one level deeper than source, so go up 3 levels to reach repo root
const brlPath = path.join(__dirname, '../../../game/brl/classic-rpg.brl');
let classicRpgIR: unknown;

before(() => {
  const brl = fs.readFileSync(brlPath, 'utf-8');
  const result = compileString(brl, 'brl');
  if (result.errors.length > 0) {
    throw new Error('BRL compilation failed: ' + result.errors.map((e: any) => e.message).join('; '));
  }
  classicRpgIR = result.ir;
});

describe('Boss Spawn Requirements', () => {
  let game: BlinkGame;

  afterEach(() => {
    game.destroy();
  });

  describe('Dragon Lord Vexar – Tier-Based Spawn Condition', () => {
    /** Helper: build a minimal game with a SpawnConfig entity so that
     *  store.setField manipulations in each test work correctly. */
    function createMinimalGame(): BlinkGame {
      const g = BlinkGame.createSync({ debug: false });
      g.loadRulesFromObject(classicRpgIR as object);

      const gsId = g.createEntity(99);
      g.addComponent(gsId, 'GameState', {
        currentWave: 1, enemiesDefeated: 0, playerDeaths: 0,
        bossDefeated: false, gameOver: false, victory: false,
        retargetingActive: false, currentTier: 1, waveInTier: 1, bossSpawned: false,
      });
      g.addComponent(gsId, 'SpawnConfig', {
        bossEveryKills: 10, tierProgressionKills: 10,
        maxTier: 3, wavesPerTier: 2, healthScaleRate: 0, damageScaleRate: 0, initialEnemyCount: 1,
      });

      // Enemy templates needed by spawn_enemy_from_template / spawn_lord_vexar
      const t1 = g.createEntity(100);
      g.addComponent(t1, 'Character',     { name: 'Goblin', class: 'Monster', level: 1, experience: 0, experienceToLevel: 999 });
      g.addComponent(t1, 'Health',        { current: 10, max: 10 });
      g.addComponent(t1, 'Mana',          { current: 0, max: 0 });
      g.addComponent(t1, 'Stats',         { strength: 8, dexterity: 8, intelligence: 4, constitution: 8, wisdom: 4 });
      g.addComponent(t1, 'Combat',        { damage: 1, defense: 0, attackSpeed: 0.1, critChance: 0.0, critMultiplier: 1.0 });
      g.addComponent(t1, 'Target',        { entity: null });
      g.addComponent(t1, 'Team',          { id: 'enemy', isPlayer: false });
      g.addComponent(t1, 'Enemy',         { tier: 1, isBoss: false, expReward: 10, wave: 1, name: 'Goblin' });
      g.addComponent(t1, 'EnemyTemplate', { isTemplate: true });
      g.addComponent(t1, 'Buffs',         { damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0 });

      const boss = g.createEntity(108);
      g.addComponent(boss, 'Character',     { name: 'Dragon Lord Vexar', class: 'Boss', level: 3, experience: 0, experienceToLevel: 999 });
      g.addComponent(boss, 'Health',        { current: 50, max: 50 });
      g.addComponent(boss, 'Mana',          { current: 0, max: 0 });
      g.addComponent(boss, 'Stats',         { strength: 8, dexterity: 8, intelligence: 4, constitution: 8, wisdom: 4 });
      g.addComponent(boss, 'Combat',        { damage: 5, defense: 2, attackSpeed: 0.1, critChance: 0.0, critMultiplier: 1.0 });
      g.addComponent(boss, 'Target',        { entity: null });
      g.addComponent(boss, 'Team',          { id: 'enemy', isPlayer: false });
      g.addComponent(boss, 'Enemy',         { tier: 3, isBoss: true, expReward: 500, wave: 3, name: 'Lord Vexar' });
      g.addComponent(boss, 'EnemyTemplate', { isTemplate: true });
      g.addComponent(boss, 'Buffs',         { damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0 });
      g.addComponent(boss, 'FinalBoss',     { isFinalBoss: true });

      return g;
    }

    it('bossSpawned starts false and progresses to true at maxTier', () => {
      game = createMinimalGame();

      // Advance tier to maxTier directly
      const store = (game as any).store;
      store.setField(99, 'GameState', 'currentTier', 3);
      store.setField(99, 'GameState', 'bossSpawned', false);

      const stateBefore = game.getComponent(99, 'GameState') as any;
      assert.strictEqual(stateBefore.currentTier, 3, 'currentTier should be 3 (maxTier)');
      assert.strictEqual(stateBefore.bossSpawned, false, 'bossSpawned should start false');

      // Fire EnemySpawned – handle_enemy_spawned should set bossSpawned = true
      game.scheduleEvent('EnemySpawned', 0, { fields: { wave: 1 } });
      game.runUntilComplete(5);

      const stateAfter = game.getComponent(99, 'GameState') as any;
      assert.strictEqual(stateAfter.bossSpawned, true, 'bossSpawned should be true after EnemySpawned at maxTier');
    });

    it('bossSpawned remains false when tier < maxTier', () => {
      game = createMinimalGame();

      const store = (game as any).store;
      store.setField(99, 'GameState', 'currentTier', 1); // tier 1, maxTier is 3
      store.setField(99, 'GameState', 'bossSpawned', false);

      game.scheduleEvent('EnemySpawned', 0, { fields: { wave: 1 } });
      game.runUntilComplete(5);

      const stateAfter = game.getComponent(99, 'GameState') as any;
      assert.strictEqual(stateAfter.bossSpawned, false, 'bossSpawned should remain false while tier < maxTier');
    });

    it('tier increments after wavesPerTier waves per tier', () => {
      game = createMinimalGame();

      // Start at tier 1, waveInTier 1, wavesPerTier 2
      const store = (game as any).store;
      store.setField(99, 'GameState', 'currentTier', 1);
      store.setField(99, 'GameState', 'waveInTier', 1);

      // First wave: waveInTier advances to 2 (still tier 1)
      game.scheduleEvent('EnemySpawned', 0, { fields: { wave: 1 } });
      game.runUntilComplete(5);

      const mid = game.getComponent(99, 'GameState') as any;
      assert.strictEqual(mid.currentTier, 1, 'Tier should still be 1 after first wave');
      assert.strictEqual(mid.waveInTier, 2,  'waveInTier should advance to 2');

      // Second wave: waveInTier exceeds wavesPerTier → tier advances to 2
      game.scheduleEvent('EnemySpawned', 1, { fields: { wave: 2 } });
      game.runUntilComplete(5);

      const final = game.getComponent(99, 'GameState') as any;
      assert.strictEqual(final.currentTier, 2, 'Tier should advance to 2 after wavesPerTier waves');
    });

    it('spawn_replacement_enemy stops spawning when bossSpawned is true', () => {
      game = createMinimalGame();

      const store = (game as any).store;
      store.setField(99, 'GameState', 'bossSpawned', true);
      store.setField(99, 'GameState', 'gameOver', false);

      // Add a hero so the game has valid state
      const hid = game.createEntity(1);
      game.addComponent(hid, 'Character', { name: 'Warrior', class: 'Warrior', level: 1, experience: 0, experienceToLevel: 100 });
      game.addComponent(hid, 'Health',    { current: 200, max: 200 });
      game.addComponent(hid, 'Team',      { id: 'player', isPlayer: true });
      game.addComponent(hid, 'Target',    { entity: null });
      game.addComponent(hid, 'Combat',    { damage: 10, defense: 5, attackSpeed: 1.0, critChance: 0.0, critMultiplier: 1.5 });
      game.addComponent(hid, 'Buffs',     { damageBonus: 0, defenseBonus: 0, hasteBonus: 0.0, shieldAmount: 0, regenAmount: 0 });
      game.addComponent(hid, 'Mana',      { current: 0, max: 0 });
      game.addComponent(hid, 'Stats',     { strength: 10, dexterity: 10, intelligence: 10, constitution: 10, wisdom: 10 });
      game.addComponent(hid, 'Skills',    { skill1: '', skill2: '', skill3: '', skill4: '', skillPoints: 0 });

      // Add a dummy enemy template so queries don't fail
      const eid = game.createEntity(100);
      game.addComponent(eid, 'Enemy',        { tier: 1, isBoss: false, expReward: 10, wave: 1, name: 'Goblin' });
      game.addComponent(eid, 'EnemyTemplate',{ isTemplate: true });
      game.addComponent(eid, 'Health',       { current: 10, max: 10 });
      game.addComponent(eid, 'Team',         { id: 'enemy', isPlayer: false });

      const entityCountBefore = game.query('Enemy').length;

      // Fire EnemyDefeated – spawn_replacement_enemy should NOT spawn when bossSpawned=true
      game.scheduleEvent('EnemyDefeated', 0, { fields: { enemy: 100, expReward: 10, isBoss: false } });
      game.runUntilComplete(20);

      // No new enemies should have been cloned (only templates remain)
      const entityCountAfter = game.query('Enemy').length;
      assert.strictEqual(
        entityCountAfter,
        entityCountBefore,
        'No new enemies should spawn when bossSpawned is true'
      );
    });
  });
});

