#!/usr/bin/env node
/**
 * Test script to verify Lord Vexar defeat tracking
 * 
 * This script runs 10 games and verifies that:
 * 1. Lord Vexar is defeated in each game
 * 2. The LordVexarDefeated component is created
 * 3. The game ends with victory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BlinkGame } from '@blink/engine';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runGame(gameNumber, irPath, maxSimulationTime = 3600) {
    console.log(`\n=== Running Game ${gameNumber} ===`);
    
    try {
        // Load the IR
        const irData = JSON.parse(fs.readFileSync(irPath, 'utf8'));
        
        // Create the game with a faster time scale
        const game = await BlinkGame.create({ timeScale: 100.0 });
        
        // Load rules from IR object
        game.loadRulesFromObject(irData);
        
        // Schedule GameStart event to trigger initialization
        game.scheduleEvent('GameStart', 0, {});
        
        // Start the game
        game.start();
        
        // Run until game is over or timeout
        let checkInterval = 1.0; // Check every second of simulation time
        let lastCheck = 0;
        let gameOver = false;
        let lordVexarDefeated = false;
        let victory = false;
        
        while (!gameOver && game.getSimulationTime() < maxSimulationTime) {
            game.step();
            
            const currentTime = game.getSimulationTime();
            if (currentTime - lastCheck >= checkInterval) {
                // Check game state
                const entities = game.getAllEntities();
                
                for (const entityId of entities) {
                    const gameState = game.getComponent(entityId, 'GameState');
                    if (gameState) {
                        if (gameState.gameOver) {
                            gameOver = true;
                            victory = gameState.victory;
                            console.log(`Game ended at ${currentTime.toFixed(2)}s - Victory: ${victory}`);
                        }
                    }
                    
                    // Check for LordVexarDefeated component
                    const lordVexarComp = game.getComponent(entityId, 'LordVexarDefeated');
                    if (lordVexarComp) {
                        lordVexarDefeated = true;
                        console.log(`✓ LordVexarDefeated component found!`);
                        console.log(`  - Defeated at: ${lordVexarComp.defeatedAt.toFixed(2)}s`);
                        console.log(`  - Hero count: ${lordVexarComp.defeatedByHeroCount}`);
                    }
                }
                
                lastCheck = currentTime;
            }
            
            // Break if we detect game over
            if (gameOver) {
                break;
            }
        }
        
        // Verify results
        const results = {
            gameNumber,
            success: gameOver && victory && lordVexarDefeated,
            gameOver,
            victory,
            lordVexarDefeated,
            simulationTime: game.getSimulationTime(),
            timeout: game.getSimulationTime() >= maxSimulationTime
        };
        
        if (results.success) {
            console.log(`✅ Game ${gameNumber}: SUCCESS - Lord Vexar defeated!`);
        } else {
            console.log(`❌ Game ${gameNumber}: FAILED`);
            console.log(`   Game Over: ${gameOver}`);
            console.log(`   Victory: ${victory}`);
            console.log(`   Lord Vexar Defeated: ${lordVexarDefeated}`);
            console.log(`   Timeout: ${results.timeout}`);
        }
        
        return results;
        
    } catch (error) {
        console.error(`❌ Game ${gameNumber}: ERROR - ${error.message}`);
        console.error(error.stack);
        return {
            gameNumber,
            success: false,
            error: error.message
        };
    }
}

async function runAllTests() {
    console.log('=================================================');
    console.log('Lord Vexar Defeat Tracking Test Suite');
    console.log('=================================================');
    console.log('Running 10 games to verify Lord Vexar defeat...\n');
    
    const irPath = path.join(__dirname, '../ir/classic-rpg-easy.ir.json');
    
    if (!fs.existsSync(irPath)) {
        console.error(`❌ IR file not found: ${irPath}`);
        process.exit(1);
    }
    
    const results = [];
    const numGames = 10;
    
    for (let i = 1; i <= numGames; i++) {
        const result = await runGame(i, irPath);
        results.push(result);
        
        // Add a small delay between games
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Summary
    console.log('\n=================================================');
    console.log('TEST SUMMARY');
    console.log('=================================================');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Total Games: ${numGames}`);
    console.log(`Successful: ${successful} ✅`);
    console.log(`Failed: ${failed} ❌`);
    
    if (successful === numGames) {
        console.log('\n🎉 ALL TESTS PASSED! Lord Vexar defeat tracking is working correctly!');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Please review the results above.');
        process.exit(1);
    }
}

// Run the tests
runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
