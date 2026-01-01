# 2026-01-01 - Externalize docker-compose volume mappings

Summary
- Replaced hardcoded host paths in `docker-compose.yml` with environment-variable-driven mappings.
- Documented how to override mappings in `DOCKER.md` using a `.env` file or shell environment variables.

Files changed
- `docker-compose.yml` - now uses `${BRL_DIR:-./examples/brl}`, `${BCL_DIR:-./examples/bcl}`, `${IR_DIR:-./examples/ir}`, `${DEMOS_DIR:-./examples/demos}` and adds `env_file: .env`.
- `DOCKER.md` - added `Customizing Volume Paths` section with `.env` example and notes for Windows users.

Rationale
- Avoid committing machine-specific absolute paths into version-controlled compose files.
- Let each contributor define their preferred host directories without editing a shared file.

Notes
- Docker Compose automatically loads `.env` from the compose file directory; you can also export the variables in your shell before running the compose commands.
