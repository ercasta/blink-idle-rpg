/**
 * BCL (Blink Choice Language) Customization System
 * 
 * Allows players to customize AI strategies for their heroes.
 * 
 * CURRENT STATE:
 *   - Choice points metadata comes from IR.choice_points
 *   - Player customizations stored in localStorage as text
 *   - Can download customizations as .bcl delta file
 *   - Customizations are NOT compiled/executed (cosmetic only)
 * 
 * FUTURE STATE (with browser-based BCL compiler):
 *   1. Choice points loaded from IR.choice_points (with signatures, docstrings)
 *   2. Player edits BCL code in browser editor
 *   3. Browser-based WASM compiler compiles BCL to choice_functions
 *   4. Delta IR merged with base IR for runtime execution
 *   5. Custom strategy actually affects gameplay
 */

const BCL_STORAGE_KEY = 'blink_bcl_customizations';
const BCL_COMMENT_CONTEXT_LENGTH = 300;

/**
 * Loads all BCL customizations from localStorage
 * @returns {Object} - Object mapping heroId -> choiceId -> code
 */
export function getBclCustomizations() {
  try {
    const stored = localStorage.getItem(BCL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('Failed to load BCL customizations:', e);
    return {};
  }
}

/**
 * Saves BCL customizations to localStorage
 * @param {Object} customizations - Customizations object
 */
export function saveBclCustomizations(customizations) {
  try {
    localStorage.setItem(BCL_STORAGE_KEY, JSON.stringify(customizations));
  } catch (e) {
    console.error('Failed to save BCL customizations:', e);
  }
}

/**
 * Checks if a hero has any customizations
 * @param {string} heroId - The hero ID
 * @returns {boolean} - True if hero has customizations
 */
export function hasHeroCustomizations(heroId) {
  const customizations = getBclCustomizations();
  return customizations[heroId] && Object.keys(customizations[heroId]).length > 0;
}

/**
 * Gets the number of customizations for a hero
 * @param {string} heroId - The hero ID
 * @returns {number} - Number of customizations
 */
export function getHeroCustomizationCount(heroId) {
  const customizations = getBclCustomizations();
  return customizations[heroId] ? Object.keys(customizations[heroId]).length : 0;
}

/**
 * Saves a single choice customization
 * @param {string} heroId - The hero ID
 * @param {string} choiceId - The choice function ID
 * @param {string} code - The customized BCL code
 */
export function saveChoiceCustomization(heroId, choiceId, code) {
  const customizations = getBclCustomizations();
  if (!customizations[heroId]) {
    customizations[heroId] = {};
  }
  customizations[heroId][choiceId] = code;
  saveBclCustomizations(customizations);
}

/**
 * Removes a choice customization (resets to default)
 * @param {string} heroId - The hero ID
 * @param {string} choiceId - The choice function ID
 */
export function resetChoiceCustomization(heroId, choiceId) {
  const customizations = getBclCustomizations();
  if (customizations[heroId]) {
    delete customizations[heroId][choiceId];
    
    // Clean up empty hero entry
    if (Object.keys(customizations[heroId]).length === 0) {
      delete customizations[heroId];
    }
    
    saveBclCustomizations(customizations);
  }
}

/**
 * Gets the customized code for a choice, or null if using default
 * @param {string} heroId - The hero ID
 * @param {string} choiceId - The choice function ID
 * @returns {string|null} - The customized code or null
 */
export function getChoiceCustomization(heroId, choiceId) {
  const customizations = getBclCustomizations();
  return customizations[heroId]?.[choiceId] || null;
}

/**
 * Extracts choice functions from loaded BCL files
 * @param {Array} bclFiles - Array of {name, content} objects
 * @returns {Array} - Array of choice point objects
 */
export function extractChoiceFunctionsFromBCL(bclFiles) {
  const choiceFunctions = [];
  
  // Regex to match BCL choice functions
  const choiceFnRegex = /choice\s+fn\s+(\w+)\s*\([^)]*\)\s*:\s*\w+\s*\{/g;
  const fullFnRegex = /(choice\s+fn\s+\w+\s*\([^)]*\)\s*:\s*\w+)\s*\{/;
  
  for (const bclFile of bclFiles) {
    const matches = [...bclFile.content.matchAll(choiceFnRegex)];
    
    for (const match of matches) {
      const functionName = match[1];
      const startIndex = match.index;
      
      // Extract full signature
      const sigMatch = bclFile.content.substring(startIndex).match(fullFnRegex);
      const signature = sigMatch ? sigMatch[1] : `choice fn ${functionName}(...)`;
      
      // Try to extract docstring (comment before function)
      const beforeFunction = bclFile.content.substring(
        Math.max(0, startIndex - 500), 
        startIndex
      );
      const commentMatch = beforeFunction.match(/\/\/\s*(.+?)(?:\n\/\/\s*(.+?))*\s*$/);
      const docstring = commentMatch ? 
        commentMatch[0].replace(/^\/\/\s*/gm, '').trim() : 
        `${functionName} choice function`;
      
      // Determine category from file name
      let category = 'strategy';
      if (bclFile.name.includes('skill')) category = 'combat';
      if (bclFile.name.includes('flee')) category = 'retreat';
      if (bclFile.name.includes('target')) category = 'targeting';
      
      // Determine applicable classes from file name
      let applicableClasses = null;
      if (bclFile.name.includes('warrior')) applicableClasses = ['Warrior'];
      if (bclFile.name.includes('mage')) applicableClasses = ['Mage'];
      if (bclFile.name.includes('rogue')) applicableClasses = ['Rogue'];
      if (bclFile.name.includes('cleric')) applicableClasses = ['Cleric'];
      
      choiceFunctions.push({
        id: functionName,
        name: functionName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        signature: signature,
        docstring: docstring,
        category: category,
        applicableClasses: applicableClasses,
        sourceFile: bclFile.name,
        defaultBehavior: docstring
      });
    }
  }
  
  console.info(`Extracted ${choiceFunctions.length} choice functions from BCL files`);
  return choiceFunctions;
}

/**
 * Gets the default BCL implementation for a choice function
 * Searches through loaded BCL files or bound functions in IR
 * @param {string} choiceId - The choice function ID
 * @param {Array} bclFiles - Array of loaded BCL files
 * @param {Object} ir - The IR object (for bound functions)
 * @returns {string|null} - The default implementation or null
 */
export function getDefaultBclImplementation(choiceId, bclFiles, ir) {
  // First, try to get bound function from IR entities
  if (ir && ir.initial_state && ir.initial_state.entities) {
    for (const entity of ir.initial_state.entities) {
      if (entity.bound_functions && entity.bound_functions[choiceId]) {
        const boundFunc = entity.bound_functions[choiceId];
        if (boundFunc.source) {
          return `// From entity: ${entity.name}\n// Bound function from IR\n\n${boundFunc.source}`;
        }
      }
    }
  }
  
  // Fallback: Search through loaded BCL files
  for (const bclFile of bclFiles) {
    const regex = new RegExp(`choice\\s+fn\\s+${choiceId}\\s*\\([^)]*\\)\\s*:\\s*\\w+\\s*\\{`);
    const match = bclFile.content.match(regex);
    
    if (match) {
      const startIndex = match.index;
      
      // Extract the full function including body
      let braceCount = 0;
      let endIndex = startIndex;
      let foundOpenBrace = false;
      
      for (let i = startIndex; i < bclFile.content.length; i++) {
        const char = bclFile.content[i];
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      // Extract function with comments before it
      const beforeFunction = bclFile.content.substring(
        Math.max(0, startIndex - BCL_COMMENT_CONTEXT_LENGTH), 
        startIndex
      );
      const commentLines = [];
      const lines = beforeFunction.split('\n');
      
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('//')) {
          commentLines.unshift(lines[i]);
        } else if (line === '') {
          continue;
        } else {
          break;
        }
      }
      
      const comments = commentLines.join('\n');
      const functionCode = bclFile.content.substring(startIndex, endIndex);
      
      return comments ? `${comments}\n${functionCode}` : functionCode;
    }
  }
  
  return null;
}

/**
 * Generates BCL delta content for download
 * @param {string} heroId - The hero ID
 * @param {Object} customizations - The customizations object for this hero
 * @param {Array} choicePointsData - Array of choice point metadata
 * @returns {string} - BCL file content
 */
export function generateBclDelta(heroId, customizations, choicePointsData) {
  let bclContent = `// BCL Delta for ${heroId}\n`;
  bclContent += `// Generated: ${new Date().toISOString()}\n`;
  bclContent += `// Contains ${Object.keys(customizations).length} customized choice(s)\n\n`;
  bclContent += `module ${heroId}_customizations\n\n`;
  
  for (const [choiceId, code] of Object.entries(customizations)) {
    const choicePoint = choicePointsData.find(cp => cp.id === choiceId);
    bclContent += `// === ${choicePoint?.name || choiceId} ===\n`;
    bclContent += code + '\n\n';
  }
  
  return bclContent;
}

/**
 * Downloads a BCL delta file
 * @param {string} heroId - The hero ID
 * @param {Object} customizations - The customizations for this hero
 * @param {Array} choicePointsData - Array of choice point metadata
 */
export function downloadBclDelta(heroId, customizations, choicePointsData) {
  if (!customizations || Object.keys(customizations).length === 0) {
    return false;
  }
  
  const bclContent = generateBclDelta(heroId, customizations, choicePointsData);
  
  const blob = new Blob([bclContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${heroId}-strategy.bcl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  return true;
}
