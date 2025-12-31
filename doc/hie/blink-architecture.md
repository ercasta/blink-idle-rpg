# Blink Architecture Specification

This document describes how the Blink Idle RPG project is structured using Hielements, and serves as the guide for creating and maintaining `hielements.hie`.

## Overview

The Blink project architecture is defined in a single `hielements.hie` file at the repository root. This specification:

1. **Documents** all major components and their relationships
2. **Enforces** that documentation, code, and structure stay aligned
3. **Guides** AI-assisted development with structured context

## Blink Architecture Elements

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          blink_project                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      documentation                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │  │
│  │  │  language   │  │   engine    │  │       hielements        │   │  │
│  │  │   docs      │  │    docs     │  │         docs            │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        language                                   │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────┐    │  │
│  │  │      brl (rules)        │  │      bcl (choices)          │    │  │
│  │  │  - specification.md     │  │  - specification.md         │    │  │
│  │  │  - grammar (future)     │  │  - grammar (future)         │    │  │
│  │  └─────────────────────────┘  └─────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        implementation                             │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐  │  │
│  │  │ compiler  │  │  engine   │  │  browser  │  │   devtools    │  │  │
│  │  │  (Rust)   │  │  (Rust)   │  │  (WASM)   │  │   (LSP/VSC)   │  │  │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Hielements Specification for Blink

### Full Specification

The following is the complete `hielements.hie` specification for Blink:

```hielements
import files

## Blink Idle RPG Project
## A complete idle RPG where you define rules and watch the game play itself.
element blink_project:
    
    ## Project root files
    scope root = files.folder_selector('.')
    check files.exists(root, 'README.md')
    check files.exists(root, 'AGENTS.md')
    check files.exists(root, 'LICENSE')
    
    ## ========================================
    ## DOCUMENTATION
    ## ========================================
    
    ## Documentation element - all project documentation
    element documentation:
        scope docs = files.folder_selector('doc/')
        check files.exists(docs, 'summary.md')
        check files.exists(docs, 'README.md')
        
        ## Language documentation
        element language_docs:
            scope lang_docs = files.folder_selector('doc/language/')
            check files.exists(lang_docs, 'README.md')
            check files.exists(lang_docs, 'brl-specification.md')
            check files.exists(lang_docs, 'bcl-specification.md')
        
        ## Engine documentation
        element engine_docs:
            scope eng_docs = files.folder_selector('doc/engine/')
            check files.exists(eng_docs, 'README.md')
            check files.exists(eng_docs, 'architecture.md')
            check files.exists(eng_docs, 'browser-engine.md')
        
        ## Hielements documentation
        element hielements_docs:
            scope hie_docs = files.folder_selector('doc/hie/')
            check files.exists(hie_docs, 'README.md')
            check files.exists(hie_docs, 'language-reference.md')
            check files.exists(hie_docs, 'blink-architecture.md')
            check files.exists(hie_docs, 'writing-specs.md')
    
    ## ========================================
    ## LANGUAGE SPECIFICATION
    ## ========================================
    
    ## Blink languages (BRL and BCL)
    element language:
        
        ## Blink Rule Language - for game developers
        element brl:
            scope spec = files.file_selector('doc/language/brl-specification.md')
            connection_point syntax_definition
            check files.exists(spec)
        
        ## Blink Choice Language - for players
        element bcl:
            scope spec = files.file_selector('doc/language/bcl-specification.md')
            connection_point syntax_definition
            check files.exists(spec)
            # BCL is a subset of BRL
    
    ## ========================================
    ## IMPLEMENTATION (Future)
    ## ========================================
    
    ## Compiler - transforms BRL to IR
    ## Status: Not yet implemented
    element compiler:
        scope src = files.folder_selector('src/compiler/')
        connection_point ir_output
        # Checks will be added when implementation starts
    
    ## Core Engine - simulation runtime
    ## Status: Not yet implemented  
    element engine:
        scope src = files.folder_selector('src/engine/')
        connection_point engine_api
        
        element timeline:
            scope src = files.folder_selector('src/engine/timeline/')
        
        element ecs:
            scope src = files.folder_selector('src/engine/ecs/')
        
        element rules:
            scope src = files.folder_selector('src/engine/rules/')
    
    ## Browser Runtime - JS/WASM implementation
    ## Status: Not yet implemented
    element browser_runtime:
        scope pkg = files.folder_selector('packages/blink-engine/')
        connection_point js_api
    
    ## Developer Tools - LSP and VSCode extension
    ## Status: Not yet implemented
    element devtools:
        
        element lsp:
            scope src = files.folder_selector('tools/blink-lsp/')
        
        element vscode_extension:
            scope src = files.folder_selector('tools/vscode-blink/')
```

### Key Design Decisions

1. **Hierarchical Structure**: Documentation, language, and implementation are top-level elements
2. **Connection Points**: Define interfaces between components (IR format, APIs)
3. **Progressive Checks**: Only enforce what exists now; future implementation checks are placeholders
4. **Documentation as Code**: Docs are checked like source code

## Element Descriptions

### documentation

Contains all project documentation. Currently the most developed part of the project.

**Checks**:
- `summary.md` exists (original design doc)
- `README.md` exists (navigation index)
- Language docs complete (BRL spec, BCL spec)
- Engine docs complete (architecture, browser engine)
- Hielements docs complete (this folder)

### language

Defines the BRL and BCL language specifications.

**Connection Points**:
- `brl.syntax_definition` - Grammar and syntax rules for BRL
- `bcl.syntax_definition` - Grammar and syntax rules for BCL

**Relationship**: BCL is a subset of BRL (players get read-only access)

### compiler

Transforms BRL source code into Intermediate Representation.

**Connection Points**:
- `ir_output` - The IR format consumed by engines

**Dependencies**: Requires `language.brl.syntax_definition`

### engine

The core simulation runtime written in Rust.

**Sub-elements**:
- `timeline` - Event scheduling and time management
- `ecs` - Entity-Component-System storage
- `rules` - Rule execution and BCL integration

**Connection Points**:
- `engine_api` - API for engine consumers (browser runtime, batch runners)

### browser_runtime

JavaScript/WASM implementation for browsers.

**Connection Points**:
- `js_api` - TypeScript API for game clients

**Dependencies**: Requires `engine.engine_api`

### devtools

Developer tooling for BRL/BCL editing.

**Sub-elements**:
- `lsp` - Language Server Protocol implementation
- `vscode_extension` - VS Code extension

**Dependencies**: Requires `compiler` for parsing

## Development Workflow

### Adding a New Component

1. **Update hielements.hie first**:
   ```hielements
   element new_component:
       scope src = files.folder_selector('src/new_component/')
       check files.exists(src, 'mod.rs')
   ```

2. **Run check to see failure**:
   ```bash
   hielements check hielements.hie
   # Expected: Failure - folder doesn't exist
   ```

3. **Create the component**:
   ```bash
   mkdir -p src/new_component
   touch src/new_component/mod.rs
   ```

4. **Run check to confirm**:
   ```bash
   hielements check hielements.hie
   # Expected: Pass
   ```

### Modifying Architecture

1. **Document in agent-changelog/**:
   ```markdown
   # Change: Add batch runner element
   
   ## hielements.hie changes
   - Add `batch_runner` element under implementation
   - Add connection to `engine.engine_api`
   
   ## Implementation
   - Create `src/batch/` folder
   - Implement BatchEngine trait
   ```

2. **Update hielements.hie**

3. **Implement changes**

4. **Run verification**:
   ```bash
   hielements run hielements.hie
   ```

## Integration with Development Tracks

| Track | Hielements Element | Key Checks |
|-------|-------------------|------------|
| Language Design | `language.brl`, `language.bcl` | Spec files exist |
| Compiler | `compiler` | Source compiles, IR valid |
| Core Engine | `engine` | Modules exist, tests pass |
| Browser Runtime | `browser_runtime` | Package.json valid, builds |
| Dev Tools | `devtools.lsp`, `devtools.vscode_extension` | Extensions work |

## Future Enhancements

As implementation progresses, add checks for:

```hielements
# Rust compilation checks
element engine:
    scope src = rust.crate_selector('blink-engine')
    check rust.compiles(src)
    check rust.has_tests(src)
    check rust.no_warnings(src)

# TypeScript checks  
element browser_runtime:
    scope src = typescript.project_selector('packages/blink-engine/')
    check typescript.compiles(src)
    check typescript.has_types(src)

# Cross-component checks
check compiler.ir_output.compatible_with(engine.ir_input)
check engine.engine_api.implemented_by(browser_runtime)
```

## Related Documents

- [Hielements Language Reference](language-reference.md)
- [Writing Hielements Specs](writing-specs.md)
- [Development Tracks](../DEVELOPMENT_TRACKS.md)
