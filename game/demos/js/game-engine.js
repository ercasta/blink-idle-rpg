/**
 * Game Engine Integration
 * 
 * Handles initialization of the Blink game engine and entity creation.
 * This module bridges between the UI layer and the BlinkEngine.
 */

/**
 * Initializes the Blink game engine with selected party
 * 
 * @param {Object} params - Initialization parameters
 * @param {Object} params.BlinkEngine - The BlinkEngine global object
 * @param {Object} params.ir - The loaded IR object
 * @param {Array} params.selectedCharacters - Array of selected hero objects
 * @returns {Promise<Object>} - The initialized game object
 */
export async function initializeGameEngine({ BlinkEngine, ir, selectedCharacters }) {
  // Create game instance
  const game = await BlinkEngine.BlinkGame.create({
    debug: true,  // Enable debug logging
    msPerFrame: 100, // 100ms of simulation time per frame
    maxEventsPerFrame: 1000
  });
  
  // Filter out hero templates from initial_state
  // Hero templates are only for UI selection, not for game execution
  const filteredIR = {
    ...ir,
    initial_state: {
      entities: ir.initial_state.entities.filter(entity => {
        return !entity.components.HeroTemplate;
      })
    }
  };
  
  // Load game rules from IR
  game.loadRulesFromObject(filteredIR);
  
  // Load config and enemy template entities from filtered IR
  console.info(`Loading ${filteredIR.initial_state.entities.length} entities from IR`);
  filteredIR.initial_state.entities.forEach((entity) => {
    game.createEntity(entity.id);
    Object.entries(entity.components).forEach(([componentName, componentData]) => {
      game.addComponent(entity.id, componentName, componentData);
    });
    
    // Log config entities
    if (entity.components.GameState || entity.components.SpawnConfig) {
      console.info(`Loaded config entity ${entity.id}:`, Object.keys(entity.components));
    }
  });
  
  // Create hero entities dynamically from selected characters
  // Use entity IDs starting from 100 to avoid conflicts
  selectedCharacters.forEach((char, index) => {
    const entityId = 100 + index;
    createHeroEntity(game, entityId, char);
  });
  
  return game;
}

/**
 * Creates a hero entity in the game
 * 
 * @param {Object} game - The BlinkGame instance
 * @param {number} entityId - The entity ID to create
 * @param {Object} character - The character data object
 */
export function createHeroEntity(game, entityId, character) {
  game.createEntity(entityId);
  
  game.addComponent(entityId, 'Character', {
    name: character.name,
    class: character.class,
    level: 1,
    experience: 0,
    experienceToLevel: 100
  });
  
  game.addComponent(entityId, 'Health', {
    current: character.baseHealth,
    max: character.baseHealth
  });
  
  game.addComponent(entityId, 'Mana', {
    current: character.baseMana,
    max: character.baseMana
  });
  
  game.addComponent(entityId, 'Stats', character.stats);
  
  game.addComponent(entityId, 'Combat', {
    damage: character.baseDamage,
    defense: character.baseDefense,
    attackSpeed: character.attackSpeed || 1.0,
    critChance: 0.05,
    critMultiplier: 1.5
  });
  
  game.addComponent(entityId, 'Target', {
    entity: null // Will be set by retargeting system
  });
  
  game.addComponent(entityId, 'Team', {
    id: 'player',
    isPlayer: true
  });
  
  game.addComponent(entityId, 'Skills', {
    skill1: character.skills && character.skills.length > 0 ? character.skills[0] : '',
    skill2: '',
    skill3: '',
    skill4: '',
    skillPoints: 0
  });
  
  game.addComponent(entityId, 'Buffs', {
    damageBonus: 0,
    defenseBonus: 0,
    hasteBonus: 0,
    shieldAmount: 0,
    regenAmount: 0
  });
  
  game.addComponent(entityId, 'SkillCooldown', {
    skill1Cooldown: 0,
    skill2Cooldown: 0,
    skill3Cooldown: 0,
    skill4Cooldown: 0
  });
  
  game.addComponent(entityId, 'ChoiceContext', {
    pendingChoice: '',
    options: '',
    chosen: ''
  });
}

/**
 * Updates character data by querying the game state
 * 
 * @param {Object} game - The BlinkGame instance
 * @returns {Object} - Object with playerCharacters and enemyCharacters
 */
export function updateCharacterData(game) {
  const playerCharacters = {};
  const enemyCharacters = {};
  
  // Query all entities with Team component
  const teamEntities = game.query('Team', 'Character', 'Health');
  
  for (const entityId of teamEntities) {
    const team = game.getComponent(entityId, 'Team');
    const char = game.getComponent(entityId, 'Character');
    const health = game.getComponent(entityId, 'Health');
    
    if (!char || !health || !team) continue;
    
    // Skip enemy templates (they're for cloning only, not for display)
    const enemyTemplate = game.getComponent(entityId, 'EnemyTemplate');
    if (enemyTemplate && enemyTemplate.isTemplate) {
      continue;
    }
    
    if (team.isPlayer) {
      // It's a player character
      const mana = game.getComponent(entityId, 'Mana');
      const combat = game.getComponent(entityId, 'Combat');
      const skills = game.getComponent(entityId, 'Skills');
      
      playerCharacters[entityId] = {
        id: entityId,
        name: char.name,
        class: char.class,
        level: char.level,
        experience: char.experience,
        experienceToLevel: char.experienceToLevel,
        health: health.current,
        maxHealth: health.max,
        mana: mana?.current || 0,
        maxMana: mana?.max || 0,
        damage: combat?.damage || 0,
        defense: combat?.defense || 0,
        attackSpeed: combat?.attackSpeed || 1,
        skills: skills ? [skills.skill1, skills.skill2].filter(s => s) : [],
        skillPoints: skills?.skillPoints || 0
      };
    } else {
      // It's an enemy
      const combat = game.getComponent(entityId, 'Combat');
      const enemy = game.getComponent(entityId, 'Enemy');
      
      enemyCharacters[entityId] = {
        id: entityId,
        name: char.name,
        class: char.class,
        level: char.level,
        health: health.current,
        maxHealth: health.max,
        damage: combat?.damage || 0,
        defense: combat?.defense || 0,
        attackSpeed: combat?.attackSpeed || 1,
        tier: enemy?.tier || 1,
        isBoss: enemy?.isBoss || false
      };
    }
  }
  
  return { playerCharacters, enemyCharacters };
}

/**
 * Updates game state from the GameState component
 * 
 * @param {Object} game - The BlinkGame instance
 * @returns {Object|null} - Game state object or null if not found
 */
export function updateGameState(game) {
  const gs = game.getComponent(99, 'GameState');
  if (gs) {
    return {
      wave: gs.currentWave,
      enemiesDefeated: gs.enemiesDefeated,
      playerDeaths: gs.playerDeaths || 0,
      victory: gs.victory,
      gameOver: gs.gameOver
    };
  }
  return null;
}

/**
 * Runs the game simulation for a specified duration
 * 
 * @param {Object} params - Run parameters
 * @param {Object} params.game - The BlinkGame instance
 * @param {number} params.targetSimTime - Simulation time to run (in seconds)
 * @param {Function} params.onProgress - Callback for progress updates
 * @param {number} params.uiUpdateInterval - How often to call onProgress (steps)
 * @returns {Promise<Object>} - Result object with stepsProcessed and finalTime
 */
export async function runSimulation({ 
  game, 
  targetSimTime, 
  onProgress, 
  uiUpdateInterval = 5 
}) {
  const currentTime = game.getTime();
  const targetTime = currentTime + targetSimTime;
  
  let stepsProcessed = 0;
  
  while (game.getTime() < targetTime) {
    if (!game.hasEvents()) {
      break;
    }
    
    // Process one step
    game.step();
    stepsProcessed++;
    
    // Update UI periodically
    if (stepsProcessed % uiUpdateInterval === 0 && onProgress) {
      await onProgress(stepsProcessed);
      
      // Yield control to browser
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  
  // Final progress update
  if (onProgress) {
    await onProgress(stepsProcessed);
  }
  
  return {
    stepsProcessed,
    finalTime: game.getTime()
  };
}
