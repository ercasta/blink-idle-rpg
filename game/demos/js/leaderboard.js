/**
 * Leaderboard Management
 * 
 * Handles saving, loading, and displaying game runs on the leaderboard.
 * Uses browser localStorage for persistence.
 */

const STORAGE_KEY = 'blink_rpg_runs';
const MAX_STORED_RUNS = 100;

/**
 * Loads all runs from localStorage
 * @returns {Array} - Array of run objects
 */
export function loadRuns() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load runs from storage:', e);
    return [];
  }
}

/**
 * Saves a run to the leaderboard
 * @param {Object} runData - The run data to save
 * @returns {number} - The rank of the saved run (1-based)
 */
export function saveRun(runData) {
  let runs = loadRuns();
  
  // Add new run
  runs.push(runData);
  
  // Sort by completion time (fastest first)
  runs.sort((a, b) => a.completionTime - b.completionTime);
  
  // Keep only top MAX_STORED_RUNS
  if (runs.length > MAX_STORED_RUNS) {
    runs = runs.slice(0, MAX_STORED_RUNS);
  }
  
  // Save back to storage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
    const rank = runs.findIndex(r => r.runId === runData.runId) + 1;
    return rank;
  } catch (e) {
    console.error('Failed to save run to storage:', e);
    return -1;
  }
}

/**
 * Clears all runs from the leaderboard
 */
export function clearLeaderboard() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear leaderboard:', e);
  }
}

/**
 * Exports leaderboard data as JSON
 * @returns {string|null} - JSON string of all runs, or null if no data
 */
export function exportLeaderboard() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || null;
  } catch (e) {
    console.error('Failed to export leaderboard:', e);
    return null;
  }
}

/**
 * Creates run data object from current game state
 * @param {Object} params - Parameters for creating run data
 * @returns {Object} - Run data object ready to be saved
 */
export function createRunData({ 
  runId, 
  startTime, 
  totalTime, 
  simulationTime, 
  partySlots, 
  loadedBCLFiles, 
  gameState, 
  runState 
}) {
  const selectedCharacters = partySlots.filter(hero => hero !== null);
  
  return {
    runId,
    timestamp: startTime,
    completionTime: totalTime,
    simulationTime,
    partyComposition: {
      characters: selectedCharacters.map(c => c.name),
      characterIds: selectedCharacters.map(c => c.id),
      bclFiles: loadedBCLFiles.map(f => f.name)
    },
    statistics: {
      enemiesDefeated: gameState.enemiesDefeated,
      playerDeaths: gameState.playerDeaths,
      retreats: runState.retreatCount,
      retreatPenalty: runState.retreatPenalty,
      deathPenalty: runState.deathPenalty,
      totalPenalties: runState.retreatPenalty + runState.deathPenalty
    },
    victory: gameState.victory
  };
}
