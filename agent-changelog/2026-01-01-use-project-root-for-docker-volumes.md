# 2026-01-01 - Use single PROJECT_ROOT for docker-compose volumes

Summary
- Reworked docker volume configuration to use a single `PROJECT_ROOT` environment variable.
- Updated `DOCKER.md` to document the `PROJECT_ROOT` usage and provide a `.env` example.

Files changed
- `docker-compose.yml` - now mounts host directories using `${PROJECT_ROOT:-.}/game/...` instead of multiple per-directory env vars.
- `DOCKER.md` - removed the per-directory env var docs and added the single `PROJECT_ROOT` section.

Rationale
- Simplifies configuration for contributors by centralizing the repository root path into a single variable.
- Keeps the shared `docker-compose.yml` file unchanged across machines while allowing different local checkout locations.

Notes
- Create a `.env` in the repository root with `PROJECT_ROOT=./` (or an absolute path on Windows).
- Restart containers after changing `.env`.
