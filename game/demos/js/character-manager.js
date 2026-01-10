/**
 * Character and Party Management
 * 
 * This module handles character data extraction from IR and party selection logic.
 * 
 * KEY CONCEPTS:
 * - Characters are extracted from IR.initial_state.entities
 * - Heroes have HeroInfo component and Team.isPlayer = true
 * - Party selection allows choosing 4 heroes with carousel navigation
 */

/**
 * Extracts character data from the compiled IR (Intermediate Representation)
 * 
 * SOURCE: game/bdl/heroes.bdl → compiled into IR.initial_state
 * Heroes are entities with HeroInfo component and Team.isPlayer = true
 * 
 * @param {Object} ir - The IR object containing initial_state.entities
 * @returns {Array} - Array of character objects formatted for the UI
 */
export function extractCharactersFromIR(ir) {
  if (!ir || !ir.initial_state || !ir.initial_state.entities) {
    console.error('No initial_state.entities in IR');
    return [];
  }
  
  // Filter entities that are heroes (have HeroInfo component and Team.isPlayer = true)
  const heroes = ir.initial_state.entities.filter(entity => {
    return entity.components.HeroInfo && 
           entity.components.Team && 
           entity.components.Team.isPlayer === true;
  });
  
  // Convert IR entities to the format expected by the UI
  const characters = heroes.map(entity => {
    return {
      id: entity.id,
      name: entity.components.Character?.name || 'Unknown Hero',
      class: entity.components.Character?.class || 'Adventurer',
      level: entity.components.Character?.level || 1,
      // Base stats for display in hero selection
      baseHealth: entity.components.Health?.max || 100,
      baseMana: entity.components.Mana?.max || 0,
      baseDamage: entity.components.Combat?.damage || 10,
      baseDefense: entity.components.Combat?.defense || 5,
      // Hero info for UI
      description: entity.components.HeroInfo?.description || '',
      role: entity.components.HeroInfo?.role || 'Unknown',
      difficulty: entity.components.HeroInfo?.difficulty || 'Normal',
      // Full component data for game engine
      health: {
        current: entity.components.Health?.current || 100,
        max: entity.components.Health?.max || 100
      },
      mana: {
        current: entity.components.Mana?.current || 0,
        max: entity.components.Mana?.max || 0
      },
      stats: entity.components.Stats || {
        strength: 10,
        dexterity: 10,
        intelligence: 10,
        constitution: 10,
        wisdom: 10
      },
      combat: entity.components.Combat || {
        damage: 10,
        defense: 5,
        attackSpeed: 1.0,
        critChance: 0.1,
        critMultiplier: 1.5
      }
    };
  });
  
  console.info(`Extracted ${characters.length} heroes from IR.initial_state`);
  return characters;
}

/**
 * Extracts enemy templates from the compiled IR
 * 
 * SOURCE: game/bdl/enemies.bdl → compiled into IR.initial_state
 * 
 * @param {Object} ir - The IR object
 * @returns {Array} - Array of enemy template objects
 */
export function extractEnemyTemplates(ir) {
  if (!ir || !ir.initial_state || !ir.initial_state.entities) {
    console.error('No initial_state.entities in IR');
    return [];
  }
  
  const enemies = ir.initial_state.entities.filter(entity => {
    return entity.components.Enemy && 
           entity.components.Team && 
           entity.components.Team.isPlayer === false;
  });
  
  const enemyTemplates = enemies.map(entity => {
    return {
      id: entity.id,
      variable: entity.variable,
      name: entity.components.Character?.name || 'Unknown Enemy',
      class: entity.components.Character?.class || 'Monster',
      level: entity.components.Character?.level || 1,
      health: {
        current: entity.components.Health?.current || 50,
        max: entity.components.Health?.max || 50
      },
      mana: {
        current: entity.components.Mana?.current || 0,
        max: entity.components.Mana?.max || 0
      },
      stats: entity.components.Stats || {
        strength: 8,
        dexterity: 8,
        intelligence: 8,
        constitution: 8,
        wisdom: 8
      },
      combat: entity.components.Combat || {
        damage: 8,
        defense: 3,
        attackSpeed: 1.0,
        critChance: 0.05,
        critMultiplier: 1.5
      },
      enemy: entity.components.Enemy || {
        tier: 1,
        isBoss: false,
        expReward: 10
      }
    };
  });
  
  console.info(`Extracted ${enemyTemplates.length} enemy templates from IR.initial_state`);
  return enemyTemplates;
}

/**
 * Checks if a hero is already selected in the party
 * @param {Array} partySlots - Array of selected heroes (or null for empty slots)
 * @param {number} excludeSlot - Slot index to exclude from the check
 * @param {string} heroId - The hero ID to check
 * @returns {boolean} - True if the hero is already selected
 */
export function isHeroAlreadySelected(partySlots, excludeSlot, heroId) {
  return partySlots.some((selectedHero, idx) => 
    idx !== excludeSlot && selectedHero && selectedHero.id === heroId
  );
}
