# Development instructions

## Pre-submission Build Checks

**ALWAYS** run these checks before submitting a PR to ensure the build passes:

1. **Build the compiler:**
   ```bash
   make build-compiler
   ```

2. **Build the packages:**
   ```bash
   make install-packages
   make build-packages
   ```

3. **Compile BRL to IR:**
   ```bash
   make compile-brl
   ```

4. **Test the demo package creation:**
   ```bash
   make demo-package
   ```

5. **Run tests:**
   ```bash
   make test
   ```

All commands must complete successfully before submitting a PR. This ensures CI/CD workflows will pass and prevents build failures.

## Language Compilation Test Suite

After making changes to the compiler, run the language compilation test suite:

```bash
cd src/compiler
cargo test --test language_tests
```

This test suite validates:
- Component definitions
- Rule definitions and triggers
- Function definitions
- Tracker definitions
- Entity syntax (new and legacy)
- `entities having` expressions
- Bound choice functions
- Composite types
- Control flow (if/else, for loops)
- Expressions (binary, unary, field access, index access, function calls)
- Statement types (let, schedule, create, delete)
- Assignment operators

All tests must pass before changes to the compiler are committed.
