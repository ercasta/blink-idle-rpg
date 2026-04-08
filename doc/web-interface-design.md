# Web Interface Design — Blink Idle RPG (Blink-QR)

*Status: Design draft — open issues are marked ⚠️*

---

##  Overview

This document defines the complete design for the Blink Idle RPG player-facing web interface (codename **Blink-QR**).

### Goals

- **Mobile-first**: All screens must work excellently on a 375 px wide phone screen.
- **Zero compilation**: Players never touch BRL code. Game mechanics run from pre-compiled IR loaded at startup.
- **QR-native hero sharing**: Every hero is a compact binary blob that can be encoded in a QR code and decoded by any phone camera.
- **WASM performance**: The game simulation runs in WebAssembly (compiled from the Blink Rust runtime) for efficient execution on mobile.
- **Offline-capable**: Core gameplay works with no internet connection after first load.
- **Social sharing**: Players create and share digital figurines via WhatsApp, Telegram, or print.

---

## Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| UI framework | React 19 + TypeScript | Existing project, familiar ecosystem |
| Build tool | Vite | Already configured |
| Styling | Tailwind CSS | Already configured; mobile-first utility classes |
| Routing | React Router v7 | SPA routing, URL-param support |
| Game engine | WASM (Blink Rust runtime) | Mobile performance; replaces JS engine for player app |
| QR generation | `qrcode` (soldair) | Canvas output, binary payloads, well-maintained |
| QR decoding (image) | `jsQR` | Pure JS, feeds from `ImageData`; no server needed |
| QR decoding (camera) | `html5-qrcode` | Wraps camera API + ZXing |
| Binary compression | `fflate` | ~25 KB, DEFLATE, tree-shakable |
| Figurine canvas | Bare `canvas` API + `html-to-image` | Low dependency; HTML+CSS → PNG is designer-friendly |
| State / persistence | React context + `localStorage` / `IndexedDB` | Roster and settings survive browser restarts |
| PWA | Vite PWA plugin | Offline support, "Add to home screen" prompt |

---

## Application Routes

```
/                   Home / Title screen
/create             Hero Creator wizard
/roster             Roster — saved heroes
/scan               QR Scanner — import hero
/figurine/:heroId   Figurine generator & share
/play               Run setup hub
/play/mode          Game mode selection
/play/party         Party selection
/play/battle        Battle screen
/play/results       Post-run results
```

URL parameter `?h=<base64url>` on the root route `"/"` is handled automatically: the app decodes the hero, shows a preview, and offers to add it to the roster before redirecting to `/roster`.

---

## Screen-by-Screen Design

### Home Screen (`/`)

**Purpose**: Entry point. Shows brand, key actions, and any imported hero from URL.

**Layout** (portrait phone):
```
┌─────────────────────────┐
│  🐉  BLINK IDLE RPG     │  title + logo
│                         │
│  [ ▶ Start a Run ]      │  → /play/mode
│  [ ✦ Create Hero ]      │  → /create
│  [ 👥 My Roster ]       │  → /roster
│  [ 📷 Scan Hero QR ]    │  → /scan
│                         │
│  ─── Recent Runs ───    │  last 3 runs, tap to view results
│  Wave 12 | 4,200 pts    │
│  Wave 7  | 2,100 pts    │
└─────────────────────────┘
```

**Behaviour**:
- If URL contains `?h=...`, decode immediately, display a hero preview card (`<HeroCard>`) with "Add to Roster" and "Play with this Hero" CTAs.
- "Start a Run" is disabled if the roster is empty; shows "Create or scan a hero first" tooltip.
- Recent runs are read from `localStorage` (last 10 stored).

---

### Hero Creator Wizard (`/create`)

**Purpose**: Step-by-step mobile-friendly hero creation.

The wizard has **7 steps** navigated with Back / Next buttons. Progress is shown as a step indicator at the top. Partial heroes are auto-saved to `sessionStorage` so accidental navigation doesn't lose work.

#### Step 1 — Identity

- **Name input**: text field, max 24 ASCII characters (enforced; warns on special characters).
- **Class picker**: horizontal scroll of 6 class cards (Warrior, Mage, Ranger, Paladin, Rogue, Cleric), each showing class name, role, difficulty tag, and a descriptive icon/emoji.
- Selected class card is highlighted; deselecting re-prompts class choice.

#### Step 2 — Base Stats

Five stats: STR, DEX, INT, CON, WIS.


**UI**: 5 rows of:
```
STR  [────────●───] 8   [+][−]
```
A point-budget bar at the top prevents unlimited stat allocation. Display a "Role Tip" highlighting the most important stats for the selected class.

#### Step 3 — Stat Growth

Five growth-rate sliders (one per stat), range 0–7 (3 bits each). Show a level-50 projection preview: "At level 50, STR will be 8 + 50 × 2 = 108".


#### Step 4 — Skill Progression

Show the class skill tree as a scrollable DAG. Each node is a skill card (name, type, brief effect). Players pick **up to 10 skills** in priority order (the order defines the leveling sequence: skill 1 is unlocked first, skill 2 second, etc.).

DECISION: each class starts with the same stats point distribution, and with 1 skill point which is part of the hero definition.


#### Step 5 — Early Game Traits

12 character trait sliders + 3 skill slot pickers (Primary, Secondary, Passive).

Each trait slider row covers one axis from its first pole (−16) to its second pole (+15):

```
physical ◀──────●──────▶ magical     [−12]
offensive◀──────●──────▶ defensive   [ +4]
supportive◀─────●──────▶ attacker    [ +8]
risky    ◀──────●──────▶ cautious    [ −6]
fire     ◀──────●──────▶ water       [−10]
wind     ◀──────●──────▶ earth       [  0]
light    ◀──────●──────▶ darkness    [ −8]
chaos    ◀──────●──────▶ order       [ +6]
sly      ◀──────●──────▶ honorable   [ −4]
range    ◀──────●──────▶ melee       [ +8]
absorb   ◀──────●──────▶ inflict     [ +6]
area     ◀──────●──────▶ focus       [ +4]
```

The 12 trait values (each −16 to +15) map directly to the character trait fields defined in `doc/game-design/character-traits.md`. Traits drive stat growth, skill selection, and AI behaviour weights (see the derivation table in that document). Each trait value is stored as one `int8` in the QR payload.

A short tooltip beneath the slider block shows the two or three most-influenced AI behaviours: e.g., "physical + attacker → STR growth, aggressive targeting".


#### Step 6 — Mid Game Traits

Same as Step 5, plus:
- **Level trigger** input (level 2–49): the level at which the hero switches to mid-game traits.

Display a toggle "Use same as Early Game" to copy values.

#### Step 7 — End Game Traits

Same as Step 6, with an "End Game" label. Level trigger must be > mid-game trigger.

#### Step 8 — Review & Generate QR

Summary card showing:
- Hero name, class, stats (level 1 and level 50 projection)
- Skill list in unlock order
- Behaviour summary (per phase: 3 key trait sliders — e.g., physical/magical, offensive/defensive, risky/cautious — plus skill slots)

Actions:
- **[ Save to Roster ]** — saves to `localStorage`
- **[ Generate QR ]** — navigates to `/figurine/:heroId`
- **[ Share Link ]** — copies URL with `?h=<base64url>` to clipboard
- **[ Edit ]** — goes back to step 1

---

### Roster Screen (`/roster`)

**Purpose**: Manage all saved heroes.

**Layout**:
```
┌─────────────────────────────┐
│  My Heroes       [+] [📷]   │  + = Create, 📷 = Scan
├─────────────────────────────┤
│ ┌───────────────────────┐   │
│ │ ⚔️ Aldric  Warrior    │   │
│ │ Lv 1 | STR 10 DEX 6  │   │
│ │ [Play] [QR] [Edit] [✕]│   │
│ └───────────────────────┘   │
│ ┌───────────────────────┐   │
│ │ 🧙 Lyra   Mage        │   │
│ │ Lv 1 | INT 14 WIS 8   │   │
│ │ [Play] [QR] [Edit] [✕]│   │
│ └───────────────────────┘   │
└─────────────────────────────┘
```

- Each hero card has quick-play, QR generate, edit, and delete actions.
- Swipe left on a card reveals delete.
- Max roster size: 20 heroes (soft limit; warn but don't block).

---

### QR Scanner Screen (`/scan`)

**Purpose**: Import a hero by scanning a QR code or loading an image.

**Layout** (two tabs):

**Tab 1 — Camera Scan**:
- Live camera viewfinder (full screen, portrait)
- Scan frame overlay
- Detected QR: vibrate, play sound, show hero preview
- Uses `html5-qrcode`; prompts for camera permission

**Tab 2 — Import from Image**:
- Large drag-drop zone or "Choose image from gallery"
- Works via `<input type="file" accept="image/*">`
- Decodes via `jsQR` on a `<canvas>` offscreen context
- Shows decode result or error

**Decode pipeline**:
```
QR content string
  → validate URL prefix (https://...?h=...)
  → extract base64url payload
  → base64url decode → Uint8Array
  → fflate DEFLATE decompress (if compressed flag set)
  → parse hero binary format
  → validate CRC-16
  → validate version + schema
  → show HeroPreviewCard
    → [Add to Roster] [Play Immediately] [Ignore]
```

Error states: invalid QR (not a Blink hero), version mismatch (offer upgrade), CRC failure (corrupted payload).

---

### Game Mode Selection (`/play/mode`)

**Purpose**: Pick the scoring ruleset for the run.

**Layout**: vertical list of mode cards, each showing:
- Mode name + difficulty badge
- 3-line description
- Key difference indicators (e.g., death penalty, time bonus)

Modes: Casual, Normal, Hardcore, Speed Run, Endless (from `game-design/game-modes.md`).

Each card expands on tap to show the full parameter comparison table vs Normal.

Action at bottom: **[ Continue → Party Selection ]**


---

### Party Selection (`/play/party`)

**Purpose**: Choose 1–6 heroes from the roster to form the party.

**Layout**: grid of hero cards from the roster (same format as Roster screen but selectable). A footer shows the selected party (avatars row) and a "Start Battle" button.

Constraints:
- Minimum 1 hero
- Maximum 6 heroes
- The same hero cannot be in the party twice
- Mode-specific constraints (if any — none defined yet)

Note: game is local-only, no sync between phones

---

### 4.7 Battle Screen (`/play/battle`)

**Purpose**: Display the live idle battle simulation.

**Layout** (portrait phone):
```
┌─────────────────────────────┐
│ Wave 5 | Tier 2 | Score 840 │  run stats header
├─────────────────────────────┤
│  ⚔️ Aldric  HP ████████ 110 │
│  🧙 Lyra   HP ████░░░░  65  │  hero party row
│  🏹 Sasha  HP ██████░░  90  │
├─────────────────────────────┤
│  Enemies                    │
│  🐍 Goblin    HP ██░░ 24    │
│  🐍 Goblin    HP ████ 48    │  enemy row
│  💀 Skeleton  HP ██░░ 15    │
├─────────────────────────────┤
│  --- Combat Log ---         │
│  Aldric hits Goblin for 18  │  scrollable log, auto-scrolls
│  Goblin hits Lyra for 9     │
│  Lyra casts Frost Bolt...   │
├─────────────────────────────┤
│  [ ⏸ Pause ] [ 🏃 Retreat ] │  action buttons
└─────────────────────────────┘
```

Decision: the interface must be much simpler. Consider the game with progress by steps of... 10 encounters? So I'd just show the player levels, and some aggregated metrics, such as an overall score, a progress indicator (we'll add this in game design so the player knows how far is in the game).

**Simulation behaviour**:
- WASM (or JS) engine runs in a background `requestAnimationFrame` loop or `setInterval`.
- Engine state is polled every ~100 ms (game time) and React state is updated for rendering.
- A "speed" toggle (1× / 2× / 5×) controls simulation ticks per frame.
- Retreat shows a confirmation dialog with the current penalty before applying.

**State display**:
- HP bars animate smoothly using CSS transitions.
- Critical hits show a flash animation.
- Status effects shown as icon badges on entity rows (🔥 Burning, ❄️ Frozen, ☠️ Poisoned).
- Score counter updates in real time.
- Wave complete: brief celebratory animation before next wave spawns.

it's good to make the game run asynchronously. In terms of user experience, we are looking at roughly 30 steps overall to complete the game, with 1 update per second. The UI should show 1 update per second despite how far the simulation run. Note that since there is no user interaction, the simulation might even complete in half a second, but nevertheless we need to show roughly 30 updates to the user before the game ends. This means we might have to "snapshot" values at given progress steps. In general I prefer decoupling the simulation from the UI.

---

### Post-Battle Results Screen (`/play/results`)

**Purpose**: Show final score and KPIs at run end.

**Layout**:
```
┌─────────────────────────────┐
│  🏆  Run Complete!           │
│     Final Score: 4,800      │
│                              │
│  Deepest Wave      12        │
│  Deepest Tier       3        │
│  Total Kills      147        │
│  Bosses Killed      2        │
│  Hero Deaths        1        │
│  Retreats           0        │
│  Total Time     08:32        │
│                              │
│  [ Share Score ]             │
│  [ Play Again ]              │
│  [ Back to Roster ]          │
└─────────────────────────────┘
```

"Share Score" uses the Web Share API (`navigator.share`) on mobile with a short text summary. Fallback: copy to clipboard.

Scores are stored in `localStorage` under a `blink-rpg-scores` key for the Recent Runs section on the Home screen.

---

### Figurine / QR Generator Screen (`/figurine/:heroId`)

**Purpose**: Generate, preview, and share the digital hero figurine.

**Layout** (two panels, stacked on mobile):

**Panel A — Preview**:
A 1080 × 1920 px `<canvas>` element rendered at 360 × 640 px display size (scaled 3×), showing:
- Background: class-themed gradient or artwork (placeholder for v1)
- Hero portrait: class emoji / placeholder art centered
- Hero name in styled font
- Class + role label
- Key stats (level 1 and projected level 50)
- Skill list (first 4 skills)
- QR code (bottom-right corner, ~200 × 200 px on canvas = high resolution)
- Short URL text below QR: `allsoulsrun.net/g.html?h=...` (truncated for display)

**Panel B — Actions**:
```
[ 📤 Share Image ]       → Web Share API (image + text)
[ 💾 Save to Gallery ]  → download PNG
[ 🖨️ Print ]            → print dialog with print CSS
[ 📋 Copy Link ]        → clipboard
[ ✏️ Edit Hero ]         → back to /create (pre-populated)
```

**Image generation pipeline** (all client-side):
```
1. Draw background layer on canvas
2. Draw portrait image (or placeholder)
3. Draw name, class, stats as text layers
4. Encode hero → Uint8Array → base64url → URL
5. Render QR code to temp canvas (qrcode library)
6. Composite QR canvas into main canvas (bottom-right)
7. Export canvas as PNG blob (canvas.toBlob)
8. Display as img preview + enable actions
```

---

## Hero Binary Format

See `doc/figurine-qr-design.md` for the full specification. Summary for implementation:

### Encoding Pipeline

```
HeroData struct (JS/TS)
  ↓  bit-pack to Uint8Array  (custom BitWriter)
Raw bytes (~100–130 B)
  ↓  DEFLATE compress (fflate, level 6)
Compressed bytes (~70–95 B)
  ↓  base64url (no padding, URL-safe alphabet A-Za-z0-9-_)
URL-safe string (~93–127 chars)
  ↓  prepend URL prefix: "https://allsoulsrun.net/g.html?h="
Final URL (~127–161 chars)
  ↓  encode in QR (byte mode, EC-M)
QR version 8–10 (very compact)
```

### Encoding Package Structure

```
packages/blink-qr/
├── package.json
├── src/
│   ├── index.ts                  ← public API
│   ├── hero-codec.ts             ← encode() / decode()
│   ├── bit-writer.ts             ← BitWriter class
│   ├── bit-reader.ts             ← BitReader class
│   ├── skill-registry.ts         ← Map<string, number> of all skill IDs 0–255
│   ├── hero-types.ts             ← QRHero interface
│   ├── crc16.ts                  ← CRC-16/CCITT-FALSE
│   └── constants.ts              ← magic bytes, version, URL prefix
└── tests/
    ├── hero-codec.test.ts
    └── roundtrip.test.ts
```

### Hero Binary Layout (byte-aligned first pass)

Based on `doc/figurine-qr-design.md` Section 2.1, adapted to align with `doc/game-design/character-traits.md`:

```
Offset  Size    Field
──────  ──────  ─────────────────────────────────────────────────────
0       2B      magic: 0x42 0x51  ("BQ" — Blink QR)
2       1B      version: 0x02
3       1B      flags: bit 0 = compressed, bits 1-7 = reserved
4       2B      payload_len (LE uint16)
6       2B      crc16 (CRC-16/CCITT-FALSE of bytes 0..payload_len+5)
──── header (8 bytes) ────────────────────────────────────────────────
8       1B      name_length (0–24)
9       ≤24B    name (ASCII, 1 byte per char)
?       1B      class_id  (0=Warrior, 1=Mage, 2=Ranger, 3=Paladin,
                           4=Rogue, 5=Cleric)
?       3B      base_stats  (STR, DEX, INT, CON, WIS; each 0–15, 4 bits)
                            packed 2 stats per byte (5 stats → 3 bytes, 4 bits unused)
?       2B      growth_rates (STR, DEX, INT, CON, WIS; each 0–7, 3 bits)
                             packed (5 × 3 = 15 bits → 2 bytes)
?       1B      skills_count (0–10)
?       ≤10B    skill_ids  (each 0–255, 1 byte per skill ID)
?       1B      section_flags (bit 0 = mid present, bit 1 = end present)
──── early game traits (15B) ─────────────────────────────────────────
?       12B     early_traits[0..11]  (int8 each, −16 to +15)
                  [0]=pm [1]=od [2]=sa [3]=rc [4]=fw [5]=we
                  [6]=ld [7]=co [8]=sh [9]=rm [10]=ai [11]=af
?       1B      early_primary_skill_id
?       1B      early_secondary_skill_id
?       1B      early_passive_skill_id
──── mid game traits (16B, if section_flags bit 0) ───────────────────
?       1B      mid_level_trigger (2–48)
?       12B     mid_traits[0..11]
?       3B      mid skill IDs
──── end game traits (16B, if section_flags bit 1) ───────────────────
?       1B      end_level_trigger (3–49, > mid trigger)
?       12B     end_traits[0..11]
?       3B      end skill IDs
──── footer ──────────────────────────────────────────────────────────
(CRC is in header; no separate footer needed)
```

Trait byte order follows the axis table in `doc/game-design/character-traits.md` (pm=0, od=1, sa=2, rc=3, fw=4, we=5, ld=6, co=7, sh=8, rm=9, ai=10, af=11). Each byte is clamped to [−16, 15] on decode. The 24-byte behaviour block from v0.01 is replaced by the 12-byte trait block; payload is ~12 bytes smaller per phase (up to ~36 bytes total saving).

---


---

## 7. State Management

### 7.1 Persistent State (`localStorage`)

| Key | Content |
|---|---|
| `blink-rpg-roster` | `QRHero[]` serialised as base64url payloads |
| `blink-rpg-scores` | `RunResult[]` (last 10 runs) |
| `blink-rpg-settings` | `AppSettings` (speed preference, sound, etc.) |

### 7.2 Session State (React Context)

| Context | Content |
|---|---|
| `RosterContext` | Loaded roster, add/remove/edit operations |
| `RunContext` | Current run config (mode, party), engine ref |
| `SettingsContext` | Global app settings |

No global Redux/Zustand store; the app is small enough for context + hooks.

### 7.3 URL State

- `?h=<base64url>` — encoded hero (import flow)
- `/figurine/:heroId` — heroId is the index in the roster or a `temp` session ID

---

## 8. Component Tree (High-Level)

```
App
├── Router
│   ├── "/" → HomeScreen
│   │   └── HeroImportModal (when ?h= present)
│   ├── "/create" → HeroCreatorWizard
│   │   ├── StepIdentity
│   │   ├── StepBaseStats
│   │   ├── StepStatGrowth
│   │   ├── StepSkillProgression
│   │   │   └── SkillTree (DAG)
│   │   ├── StepBehaviourPhase (×3, reused)
│   │   └── StepReview
│   │       └── HeroCard (preview)
│   ├── "/roster" → RosterScreen
│   │   └── HeroCard (×N, swipeable)
│   ├── "/scan" → ScannerScreen
│   │   ├── CameraScanTab (html5-qrcode)
│   │   └── ImageImportTab (jsQR)
│   ├── "/play/mode" → ModeSelectScreen
│   │   └── ModeCard (×5)
│   ├── "/play/party" → PartySelectScreen
│   │   └── HeroCard (selectable)
│   ├── "/play/battle" → BattleScreen
│   │   ├── RunStatsBar
│   │   ├── HeroPartyPanel
│   │   ├── EnemyPanel
│   │   ├── CombatLog
│   │   └── ActionBar (pause / retreat)
│   ├── "/play/results" → ResultsScreen
│   └── "/figurine/:id" → FigurineScreen
│       ├── FigurineCanvas (canvas)
│       └── ShareActions
└── Providers
    ├── RosterContext.Provider
    ├── RunContext.Provider
    └── SettingsContext.Provider
```

---

