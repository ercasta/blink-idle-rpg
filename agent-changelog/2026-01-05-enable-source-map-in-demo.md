# 2026-01-05 - Enable source_map in demo build and update demo UI

Summary:
- Enabled passing `--source-map` from the local `Makefile` when compiling the `classic-rpg` BRL to IR so that `IR.source_map` is produced for dev tools.
- Removed a stale comment in `game/demos/rpg-demo.html` and replaced it with a short note stating that `IR.source_map` will populate the dev-mode source viewer when present.

Files changed:
- `Makefile` - Added `SOURCE_MAP_FLAG` variable and used it when compiling `classic-rpg` to include source maps in the IR output.
- `game/demos/rpg-demo.html` - Updated comment near `sourceFiles` declaration to remove stale note.

Notes / Next steps:
- CI workflows already use `--source-map` (see `.github/workflows/*`), so enabling it in the local `Makefile` aligns local builds with CI.
- To produce IR with embedded source files, run:

```bash
make build-compiler
make compile-brl
```

- Verify that `game/ir/classic-rpg.ir.json` contains a `source_map.files` array with `{path, language, content}` entries. If not present, re-run the compiler with explicit `--source-map` in your build command.

Signed-off-by: agent
