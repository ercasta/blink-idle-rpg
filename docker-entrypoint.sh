#!/bin/bash
set -e

# Docker entrypoint for Blink Idle RPG
# Note: BRL compilation happens in the browser using the TypeScript compiler
# The docker container serves the demos and pre-built bundles

echo "Starting Blink Idle RPG Docker container..."
echo ""

# Execute the provided command
if [ "$1" = "serve" ]; then
    echo "Starting web server on port 3000..."
    echo "Access the demos at http://localhost:3000"
    echo ""
    echo "Available demos:"
    echo "  - http://localhost:3000/index.html (Demo launcher - start here!)"
    echo "  - http://localhost:3000/rpg-demo.html (Classic RPG)"
    echo ""
    echo "The demos use the TypeScript compiler to compile BRL/BDL files in the browser."
    echo ""
    cd /workspace/game/demos
    exec serve -l 3000 .
elif [ "$1" = "bash" ]; then
    exec /bin/bash
else
    exec "$@"
fi
