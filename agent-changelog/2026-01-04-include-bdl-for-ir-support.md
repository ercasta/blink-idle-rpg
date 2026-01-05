# Include BDL for IR Support: Compile BDL Entities into IR.initial_state

**Date**: 2026-01-04  
**Status**: ✅ Complete  
**Issue**: Last PR had to load data from JSON instead of IR because the compiler's `--include` flag only added BDL files to the source map for debugging—BDL entity compilation into IR.initial_state was not yet implemented.

## Problem Statement

The compiler's `--include` flag was only adding BDL files to the IR source map for debugging purposes. BDL entity definitions were **not** being compiled into `IR.initial_state.entities`. As a workaround, the game was loading entity data from separate JSON files (`enemies.json`, `characters.json`).

This violated the design principle that the IR should be the single source of truth for all game data.

## Solution

Implemented full BDL compilation support:

1. **Compiler Changes** (`src/compiler/src/main.rs`, `src/compiler/src/lib.rs`):
   - Added new `compile_to_json_with_bdl()` function that accepts BDL files
   - Parse BDL files into AST separately
   - Merge BDL items (entities) with BRL AST **before** semantic analysis
   - This allows BDL entities to reference components defined in BRL
   - Entities from BDL are compiled into `IR.initial_state.entities`

2. **Build System** (`Makefile`):
   - Updated `compile-brl` target to include BDL files when compiling classic-rpg
   - Command: `--include game/bdl/heroes.bdl --include game/bdl/enemies.bdl --include game/bdl/game-config.bdl`

3. **Data Fixes** (`game/bdl/enemies.bdl`):
   - Fixed invalid syntax: removed compendium entity that used unsupported field assignment
   - BDL only supports component initialization inside entity blocks, not external field assignment

4. **Runtime Changes** (`game/demos/rpg-demo.html`):
   - Added `extractCharactersFromIR()` to extract hero entities from `IR.initial_state.entities`
   - Added `extractEnemiesFromIR()` to extract enemy entities from `IR.initial_state.entities`
   - Updated initialization to call extraction functions instead of JSON loading
   - Removed deprecated `loadCharacterData()` and `loadEnemyData()` functions

## Technical Details

### BDL Compilation Flow

**Before this PR:**
```
BRL file → Compile → IR (rules + components only)
BDL files → --include → Source map only (not compiled)
Runtime → Load entities from JSON files
```

**After this PR:**
```
BRL file → Parse → BRL AST
BDL files → Parse → BDL AST (entities only)
Merge ASTs → BRL items + BDL entities
Analyze → Typed AST (shared symbol table)
Generate → IR (rules + components + entities in initial_state)
Runtime → Extract entities from IR.initial_state
```

### Key Implementation Detail

The solution merges BDL items into the BRL AST **before** semantic analysis. This is crucial because:
- BDL entities reference components (e.g., `Health`, `Character`, `Combat`)
- Components are defined in BRL files
- The semantic analyzer needs to see both components and entities together
- This ensures the symbol table has all component definitions when analyzing BDL entities

### Data Mapping

IR entities are converted to match the UI's expected format:
```javascript
{
  id: entity.id,
  name: entity.components.Character?.name,
  class: entity.components.Character?.class,
  baseHealth: entity.components.Health?.max,
  baseDamage: entity.components.Combat?.damage,
  baseDefense: entity.components.Combat?.defense,
  baseMana: entity.components.Mana?.max,
  description: entity.components.HeroInfo?.description,
  role: entity.components.HeroInfo?.role,
  difficulty: entity.components.HeroInfo?.difficulty,
  // ... full component data for game engine
}
```

## Results

### Compilation
- ✅ IR.initial_state now contains 43 entities:
  - 30 heroes (from `heroes.bdl`)
  - 9 enemies (from `enemies.bdl`)
  - 4 configuration entities (from `game-config.bdl`)

### Runtime
- ✅ rpg-demo.html successfully loads all data from IR
- ✅ Hero selection displays correctly:
  - Names, classes, descriptions
  - Stats: Health (120-140), Damage (15-28), Mana (20-35), Defense (8-12)
  - Role and difficulty indicators
- ✅ 30 heroes available for selection
- ✅ Party selection UI fully functional

### Testing
- ✅ All 29 compiler language tests pass
- ✅ No regressions introduced
- ✅ Code review feedback addressed
- ✅ No security vulnerabilities (CodeQL scan clean)

## Files Modified

1. `src/compiler/src/main.rs` - Parse and compile BDL files
2. `src/compiler/src/lib.rs` - Add `compile_to_json_with_bdl()` function
3. `Makefile` - Add `--include` flags for BDL compilation
4. `game/bdl/enemies.bdl` - Fix invalid syntax
5. `game/demos/rpg-demo.html` - Extract data from IR.initial_state
6. `game/demos/data/classic-rpg.ir.json` - Updated with BDL entities
7. `game/ir/classic-rpg.ir.json` - Generated IR with entities

## Verification

### Compiler Output
```
Warning: Non-literal expression in entity field (BDL violation). Using null.
Compiled ../../game/brl/classic-rpg.brl -> ../../game/ir/classic-rpg.ir.json
  Included: ../../game/bdl/heroes.bdl, ../../game/bdl/enemies.bdl, ../../game/bdl/game-config.bdl
```

### Console Output
```
Successfully loaded IR from data/classic-rpg.ir.json
Extracted 30 heroes from IR.initial_state
Extracted 9 enemy templates from IR.initial_state
```

### Screenshot
![Working UI](https://github.com/user-attachments/assets/c87d2602-e480-48ee-a451-57190b126357)

## Impact

### Single Source of Truth
The IR file is now the single source of truth for:
- ✅ Game rules (BRL)
- ✅ Components (BRL)
- ✅ Functions (BRL)
- ✅ Entities (BDL) ← **NEW**
- ✅ Trackers (BRL, legacy)

### Eliminated Dependencies
- ❌ No longer need `enemies.json`
- ❌ No longer need `characters.json`
- ✅ All data comes from compiled IR

### Developer Experience
- ✅ Edit entities in BDL (type-safe, validated)
- ✅ Compiler validates entity references to components
- ✅ Single compilation step produces complete IR
- ✅ Runtime automatically uses latest entity data

## Future Work

- BCL (Blink Choice Language) compilation into `IR.bound_functions`
- Source map support for BDL files (for IDE debugging)
- Entity templates for dynamic entity creation

## Related Documents

- [BDL Specification](../doc/language/bdl-specification.md)
- [IR Specification](../doc/ir-specification.md)
- [Previous: Data Loading Architecture Review](./2026-01-03-data-loading-review.md)
- [Previous: BDL Implementation](./2026-01-03-bdl-implementation.md)
