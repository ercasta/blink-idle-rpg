# Fix Hero Selection in GitHub Pages Deployment

**Date:** 2026-01-02  
**Issue:** Despite having 30+ heroes defined in characters.json, only the original 4 were selectable in the deployed demo.  
**Secondary Issue:** Potential game hanging reported (investigated but not confirmed).

## Problem Analysis

### Hero Selection Issue
The GitHub Pages deployment workflow was copying demo HTML/JS files but not the `game/data/characters.json` file. This caused the following sequence:
1. rpg-demo.html attempts to fetch `../data/characters.json`
2. Fetch fails with 404 error
3. Code falls back to hardcoded array of 4 basic heroes (Warrior, Mage, Rogue, Cleric)
4. Users could only select from these 4 heroes instead of all 30

### Game Hanging Investigation
Investigated potential event listener memory leaks and UI performance issues:
- **Event Cleanup**: Verified `BlinkGame.destroy()` properly clears all callbacks
- **UI Throttling**: Confirmed UI updates are batched (every 50 events) to prevent performance degradation
- **No Issues Found**: Code is already properly implemented for stability

## Solution

### Changes to `.github/workflows/github-pages.yml`
Added data file deployment step in the "Prepare deployment directory" section:

```yaml
# Copy data files for runtime use
echo "Copying data files..."
mkdir -p _site/data
if [ -f game/data/characters.json ]; then
  cp game/data/characters.json _site/data/
fi
```

This ensures `characters.json` is available at `/data/characters.json` when the demo is served from GitHub Pages.

## Files Modified
- `.github/workflows/github-pages.yml` - Added data directory copy step

## Verification
- ✅ Tested locally: All 30 heroes load when characters.json is properly served
- ✅ Carousel indicators show "X / 30" instead of "X / 4"
- ✅ All hero variants are browsable and selectable
- ✅ Duplicate selection prevention works correctly
- ✅ Code review passed with no issues
- ✅ Security scan passed with no alerts

## Impact
- Users can now select from all 30 heroes in the GitHub Pages demo
- Enables full exploration of character variety (5 variants each of Warrior, Mage, Rogue, Cleric, Ranger, Paladin)
- Improves demo experience and showcases game content properly

## Notes
- No code changes needed to rpg-demo.html - it already correctly loads from `../data/characters.json`
- No game stability fixes needed - existing event cleanup and UI throttling are properly implemented
- This is a deployment-only fix that doesn't affect local development
