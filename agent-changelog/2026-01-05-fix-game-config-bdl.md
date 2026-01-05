# 2026-01-05 - Fix `game-config.bdl` entity declarations

Summary:
- Converted anonymous `entity { ... }` declarations in `game/bdl/game-config.bdl` into named assignments using the `variable = new entity { ... }` form.
- Variable names used: `game_state`, `run_stats`, `flee_config`, `spawn_config`, `enemy_compendium`.

Why:
- The `new entity` assignment form provides stable identifiers useful for IR generation and tooling, and aligns with compiler examples and tests.

Files changed:
- `game/bdl/game-config.bdl`

Verification:
- The file now uses `variable = new entity { ... }` and should parse with the compiler's BDL parser.
- To verify, run the compiler to compile BRL/BDL to IR and ensure no parse errors:

```bash
make build-compiler
make compile-brl
```

If parsing still fails, please paste the compiler error and I will iterate further.
