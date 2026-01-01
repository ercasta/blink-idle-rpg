#!/bin/bash
set -e

# Compile BRL files to IR if not already compiled or if BRL files are newer
echo "Checking BRL files..."
for brl_file in /app/examples/brl/*.brl; do
    if [ -f "$brl_file" ]; then
        filename=$(basename "$brl_file" .brl)
        ir_file="/app/examples/ir/${filename}.ir.json"
        
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
    echo "  - http://localhost:3000/combat-demo.html (Simple combat)"
    echo "  - http://localhost:3000/rpg-demo.html (Classic RPG)"
    echo ""
    cd /app/examples/demos
    exec serve -l 3000 .
elif [ "$1" = "bash" ]; then
    exec /bin/bash
else
    exec "$@"
fi
