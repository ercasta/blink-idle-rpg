#!/usr/bin/env bash
set -euo pipefail

WORKSPACE=/workspace
PACKAGES=(packages/blink-compiler-ts packages/blink-engine packages/blink-test)

echo "Workspace mounted at $WORKSPACE"

cd "$WORKSPACE"

# Use container-local npm cache (mounted via volume) to speed repeated installs
echo "Installing package dependencies (will skip if already up-to-date)..."
for pkg in "${PACKAGES[@]}"; do
  if [ -d "$WORKSPACE/$pkg" ]; then
    echo "-- processing $pkg"
    pushd "$WORKSPACE/$pkg" > /dev/null
    if [ -f package-lock.json ]; then
      npm ci --no-audit --no-fund --prefer-offline
    else
      npm install --no-audit --no-fund --prefer-offline
    fi
    popd > /dev/null
  else
    echo "-- package $pkg not found in workspace, skipping"
  fi
done

echo "Running tests via Makefile in workspace..."
make test

echo "Container run complete."

# Run additional verification script if present
if [ -f "$WORKSPACE/tools/verify-integer.js" ]; then
  echo "Running integer verification script..."
  node "$WORKSPACE/tools/verify-integer.js"
  echo "Integer verification complete."
fi
