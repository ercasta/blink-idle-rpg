# Hero Selection Carousel Feature

## Requirements
- Replace checkbox-based hero selection with slot-by-slot carousel system
- Each of the 4 slots should have carousel navigation to browse available heroes
- Cannot select the same hero for multiple slots
- Expand character pool to at least 5 heroes per class

## Changes to hielements.hie
No structural changes needed - this is a UI enhancement within existing game content

## Implementation Plan

### 1. Expand Character Pool (characters.json)
- Add 4 more Warriors (total 5)
- Add 4 more Mages (total 5)  
- Add 4 more Rogues (total 5)
- Add 4 more Clerics (total 5)
- Add 4 more Rangers (total 5)
- Add 4 more Paladins (total 5)
- Each character needs: id, name, class, description, stats, baseHealth, baseMana, baseDamage, baseDefense, attackSpeed, skills, bcl, difficulty, role, playstyle

### 2. Update rpg-demo.html UI
- Change from grid of checkboxes to 4 hero slots with carousels
- Each slot shows one hero at a time with prev/next navigation buttons
- Disable selection of heroes already chosen in other slots
- Visual indicator of which slot is being configured
- Maintain party counter and start button functionality

### 3. Update JavaScript Logic
- Change from array-based selection to slot-based (4 slots, each with 1 hero)
- Add carousel navigation functions (nextHero, prevHero per slot)
- Add duplicate checking logic across all slots
- Update renderCharacterSelection to render carousels instead of grid

## Files to Modify
- /game/data/characters.json - Add new heroes
- /game/demos/rpg-demo.html - Update UI and JavaScript
