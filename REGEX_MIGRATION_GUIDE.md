# Regex Migration Guide for BRL/BDL/BCL Syntax Update

Use VS Code's Find & Replace (Ctrl+H) with regex enabled for these transformations.

## Step 1: Update BRL Rule Signatures

**Files:** `game/brl/*.brl`, `game/tests/brl/*.brl`

### Pattern 1: Named rules
```regex
Find:    rule (\w+) on (\w+) (\w+) \{
Replace: rule $1 on $2($3: id) {
```

### Pattern 2: Anonymous rules
```regex
Find:    rule on (\w+) (\w+) \{
Replace: rule on $1($2: id) {
```

### Pattern 3: Rules with when conditions
```regex
Find:    rule (\w+) on (\w+) (\w+) when
Replace: rule $1 on $2($3: id) when
```

```regex
Find:    rule on (\w+) (\w+) when
Replace: rule on $1($2: id) when
```

### Pattern 4: Rules with priority
```regex
Find:    rule (\w+) on (\w+) (\w+) \[priority:
Replace: rule $1 on $2($3: id) [priority:
```

```regex
Find:    rule on (\w+) (\w+) \[priority:
Replace: rule on $1($2: id) [priority:
```

## Step 2: Add Types to Variable Declarations in BRL

**Files:** `game/brl/*.brl`, `game/tests/brl/*.brl`

⚠️ **These require manual type determination** - regex can only mark the locations:

### Find variables needing types
```regex
Find:    let (\w+) = (entities having)
Replace: let $1: list = $2
```

```regex
Find:    let (\w+) = (\w+)\[
Replace: let $1: id = $2[
```

### Common patterns (check each case):
```regex
Find:    let (\w+) = (\d+)
Replace: let $1: integer = $2
```

```regex
Find:    let (\w+) = (\d+\.\d+)
Replace: let $1: float = $2
```

```regex
Find:    let (\w+) = "
Replace: let $1: string = "
```

```regex
Find:    let (\w+) = (true|false)
Replace: let $1: boolean = $2
```

```regex
Find:    let (\w+) = \[
Replace: let $1: list = [
```

### Entity references and complex expressions
For these, search and manually add types:
```regex
Find:    let (\w+) = (\w+)\.(\w+)
# Manually determine if result is id, integer, string, etc.
```

## Step 3: Update BDL Entity Declarations

**Files:** `game/bdl/*.bdl`

### First pass: Mark all entity blocks
```regex
Find:    ^entity \{
Replace: let FIXME_NAME_001: id = new entity {
```

Then manually replace each `FIXME_NAME_001` with appropriate name:
- `let goblin_scout: id = new entity {`
- `let orc_raider: id = new entity {`
- `let warrior_hero: id = new entity {`
- etc.

### Alternative: Entity-specific replacements (if entities have comments above)
```regex
Find:    // (.*)\nentity \{
Replace: // $1\nlet FIXME_$1: id = new entity {
```

## Step 4: Update BCL Variable Declarations

**Files:** `game/bcl/*.bcl`

### Integer counts/indices
```regex
Find:    let (\w*count\w*) = 
Replace: let $1: integer = 
```

```regex
Find:    let (\w*index\w*|idx) = 
Replace: let $1: integer = 
```

### Boolean flags
```regex
Find:    let (\w*can\w*|\w*is\w*|\w*has\w*|\w*should\w*) = 
Replace: let $1: boolean = 
```

### Entity references
```regex
Find:    let (target|enemy|hero|entity|attacker|defender) = 
Replace: let $1: id = 
```

### Lists
```regex
Find:    let (\w*allies\w*|\w*enemies\w*|\w*party\w*|\w*list\w*) = 
Replace: let $1: list = 
```

## Step 5: Update Choice Function Parameters

**Files:** `game/bcl/*.bcl`

Choice functions might have old syntax like:
```regex
Find:    choice fn (\w+)\(([^)]+)\): (\w+) \{
# Check if parameters have types; if not, they need to be added manually
```

Look for:
```regex
Find:    (\w+): entity
Replace: $1: id
```

## Step 6: Fix Schedule Calls (Optional, for consistency)

If you want to capture schedule return values:
```regex
Find:    (\s+)schedule \[
Replace: $1let evt: id = schedule [
```

```regex
Find:    (\s+)schedule (\w+) \{
Replace: $1let evt: id = schedule $2 {
```

**Note:** This is optional and may not always be desired. Review each case.

## Validation Steps

After each file or group of files:

### 1. Build compiler
```bash
cd packages/blink-compiler-ts
npm run build
```

### 2. Test compilation
```bash
cd ../..
make compile-brl
```

### 3. Check for errors
```bash
cd packages/blink-compiler-ts
npm test
```

## Manual Steps Required

### For BDL files:
1. Run entity block regex to add `let FIXME_NAME_###: id = new entity {`
2. Manually replace each FIXME_NAME with appropriate entity name:
   - Look at Character.name field
   - Use snake_case: `sir_braveheart`, `goblin_scout`, etc.
   - Ensure uniqueness

### For BRL complex variables:
Search for remaining untyped lets:
```regex
Find:    let \w+ = [^:]
```
Then manually add appropriate types based on context.

### For BCL entity declarations:
If BCL files have entity declarations (like party-config.bcl), apply BDL patterns.

## Order of Execution

1. ✅ **BRL rule signatures** (Step 1) - Safe, automated
2. ✅ **BRL simple variables** (Step 2) - Use patterns, verify each
3. ⚠️ **BRL complex variables** (Step 2) - Manual review required
4. ⚠️ **BDL entities** (Step 3) - Semi-automated, manual naming
5. ✅ **BCL variables** (Step 4) - Use heuristic patterns
6. ✅ **BCL parameters** (Step 5) - Check and fix manually

## Quick Verification Script

Save as `verify-syntax.sh`:
```bash
#!/bin/bash
echo "Building compiler..."
cd packages/blink-compiler-ts && npm run build && cd ../..

echo "Compiling BRL..."
make compile-brl

echo "Running tests..."
cd packages/blink-compiler-ts && npm test
```

## Common Pitfalls

1. **Over-replacing:** Some variables might legitimately not need types in certain contexts
2. **Wrong types:** `let x = foo.bar` - need to know if bar is id, integer, string, etc.
3. **Missing parens:** Rule signatures must have parentheses around event parameter
4. **Entity names:** Each BDL entity needs a unique, descriptive name

## File-by-File Checklist

### BRL Files
- [ ] `game/brl/classic-rpg.brl` - ~15 rules, ~33 lets
- [ ] `game/tests/brl/level2-basic-rules.brl`
- [ ] `game/tests/brl/level3-control-flow.brl`
- [ ] `game/tests/brl/level4-functions.brl`
- [ ] `game/tests/brl/level5-complex-game.brl`

### BDL Files
- [ ] `game/bdl/heroes.bdl` - ~10 entities
- [ ] `game/bdl/enemies.bdl` - ~5-10 entities
- [ ] `game/bdl/game-config.bdl` - ~2 entities
- [ ] `game/bdl/scenario-easy.bdl` - ~1 entity
- [ ] `game/bdl/scenario-normal.bdl` - ~1 entity
- [ ] `game/bdl/scenario-hard.bdl` - ~1 entity

### BCL Files
- [ ] `game/bcl/cleric-skills.bcl`
- [ ] `game/bcl/flee-aggressive.bcl`
- [ ] `game/bcl/flee-conservative.bcl`
- [ ] `game/bcl/mage-skills.bcl`
- [ ] `game/bcl/party-config.bcl` - May have entity declarations
- [ ] `game/bcl/rogue-skills.bcl`
- [ ] `game/bcl/warrior-skills.bcl`

## Estimated Time

- BRL rule signatures: 5 minutes (automated)
- BRL variable types: 15-20 minutes (semi-automated)
- BDL entity declarations: 20-25 minutes (manual naming)
- BCL variable types: 10 minutes (semi-automated)
- Testing and fixes: 10-15 minutes

**Total: ~60-75 minutes**
