# Browser Compiler Evaluation: Making BRL/BCL Accessible to Players

**Date**: 2025-12-31  
**Status**: Proposal  
**Related**: [IR Decision](ir-decision.md), [Development Tracks](../DEVELOPMENT_TRACKS.md)

## Problem Statement

Currently, the BRL/BCL compiler is implemented in Rust. For players who want to:
1. Write and compile BCL (choice rules) for their party builds
2. Manage a collection of builds (individual party members or full party configurations)
3. Use the JavaScript browser engine without installing Rust toolchain

...they still need to go through the Rust compiler, which complicates the player experience.

### Player Use Cases

1. **Casual Player**: Writes BCL in browser, wants immediate feedback
2. **Build Collector**: Maintains offline collection of BCL builds
3. **Community Contributor**: Shares builds via browser without local toolchain
4. **Mobile User**: Compiles builds on tablet/phone
5. **Offline Player**: Works on builds without server connectivity

---

## Current Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  BRL/BCL     │ ──► │    Rust      │ ──► │      IR      │
│  Source      │     │   Compiler   │     │    (JSON)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                   ┌──────────────┴──────────────┐
                                   │                             │
                                   ▼                             ▼
                           ┌──────────────┐              ┌──────────────┐
                           │ JS Engine    │              │ Rust Engine  │
                           │ (Browser)    │              │ (Native)     │
                           └──────────────┘              └──────────────┘
```

**Current Pain Points:**
- Players must install Rust toolchain to compile BCL
- No browser-native compilation workflow
- Cannot preview/validate BCL without external compilation step
- Build collections require pre-compiled IR files

---

## Options Evaluated

### Option 1: Compile Rust Compiler to WebAssembly (WASM)

Compile the existing Rust compiler to WASM and load it in the browser.

```
┌──────────────┐     ┌─────────────────────────────────────┐
│  BRL/BCL     │ ──► │  Browser                            │
│  Source      │     │  ┌──────────────┐    ┌──────────┐  │
│              │     │  │ Rust→WASM    │───►│   IR     │  │
└──────────────┘     │  │ Compiler     │    │  (JSON)  │  │
                     │  └──────────────┘    └────┬─────┘  │
                     │                           │        │
                     │                           ▼        │
                     │                    ┌──────────────┐ │
                     │                    │  JS Engine   │ │
                     │                    └──────────────┘ │
                     └─────────────────────────────────────┘
```

**Implementation Steps:**
1. Add `wasm32-unknown-unknown` target to Rust compiler
2. Create JavaScript bindings using `wasm-bindgen`
3. Bundle WASM module with size optimization
4. Create browser loader/initializer

**Pros:**
- ✅ Single codebase (Rust compiler)
- ✅ Guaranteed identical behavior
- ✅ Reuse all existing tests
- ✅ No code duplication
- ✅ Automatic sync when Rust compiler updates

**Cons:**
- ❌ WASM bundle size (typically 500KB-2MB for complex parsers)
- ❌ Initial load time (WASM compilation)
- ❌ Debugging is harder (no Rust source in browser DevTools)
- ❌ Some Rust crates don't compile to WASM
- ❌ Memory management complexity
- ❌ Async initialization required

**Estimated Effort**: Medium (2-3 weeks)
- Configure WASM build: 2-3 days
- JavaScript bindings: 3-5 days
- Browser integration: 3-5 days
- Size optimization: 2-3 days
- Testing: 3-4 days

**Technical Notes:**
```toml
# Cargo.toml additions needed
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2.95"

[profile.release]
opt-level = "z"  # Optimize for size
lto = true
```

---

### Option 2: Pure TypeScript/JavaScript Compiler

Rewrite the compiler in TypeScript, maintaining the same semantics.

```
┌──────────────┐     ┌─────────────────────────────────────┐
│  BRL/BCL     │ ──► │  Browser                            │
│  Source      │     │  ┌──────────────┐    ┌──────────┐  │
│              │     │  │     TS       │───►│   IR     │  │
└──────────────┘     │  │   Compiler   │    │  (JSON)  │  │
                     │  └──────────────┘    └────┬─────┘  │
                     │                           │        │
                     │                           ▼        │
                     │                    ┌──────────────┐ │
                     │                    │  JS Engine   │ │
                     │                    └──────────────┘ │
                     └─────────────────────────────────────┘
```

**Implementation Steps:**
1. Port lexer to TypeScript (reimplement token types)
2. Port parser to TypeScript (AST construction)
3. Port semantic analyzer (type checking)
4. Port IR generator
5. Create comprehensive test suite ensuring parity
6. NPM package for browser use

**Pros:**
- ✅ Native browser performance
- ✅ No WASM overhead
- ✅ Small bundle size (typically 50-150KB)
- ✅ Excellent debugging (full source maps)
- ✅ TypeScript developers can contribute
- ✅ Same ecosystem as JS engine
- ✅ Works offline with minimal footprint
- ✅ Instant startup (no WASM compilation)
- ✅ Easy to integrate with React/Vue/etc.

**Cons:**
- ❌ Two codebases to maintain (Rust + TS)
- ❌ Risk of semantic divergence
- ❌ Double implementation effort
- ❌ Must keep both in sync on language changes
- ❌ Parser tooling less mature than Rust

**Estimated Effort**: High (4-6 weeks)
- Lexer port: 3-5 days
- Parser port: 7-10 days
- Analyzer port: 5-7 days
- IR generator port: 3-5 days
- Testing & parity validation: 5-7 days
- Documentation: 2-3 days

**Technical Notes:**
```typescript
// Example structure
packages/blink-compiler/
├── src/
│   ├── lexer/
│   │   └── Lexer.ts
│   ├── parser/
│   │   └── Parser.ts
│   ├── analyzer/
│   │   └── Analyzer.ts
│   ├── ir/
│   │   └── Generator.ts
│   └── index.ts
```

---

### Option 3: BCL-Only TypeScript Compiler (Recommended)

Since BCL is a strict subset of BRL, implement only the BCL compiler in TypeScript. Full BRL compilation remains in Rust for game developers.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  GAME DEVELOPERS                         PLAYERS                        │
│  ┌──────────────┐                        ┌──────────────┐               │
│  │  BRL Source  │                        │  BCL Source  │               │
│  └──────┬───────┘                        └──────┬───────┘               │
│         │                                       │                       │
│         ▼                                       ▼                       │
│  ┌──────────────┐                        ┌──────────────┐               │
│  │    Rust      │                        │      TS      │  ◄── Browser  │
│  │  Compiler    │                        │   Compiler   │      Only     │
│  │  (Full BRL)  │                        │  (BCL Only)  │               │
│  └──────┬───────┘                        └──────┬───────┘               │
│         │                                       │                       │
│         ▼                                       ▼                       │
│  ┌──────────────┐                        ┌──────────────┐               │
│  │  Game IR     │                        │  Build IR    │               │
│  │  (rules)     │                        │  (choices)   │               │
│  └──────┬───────┘                        └──────┬───────┘               │
│         │                                       │                       │
│         └────────────────┬──────────────────────┘                       │
│                          │                                              │
│                          ▼                                              │
│                   ┌──────────────┐                                      │
│                   │  JS Engine   │                                      │
│                   │  (Browser)   │                                      │
│                   └──────────────┘                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Implementation Steps:**
1. Define BCL IR subset (choice functions only)
2. Implement BCL lexer in TypeScript (subset of BRL tokens)
3. Implement BCL parser (rejects BRL-only constructs)
4. Implement BCL semantic analyzer (validates no writes)
5. Generate BCL IR (compatible with engine)
6. Create build collection management system

**Pros:**
- ✅ Smaller scope (BCL is simpler than BRL)
- ✅ Players only need BCL (not full BRL)
- ✅ Clear separation of concerns
- ✅ Lighter bundle (~30-80KB)
- ✅ BCL validation specific (better errors for players)
- ✅ Can evolve independently for player experience
- ✅ Rust compiler for game developers (who already have tooling)
- ✅ TS compiler for players (who want browser workflow)
- ✅ Enables build collection features

**Cons:**
- ❌ Two compilers (but for different audiences)
- ❌ BCL changes require both updates
- ❌ Some code duplication (lexer basics)

**Estimated Effort**: Medium (3-4 weeks)
- BCL lexer: 2-3 days
- BCL parser: 4-6 days
- BCL analyzer: 3-4 days
- BCL IR generator: 2-3 days
- Build collection system: 3-5 days
- Testing: 4-5 days
- Documentation: 2-3 days

**Technical Notes:**
```typescript
// BCL Compiler API
interface BCLCompiler {
  compile(source: string): BCLCompileResult;
  validate(source: string): ValidationResult;
  getCompletions(source: string, position: number): Completion[];
}

interface BCLCompileResult {
  success: boolean;
  ir?: BCLModule;
  errors?: CompileError[];
  warnings?: CompileWarning[];
}

// Build Collection System
interface BuildCollection {
  builds: Build[];
  addBuild(source: string, metadata: BuildMetadata): Build;
  removeBuild(id: string): void;
  exportCollection(): string;
  importCollection(data: string): void;
}

interface Build {
  id: string;
  name: string;
  source: string;  // BCL source
  ir: BCLModule;   // Compiled IR
  metadata: BuildMetadata;
  created: Date;
  modified: Date;
}
```

---

### Option 4: Hybrid - TypeScript Compiler + Optional WASM

Implement TypeScript compiler for development/preview, use WASM for production compilation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐        ┌───────────────────────────────────────────┐  │
│  │  BCL Source  │───────►│  Compilation Strategy                      │  │
│  └──────────────┘        │                                           │  │
│                          │  if (wasmLoaded && productionMode) {      │  │
│                          │    return wasmCompiler.compile(source);   │  │
│                          │  } else {                                 │  │
│                          │    return tsCompiler.compile(source);     │  │
│                          │  }                                        │  │
│                          └──────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│                            ┌──────────────┐                             │
│                            │      IR      │                             │
│                            └──────────────┘                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Pros:**
- ✅ Fast feedback with TypeScript during editing
- ✅ Guaranteed correctness with WASM for final compilation
- ✅ Best of both worlds

**Cons:**
- ❌ Most complex solution
- ❌ Three codebases (Rust + TS + bindings)
- ❌ Potential confusion about which compiler is running

**Estimated Effort**: Very High (6-8 weeks)

---

## Recommendation: Option 3 (BCL-Only TypeScript Compiler)

### Rationale

1. **Audience Separation**: Game developers (BRL) and players (BCL) have different needs
   - Game developers: Full toolchain, IDE support, complex rules → Rust is fine
   - Players: Browser-only, simple choices, build management → TypeScript is ideal

2. **BCL is Simpler**: BCL is explicitly a subset of BRL
   - No component definitions
   - No entity creation/deletion
   - No event scheduling
   - Just read-only queries and choice functions
   - Easier to implement correctly

3. **Better Player Experience**: Can optimize error messages and UX for players
   - "You cannot modify Health.current in BCL" vs generic parse error
   - Auto-complete for valid BCL constructs
   - Preview integration in browser

4. **Build Collection System**: Enables key player features
   - Save/load builds locally
   - Export/import build collections
   - Share builds via URLs
   - Offline build management

5. **Maintenance Burden is Acceptable**: BCL grammar is stable and small
   - Changes are infrequent
   - Test suite ensures parity
   - Clear contract (BCL spec)

### Implementation Plan

#### Phase 1: Core BCL Compiler (Week 1-2)

```
packages/blink-compiler-bcl/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Public API
│   ├── lexer/
│   │   ├── Lexer.ts       # Token generation
│   │   └── tokens.ts      # Token types
│   ├── parser/
│   │   ├── Parser.ts      # AST construction
│   │   └── ast.ts         # AST types
│   ├── analyzer/
│   │   ├── Analyzer.ts    # BCL validation
│   │   └── types.ts       # Type system
│   ├── ir/
│   │   ├── Generator.ts   # IR generation
│   │   └── types.ts       # IR types
│   └── errors/
│       └── errors.ts      # Player-friendly errors
├── tests/
│   ├── lexer.test.ts
│   ├── parser.test.ts
│   ├── analyzer.test.ts
│   └── integration.test.ts
```

#### Phase 2: Build Collection System (Week 2-3)

```
packages/blink-builds/
├── package.json
├── src/
│   ├── index.ts           # Public API
│   ├── Collection.ts      # Build collection manager
│   ├── Build.ts           # Individual build
│   ├── storage/
│   │   ├── LocalStorage.ts
│   │   ├── IndexedDB.ts
│   │   └── Export.ts
│   └── sharing/
│       ├── URLSharing.ts
│       └── FileSharing.ts
```

#### Phase 3: Integration & Demo (Week 3-4)

- Integrate BCL compiler with JS engine
- Create demo build editor
- Add to existing demo page
- Documentation

### API Design

```typescript
// BCL Compiler
import { BCLCompiler, CompileResult } from '@blink/compiler-bcl';

const compiler = new BCLCompiler();

// Compile BCL source
const result: CompileResult = compiler.compile(`
  choice fn select_target(attacker: Character, enemies: list): id {
    return find_weakest(enemies)
  }
`);

if (result.success) {
  // Use with engine
  game.loadChoices(result.ir);
} else {
  // Show errors to player
  console.log(result.errors);
}

// Build Collection
import { BuildCollection } from '@blink/builds';

const collection = new BuildCollection();

// Add a build
const build = await collection.addBuild({
  name: "Aggressive Warrior",
  source: "choice fn select_target...",
});

// Export collection
const exportData = collection.export();

// Share via URL
const shareUrl = collection.getShareUrl(build.id);
```

### Success Criteria

1. **Functional**: BCL compilation in browser produces valid IR
2. **Performance**: Compilation < 100ms for typical builds
3. **Bundle Size**: < 80KB gzipped
4. **Error Quality**: Player-friendly error messages
5. **Parity**: Same IR output as Rust compiler for valid BCL
6. **Offline**: Works completely offline after initial load

---

## Alternative Considerations

### Why Not Server-Side Compilation?

Could offer a compilation API service.

**Pros:**
- No client-side compiler needed
- Single source of truth

**Cons:**
- Requires internet connectivity
- Server costs
- Latency for feedback
- Defeats "offline build collection" use case

**Verdict**: Server-side can complement but not replace browser compilation.

### Why Not Just Use Pre-Compiled IR?

Could provide UI to select from pre-built choices.

**Pros:**
- No compilation needed
- Very simple

**Cons:**
- No custom builds
- Limited creativity
- Not what players want

**Verdict**: Pre-compiled templates are a feature, not a solution.

---

## Conclusion

**Recommended Approach**: Option 3 - BCL-Only TypeScript Compiler

This approach provides:
- ✅ Browser-native compilation for players
- ✅ Small bundle size
- ✅ Excellent developer experience
- ✅ Build collection system
- ✅ Clear separation between game developer and player workflows
- ✅ Manageable maintenance burden

The key insight is that **players only need BCL**, and BCL is simpler than BRL. By focusing on BCL only, we can deliver a great player experience with reasonable effort while keeping the full BRL compiler in Rust for game developers who already have tooling.

---

## Next Steps

If this proposal is accepted:

1. [ ] Create `packages/blink-compiler-bcl` project structure
2. [ ] Implement BCL lexer
3. [ ] Implement BCL parser
4. [ ] Implement BCL analyzer (with write-violation detection)
5. [ ] Implement IR generator
6. [ ] Create parity test suite (compare TS vs Rust output)
7. [ ] Implement build collection system
8. [ ] Create demo build editor
9. [ ] Update documentation
10. [ ] Integrate with demo page

---

## Appendix A: BCL Grammar Subset

For complete grammar definitions of shared elements (params, type, block, expression, etc.),
see the [BRL Specification](../language/brl-specification.md).

```ebnf
(* BCL is a strict subset of BRL *)
(* This shows BCL-specific productions and restrictions *)

program = { declaration } ;

declaration = choice_function_def
            | pure_function_def
            | party_def
            | import ;

(* BCL-specific: choice function marker *)
choice_function_def = "choice" "fn" identifier "(" [ param_list ] ")" ":" type block ;

(* Standard function (must be pure in BCL - no side effects) *)
pure_function_def = "fn" identifier "(" [ param_list ] ")" [ ":" type ] block ;

(* BCL-specific: party definition block *)
party_def = "party" "{" { party_member } "}" ;

party_member = identifier "{" { field_init } "}" ;

field_init = identifier ":" expression ;

(* Shared with BRL - see BRL spec for details *)
param_list = param { "," param } ;
param = identifier ":" type ;
type = "string" | "boolean" | "integer" | "float" | "id" | "list" | identifier ;
block = "{" { statement } "}" ;

(* BCL-allowed statements (read-only subset of BRL) *)
statement = let_statement
          | if_statement
          | for_statement  (* read-only iteration *)
          | return_statement ;

let_statement = "let" identifier [ ":" type ] "=" expression ;
if_statement = "if" expression block [ "else" ( if_statement | block ) ] ;
for_statement = "for" identifier "in" expression block ;
return_statement = "return" [ expression ] ;

(* Expressions - same as BRL, see doc/language/brl-specification.md Section 8 *)
(* Key difference: BCL disallows assignment expressions to component fields *)
expression = or_expression ;
or_expression = and_expression { "||" and_expression } ;
and_expression = equality_expression { "&&" equality_expression } ;
equality_expression = comparison_expression { ( "==" | "!=" ) comparison_expression } ;
comparison_expression = additive_expression { ( "<" | "<=" | ">" | ">=" ) additive_expression } ;
additive_expression = multiplicative_expression { ( "+" | "-" ) multiplicative_expression } ;
multiplicative_expression = unary_expression { ( "*" | "/" | "%" ) unary_expression } ;
unary_expression = ( "!" | "-" ) unary_expression | postfix_expression ;
postfix_expression = primary_expression { "." identifier | "[" expression "]" | "(" [ arg_list ] ")" } ;
primary_expression = literal | identifier | "(" expression ")" | "[" [ arg_list ] "]" ;
arg_list = expression { "," expression } ;
literal = string_literal | integer_literal | float_literal | "true" | "false" | "null" ;

(* ============================================ *)
(* DISALLOWED in BCL (BRL-only constructs)     *)
(* ============================================ *)
(* component_def      - cannot define components *)
(* rule_def           - cannot define rules *)
(* tracker_def        - cannot define trackers *)
(* schedule_statement - cannot schedule events *)
(* cancel_statement   - cannot cancel events *)
(* create_statement   - cannot create entities *)
(* delete_statement   - cannot delete entities *)
(* assignment to component fields (e.g., entity.Health.current = 50) *)
```

## Appendix B: Bundle Size Estimates

| Component | Estimated Size (min+gzip) |
|-----------|---------------------------|
| BCL Lexer | ~5KB |
| BCL Parser | ~15KB |
| BCL Analyzer | ~10KB |
| IR Generator | ~8KB |
| Error Messages | ~5KB |
| Build Collection | ~12KB |
| **Total** | **~55KB** |

Compare to WASM approach: ~500KB-1.5MB

## Appendix C: Error Message Examples

```
BCL Error: Cannot modify component field
  → my_party.bcl:42:5

  41 |     let target = enemies[0]
  42 |     target.Health.current = 50
       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

  BCL can only read values, not modify them.
  
  Hint: Use a choice function to return a decision instead.
  Example:
    choice fn select_heal_target(...): id {
      return target.id  // Return target, don't modify it
    }
```

```
BCL Error: Entity creation not allowed
  → my_party.bcl:15:1

  15 | create entity {
       ^^^^^^^^^^^^^

  BCL cannot create entities. Only game rules (BRL) can do that.
  
  Hint: Define party members using the 'party' block instead.
  Example:
    party {
      warrior { class: "Warrior", name: "Tank" }
    }
```
