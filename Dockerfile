# Multi-stage Dockerfile for Blink Idle RPG
# Stage 1: Build the Rust compiler
FROM rust:1.92 AS rust-builder

WORKDIR /build

# Copy only the compiler source
COPY src/compiler ./src/compiler

# Build the compiler in release mode
WORKDIR /build/src/compiler
RUN cargo build --release

# Stage 2: Build Node.js packages
FROM node:20 AS node-builder

WORKDIR /build

# Copy package files first for better layer caching
COPY packages/blink-engine/package*.json ./packages/blink-engine/
COPY packages/blink-test/package*.json ./packages/blink-test/

# Install dependencies
RUN cd packages/blink-engine && npm install
RUN cd packages/blink-test && npm install

# Copy source code and build
COPY packages/blink-engine ./packages/blink-engine
COPY packages/blink-test ./packages/blink-test

RUN cd packages/blink-engine && npm run build
RUN cd packages/blink-test && npm run build

# Stage 3: Runtime image
FROM node:20-slim

# Install serve for serving static files
RUN npm install -g serve

WORKDIR /app

# Copy built compiler from rust-builder
COPY --from=rust-builder /build/src/compiler/target/release/blink-compiler /usr/local/bin/

# Copy built packages
COPY --from=node-builder /build/packages ./packages

# Copy example files and demos
COPY examples ./examples
COPY Makefile ./

# Create directories for IR files if they don't exist
RUN mkdir -p examples/ir

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port for the web server
EXPOSE 3000

# Use the entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command: serve the demos
CMD ["serve"]
