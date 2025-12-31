/**
 * Tests for Boss Spawn Requirements
 * Validates that Dragon Lord Vexar only appears after 2000 enemies defeated
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { BlinkGame } from './BlinkGame';
import * as fs from 'fs';
import * as path from 'path';

// Load the actual classic RPG IR from the examples directory
const classicRpgPath = path.join(__dirname, '../../../examples/ir/classic-rpg.ir.json');
const classicRpgIR = JSON.parse(fs.readFileSync(classicRpgPath, 'utf-8'));

describe('Boss Spawn Requirements', () => {
  let game: BlinkGame;

  beforeEach(() => {
    game = BlinkGame.createSync({ debug: false });
    game.loadRulesFromObject(classicRpgIR);
  });

  describe('Dragon Lord Vexar Spawn Condition', () => {
    it('should not spawn boss when enemiesDefeated < 2000 even at wave 4', () => {
      // Get the game state entity
      const gameState = game.getComponent(99, 'GameState');
      assert.ok(gameState, 'GameState should exist');
      
      // Set current wave to 4 (about to spawn boss on next SpawnEnemy event)
      const store = (game as any).store;
      store.setField(99, 'GameState', 'currentWave', 4);
      
      // Set enemiesDefeated to less than 2000
      store.setField(99, 'GameState', 'enemiesDefeated', 1999);
      
      // Verify the initial state
      const stateBefore = game.getComponent(99, 'GameState');
      assert.strictEqual(stateBefore?.currentWave, 4);
      assert.strictEqual(stateBefore?.enemiesDefeated, 1999);
      
      // Try to spawn next enemy (should not increment to wave 5)
      game.scheduleEvent('SpawnEnemy', 0, {});
      game.step();
      
      // Wave should NOT have incremented to 5 because enemiesDefeated < 2000
      const stateAfter = game.getComponent(99, 'GameState');
      assert.strictEqual(stateAfter?.currentWave, 4, 'Wave should remain at 4 when enemiesDefeated < 2000');
    });

    it('should spawn boss when enemiesDefeated >= 2000 and at wave 4', () => {
      // Get the game state entity
      const gameState = game.getComponent(99, 'GameState');
      assert.ok(gameState, 'GameState should exist');
      
      // Set current wave to 4 (about to spawn boss on next SpawnEnemy event)
      const store = (game as any).store;
      store.setField(99, 'GameState', 'currentWave', 4);
      
      // Set enemiesDefeated to exactly 2000
      store.setField(99, 'GameState', 'enemiesDefeated', 2000);
      
      // Verify the initial state
      const stateBefore = game.getComponent(99, 'GameState');
      assert.strictEqual(stateBefore?.currentWave, 4);
      assert.strictEqual(stateBefore?.enemiesDefeated, 2000);
      
      // Try to spawn next enemy (should increment to wave 5)
      game.scheduleEvent('SpawnEnemy', 0, {});
      game.step();
      
      // Wave should have incremented to 5 because enemiesDefeated >= 2000
      const stateAfter = game.getComponent(99, 'GameState');
      assert.strictEqual(stateAfter?.currentWave, 5, 'Wave should increment to 5 when enemiesDefeated >= 2000');
    });

    it('should spawn boss when enemiesDefeated > 2000 and at wave 4', () => {
      // Get the game state entity
      const gameState = game.getComponent(99, 'GameState');
      assert.ok(gameState, 'GameState should exist');
      
      // Set current wave to 4
      const store = (game as any).store;
      store.setField(99, 'GameState', 'currentWave', 4);
      
      // Set enemiesDefeated to more than 2000
      store.setField(99, 'GameState', 'enemiesDefeated', 3000);
      
      // Try to spawn next enemy
      game.scheduleEvent('SpawnEnemy', 0, {});
      game.step();
      
      // Wave should have incremented to 5
      const stateAfter = game.getComponent(99, 'GameState');
      assert.strictEqual(stateAfter?.currentWave, 5, 'Wave should increment to 5 when enemiesDefeated > 2000');
    });

    it('should allow spawning waves 1-4 regardless of enemiesDefeated count', () => {
      // Test that early waves (1-3) can spawn without the 2000 enemy requirement
      const store = (game as any).store;
      
      // Test wave 1 -> 2 with 0 enemies defeated
      store.setField(99, 'GameState', 'currentWave', 1);
      store.setField(99, 'GameState', 'enemiesDefeated', 0);
      
      game.scheduleEvent('SpawnEnemy', 0, {});
      game.runUntilComplete(1);
      
      let state = game.getComponent(99, 'GameState');
      assert.strictEqual(state?.currentWave, 2, 'Should advance from wave 1 to 2 with 0 enemies defeated');
      
      // Test wave 2 -> 3 with 0 enemies defeated
      store.setField(99, 'GameState', 'currentWave', 2);
      store.setField(99, 'GameState', 'enemiesDefeated', 0);
      
      game.scheduleEvent('SpawnEnemy', 5, {});
      game.runUntilComplete(10);
      
      state = game.getComponent(99, 'GameState');
      assert.strictEqual(state?.currentWave, 3, 'Should advance from wave 2 to 3 with 0 enemies defeated');
      
      // Test wave 3 -> 4 with 0 enemies defeated
      store.setField(99, 'GameState', 'currentWave', 3);
      store.setField(99, 'GameState', 'enemiesDefeated', 0);
      
      game.scheduleEvent('SpawnEnemy', 10, {});
      game.runUntilComplete(15);
      
      state = game.getComponent(99, 'GameState');
      assert.strictEqual(state?.currentWave, 4, 'Should advance from wave 3 to 4 with 0 enemies defeated');
    });

    it('should verify Dragon Lord Vexar entity exists', () => {
      // Verify that entity 8 (Dragon Lord Vexar) exists
      const dragonChar = game.getComponent(8, 'Character');
      const dragonEnemy = game.getComponent(8, 'Enemy');
      
      assert.ok(dragonChar, 'Dragon Lord Vexar should exist');
      assert.strictEqual(dragonChar?.name, 'Dragon Lord Vexar');
      assert.strictEqual(dragonChar?.class, 'Boss');
      assert.strictEqual(dragonEnemy?.isBoss, true);
      assert.strictEqual(dragonEnemy?.tier, 5);
    });
  });

  afterEach(() => {
    game.destroy();
  });
});
