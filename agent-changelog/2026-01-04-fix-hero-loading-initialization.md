# Fix Hero Loading Initialization Issue

## Problem Statement
Hero loading was failing on the party selection screen in `rpg-demo.html`. The issue manifested as:
- Only 1 hero selected out of 4 slots
- "Start Adventure" button remained disabled
- Slots 2-4 showed "Already Selected" for the same hero

## Root Cause
The `currentHeroIndex` array was initialized with all zeros: `[0, 0, 0, 0]`, causing all 4 slots to attempt displaying the same hero (index 0). The duplicate detection logic then:
1. Slot 1 successfully selected hero at index 0
2. Slots 2-4 detected the hero was already selected and cleared their selections
3. Result: Only 1/4 heroes selected, button stays disabled

## Technical Details

### Before Fix
```javascript
let currentHeroIndex = [0, 0, 0, 0]; // All slots start with same hero
```

When `renderHeroInSlot()` was called for each slot:
- Each slot tried to render the hero at index 0 (Sir Braveheart)
- The `isAlreadySelected` check prevented duplicate selections
- Only the first slot kept its selection, others were cleared
- Party counter showed "Selected: 1 / 4"
- Start button remained disabled (requires 4/4 heroes)

### After Fix
```javascript
let currentHeroIndex = [0, 1, 2, 3]; // Each slot starts with different hero
```

Now each slot initializes with a unique hero:
- Slot 1: Hero index 0 (Sir Braveheart)
- Slot 2: Hero index 1 (Gorak the Unbreakable)
- Slot 3: Hero index 2 (Valkyrie Stormblade)
- Slot 4: Hero index 3 (Titan Ironheart)
- Party counter shows "Selected: 4 / 4"
- Start button is enabled immediately

## Changes Made

### 1. Fixed Hero Index Initialization (`game/demos/rpg-demo.html`)
**File**: Line 1685
```javascript
// Before:
let currentHeroIndex = [0, 0, 0, 0];

// After:
let currentHeroIndex = [0, 1, 2, 3]; // Start with different heroes
```

### 2. Added Error Handling for Empty Hero Data
**File**: `game/demos/rpg-demo.html`, Lines 1756-1779

Added guard clause in `renderCharacterSelection()` to handle case where no heroes are loaded:
- Displays clear error message explaining possible causes
- Prevents silent failure when `availableCharacters` is empty
- Provides actionable troubleshooting steps

### 3. Improved Error Messages in `renderHeroInSlot()`
**File**: `game/demos/rpg-demo.html`, Lines 1838-1857

Enhanced error handling to:
- Separate checks for DOM elements vs hero data
- Log detailed error messages to console
- Display inline error message when hero data is missing

## Verification

### Heroes Loading Successfully
The IR file at `game/demos/data/classic-rpg.ir.json` contains:
- ✅ 30 hero definitions from `heroes.bdl`
- ✅ All hero components (Character, Health, Mana, Combat, HeroInfo, etc.)
- ✅ Bound choice functions for BCL strategy

Console output confirms:
```
Successfully loaded IR from data/classic-rpg.ir.json
Extracted 30 heroes from IR.initial_state
```

### Party Selection Working
After fix:
- ✅ All 4 slots display unique heroes on page load
- ✅ Party counter shows "Selected: 4 / 4"
- ✅ "Start Adventure" button is enabled
- ✅ Users can navigate through all 30 heroes using arrows
- ✅ Duplicate selection prevention still works correctly

## Screenshots

### Before Fix
![Before Fix](https://github.com/user-attachments/assets/f9772321-ae9f-4975-b2a6-477a2bdb482d)
- Only 1 hero selected
- Slots 2-4 show "Already Selected" overlay
- Button disabled

### After Fix
![After Fix](https://github.com/user-attachments/assets/7bfec8b7-00df-4add-8d5b-c6c237f91c9f)
- All 4 heroes selected with unique characters
- Party counter shows 4 / 4
- Start button enabled and ready

## Related Files
- `game/bdl/heroes.bdl` - Hero definitions (source)
- `game/demos/data/classic-rpg.ir.json` - Compiled IR with hero data (266KB)
- `game/demos/rpg-demo.html` - Party selection UI

## Testing
Tested by:
1. Opening `http://localhost:8080/rpg-demo.html` in browser
2. Verifying 4 unique heroes displayed on page load
3. Confirming "Start Adventure" button is enabled
4. Testing hero navigation with arrow buttons
5. Verifying duplicate prevention still works

## Impact
- **User Experience**: Party selection now works immediately on page load
- **Gameplay**: Users can start the game without manual hero selection
- **Error Handling**: Better error messages for debugging future issues
- **No Breaking Changes**: Existing functionality preserved
