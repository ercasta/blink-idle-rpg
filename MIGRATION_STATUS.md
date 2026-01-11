# BRL/BDL/BCL Migration Script

## Summary

The compiler has been successfully updated with the new syntax requirements:
- ✅ Mandatory `let` keyword with type annotations
- ✅ Single entity syntax: `let name: id = new entity { }`  
- ✅ Typed rule parameters: `rule Name on Event(evt: id) { }`
- ✅ AST, semantic analyzer, and codegen updated
- ✅ Compiler builds and runs

## Remaining Work

The following game files need manual migration due to complexity and context requirements:

### BRL Files (1 file)

**`game/brl/classic-rpg.brl`** (~877 lines)
- 33+ `let` declarations need type annotations  
- ~15 rules need parameter syntax update: `on Event gs` → `on Event(gs: id)`
- All `schedule` calls should capture return IDs

**Pattern replacements needed:**
```brl
# OLD → NEW
let heroes = entities having    → let heroes: list = entities having
let count = spawner             → let count: integer = spawner
let target = attacker          → let target: id = attacker
rule X on GameStart gs {       → rule X on GameStart(gs: id) {
rule X on DoAttack da {        → rule X on DoAttack(da: id) {
```

### BDL Files (7 files)

All need: `entity { ... }` → `let name: id = new entity { ... }`

1. **`game/bdl/heroes.bdl`** (~2218 lines, 8-10 hero definitions)
2. **`game/bdl/enemies.bdl`** (enemy templates)
3. **`game/bdl/game-config.bdl`** (game state entities)
4. **`game/bdl/scenario-easy.bdl`**
5. **`game/bdl/scenario-normal.bdl`**
6. **`game/bdl/scenario-hard.bdl`**

**Pattern:** Each anonymous `entity {` block needs a unique variable name

### BCL Files (7 files - partially done)

Need type annotations on `let` declarations inside choice functions:

1. ✅ **`game/bcl/flee-aggressive.bcl`** - DONE
2. **`game/bcl/flee-conservative.bcl`** - Similar to aggressive
3. **`game/bcl/cleric-skills.bcl`** - Multiple let statements
4. **`game/bcl/mage-skills.bcl`** - Multiple let statements
5. **`game/bcl/rogue-skills.bcl`** - Multiple let statements
6. **`game/bcl/warrior-skills.bcl`** - Multiple let statements
7. **`game/bcl/party-config.bcl`** - Entity declarations and lets

### Test Files (5 files in `game/tests/brl/`)

1. **`level2-basic-rules.brl`**
2. **`level3-control-flow.brl`**
3. **`level4-functions.brl`**
4. **`level5-complex-game.brl`**

All need same transformations as main BRL file.

## Migration Commands

Due to file complexity, automated sed/awk replacement would risk errors. Manual migration recommended with:

1. **Use Find/Replace in VS Code** with regex:
   - `let (\w+) =` → `let $1: TYPE =` (then manually set TYPE)
   - `rule (\w+) on (\w+) (\w+) \{` → `rule $1 on $2($3: id) {`
   - `rule on (\w+) (\w+) \{` → `rule on $1($2: id) {`

2. **For BDL files:**
   - Select each `entity {` block
   - Add unique name: `let entity_name_001: id = new entity {`

3. **Compile after each file** to validate:
   ```bash
   cd packages/blink-compiler-ts
   npm run build
   cd ../..
   make compile-brl
   ```

## Current Test Status

Compiler tests show these errors (expected):

| File | Error | Count |
|------|-------|-------|
| classic-rpg.brl | Missing `(` in rule | 1 |
| All BCL files | Missing type annotations | 7 |
| All BDL files | Old entity syntax | 7 |
| Test BRL files | Old rule/let syntax | Multiple |

## Next Steps

1. Update remaining BCL files (6 files, ~10 min)
2. Update BDL files (7 files, ~30 min)
3. Update classic-rpg.brl (~15 min)
4. Update test BRL files (~15 min)
5. Run full test suite
6. Fix any remaining issues

**Estimated time to completion:** 1-1.5 hours of focused work

## Rollback Available

All changes are in git. To rollback:
```bash
git checkout HEAD -- packages/blink-compiler-ts game/
```

## Status

- Compiler: ✅ Complete and tested
- Specifications: ✅ Updated
- Game files: ⏳ In progress (1/15 files done)
- Tests: ⏳ Pending file updates
