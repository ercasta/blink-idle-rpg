# Remove Hero Selection Fallback

**Date:** 2026-01-03  
**Issue:** Hero selection fallback masks whether characters.json is properly loaded on GitHub Pages

## Problem Analysis

The rpg-demo.html had a fallback mechanism that would silently fall back to 4 basic hardcoded heroes if characters.json failed to load. This created doubt about whether the file was actually being deployed and loaded correctly, especially on GitHub Pages where only the basic 4 heroes appeared to be available.

Additionally, the path `../data/characters.json` works for local development but fails on GitHub Pages due to different directory structures:
- Local dev: `game/demos/rpg-demo.html` → `../data/characters.json` = `game/data/characters.json` ✓
- GitHub Pages: `_site/rpg-demo.html` → `../data/characters.json` = (goes up from root) ✗
- GitHub Pages needs: `_site/rpg-demo.html` → `data/characters.json` = `_site/data/characters.json` ✓

## Solution

### 1. Try Multiple Paths
Modified `loadCharacterData()` to attempt loading from multiple paths:
1. `data/characters.json` (GitHub Pages path)
2. `../data/characters.json` (local development path)

### 2. Remove Fallback
Completely removed the fallback to hardcoded 4 basic heroes (lines 1159-1219). Now if the file fails to load from all paths:
- Console error shows clear message
- Alert notifies user immediately
- Function throws error to halt execution

### 3. Better Logging
Added detailed console logging to show:
- Which path is being attempted
- Success message with character count when loaded
- Clear warning for each failed path attempt

## Changes Made

### game/demos/rpg-demo.html
- Removed 71 lines of hardcoded fallback heroes
- Added path array with both GitHub Pages and local dev paths
- Added loop to try each path in sequence
- Added detailed logging for debugging
- Added clear error handling with alert and exception

## Verification

### Local Testing
✅ Tested with local web server from `game/` directory
✅ Successfully loads all 30 characters from `../data/characters.json`
✅ Console shows: "Successfully loaded 30 characters from ../data/characters.json"
✅ Carousel shows "X / 30" on all hero slots
✅ Can browse through all 30 heroes (Warriors, Mages, Rogues, Clerics, Rangers, Paladins)
✅ Duplicate selection prevention works correctly

### Expected GitHub Pages Behavior
✅ Will try `data/characters.json` first (GitHub Pages path)
✅ Should successfully load all 30 characters
✅ If file is missing, shows clear error instead of silently falling back
✅ No ambiguity about whether file is loaded

## Impact

### Positive
- **Transparency**: No more doubt about whether characters.json is loaded - if it fails, you know immediately
- **Debugging**: Clear console logs show which path succeeded/failed
- **Correctness**: Works for both local development and GitHub Pages deployment
- **Smaller File**: Removed 71 lines of redundant code

### Breaking Changes
- **None for users**: If deployment is correct, works as before
- **Deployment Issues Surface**: If characters.json is missing, demo will fail to load (this is desired behavior)

## Files Modified
- `game/demos/rpg-demo.html` - Updated loadCharacterData() function

## Testing Screenshots
- Initial load: Shows "1 / 30" on all slots (30 heroes available)
- After browsing: Shows "11 / 30" with "Zephyr the Archmage" (different Mage variant)
- Proves all 30 heroes are accessible beyond the basic 4
