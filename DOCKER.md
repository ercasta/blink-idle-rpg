# Docker Setup for Blink Idle RPG

This guide explains how to build and run Blink Idle RPG using Docker, allowing you to run the entire project in a container without installing Rust, Node.js, or other dependencies on your host machine.

> **Note:** The Docker setup has been designed and validated structurally, but could not be fully tested in the CI environment due to SSL certificate issues with external package registries (crates.io and npmjs.org). The setup should work correctly in normal development environments with proper network access. If you encounter issues, please see the Troubleshooting section below.

## Quick Start

### Prerequisites

- Docker Engine (20.10.0 or later)
- Docker Compose (2.0.0 or later) - included with Docker Desktop

Install Docker Desktop from [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

**Note:** Modern Docker installations include Docker Compose as a plugin. Use `docker compose` (with a space) instead of `docker-compose` (with a hyphen) if you have the newer version.

### Running with Docker Compose (Recommended)

The easiest way to get started:

```bash
# Build and start the container
docker-compose up --build

# The server will start and be available at http://localhost:3000
```

Open your browser and navigate to:
- **http://localhost:3000** - Demo launcher (start here!)
- **http://localhost:3000/classic-rpg.html** - Classic RPG demo

To stop the container:
```bash
# Press Ctrl+C, then run:
docker-compose down
```

### Running with Docker CLI

If you prefer to use Docker directly:

```bash
# Build the image
docker build -t blink-idle-rpg .

# Run the container
docker run -p 3000:3000 \
  -v $(pwd)/game/brl:/workspace/game/brl \
  -v $(pwd)/game/bcl:/workspace/game/bcl \
  -v $(pwd)/game/ir:/workspace/game/ir \
  -v $(pwd)/game/demos:/workspace/game/demos \
  blink-idle-rpg

# Access the demos at http://localhost:3000
```

## Volume Mapping (Host Folder Mapping)

The Docker setup uses volume mapping to allow you to edit game files on your host machine while the container is running. Any changes you make will be automatically reflected when you refresh the browser.

### Mapped Directories

| Host Directory | Container Directory | Purpose |
|---------------|---------------------|---------|
| `./game/brl` | `/workspace/game/brl` | **BRL files** - Edit game rules and logic |
| `./game/bcl` | `/workspace/game/bcl` | **BCL files** - Edit player AI strategies |
| `./game/ir` | `/workspace/game/ir` | **IR files** - View compiled game rules |
| `./game/demos` | `/workspace/game/demos` | **Demo HTML/JS** - Modify demo pages |

### How to Edit Files

1. **Start the Docker container** using `docker-compose up` or `docker run`
2. **Edit BRL or BCL files** on your host machine using your favorite text editor:
   - Edit files in `./game/brl/` (e.g., `simple-combat.brl`)
   - Edit files in `./game/bcl/` (e.g., `warrior-skills.bcl`)
3. **Recompile** the BRL files:
   ```bash
   # Execute a command in the running container
  docker-compose exec blink-app blink-compiler compile -i /workspace/game/brl/simple-combat.brl -o /workspace/game/ir/simple-combat.ir.json --pretty
   ```
   
   Or compile all BRL files at once:
   ```bash
  docker-compose exec blink-app bash -c 'for f in /workspace/game/brl/*.brl; do blink-compiler compile -i "$f" -o "/workspace/game/ir/$(basename "$f" .brl).ir.json" --pretty; done'
   ```

4. **Refresh your browser** to see the changes

### Customizing Volume Paths (single project root)

Instead of setting multiple host paths, you can define a single `PROJECT_ROOT` environment variable that points to the repository root (or any folder containing the `game/` subfolder). The compose file derives the individual mounts from this root, so you don't need to edit `docker-compose.yml`.

Create a `.env` file in the repository root with:

```
# Path to the project root containing the `game/` folder. Default is the compose directory (.)
PROJECT_ROOT=./

# Example: on Windows use an absolute path
# PROJECT_ROOT=C:/Users/you/path/to/blink-idle-rpg
```

Notes:
- Docker Compose automatically loads a `.env` file located next to `docker-compose.yml`. You can also export `PROJECT_ROOT` in your shell before running `docker compose up`.
- On Windows, prefer using absolute paths (e.g. `C:/path/to/repo`) to avoid path-translation issues.
- After changing `.env`, restart the containers:

```bash
docker-compose down
docker-compose up --build
```

Using `PROJECT_ROOT` keeps the shared `docker-compose.yml` unchanged across contributors while letting each user point to their preferred local checkout path.

### Example Workflow

Here's a complete example of modifying a game rule:

```bash
# 1. Start the container
docker-compose up -d

# 2. Edit simple-combat.brl on your host machine
# (Use any text editor to modify ./game/brl/simple-combat.brl)

# 3. Recompile the BRL file
  docker-compose exec blink-app blink-compiler compile \
  -i /workspace/game/brl/simple-combat.brl \
  -o /workspace/game/ir/simple-combat.ir.json \
  --pretty

# 4. Open http://localhost:3000/classic-rpg.html in your browser
# 5. Refresh the page to see your changes

# 6. When done, stop the container
docker-compose down
```

## Container Commands

The Docker setup supports multiple commands:

### Serve the Demos (Default)

```bash
docker-compose up
# or
docker run -p 3000:3000 blink-idle-rpg serve
```

This starts a web server on port 3000 serving the demo files.

### Interactive Bash Shell

```bash
# Start a bash shell in a new container
docker run -it --rm \
  -v $(pwd)/examples:/workspace/examples \
  blink-idle-rpg bash

# Or connect to a running container
docker-compose exec blink-app bash
```

Once inside, you can:
- Run `blink-compiler compile -i /workspace/game/brl/simple-combat.brl -o /workspace/game/ir/simple-combat.ir.json --pretty`
- Explore the filesystem
- Debug compilation issues

### Compile BRL Files Only

```bash
# Compile a specific BRL file
  docker-compose exec blink-app blink-compiler compile \
  -i /workspace/game/brl/simple-combat.brl \
  -o /workspace/game/ir/simple-combat.ir.json \
  --pretty

# Compile all BRL files
  docker-compose exec blink-app bash -c \
  'for f in /workspace/game/brl/*.brl; do \
    blink-compiler compile -i "$f" -o "/workspace/game/ir/$(basename "$f" .brl).ir.json" --pretty; \
  done'
```

## Build Process

The Docker image is built in three stages for optimal size and build caching:

### Stage 1: Rust Builder
- Uses `rust:1.92` base image
- Builds the BRL compiler (`blink-compiler`) from source
- Only the compiled binary is carried forward

### Stage 2: Node.js Builder
- Uses `node:20` base image
- Installs npm dependencies for `blink-engine` and `blink-test` packages
- Builds TypeScript packages
- Only the built packages are carried forward

### Stage 3: Runtime Image
- Uses `node:20-slim` base image (smaller)
- Includes only the compiler binary and built packages
- Installs `serve` for the web server
- Copies example files and demos
- Total image size: ~300-400MB

## Automatic BRL Compilation

When the container starts, the `docker-entrypoint.sh` script automatically:

1. **Checks all BRL files** in `/workspace/examples/brl/`
2. **Compiles modified BRL files** to IR if:
   - The IR file doesn't exist, OR
   - The BRL file is newer than the IR file
3. **Skips unchanged files** for faster startup

This means if you modify a BRL file and restart the container, it will automatically recompile.

## Troubleshooting

### Docker Build Fails with SSL/Network Errors

If `docker build` fails with errors like "SSL certificate problem" or "failed to download from crates.io", this is usually due to network restrictions or proxy issues in certain environments (CI/CD, corporate networks, etc.).

**Workaround:** Use the pre-built compiler script:

```bash
# Build the compiler locally first, then build Docker image with it
./docker-build-with-prebuilt.sh
```

This script:
1. Builds the Rust compiler locally on your machine
2. Creates a Docker image that copies the pre-built binary instead of building in Docker
3. Completes the rest of the Docker build normally

**Alternative Workaround:** If you have a working network connection but Docker doesn't, you can:

```bash
# Build TypeScript compiler locally
cd packages/blink-compiler-ts && npm install && npm run build && cd ../..

# Create a simple Dockerfile that uses pre-built binary
# (See docker-build-with-prebuilt.sh for an example)
```

### Port Already in Use

If port 3000 is already in use on your host:

```bash
# Use a different port (e.g., 8080)
docker run -p 8080:3000 blink-idle-rpg
# Access at http://localhost:8080
```

Or edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Change 8080 to your preferred port
```

### BRL Files Not Compiling

If you edit a BRL file but changes aren't reflected:

1. **Check the file was saved** on your host machine
2. **Manually recompile** in the container:
   ```bash
   docker-compose exec blink-app blink-compiler compile \
    -i /workspace/examples/brl/YOUR_FILE.brl \
    -o /workspace/examples/ir/YOUR_FILE.ir.json \
     --pretty
   ```
3. **Check for compilation errors** in the output
4. **Refresh your browser** (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)

### Container Won't Start

```bash
# Check Docker is running
docker ps

# View container logs
docker-compose logs

# Rebuild the image from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Viewing Logs

```bash
# Follow logs in real-time
docker-compose logs -f

# View logs for a specific service
docker-compose logs blink-app
```

## Advanced Usage

### Building for Production

```bash
# Build optimized image
docker build -t blink-idle-rpg:latest .

# Run without volume mounts (uses files baked into image)
docker run -p 3000:3000 blink-idle-rpg:latest
```

### Running Multiple Instances

```bash
# Instance 1 on port 3000
docker run -d --name blink-1 -p 3000:3000 blink-idle-rpg

# Instance 2 on port 3001 with different BRL files
docker run -d --name blink-2 -p 3001:3000 \
  -v $(pwd)/custom-brl:/workspace/examples/brl \
  blink-idle-rpg
```

### Custom Dockerfile Location

```bash
# Build from a different location
docker build -f /path/to/Dockerfile -t blink-idle-rpg .
```

## Docker Image Size

The multi-stage build keeps the image reasonably sized:

- **Rust builder stage**: ~1.5GB (not in final image)
- **Node builder stage**: ~1.2GB (not in final image)
- **Final runtime image**: ~300-400MB

To check the actual size:
```bash
docker images blink-idle-rpg
```

## Cleanup

### Remove Containers and Images

```bash
# Stop and remove containers
docker-compose down

# Remove the image
docker rmi blink-idle-rpg

# Remove all unused Docker resources
docker system prune -a
```

## Comparison with Local Development

| Feature | Docker | Local Development |
|---------|--------|-------------------|
| **Setup Time** | 5-10 minutes (first build) | 15-30 minutes (install tools) |
| **Dependencies** | Only Docker required | Node.js, npm |
| **Isolation** | Fully isolated | Uses system tools |
| **Reproducibility** | Identical on all machines | May vary by system |
| **Performance** | ~5-10% slower | Native speed |
| **File Editing** | Host machine (via volumes) | Host machine |
| **Best For** | Quick demos, testing, CI/CD | Active development |

## Next Steps

- [Read the main README](README.md) for project overview
- [View BRL User Guide](doc/language/brl-user-guide.md) to learn the language
- [View BCL User Guide](doc/language/bcl-user-guide.md) to create AI strategies
- [Check the demos README](examples/demos/README.md) for demo details

## Support

If you encounter issues with the Docker setup:

1. Check this documentation for troubleshooting steps
2. View container logs: `docker-compose logs`
3. Try rebuilding: `docker-compose build --no-cache`
4. Open an issue on GitHub with:
   - Your Docker version (`docker --version`)
   - Error messages from logs
   - Steps to reproduce
