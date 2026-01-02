#!/bin/bash
set -e

# Compile BRL files to IR if not already compiled or if BRL files are newer
echo "Checking BRL files..."
# Determine game directory (support mounted /workspace/game or plain /game)
if [ -d "/workspace/game" ]; then
    GAME_DIR="/workspace/game"
elif [ -d "/game" ]; then
    GAME_DIR="/game"
else
    GAME_DIR="/workspace/game"
fi

for brl_file in "$GAME_DIR"/brl/*.brl; do
    if [ -f "$brl_file" ]; then
        filename=$(basename "$brl_file" .brl)
        ir_file="$GAME_DIR/ir/${filename}.ir.json"
        
        # Check if IR file doesn't exist or if BRL file is newer
        if [ ! -f "$ir_file" ] || [ "$brl_file" -nt "$ir_file" ]; then
            echo "Compiling ${filename}.brl to IR..."
            blink-compiler compile -i "$brl_file" -o "$ir_file" --pretty
        else
            echo "IR file ${filename}.ir.json is up to date"
        fi
    fi
done

echo "BRL compilation complete!"
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
    cd /workspace/game/demos
    exec serve -l 3000 .
elif [ "$1" = "bash" ]; then
    exec /bin/bash
else
    exec "$@"
fi
