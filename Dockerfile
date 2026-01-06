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

# Copy source code and build
COPY packages/blink-engine ./packages/blink-engine
COPY packages/blink-test ./packages/blink-test
COPY packages/blink-compiler-ts ./packages/blink-compiler-ts

RUN cd packages/blink-engine && npm run build && npm run build:bundle
RUN cd packages/blink-test && npm run build
RUN cd packages/blink-compiler-ts && npm run build && npm run build:bundle

# Stage 2: Runtime image
FROM node:20-slim

# Install serve for serving static files
RUN npm install -g serve

WORKDIR /workspace

# Copy built packages from node-builder
COPY --from=node-builder /build/packages ./packages

# Copy example files and demos
COPY game ./game
COPY Makefile ./

# Copy compiled bundles to demos directory
RUN mkdir -p game/demos && \
    cp packages/blink-engine/dist/blink-engine.bundle.js game/demos/ && \
    cp packages/blink-compiler-ts/dist/blink-compiler.bundle.js game/demos/

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port for the web server
EXPOSE 3000

# Use the entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command: serve the demos
CMD ["serve"]
