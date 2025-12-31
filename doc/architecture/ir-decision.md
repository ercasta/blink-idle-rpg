# Architecture Decision: Intermediate Representation and Engine Independence

**Date**: 2024-12-31  
**Status**: Proposal  
**Decision**: Pending

## Context

The Blink system needs to support multiple runtime engines:
- **Rust Engine**: Native performance, batch processing, balance testing
- **Browser Engine**: JavaScript-native for web game clients
- **Future engines**: Server-side, mobile, etc.

The question is: how should the compiler and engines relate?

## Options Evaluated

### Option A: Single Engine, WASM for Browser (Original)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  BRL Source  │ ──► │   Compiler   │ ──► │  Rust Engine │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  │ WASM compile
                                                  ▼
                                          ┌──────────────┐
                                          │   Browser    │
                                          │   (WASM)     │
                                          └──────────────┘
```

**Pros:**
- Single engine implementation
- One codebase to maintain
- Guaranteed consistency

**Cons:**
- Browser runtime depends on Rust engine
- WASM has overhead and limitations
- Harder to debug in browser (no source maps into Rust)
- Cannot develop engines in parallel
- JavaScript developers cannot contribute to engine
- WASM bundle size can be large

### Option B: IR as Interchange Format, Independent Engines (Proposed)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  BRL Source  │ ──► │   Compiler   │ ──► │      IR      │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                     ┌────────────────────────────┼────────────────────────────┐
                     │                            │                            │
                     ▼                            ▼                            ▼
              ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
              │ Rust Engine  │            │  JS Engine   │            │ Other Engine │
              │   (Native)   │            │  (Browser)   │            │   (Future)   │
              └──────────────┘            └──────────────┘            └──────────────┘
```

**Pros:**
- Engines are completely independent
- Each engine optimized for its target platform
- Parallel development possible
- JavaScript developers can build JS engine
- Rust developers can build Rust engine
- No WASM overhead for browser (pure JS)
- Better debugging in each environment
- IR provides clear contract

**Cons:**
- Multiple implementations to maintain
- Risk of semantic divergence between engines
- More total code

### Option C: Hybrid (IR + Optional WASM)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  BRL Source  │ ──► │   Compiler   │ ──► │      IR      │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                     ┌────────────────────────────┼────────────────────┐
                     │                            │                    │
                     ▼                            ▼                    ▼
              ┌──────────────┐            ┌──────────────┐     ┌──────────────┐
              │ Rust Engine  │            │  JS Engine   │     │ WASM Engine  │
              │   (Native)   │            │   (Pure JS)  │     │ (Rust→WASM)  │
              └──────────────┘            └──────────────┘     └──────────────┘
                     │                                                │
                     │ (optional compile)                             │
                     └────────────────────────────────────────────────┘
```

**Pros:**
- Maximum flexibility
- Can choose best approach per use case
- Can start with JS engine, add WASM later if needed

**Cons:**
- Most complex
- Three implementations potentially

---

## Analysis: Is IR a Benefit or Useless Complication?

### Benefits of IR

#### 1. Centralized Validation and Error Reporting
The compiler can catch ALL errors at IR generation time:
- Syntax errors
- Type errors
- Undefined component/entity references
- Invalid event scheduling
- BCL constraint violations (no writes)

**This is huge for development experience.** Game developers get consistent, helpful error messages regardless of which engine they target.

```
Error in combat.brl:42:5
  Entity 'enemy' does not have component 'Mana'
  
  41 |     let target = event.target
  42 |     target.Mana.current -= 10
       ^^^^^^^^^^^^^^^^^^^^^^^^^
  help: Did you mean 'Health'?
```

Without IR, each engine would need to implement error reporting, leading to inconsistent messages.

#### 2. Single Source of Truth for Semantics
The IR specification defines EXACTLY what the game rules mean:
- Event timing semantics
- Component modification order
- Rule priority resolution
- Tracker firing behavior

Engines become "dumb executors" of well-defined IR instructions.

#### 3. Enables Truly Independent Development
With IR as the contract:
- Compiler team: Focuses on parsing, analysis, IR generation
- Rust engine team: Focuses on performance, native features
- JS engine team: Focuses on browser integration, developer experience
- No team blocks another

#### 4. Testing and Verification
- **Compiler tests**: BRL → IR transformation correctness
- **Engine tests**: IR execution correctness
- **Cross-engine tests**: Same IR produces same results

```
test_case: damage_calculation
  ir_file: fixtures/damage.ir
  expected_output: fixtures/damage_expected.json
  
  engines:
    - rust_engine: PASS
    - js_engine: PASS
    - wasm_engine: PASS
```

#### 5. Debugging and Inspection
IR can be serialized, logged, inspected:
```bash
# Generate IR and inspect it
blink-compiler compile combat.brl --emit-ir > combat.ir.json

# Human-readable IR
cat combat.ir.json | jq '.rules[0]'
```

#### 6. Optimization Opportunities
IR enables optimization passes:
- Dead code elimination
- Constant folding
- Rule ordering optimization
- These optimizations are written once, benefit all engines

### Potential Drawbacks of IR

#### 1. Additional Abstraction Layer
- One more thing to learn
- One more thing to debug
- IR format becomes a versioned API

**Mitigation**: IR is internal to the toolchain. Game developers never see it.

#### 2. IR Format Stability
Once engines depend on IR, changing it requires coordinating updates.

**Mitigation**: 
- Version the IR format
- Provide migration tools
- Design IR carefully upfront

#### 3. Two Compilation Steps
BRL → IR → Execution (instead of BRL → Execution)

**Mitigation**: 
- Negligible performance impact (compilation is fast)
- Actually beneficial for caching (compile once, run many)

### Conclusion: IR is Clearly Beneficial

The benefits far outweigh the costs:
- **Error centralization alone justifies IR**
- **Engine independence enables parallel development**
- **Testing becomes much more tractable**
- **IR is a proven pattern** (LLVM IR, JVM bytecode, WebAssembly)

---

## Recommended Architecture

### IR-Centric Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              TOOLCHAIN                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         COMPILER                                 │   │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────────────┐    │   │
│  │  │  Lexer  │─►│ Parser  │─►│ Analyzer │─►│  IR Generator   │    │   │
│  │  └─────────┘  └─────────┘  └──────────┘  └────────┬────────┘    │   │
│  │                                                    │             │   │
│  │                    ┌───────────────────────────────┘             │   │
│  │                    ▼                                             │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │                    BLINK IR                              │    │   │
│  │  │  • Component definitions                                 │    │   │
│  │  │  • Rule definitions (with compiled expressions)          │    │   │
│  │  │  • Tracker definitions                                   │    │   │
│  │  │  • Initial state (optional)                              │    │   │
│  │  │  • Format: JSON or Binary (MessagePack)                  │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    │ IR is the contract                 │
│                    ┌───────────────┼───────────────┐                    │
│                    ▼               ▼               ▼                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │   RUST ENGINE    │  │    JS ENGINE     │  │   BATCH ENGINE   │      │
│  │   (Native)       │  │    (Browser)     │  │   (Headless)     │      │
│  │                  │  │                  │  │                  │      │
│  │  • Full features │  │  • Browser-first │  │  • No trackers   │      │
│  │  • Max perf      │  │  • Good DevEx    │  │  • Max throughput│      │
│  │  • Dev server    │  │  • React/Vue     │  │  • Balance test  │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### IR Format (Draft)

```typescript
interface BlinkIR {
  version: string;
  
  // Component definitions
  components: ComponentDef[];
  
  // Compiled rules
  rules: RuleDef[];
  
  // Tracker definitions
  trackers: TrackerDef[];
  
  // Functions (from BRL)
  functions: FunctionDef[];
  
  // BCL choice functions (if included)
  choices?: ChoiceFunctionDef[];
  
  // Initial game state (optional)
  initialState?: EntityDef[];
}

interface ComponentDef {
  name: string;
  fields: FieldDef[];
}

interface RuleDef {
  id: string;
  triggerEvent: string;
  condition?: Expression;  // Compiled expression tree
  priority: number;
  body: Instruction[];     // Compiled instructions
}

interface TrackerDef {
  component: string;
  triggerEvent: string;
}

// Instructions are low-level operations
type Instruction = 
  | { op: 'load_local', index: number }
  | { op: 'store_local', index: number }
  | { op: 'get_component', entity: Operand, component: string }
  | { op: 'set_field', entity: Operand, component: string, field: string, value: Operand }
  | { op: 'schedule_immediate', event: Operand }
  | { op: 'schedule_delayed', event: Operand, delay: Operand }
  | { op: 'binary_op', op: BinaryOp, left: Operand, right: Operand }
  | { op: 'jump', target: number }
  | { op: 'jump_if', condition: Operand, target: number }
  | { op: 'call', function: string, args: Operand[] }
  | { op: 'return', value?: Operand }
  // ... etc
```

### Engine Responsibilities

Each engine must:
1. **Load IR**: Parse the IR format
2. **Initialize state**: Create entities and components from initial state
3. **Execute rules**: When events fire, match and execute rules
4. **Handle trackers**: Collect component data when tracker events fire
5. **Provide API**: Expose start/stop/step/query to host application

Each engine can have unique features:
- **Rust Engine**: Hot-reload, debugging server, max performance
- **JS Engine**: React/Vue bindings, browser DevTools integration
- **Batch Engine**: No UI, parallel simulation, statistics

### Development Independence

| Track | Depends On | Provides |
|-------|------------|----------|
| Compiler | Language spec | IR |
| Rust Engine | IR spec | Native runtime |
| JS Engine | IR spec | Browser runtime |
| Batch Engine | IR spec | Testing runtime |
| Dev Tools | Compiler (AST) | IDE support |

**Key insight**: Engines depend only on IR specification, NOT on each other.

---

## Action Items

1. **Update DEVELOPMENT_TRACKS.md** to reflect engine independence
2. **Create IR specification document** (`doc/ir-specification.md`)
3. **Update engine architecture** to show IR consumption
4. **Rename Track 4** to be more specific (JS Engine, not "Browser Runtime")

---

## References

- LLVM IR: https://llvm.org/docs/LangRef.html
- WebAssembly: https://webassembly.org/
- JVM Bytecode: https://docs.oracle.com/javase/specs/jvms/se8/html/
