# Hielements Language Reference (Summary)

This document provides a condensed reference of the Hielements language for Blink developers. For the complete reference, see the [official documentation](https://github.com/ercasta/hielements/blob/main/doc/language_reference.md).

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Elements](#elements)
3. [Scopes](#scopes)
4. [Connection Points](#connection-points)
5. [Checks (Rules)](#checks-rules)
6. [Templates](#templates)
7. [Imports](#imports)
8. [Comments](#comments)
9. [CLI Commands](#cli-commands)

---

## 1. Core Concepts

Hielements defines software architecture using:

| Concept | Description |
|---------|-------------|
| **Element** | A logical component of your system |
| **Scope** | What code/artifacts belong to an element |
| **Connection Point** | APIs, interfaces, or dependencies exposed |
| **Check** | Rules that must be satisfied |
| **Template** | Reusable element patterns |

### How It Works

```
┌─────────────────────────────────────────┐
│          Hielements Spec (.hie)         │
└─────────────────────────────────────────┘
                    │
                    ▼
           ┌─────────────────┐
           │   Interpreter   │
           └─────────────────┘
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│  files   │  │  python  │  │  docker  │
│ library  │  │ library  │  │ library  │
└──────────┘  └──────────┘  └──────────┘
```

---

## 2. Elements

Elements are the fundamental building blocks representing logical components.

### Syntax

```hielements
element element_name:
    # scopes, connection points, checks, nested elements
```

### Basic Example

```hielements
element orders_service:
    scope src = files.folder_selector('src/orders')
    check files.contains(src, 'main.py')
```

### Nested Elements

```hielements
element ecommerce_platform:
    
    element orders_service:
        scope module = python.module_selector('services.orders')
        connection_point api = python.public_functions(module)
    
    element payments_service:
        scope module = python.module_selector('services.payments')
        connection_point api = python.public_functions(module)
    
    # Cross-service check
    check python.can_import(orders_service.module, payments_service.module)
```

### Element Semantics

- Each element defines a **boundary** around a logical component
- Elements can be **nested** to create hierarchies
- Element names must be **unique** within their scope
- Elements are evaluated **lazily**

---

## 3. Scopes

Scopes define what code or artifacts belong to an element.

### Syntax

```hielements
scope identifier = library.selector_function(arguments)
```

### Common Selectors

```hielements
# Files and folders
scope src = files.folder_selector('src/')
scope config = files.file_selector('config.yaml')
scope docs = files.glob_selector('**/*.md')

# Python
scope module = python.module_selector('mypackage.module')
scope tests = python.test_selector('tests/')

# Docker
scope dockerfile = docker.file_selector('Dockerfile')

# Rust
scope crate = rust.crate_selector('my_crate')
scope module = rust.module_selector('my_crate::module')
```

---

## 4. Connection Points

Connection points expose interfaces that other elements can reference.

### Syntax

```hielements
connection_point identifier = library.function(scope)
connection_point identifier: type = library.function(scope)
```

### Examples

```hielements
element api_server:
    scope api_module = python.module_selector('api')
    
    # Expose public functions as REST API
    connection_point rest_api = python.public_functions(api_module)
    
    # Expose database connection
    connection_point database = postgres.connection(config)
```

### Using Connection Points

```hielements
element client:
    # Reference another element's connection point
    check http.can_reach(api_server.rest_api)
```

---

## 5. Checks (Rules)

Checks enforce architectural rules.

### Syntax

```hielements
check library.check_function(arguments)
```

### File/Folder Checks

```hielements
# File exists
check files.exists(src, 'main.py')

# Folder contains file
check files.contains(folder, 'README.md')

# No files matching pattern
check files.no_files_matching(src, '*.tmp')

# File structure
check files.has_structure(src, ['__init__.py', 'main.py'])
```

### Python Checks

```hielements
# Function exists
check python.function_exists(module, 'handle_request')

# Has tests
check python.has_tests(module)

# No circular imports
check python.no_circular_imports(module)

# Has docstrings
check python.has_docstrings(module)
```

### Docker Checks

```hielements
# Base image
check docker.base_image(dockerfile, 'python:3.11-slim')

# Exposes port
check docker.exposes_port(dockerfile, 8080)

# Entry point
check docker.entry_point(dockerfile, main)
```

### Rust Checks

```hielements
# Compiles
check rust.compiles(crate)

# Has tests
check rust.has_tests(module)

# Struct exists
check rust.struct_exists(module, 'Timeline')
```

### Check Results

| Result | Meaning |
|--------|---------|
| ✅ Pass | Rule satisfied |
| ❌ Fail | Architectural violation |
| ⚠️ Warning | Non-blocking issue |
| ⏭️ Skip | Could not evaluate |

---

## 6. Templates

Templates define reusable element patterns.

### Defining Templates

```hielements
template microservice:
    element api:
        connection_point http_api
    
    element database:
        connection_point connection
    
    element config:
        scope config_file
    
    check files.exists(config.config_file)
```

### Implementing Templates

```hielements
element orders_service implements microservice:
    # Bind template elements to concrete implementations
    microservice.api.scope = python.module_selector('orders.api')
    microservice.api.http_api = python.flask_routes(microservice.api.scope)
    
    microservice.database.scope = sql.migration_selector('db/orders')
    microservice.database.connection = postgres.connection(config)
    
    microservice.config.config_file = files.file_selector('config/orders.yaml')
```

### Template Benefits

- Ensure consistency across similar components
- Make architectural patterns explicit
- Reduce duplication in specifications
- Enforce shared rules automatically

---

## 7. Imports

Imports bring libraries and specifications into scope.

### Built-in Libraries

```hielements
import files    # File and folder operations
import python   # Python code analysis
import docker   # Docker configuration
import rust     # Rust code analysis
```

### File Imports

```hielements
# Import another .hie file
import 'modules/backend.hie'

# Import with alias
import 'common/templates.hie' as templates
```

### External Libraries

Configure in `hielements.toml`:

```toml
[libraries]
mylibrary = { executable = "path/to/plugin" }
```

Then use:

```hielements
import mylibrary

element mycomponent:
    scope src = mylibrary.custom_selector('src')
    check mylibrary.custom_check(src)
```

---

## 8. Comments

### Single-line Comments

```hielements
# This is a comment
element my_service:  # Inline comment
    scope src = files.folder_selector('src/')
```

### Multi-line Comments

```hielements
###
This is a multi-line comment.
It can span multiple lines.
###
```

### Documentation Comments

```hielements
## Orders Service
## Handles all order-related operations including creation,
## modification, and fulfillment.
element orders_service:
    scope module = python.module_selector('orders')
```

---

## 9. CLI Commands

### Basic Commands

```bash
# Validate syntax (no execution)
hielements check architecture.hie

# Run all checks
hielements run architecture.hie

# Dry run (show what would be checked)
hielements run --dry-run architecture.hie

# JSON output
hielements check --format json architecture.hie

# SARIF output (for CI integration)
hielements check --format sarif architecture.hie
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (all checks passed) |
| 1 | Check failures (architectural violations) |
| 2 | Errors (syntax errors, missing files, etc.) |

---

## Appendix: Quick Reference Card

```hielements
# IMPORTS
import library_name
import 'path/to/file.hie'

# TEMPLATES
template template_name:
    element child_element:
        connection_point cp_name
    check some_check()

# ELEMENTS
element element_name implements template_name:
    # Scope: what belongs to this element
    scope name = library.selector('path')
    
    # Connection point: what this element exposes
    connection_point name = library.function(scope)
    
    # Check: rules to enforce
    check library.check_function(scope)
    
    # Nested element
    element child:
        scope child_scope = library.selector('child/path')

# COMMENTS
# Single line
## Doc comment (for element description)
### Multi-line ###
```

---

## Further Reading

- [Official Hielements Repository](https://github.com/ercasta/hielements)
- [Complete Language Reference](https://github.com/ercasta/hielements/blob/main/doc/language_reference.md)
- [Usage Guide](https://github.com/ercasta/hielements/blob/main/USAGE.md)
- [External Libraries Guide](https://github.com/ercasta/hielements/blob/main/doc/external_libraries.md)
