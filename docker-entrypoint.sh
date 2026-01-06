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
        
        # Special handling for classic-rpg which needs includes and multiple scenario variants
        if [ "$filename" = "classic-rpg" ]; then
            # Compile with Easy scenario
            ir_file="$GAME_DIR/ir/${filename}-easy.ir.json"
            if [ ! -f "$ir_file" ] || [ "$brl_file" -nt "$ir_file" ]; then
                echo "Compiling ${filename}.brl (Easy scenario)..."
                blink-compiler compile -i "$brl_file" -o "$ir_file" --pretty \
                    --include "$GAME_DIR/bdl/heroes.bdl" \
                    --include "$GAME_DIR/bdl/enemies.bdl" \
                    --include "$GAME_DIR/bdl/scenario-easy.bdl"
            else
                echo "IR file ${filename}-easy.ir.json is up to date"
            fi
            
            # Compile with Normal scenario
            ir_file="$GAME_DIR/ir/${filename}-normal.ir.json"
            if [ ! -f "$ir_file" ] || [ "$brl_file" -nt "$ir_file" ]; then
                echo "Compiling ${filename}.brl (Normal scenario)..."
                blink-compiler compile -i "$brl_file" -o "$ir_file" --pretty \
                    --include "$GAME_DIR/bdl/heroes.bdl" \
                    --include "$GAME_DIR/bdl/enemies.bdl" \
                    --include "$GAME_DIR/bdl/scenario-normal.bdl"
            else
                echo "IR file ${filename}-normal.ir.json is up to date"
            fi
            
            # Compile with Hard scenario
            ir_file="$GAME_DIR/ir/${filename}-hard.ir.json"
            if [ ! -f "$ir_file" ] || [ "$brl_file" -nt "$ir_file" ]; then
                echo "Compiling ${filename}.brl (Hard scenario)..."
                blink-compiler compile -i "$brl_file" -o "$ir_file" --pretty \
                    --include "$GAME_DIR/bdl/heroes.bdl" \
                    --include "$GAME_DIR/bdl/enemies.bdl" \
                    --include "$GAME_DIR/bdl/scenario-hard.bdl"
            else
                echo "IR file ${filename}-hard.ir.json is up to date"
            fi
            
            # Compile with legacy game-config (for backward compatibility)
            ir_file="$GAME_DIR/ir/${filename}.ir.json"
            if [ ! -f "$ir_file" ] || [ "$brl_file" -nt "$ir_file" ]; then
                echo "Compiling ${filename}.brl (Legacy config)..."
                blink-compiler compile -i "$brl_file" -o "$ir_file" --pretty \
                    --include "$GAME_DIR/bdl/heroes.bdl" \
                    --include "$GAME_DIR/bdl/enemies.bdl" \
                    --include "$GAME_DIR/bdl/game-config.bdl"
            else
                echo "IR file ${filename}.ir.json is up to date"
            fi
        else
            # Standard compilation for other BRL files
            ir_file="$GAME_DIR/ir/${filename}.ir.json"
            if [ ! -f "$ir_file" ] || [ "$brl_file" -nt "$ir_file" ]; then
                echo "Compiling ${filename}.brl to IR..."
                blink-compiler compile -i "$brl_file" -o "$ir_file" --pretty
            else
                echo "IR file ${filename}.ir.json is up to date"
            fi
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
