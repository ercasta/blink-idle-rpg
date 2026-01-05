# 2026-01-05 - Remove hardcoded `sourceFiles` fallback

Summary:
- Replaced the large hardcoded `sourceFiles` object in `game/demos/rpg-demo.html` with minimal empty strings for `brl`, `bcl`, and `bdl`.
- Rationale: avoid keeping large stale source blobs in the demo HTML while preserving runtime safety (code still expects `sourceFiles` to exist).

Files changed:
- `game/demos/rpg-demo.html` - removed large embedded BRL/BCL/BDL content and left `sourceFiles` as empty strings; `loadSourceFilesFromIR()` remains responsible for populating the source viewer when `IR.source_map` is present.

Verification:
1. Run `make compile-brl` to generate `game/ir/classic-rpg.ir.json` with `source_map`.
2. Open the demo and enable Dev Mode; the source viewer will show IR-provided files when available.

Notes:
- I intentionally left `sourceFiles` properties present as empty strings to avoid runtime errors in code paths that access `sourceFiles.brl` directly. If you want stricter guards, I can add defensive checks where `sourceFiles` is accessed instead.
