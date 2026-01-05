# 2026-01-05 - Replace hardcoded `sourceFiles` with minimal fallback

Summary:
- Replaced the large hardcoded `sourceFiles` object in `game/demos/rpg-demo.html` with a minimal runtime fallback containing short placeholder messages.
- This prevents runtime ReferenceErrors when IR does not include `source_map`, while keeping `loadSourceFilesFromIR()` responsible for populating `sourceFiles` when available.

Files changed:
- `game/demos/rpg-demo.html` - removed hardcoded BRL/BCL/BDL source blobs and added minimal placeholders.

Rationale:
- The demo previously embedded large sample source text which is unnecessary at runtime and duplicates source maintained in the compiler/repo.
- Removing the large blob reduces page size and avoids stale content; a minimal fallback ensures code that references `sourceFiles` won't throw if `IR.source_map` is missing.

How to verify:
1. Run `make compile-brl` (after building the compiler) to produce `game/ir/classic-rpg.ir.json` with `source_map`.
2. Open `game/demos/rpg-demo.html` in a browser and enable Dev Mode — the source viewer should show IR-provided source when `source_map` is present; otherwise it will show the placeholder message.
