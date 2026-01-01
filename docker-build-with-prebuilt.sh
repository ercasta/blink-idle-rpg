#!/bin/bash
# Helper script to build the Docker image with pre-built compiler
# This is useful if the Docker build fails due to network issues with cargo

set -e

echo "=== Building Blink Compiler Locally ==="
cd src/compiler
cargo build --release
cd ../..

echo ""
echo "=== Creating temporary .dockerignore for pre-built compiler ==="
# Backup existing .dockerignore
if [ -f .dockerignore ]; then
    mv .dockerignore .dockerignore.backup
fi

cat > .dockerignore << 'EOF'
# Rust source (we're using pre-built binary)
**/*.rs.bk
Cargo.lock

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Build outputs (except release binary we need)
dist/
build/
src/compiler/target/debug/

# Git
.git/
.gitignore

# CI/CD
.github/

# Documentation (not needed in image)
doc/
CHANGELOG.md
RELEASE_NOTES.md
LICENSE

# Demo package artifacts
demo-package/
*.zip
EOF

echo ""
echo "=== Creating temporary Dockerfile with pre-built compiler ==="
cat > Dockerfile.prebuilt << 'EOF'
# Dockerfile using pre-built compiler
# Use this if the main Dockerfile fails due to network issues

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

# Runtime image
FROM node:20-slim

# Install serve for serving static files
RUN npm install -g serve

WORKDIR /workspace

# Copy pre-built compiler from host
COPY src/compiler/target/release/blink-compiler /usr/local/bin/

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
EOF

echo ""
echo "=== Building Docker image with pre-built compiler ==="
docker build --file Dockerfile.prebuilt --tag blink-idle-rpg --no-cache .

echo ""
echo "=== Cleaning up temporary files ==="
rm Dockerfile.prebuilt
if [ -f .dockerignore.backup ]; then
    mv .dockerignore.backup .dockerignore
fi

echo ""
echo "✅ Docker image 'blink-idle-rpg' built successfully!"
echo ""
echo "Run with: docker-compose up"
echo "Or:       docker run -p 3000:3000 -v \$(pwd)/examples/brl:/workspace/examples/brl -v \$(pwd)/examples/bcl:/workspace/examples/bcl -v \$(pwd)/examples/ir:/workspace/examples/ir blink-idle-rpg"
