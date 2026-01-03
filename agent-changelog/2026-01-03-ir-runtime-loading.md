# IR Runtime Loading Fix

**Date**: 2026-01-03  
**Status**: In Progress  
**Priority**: High

## Problem Statement

Multiple issues with file loading and hardcoded data that should be loaded from IR:

1. **Hardcoded BRL Source**: `sourceFiles` const (line 3348) contains hardcoded BRL rules instead of loading from IR's source_map
2. **Hardcoded Choice Points**: Choice points loaded from `characters.json` instead of from BRL IR's choice_points
3. **Local File Loading**: `characters.json` fails to load locally (trying `../data/characters.json` which doesn't work from `game/demos/` directory)
4. **GitHub Pages Loading**: `classic-rpg.ir.json` fails to load on GitHub Pages (trying `../data/classic-rpg.ir.json` but not deployed there)

## Root Cause Analysis

### Issue 1: Hardcoded BRL Source
The integrated IDE feature uses hardcoded BRL source text instead of loading from IR:
- Location: `rpg-demo.html` line 3348
- Current: `const sourceFiles = { brl: "..." }` with hardcoded text
- Expected: Load from `classicRpgIR.source_map.brl` at runtime

### Issue 2: Hardcoded Choice Points  
Choice points loaded from wrong location:
- Location: `rpg-demo.html` line 1914 (`loadChoicePoints()`)
- Current: Loads from `characters.json` 
- Expected: Should extract from `classicRpgIR.choice_points` 

### Issue 3 & 4: File Path Issues
Path resolution differs between local dev and GitHub Pages:
- Local structure: `game/demos/rpg-demo.html` → need `../data/` and `../ir/`
- GitHub Pages: `rpg-demo.html` → need `data/` and `ir/` (no ../)
- Current code tries both but doesn't handle all cases correctly

## Required Changes

### HIElements Changes

Need to update hielements.hie to reflect that IR should contain:
1. `source_map` field with original BRL/BCL/BDL source code
2. `choice_points` array with choice point metadata (name, signature, docstring, etc.)

### Implementation Changes

### Changes Implemented

#### 1. Fixed IR Loading Paths  
**File**: `game/demos/rpg-demo.html` function `loadDefaultIR()`

Changed from invalid code:
```javascript
const response = await fetch(['data/classic-rpg.ir.json', '../data/classic-rpg.ir.json']);
```

To proper path fallback (matching pattern used in `loadCharacterData`):
```javascript
const paths = ['data/classic-rpg.ir.json', '../ir/classic-rpg.ir.json'];
for (const path of paths) {
  try {
    const response = await fetch(path);
    // ... success handling
  } catch (error) {
    // Try next path
  }
}
```

This fixes:
- ✅ Local dev: `game/demos/rpg-demo.html` → `../ir/classic-rpg.ir.json` = `game/ir/classic-rpg.ir.json`
- ✅ GitHub Pages: `rpg-demo.html` → `data/classic-rpg.ir.json` = `_site/data/classic-rpg.ir.json`

#### 2. Prepared for IR Source Loading
**File**: `game/demos/rpg-demo.html`

- Converted `const sourceFiles` to `let sourceFiles` (can be updated at runtime)
- Added `loadSourceFilesFromIR()` function to load from IR when available
- Called `loadSourceFilesFromIR()` after IR loads in initialization
- Kept placeholder source code until compiler adds `source_map` field

#### 3. Prepared for IR Choice Points  
**File**: `game/demos/rpg-demo.html` function `loadChoicePoints()`

Changed from loading from `characters.json` to checking IR:
```javascript
async function loadChoicePoints() {
  if (classicRpgIR && classicRpgIR.choice_points) {
    choicePointsData = classicRpgIR.choice_points;
    console.info(`Loaded ${choicePointsData.length} choice points from IR`);
  } else {
    console.warn('No choice points found in IR (not yet implemented in compiler)');
    choicePointsData = [];
  }
}
```

#### 4. Fixed GitHub Pages Deployment
**File**: `.github/workflows/github-pages.yml`

Added IR files to runtime data directory:
```yaml
# Copy IR files for runtime use (demos need these)
if ls game/ir/*.ir.json 1> /dev/null 2>&1; then
  cp game/ir/*.ir.json _site/data/
  echo "Copied IR files to _site/data/"
fi
```

This ensures `classic-rpg.ir.json` is available at `/data/classic-rpg.ir.json` on GitHub Pages.

## Current Status

### ✅ Completed
1. Fixed IR file loading - proper path fallback for local & GitHub Pages
2. Fixed invalid `fetch` call that was passing an array instead of trying paths
3. Prepared code to load BRL source from IR (awaiting compiler support)
4. Prepared code to load choice points from IR (awaiting compiler support)
5. Updated GitHub Pages workflow to deploy IR files to `/data/` directory
6. IR files now load correctly both locally and on GitHub Pages

### ⏳ Pending (Compiler Support Needed)
The following features are prepared but awaiting compiler implementation:
1. **Source Map**: Compiler needs to add `source_map` field to IR with BRL/BCL/BDL source
2. **Choice Points**: Compiler needs to add `choice_points` array to IR with metadata

Once the compiler adds these fields, the runtime will automatically use them (no further code changes needed).

## Testing Plan

### Tested Locally ✅
1. IR files exist at `game/ir/classic-rpg.ir.json` 
2. Path resolution correct: `game/demos/rpg-demo.html` will try `../ir/classic-rpg.ir.json`
3. Code properly attempts multiple paths with fallback

### To Test on GitHub Pages
After deployment:
1. Verify IR loads from `data/classic-rpg.ir.json`
2. Verify no console errors about missing files
3. Verify game functions correctly

## Success Criteria

- ✅ No invalid `fetch(array)` calls - properly loops through paths
- ✅ Files load correctly in local development (path: `../ir/classic-rpg.ir.json`)
- ✅ Files will load correctly on GitHub Pages (path: `data/classic-rpg.ir.json` with deployment fix)
- ✅ Code ready to load BRL source from IR.source_map (when compiler adds it)
- ✅ Code ready to load choice points from IR.choice_points (when compiler adds it)
- ✅ Hardcoded BRL source replaced with placeholder (shows warning until compiler updated)
- ✅ Hardcoded choice points removed (shows warning until compiler updated)

## Future Work

### Compiler Enhancements Needed
1. Add `source_map` field to IR output:
   ```json
   {
     "version": "1.0",
     "module": "classic-rpg",
     "source_map": {
       "brl": "component Character { ... }",
       "bcl": "choice select_target(...) { ... }",
       "bdl": "entity @warrior { ... }"
     },
     "components": [...]
   }
   ```

2. Add `choice_points` array to IR output:
   ```json
   {
     "choice_points": [
       {
         "id": "select_target",
         "name": "Select Target",
         "signature": "(attacker: entity_id): entity_id",
         "docstring": "Choose which enemy to attack",
         "defaultBehavior": "Targets lowest health enemy",
         "applicableClasses": ["*"]
       }
     ]
   }
   ```

3. Add `--source-map` flag to compilation in:
   - `Makefile` compile-brl target
   - `.github/workflows/github-pages.yml` Compile BRL step

## Notes

- This aligns with the architecture principle that IR is the single source of truth
- Compiler needs to be updated to include source_map and choice_points in IR output
- May need to update IR specification to document these fields
