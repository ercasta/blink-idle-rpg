# 2026-01-05 — Entity Cloning Feature and Enemy Spawning Refactor

## Summary
Implementation of entity cloning feature in BRL and BDL languages, followed by refactoring enemy spawning logic from UI to BRL rules.

## Background
Previous PR (#64) deferred the implementation of "Proposal #4: Move Enemy Spawning to BRL" because BRL lacked the necessary language features:
1. Entity cloning syntax (`clone template { ... }`)
2. Advanced entity queries and filtering
3. Dynamic entity creation from rules

## Planned Changes to hielements.hie

### New Language Features
- Add `clone` keyword to BRL lexer
- Add `CloneEntity` expression type to BRL parser AST
- Support shallow cloning (reference sharing)
- Support deep cloning (full copy)
- Support clone with overrides: `clone template { Component { field: new_value } }`

### BDL Support
- Document that BDL supports entity cloning (subset of BRL)
- Allow cloning syntax in data files for template-based entity creation

### IR Extensions
- Add `clone_entity` operation to IR specification
- Include `clone_mode` parameter (deep/shallow)
- Include optional component overrides

### Engine Implementation
- Implement cloning in JavaScript engine
- Deep clone: create new entity with copied component values
- Shallow clone: create new entity sharing component references
- Component override: apply field changes after cloning

### Enemy Spawning Refactor
- Create `EnemySpawner` component in BRL
- Add `spawn_initial_enemies` rule triggered by GameStart
- Use entity cloning to create enemies from templates
- Remove 900+ lines of spawning code from rpg-demo.html
- Update UI to only trigger GameStart event

## Files to Change

### Compiler Changes
- `src/compiler/src/lexer/mod.rs` - Add `clone` keyword
- `src/compiler/src/parser/mod.rs` - Add CloneEntity expression, parsing logic
- `src/compiler/src/ir/mod.rs` - Add clone_entity IR operation
- `src/compiler/tests/language_tests.rs` - Add cloning tests

### Documentation Changes  
- `doc/language/brl-specification.md` - Document clone syntax
- `doc/language/bdl-specification.md` - Document BDL clone support
- `doc/ir-specification.md` - Document clone_entity IR operation

### Engine Changes
- `packages/blink-engine/src/game.ts` - Implement cloneEntity method
- `packages/blink-engine/src/ir-executor.ts` - Handle clone_entity IR op
- `packages/blink-test/src/test-api.ts` - Add cloning test utilities

### Game Logic Changes
- `game/brl/classic-rpg.brl` - Add enemy spawning rules
- `game/bdl/enemies.bdl` - Ensure templates are properly structured
- `game/demos/rpg-demo.html` - Remove spawning logic, simplify UI

### Hielements Changes
- `hielements.hie` - Track new language features and their implementation

## Implementation Status

### Phase 1: Lexer and Parser
- [ ] Add `clone` keyword to lexer
- [ ] Add `CloneEntity` expression to AST
- [ ] Implement clone expression parsing
- [ ] Support clone with component overrides
- [ ] Add parser tests

### Phase 2: IR Generation
- [ ] Define clone_entity IR operation
- [ ] Generate IR for clone expressions
- [ ] Handle deep vs shallow cloning
- [ ] Generate IR for component overrides
- [ ] Add IR generation tests

### Phase 3: Engine Implementation  
- [ ] Implement cloneEntity in JS engine
- [ ] Handle deep cloning
- [ ] Handle shallow cloning
- [ ] Apply component overrides
- [ ] Add engine tests

### Phase 4: BRL Enemy Spawning
- [ ] Add EnemySpawner component
- [ ] Create spawn_initial_enemies rule
- [ ] Use clone to create enemies from templates
- [ ] Handle target assignment in BRL
- [ ] Test spawning behavior

### Phase 5: UI Refactor
- [ ] Remove spawnInitialEnemies function
- [ ] Remove spawnEnemy function
- [ ] Simplify initGameWithParty
- [ ] Update event scheduling
- [ ] Test complete game flow

### Phase 6: Testing and Validation
- [ ] Run language compilation tests
- [ ] Build compiler
- [ ] Compile BRL to IR
- [ ] Test demo package
- [ ] Manual game testing
- [ ] Code review
- [ ] Security scanning

## Notes
- Clone syntax follows existing BRL patterns
- Deep vs shallow determined by context or explicit flag
- Component overrides use same syntax as entity creation
- Entity templates in BDL remain unchanged (just variables)
- Spawning logic moves to BRL, making game rules portable
