# Blink Idle RPG - Demo

Browser-based demos showcasing the Blink engine. **Works on mobile and desktop!**

## 🚀 Quick Start

To run the demos, you need to serve them using a local web server:

### Option 1: Using npx serve (Recommended)

```bash
cd game/demos
npx serve .
```

Then open http://localhost:3000 in your browser.

### Option 2: Using Python

```bash
cd game/demos
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## Available Demos

### 📱 index.html - Demo Launcher (Start Here!)
A mobile-friendly landing page that provides:
- Easy navigation to all demos
- Description of each demo
- Tips and usage instructions
- **Best choice for first-time users and mobile devices**

### 🏰 rpg-demo.html - Classic RPG Demo

- **4-Hero Party**: Warrior, Mage, Rogue, and Cleric
- **Endless Enemies**: Waves of progressively stronger monsters
- **Character Progression**: Level up, gain skills, increase stats
- **Boss Battles**: Face powerful bosses every 100 enemies
- **Goal**: Defeat 1000 enemies to win
- **Speed Control**: Up to 1000x simulation speed
- **Perfect for**: Extended gameplay and progression testing

## What The Demos Show

## How It Works

The demos load and execute game files in real-time:

1. **BRL Files** (Blink Rule Language): Human-readable game rules defining components, rules, and game logic
2. **IR Files** (Intermediate Representation): Compiled JSON format that the Blink engine executes
3. **BCL Files** (Blink Choice Language): AI strategies and decision-making for characters
4. **Blink Engine**: JavaScript runtime that processes IR and executes game logic

The flow:
- BRL → Compiler → IR → Blink Engine → Game Simulation
- Demos load IR files directly (already compiled from BRL)
- BCL files can be uploaded as ZIP to customize AI behavior

Key concepts:
1. **Components**: Define game entities (Character, Health, Attack, Target, etc.)
2. **Rules**: 
   - `attack_rule`: Deals damage and schedules next attack
   - `death_check`: Emits Death event when health ≤ 0
   - `level_up`: Increases character stats on leveling
3. **Trackers**: Capture component data on events for UI updates
4. **Events**: Trigger rules and drive the game simulation

## Mobile Optimization

All demos are optimized for mobile devices with:
- ✅ Responsive design that adapts to any screen size
- ✅ Touch-friendly buttons and controls
- ✅ Efficient rendering for smooth performance
- ✅ Readable text on small screens
- ✅ No server or installation required

## Files

### Files in this directory

- `index.html` - Mobile-friendly demo launcher and landing page (default)
- `rpg-demo.html` - Classic RPG demo UI
- `blink-engine.bundle.js` - Standalone Blink engine bundle for browsers

### Game Files

The demos load game files from the sibling directories:

- **BRL Files** (from `game/brl/`): `simple-combat.brl`, `simple-clicker.brl`
- **IR Files** (from `game/ir/`): `simple-combat.ir.json`, `simple-clicker.ir.json`, `classic-rpg.ir.json`
- **BCL Files** (from `game/bcl/`): `warrior-skills.bcl`, `mage-skills.bcl`, `rogue-skills.bcl`, `cleric-skills.bcl`, `party-config.bcl`

## Building the Demo Package

The demo package is automatically built via GitHub Actions for Windows and Linux. You can:

1. **Download from GitHub Actions**: Navigate to the "Build Demo Package" workflow run and download the `blink-demo-package-windows` or `blink-demo-package-linux` artifact

## What's New

🎉 **Demos now run from actual game files!** All demos load their rules from external IR (Intermediate Representation) files instead of hardcoded data. You can:

- Download BRL files to see the human-readable game rules
- Download IR files to see the compiled format the engine runs
- Download BCL files to study AI strategies and player choices
- Modify these files and upload them back to see your changes in action!

This makes it easy for interested players to learn how Blink games work and even create their own modifications.

## Troubleshooting

**Q: The demo doesn't work when I serve it**
- Make sure JavaScript is enabled in your browser
- Check that you're accessing it through a web server (http://localhost:...) and not file://
- Try opening in a different browser (Chrome, Firefox, Safari recommended)
- Check the browser console for any errors (F12 → Console tab)

**Q: Can I use these demos offline?**
- Yes, once you've served them locally with npx or python, they work offline
- The RPG demo needs internet for the first load to fetch JSZip library, but works offline after that

**Q: The game is too fast/slow**
- Use the speed slider at the bottom to adjust simulation speed
- Simple combat: 0.5x to 10x
- RPG demo: 1x to 1000x
