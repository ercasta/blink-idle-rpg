# Blink Idle RPG - Combat Demo

A browser-based demo showcasing the Blink engine running the `simple-combat.brl` example.

## Running the Demo

### Option 1: Using a simple HTTP server

```bash
cd packages/demo
npx serve .
```

Then open http://localhost:3000 in your browser.

### Option 2: Using Python

```bash
cd packages/demo
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

### Option 3: Open directly in browser

Simply open `index.html` directly in your browser. Note: Some browsers may restrict local file access.

## What This Demo Shows

- **Two Combatants**: Hero (green) vs Goblin (red)
- **Automatic Combat**: Battles run automatically based on attack speeds
- **Real-time Updates**: Health bars update as damage is dealt
- **Combat Log**: Shows all attacks and damage in real-time
- **Speed Control**: Adjust simulation speed from 0.5x to 10x

## How It Works

The demo uses the Blink engine to execute the simple-combat IR (Intermediate Representation):

1. **Components**: Character, Health, Attack, Target
2. **Rules**: 
   - `attack_rule`: Deals damage and schedules next attack
   - `death_check`: Emits Death event when health ≤ 0
3. **Trackers**: Capture Health and Character data on combat events

## Files

- `index.html` - Demo UI and game logic
- `blink-engine.bundle.js` - Standalone Blink engine bundle for browsers
