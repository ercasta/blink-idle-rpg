# Blink Idle RPG - Demo

Browser-based demos showcasing the Blink engine. **Works on mobile and desktop!**

## 🚀 Quick Start (No Installation Required!)

**Simply open `index.html` in your browser!**

1. Navigate to this folder (`packages/demo/`)
2. Double-click `index.html` (or right-click → Open with your browser)
3. Choose a demo and start playing!

This works on:
- 📱 Mobile phones (iOS, Android)
- 💻 Desktop browsers (Chrome, Firefox, Safari, Edge)
- 📟 Tablets

## Alternative: Using a Web Server

If you prefer running a local server:

### Option 1: Using npx serve

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

## Available Demos

### 📱 index.html - Demo Launcher (Start Here!)
A mobile-friendly landing page that provides:
- Easy navigation to all demos
- Description of each demo
- Tips and usage instructions
- **Best choice for first-time users and mobile devices**

### ⚔️ combat-demo.html - Simple Combat Demo

- **Two Combatants**: Hero (green) vs Goblin (red)
- **Automatic Combat**: Battles run automatically based on attack speeds
- **Real-time Updates**: Health bars update as damage is dealt
- **Combat Log**: Shows all attacks and damage in real-time
- **Speed Control**: Adjust simulation speed from 0.5x to 10x
- **Perfect for**: Quick tests and understanding basic mechanics

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

The demos use the Blink engine to execute IR (Intermediate Representation):

1. **Components**: Define game entities (Character, Health, Attack, Target, etc.)
2. **Rules**: 
   - `attack_rule`: Deals damage and schedules next attack
   - `death_check`: Emits Death event when health ≤ 0
   - `level_up`: Increases character stats on leveling
3. **Trackers**: Capture component data on events for UI updates

## Mobile Optimization

All demos are optimized for mobile devices with:
- ✅ Responsive design that adapts to any screen size
- ✅ Touch-friendly buttons and controls
- ✅ Efficient rendering for smooth performance
- ✅ Readable text on small screens
- ✅ No server or installation required

## Files

- `index.html` - Mobile-friendly demo launcher and landing page (default)
- `combat-demo.html` - Simple combat demo UI
- `rpg-demo.html` - Classic RPG demo UI
- `blink-engine.bundle.js` - Standalone Blink engine bundle for browsers

## Troubleshooting

**Q: The demo doesn't work when I open it**
- Make sure JavaScript is enabled in your browser
- Try opening in a different browser (Chrome, Firefox, Safari recommended)
- Check the browser console for any errors (F12 → Console tab)

**Q: Can I use these demos offline?**
- Yes! The demo launcher and simple combat demo work completely offline
- The RPG demo needs internet for the first load to fetch JSZip library, but works offline after that

**Q: The game is too fast/slow**
- Use the speed slider at the bottom to adjust simulation speed
- Simple combat: 0.5x to 10x
- RPG demo: 1x to 1000x
