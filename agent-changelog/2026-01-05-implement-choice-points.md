# Implement Choice Points in Compiler and Fix Tracker Validation

**Date**: 2026-01-05  
**Type**: Feature Implementation + Bug Fix

## Summary

Implemented the `choice_points` metadata generation in the compiler and fixed tracker validation errors in the HTML game. This resolves two critical issues preventing the HTML game from loading and displaying the hero strategy customization UI.

## Problem Statement

Two errors were blocking the HTML game:
1. **No choice points found in IR**: The compiler was not generating choice point metadata, preventing the strategy customization UI from displaying available decision points
2. **IR missing trackers array**: The bundled engine was requiring a `trackers` array even though trackers were deprecated

## Changes Made

### 1. Compiler: IR Structure Enhancement

**File**: `src/compiler/src/ir/mod.rs`

Added `IRChoicePoint` struct to represent choice point metadata:
```rust
pub struct IRChoicePoint {
    pub id: String,                          // Function name (e.g., "select_attack_target")
    pub name: String,                        // Human-readable name
    pub signature: String,                   // Function signature for display
    pub params: Vec<IRParam>,                // Function parameters
    pub return_type: IRType,                 // Return type
    pub docstring: Option<String>,           // Documentation
    pub category: Option<String>,            // Category (targeting, skills, strategy)
    pub applicable_classes: Option<Vec<String>>, // Applicable character classes
    pub default_behavior: Option<String>,    // Default behavior description
}
```

Added `choice_points` field to `IRModule`:
```rust
pub struct IRModule {
    // ... existing fields ...
    pub choice_points: Vec<IRChoicePoint>,
    // ...
}
```

### 2. Compiler: Choice Point Extraction

**File**: `src/compiler/src/ir/mod.rs`

Implemented `extract_choice_points()` method that:
- Collects all unique bound function signatures from entities
- Auto-generates human-readable names (e.g., "select_attack_target" → "Select Attack Target")
- Auto-categorizes based on function name patterns:
  - Contains "target" → "targeting" category
  - Contains "skill" → "skills" category
  - Contains "flee" or "retreat" → "strategy" category
- Extracts applicable classes from Character component data
- Generates proper type signatures for display

### 3. Bundled Engine: Fix Tracker Validation

**File**: `game/demos/blink-engine.bundle.js`

Changed tracker validation from required to optional:
```javascript
// Before (required):
if (!Array.isArray(ir.trackers)) {
  throw new Error('IR missing trackers array');
}

// After (optional):
if (ir.trackers !== undefined && !Array.isArray(ir.trackers)) {
  throw new Error('IR trackers field must be an array when present');
}
```

### 4. IR Generation Updates

**Files**: `game/ir/classic-rpg.ir.json`, `game/demos/data/classic-rpg.ir.json`

Generated IR now contains 3 choice points:

```json
{
  "choice_points": [
    {
      "id": "select_attack_target",
      "name": "Select Attack Target",
      "signature": "choice fn select_attack_target(character: id, enemies: list<id>): id",
      "category": "targeting",
      "applicable_classes": ["Warrior"]
    },
    {
      "id": "select_combat_skill",
      "name": "Select Combat Skill",
      "signature": "choice fn select_combat_skill(character: id, allies: list<id>, enemies: list<id>): string",
      "category": "skills",
      "applicable_classes": ["Warrior"]
    },
    {
      "id": "select_skill_on_levelup",
      "name": "Select Skill On Levelup",
      "signature": "choice fn select_skill_on_levelup(character: id, currentLevel: id): string",
      "category": "skills",
      "applicable_classes": ["Warrior"]
    }
  ]
}
```

### 5. Documentation Update

**File**: `hielements.hie`

Updated status of choice_points from PLANNED to IMPLEMENTED:
```
- choice_points[]: Metadata about customizable choices (IMPLEMENTED)
```

## Technical Details

### Choice Point Metadata Extraction Algorithm

1. **Collection**: Iterate through all entities in `initial_state`
2. **Deduplication**: Use HashMap to collect unique choice functions by name
3. **Signature Generation**: Format parameters and return type into readable signature
4. **Categorization**: Apply heuristics based on function name
5. **Class Detection**: Extract from Character component if available
6. **Sorting**: Sort by ID for consistent output

### Type Signature Generation

The compiler generates human-readable type signatures:
- `id` → entity references
- `list<id>` → lists of entities
- `string`, `number`, `boolean` → primitive types
- `map<K, V>` → map types

### Helper Methods Added

- `extract_choice_points()`: Main extraction logic
- `humanize_name()`: Convert snake_case to Title Case
- `type_to_string()`: Convert IRType to string representation

## Testing

### Compiler Tests
✅ All 32 language tests pass
```
test result: ok. 32 passed; 0 failed; 0 ignored
```

### Manual Testing
✅ HTML game loads without errors
✅ Console shows: "Loaded 3 choice points from IR"
✅ Customization modal displays all choice points
✅ Categories properly assigned (targeting, skills)
✅ No tracker validation errors

### Visual Verification

Screenshots confirm:
1. Hero selection screen displays "Customize Strategy" buttons
2. Modal shows all 3 choice points with proper categories
3. Editor ready for BCL customization

## Impact

### User-Facing
- ✅ Strategy customization UI now functional
- ✅ Players can see available decision points for each hero
- ✅ Clear categorization helps users understand choices

### Developer-Facing
- ✅ Compiler automatically generates choice point metadata
- ✅ No manual maintenance required
- ✅ Extensible for future choice points

### Architecture
- ✅ IR specification fully implemented for choice points
- ✅ Deprecated tracker requirement removed
- ✅ TypeScript source already had correct validation (bundle was outdated)

## Future Enhancements

Potential improvements for choice points:
1. Extract docstrings from BDL/BCL comments
2. Extract default behavior from first entity's implementation
3. Support multi-class choice points (currently extracts only first entity's class)
4. Add validation for choice point consistency across entities

## Related Files

- `src/compiler/src/ir/mod.rs` - IR structure and generation
- `game/demos/blink-engine.bundle.js` - Bundled engine
- `game/ir/classic-rpg.ir.json` - Generated IR
- `game/demos/data/classic-rpg.ir.json` - IR for HTML demo
- `hielements.hie` - Architecture specification

## Verification Commands

```bash
# Build compiler
make build-compiler

# Run compiler tests
make test-compiler

# Compile BRL to IR
make compile-brl

# Verify choice points in IR
jq '.choice_points' game/ir/classic-rpg.ir.json

# Serve HTML demo
cd game/demos && python3 -m http.server 8000
# Visit: http://localhost:8000/rpg-demo.html
```

## Notes

- The TypeScript source in `packages/blink-engine/src/ir/loader.ts` already had the correct optional tracker validation
- The bundle was manually maintained and needed direct update
- Two warnings in compilation ("Non-literal expression in entity field") are expected for computed values in BDL
- Choice points are automatically extracted from any bound functions in entities
- The system is now ready for players to customize hero strategies through the UI
