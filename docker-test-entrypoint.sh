#!/usr/bin/env bash
set -euo pipefail

WORKSPACE=/workspace

echo "Preparing workspace: removing host node_modules and copying prebuilt node_modules..."

# Remove host node_modules for packages we manage
for pkg in blink-compiler-ts blink-engine blink-test; do
  if [ -d "$WORKSPACE/packages/$pkg/node_modules" ]; then
    rm -rf "$WORKSPACE/packages/$pkg/node_modules"
  fi
  if [ -d "/opt/node_modules/$pkg" ]; then
    mkdir -p "$WORKSPACE/packages/$pkg"
    cp -a "/opt/node_modules/$pkg" "$WORKSPACE/packages/$pkg/node_modules"
  fi
done

echo "Copying prebuilt bundles into workspace/game/demos (overwriting)..."
mkdir -p "$WORKSPACE/game/demos"
cp -a /opt/build_artifacts/demos/* "$WORKSPACE/game/demos/" 2>/dev/null || true

echo "Running tests via Makefile in workspace..."
cd "$WORKSPACE"
make test

echo "Container run complete."
