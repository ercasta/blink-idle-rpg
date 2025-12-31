# Writing Hielements Specifications

This guide covers best practices for writing and maintaining Hielements specifications for the Blink project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Naming Conventions](#naming-conventions)
3. [Organizing Specifications](#organizing-specifications)
4. [Writing Effective Checks](#writing-effective-checks)
5. [Using Templates](#using-templates)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

---

## 1. Getting Started

### Prerequisites

1. Install Hielements:
   ```bash
   cargo install hielements
   ```

2. Install VS Code extension (optional but recommended):
   - Search "Hielements" in VS Code extensions
   - Or build from source: `ercasta/hielements/vscode-extension`

### Your First Edit

1. Open `hielements.hie` at the project root
2. Find the element you want to modify
3. Make your changes
4. Run validation:
   ```bash
   hielements check hielements.hie
   ```

### File Structure

```
blink-idle-rpg/
├── hielements.hie          # Main architecture specification
├── hielements.toml         # Configuration (if needed)
├── doc/
│   └── hie/                # Hielements documentation
├── src/                    # Source code
└── agent-changelog/        # Change documentation
```

---

## 2. Naming Conventions

### Elements

Use `snake_case` for element names:

```hielements
# ✅ Good
element browser_runtime:
element orders_service:
element payment_gateway:

# ❌ Bad
element BrowserRuntime:
element orders-service:
element PaymentGateway:
```

### Scopes

Name scopes after what they select:

```hielements
# ✅ Good - descriptive
scope rust_src = rust.module_selector('src/engine')
scope spec_file = files.file_selector('doc/spec.md')
scope test_folder = files.folder_selector('tests/')

# ❌ Bad - vague
scope s = rust.module_selector('src/engine')
scope f = files.file_selector('doc/spec.md')
scope x = files.folder_selector('tests/')
```

### Connection Points

Name after what they expose:

```hielements
# ✅ Good
connection_point rest_api = python.public_functions(api_module)
connection_point ir_output = compiler.intermediate_rep(src)
connection_point database_connection = postgres.connection(config)

# ❌ Bad
connection_point cp1 = python.public_functions(api_module)
connection_point output = compiler.intermediate_rep(src)
```

---

## 3. Organizing Specifications

### Single File vs Multiple Files

**Single File** (current approach for Blink):
- Good for projects under active initial development
- Easier to understand at a glance
- All architecture in one place

**Multiple Files** (for larger projects):
```
architecture/
├── main.hie              # Top-level elements
├── documentation.hie     # Doc structure
├── implementation.hie    # Code structure
└── templates.hie         # Reusable patterns
```

Import in main file:
```hielements
import 'architecture/documentation.hie'
import 'architecture/implementation.hie'
import 'architecture/templates.hie' as templates
```

### Element Hierarchy

Structure elements to match logical architecture:

```hielements
element blink_project:
    
    # Group 1: Documentation
    element documentation:
        element language_docs:
        element engine_docs:
    
    # Group 2: Language
    element language:
        element brl:
        element bcl:
    
    # Group 3: Implementation
    element compiler:
    element engine:
        element timeline:
        element ecs:
    element browser_runtime:
```

### Comment Groups

Use comments to create visual sections:

```hielements
element blink_project:
    
    ## ========================================
    ## DOCUMENTATION
    ## ========================================
    
    element documentation:
        # ...
    
    ## ========================================
    ## IMPLEMENTATION
    ## ========================================
    
    element implementation:
        # ...
```

---

## 4. Writing Effective Checks

### Start Simple

Begin with existence checks:

```hielements
element my_component:
    scope src = files.folder_selector('src/my_component/')
    
    # Start with basic existence
    check files.exists(src)
    check files.exists(src, 'mod.rs')
```

### Add Structural Checks

Once stable, add structure requirements:

```hielements
element my_component:
    scope src = files.folder_selector('src/my_component/')
    
    # Required files
    check files.exists(src, 'mod.rs')
    check files.exists(src, 'lib.rs')
    
    # Required structure
    check files.has_structure(src, [
        'mod.rs',
        'types.rs',
        'impl.rs'
    ])
```

### Add Quality Checks

When implementation is mature:

```hielements
element my_component:
    scope src = rust.module_selector('my_component')
    
    # Compilation
    check rust.compiles(src)
    
    # Testing
    check rust.has_tests(src)
    
    # Quality
    check rust.no_warnings(src)
    check rust.has_docs(src)
```

### Relationship Checks

Define how components interact:

```hielements
element system:
    element producer:
        connection_point output
    
    element consumer:
        connection_point input
    
    # Relationship check
    check producer.output.compatible_with(consumer.input)
```

---

## 5. Using Templates

### When to Use Templates

Use templates when you have multiple similar components:

```hielements
# Without template - repetitive
element service_a:
    scope src = files.folder_selector('services/a/')
    scope config = files.file_selector('services/a/config.yaml')
    check files.exists(src, 'main.py')
    check files.exists(config)

element service_b:
    scope src = files.folder_selector('services/b/')
    scope config = files.file_selector('services/b/config.yaml')
    check files.exists(src, 'main.py')
    check files.exists(config)
```

### Define Template

```hielements
## Microservice Template
## Standard structure for all microservices
template microservice:
    element source:
        scope src
        check files.exists(src, 'main.py')
    
    element configuration:
        scope config
        check files.exists(config)
```

### Implement Template

```hielements
element service_a implements microservice:
    microservice.source.src = files.folder_selector('services/a/')
    microservice.configuration.config = files.file_selector('services/a/config.yaml')

element service_b implements microservice:
    microservice.source.src = files.folder_selector('services/b/')
    microservice.configuration.config = files.file_selector('services/b/config.yaml')
```

### Blink-Specific Templates

Consider templates for:

```hielements
## Rust Crate Template
template rust_crate:
    scope src
    check rust.compiles(src)
    check rust.has_tests(src)

## Documentation Section Template
template doc_section:
    scope folder
    check files.exists(folder, 'README.md')

## Apply to Blink components
element compiler implements rust_crate:
    rust_crate.src = rust.crate_selector('blink-compiler')

element engine implements rust_crate:
    rust_crate.src = rust.crate_selector('blink-engine')
```

---

## 6. Common Patterns

### Documentation Pattern

```hielements
element documentation:
    scope docs = files.folder_selector('doc/')
    
    # Must have index
    check files.exists(docs, 'README.md')
    
    # Must have summary
    check files.exists(docs, 'summary.md')
    
    # Subsection pattern
    element subsection:
        scope folder = files.folder_selector('doc/subsection/')
        check files.exists(folder, 'README.md')
```

### Rust Project Pattern

```hielements
element rust_project:
    scope root = files.folder_selector('.')
    
    check files.exists(root, 'Cargo.toml')
    check files.exists(root, 'src/lib.rs')
    
    element src:
        scope src = rust.crate_selector('my_crate')
        check rust.compiles(src)
    
    element tests:
        scope tests = files.folder_selector('tests/')
        check rust.tests_pass(tests)
```

### Multi-Package Pattern (Monorepo)

```hielements
element monorepo:
    scope packages = files.folder_selector('packages/')
    
    element package_a:
        scope pkg = files.folder_selector('packages/a/')
        check files.exists(pkg, 'package.json')
    
    element package_b:
        scope pkg = files.folder_selector('packages/b/')
        check files.exists(pkg, 'package.json')
    
    # Cross-package dependency check
    check npm.valid_workspace_deps(packages)
```

### Feature Flag Pattern

Use comments to mark future checks:

```hielements
element engine:
    scope src = rust.crate_selector('blink-engine')
    
    # Current checks
    check files.exists(src, 'Cargo.toml')
    
    # TODO: Enable when implementation starts
    # check rust.compiles(src)
    # check rust.has_tests(src)
    # check rust.test_coverage(src, 80)
```

---

## 7. Troubleshooting

### Common Errors

#### E001: Undefined element

```
Error E001: Undefined element 'foo'
```

**Fix**: Check spelling and ensure element is defined before reference.

#### E007: Scope resolution failed

```
Error E007: Scope resolution failed for 'src/missing/'
```

**Fix**: Verify the path exists or adjust the selector.

#### Check failed

```
Check failed: files.exists(src, 'main.py')
```

**Fix**: Either create the missing file or update the check.

### Debugging Tips

1. **Use dry-run**:
   ```bash
   hielements run --dry-run hielements.hie
   ```

2. **Check specific element**:
   ```bash
   hielements check hielements.hie --element engine
   ```

3. **Verbose output**:
   ```bash
   hielements check -v hielements.hie
   ```

4. **JSON output for parsing**:
   ```bash
   hielements check --format json hielements.hie
   ```

### Performance Tips

- Use specific selectors over broad globs
- Split large specs into multiple files
- Cache results in CI/CD pipelines

---

## Checklist for New Specifications

When adding a new element:

- [ ] Follow naming conventions (snake_case)
- [ ] Add documentation comment (`## Description`)
- [ ] Define scope(s) clearly
- [ ] Start with existence checks
- [ ] Define connection points if others depend on this
- [ ] Add to parent element hierarchy
- [ ] Run `hielements check` before committing
- [ ] Document in `agent-changelog/` if significant

---

## Further Reading

- [Blink Architecture Specification](blink-architecture.md)
- [Hielements Language Reference](language-reference.md)
- [Official Hielements Usage Guide](https://github.com/ercasta/hielements/blob/main/USAGE.md)
