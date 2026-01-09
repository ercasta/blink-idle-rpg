# Multi-stage Dockerfile for Blink Idle RPG
# Stage 1: Build Node.js packages and TypeScript compiler
FROM node:20 AS node-builder

WORKDIR /build

# Copy package files first for better layer caching
COPY packages/blink-engine/package*.json ./packages/blink-engine/
COPY packages/blink-test/package*.json ./packages/blink-test/
COPY packages/blink-compiler-ts/package*.json ./packages/blink-compiler-ts/

# Install dependencies
RUN cd packages/blink-engine && npm install
RUN cd packages/blink-test && npm install
RUN cd packages/blink-compiler-ts && npm install

# Copy source code
COPY packages/blink-engine ./packages/blink-engine
COPY packages/blink-test ./packages/blink-test
COPY packages/blink-compiler-ts ./packages/blink-compiler-ts

# Create game/demos directory for bundles
RUN mkdir -p game/demos

# Build packages (bundles will be created in game/demos)
RUN cd packages/blink-engine && npm run build && npm run build:bundle
RUN cd packages/blink-test && npm run build
RUN cd packages/blink-compiler-ts && npm run build && npm run build:bundle

# Verify bundles were produced during the build stage (fail fast with diagnostic output)
RUN if [ -f game/demos/blink-engine.bundle.js ] && [ -f game/demos/blink-compiler.bundle.js ]; then \
			echo "OK: bundles present:" && ls -lh game/demos; \
		else \
			echo "ERROR: expected bundles not found in /build/game/demos"; \
			echo "Contents of /build/game/demos:"; ls -la game/demos || true; \
			echo "Listing /build/packages for debugging:"; ls -la packages || true; \
			false; \
		fi

# Stage 2: Runtime image
FROM node:20-slim

# Install serve for serving static files
RUN npm install -g serve

WORKDIR /workspace

# Copy built packages from node-builder
COPY --from=node-builder /build/packages ./packages

# Copy example files and demos from the repository first
COPY game ./game

# Then copy bundles that were created during build into the repo game/demos
# This ensures the repo's game/ copy does not overwrite the generated bundles.
COPY --from=node-builder /build/game/demos/blink-engine.bundle.js ./game/demos/
COPY --from=node-builder /build/game/demos/blink-compiler.bundle.js ./game/demos/
COPY Makefile ./

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port for the web server
EXPOSE 3000

# Use the entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command: serve the demos
CMD ["serve"]
