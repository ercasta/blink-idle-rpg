# Development instructions

## Change planning and execution
- The system is documented using the Hielements Language from ercasta/hielements Github repository
- Read doc/hie folder to get and understanding of the system
- Plan for changes by defining what changes are needed to hielements.hie. Track these in a separate file in "agent-changelog" folder (1 file per each request)
- Change hielements accordingly
- Implement the changes
- Run Hielements checks to ensure alignment

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
