# Web Interface Design — Blink Idle RPG (Blink-QR)

*Status: Design draft — open issues are marked ⚠️*

---

## 1. Overview

This document defines the complete design for the Blink Idle RPG player-facing web interface (codename **Blink-QR**).

The previous React app at `game/app/` has been deleted; it was a developer-oriented prototype mixing game play with BRL/BCL compilation screens. This design starts from scratch to serve the actual player audience.

### Goals

- **Mobile-first**: All screens must work excellently on a 375 px wide phone screen.
- **Zero compilation**: Players never touch BRL or BCL code. Game mechanics run from pre-compiled IR loaded at startup.
- **QR-native hero sharing**: Every hero is a compact binary blob that can be encoded in a QR code and decoded by any phone camera.
- **WASM performance**: The game simulation runs in WebAssembly (compiled from the Blink Rust runtime) for efficient execution on mobile.
- **Offline-capable**: Core gameplay works with no internet connection after first load.
- **Social sharing**: Players create and share digital figurines via WhatsApp, Telegram, or print.

### Out of Scope (reserved for the future "Studio" app)

- BRL source editing
- BCL skill editing
- Step-by-step debugger / Inspector
- IR viewer

---

## 2. Technology Stack

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

> ⚠️ **OI-1 (Engine choice)**: The WASM engine (Track 7) is not yet complete. The JS engine (Track 4) is functional. The player app should **start with the JS engine** behind an `IEngine` abstraction interface, then swap in the WASM engine when it passes conformance tests. Keeping the abstraction clean is the critical design choice — the swap should be a one-line config change, not a refactor.

DECISION: WASM Engine. Let's first fix that

---

## 3. Application Routes

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

## 4. Screen-by-Screen Design

### 4.1 Home Screen (`/`)

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

### 4.2 Hero Creator Wizard (`/create`)

**Purpose**: Step-by-step mobile-friendly hero creation.

The wizard has **7 steps** navigated with Back / Next buttons. Progress is shown as a step indicator at the top. Partial heroes are auto-saved to `sessionStorage` so accidental navigation doesn't lose work.

#### Step 1 — Identity

- **Name input**: text field, max 24 ASCII characters (enforced; warns on special characters).
- **Class picker**: horizontal scroll of 6 class cards (Warrior, Mage, Ranger, Paladin, Rogue, Cleric), each showing class name, role, difficulty tag, and a descriptive icon/emoji.
- Selected class card is highlighted; deselecting re-prompts class choice.

#### Step 2 — Base Stats

Five stats: STR, DEX, INT, CON, WIS.

> ⚠️ **OI-2 (Stat model)**: The characters.md doc defines 5 stats but does not finalise the value range or progression model. Two sub-questions:
> - **Value range per stat**: Characters.md says "0–7 (3 bits) or 0–15 (4 bits)"; figurine-qr-design.md uses 4 bits. **Recommend: 4-bit values (0–15)** as a reasonable balance between expressiveness and QR space efficiency.
> - **Progression model**: (A) Fixed linear growth per level set at creation — simplest, fits QR. (B) Point-buy at character creation only. (C) Per-level allocation at play time (requires mid-run player interaction, incompatible with idle). **Recommend Option A**: each stat has a `base_value` (0–15) and a `growth_rate` (0–7, 3-bit) encoding how many points the stat gains per level. Both encoded in QR.

DECISION: we'll address this in game design first. 


**UI**: 5 rows of:
```
STR  [────────●───] 8   [+][−]
```
A point-budget bar at the top prevents unlimited stat allocation. Display a "Role Tip" highlighting the most important stats for the selected class.

#### Step 3 — Stat Growth

Five growth-rate sliders (one per stat), range 0–7 (3 bits each). Show a level-50 projection preview: "At level 50, STR will be 8 + 50 × 2 = 108".

> ⚠️ **OI-3 (Point budget)**: Does each hero have a fixed total points budget for base stats AND growth rates, or are they independent? A shared budget discourages min-maxing; independent budgets give more freedom. **Recommend**: independent budgets with soft guidance (class tips, no hard cap except per-stat max).

#### Step 4 — Skill Progression

Show the class skill tree as a scrollable DAG. Each node is a skill card (name, type, brief effect). Players pick **up to 10 skills** in priority order (the order defines the leveling sequence: skill 1 is unlocked first, skill 2 second, etc.).

DECISION: each class starts with the same stats point distribution, and with 1 skill point which is part of the hero definition.

> ⚠️ **OI-4 (Skill tree depth)**: The skills.md document currently lists 4 skills per class (Warrior, Mage, Ranger, Paladin, Rogue, Cleric) — too few for a meaningful tree. Review.md mentions 36 skills across 4 classes (9 each). The actual skill DAG structure (prerequisites per class) needs to be designed and added to the game design docs before this screen can be fully implemented. **This is a blocking game design dependency.**
>
> For the UI, plan for up to 20 nodes per class in a 2–3 column scrollable grid. Prerequisite edges are shown as connecting lines. Locked skills are greyed out; eligible skills have a pulsing highlight.

DECISION: already addressed in a separate game design branch

#### Step 5 — Early Game Behaviour

24 behaviour byte sliders + 3 skill slot pickers (Primary, Secondary, Passive).

Each behaviour slider row:
```
Fight/Flight   [◀──────●──────▶]   +12
              (Flee early)  (Fight on)
```

The 24 behaviour bytes map to the named decision values defined in `doc/game-design/characters.md` (12 named decision fields, each -32 to +31). The remaining 12 bytes are reserved for future use and hidden from the player UI (displayed as "Advanced" toggle collapsed by default).

> ⚠️ **OI-5 (Behaviour byte semantics)**: Characters.md defines 12 named decision values (range -32 to +31). `blink-qr.md` and `review.md` describe 24 behaviour bytes (range -128 to +127 as full signed bytes). These are **not aligned**. Three options:
> - **Option A**: Use exactly the 12 decision fields from characters.md (6 bits each = 72 bits = 9 bytes per phase). Cleaner semantics; smaller payload.
> - **Option B**: Use 24 full bytes per phase as in blink-qr.md, assigning the first 12 to the named decision values and reserving bytes 12-23.
> - **Option C**: Redesign behaviour bytes as a distinct higher-level abstraction that maps to decision values internally.
>
> **This is a blocking game design decision** that directly controls the QR encoding and the engine's AI integration. Must be resolved before implementation.

The 3 skill pickers show only skills already chosen in Step 4, filtered by type (active for primary/secondary, passive for passive slot).

Decision: we'll use 12 decision fields. addressed in separate design branch

#### Step 6 — Mid Game Behaviour

Same as Step 5, plus:
- **Level trigger** input (level 2–49): the level at which the hero switches to mid-game behaviour.

Display a toggle "Use same as Early Game" to copy values.

#### Step 7 — End Game Behaviour

Same as Step 6, with an "End Game" label. Level trigger must be > mid-game trigger.

#### Step 8 — Review & Generate QR

Summary card showing:
- Hero name, class, stats (level 1 and level 50 projection)
- Skill list in unlock order
- Behaviour summary (per phase: 3 key behaviour sliders, skill slots)

Actions:
- **[ Save to Roster ]** — saves to `localStorage`
- **[ Generate QR ]** — navigates to `/figurine/:heroId`
- **[ Share Link ]** — copies URL with `?h=<base64url>` to clipboard
- **[ Edit ]** — goes back to step 1

---

### 4.3 Roster Screen (`/roster`)

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

> ⚠️ **OI-6 (Roster persistence)**: `localStorage` is simple but limited (~5 MB) and cleared by "Clear site data". For a hero collection game, `IndexedDB` is more robust and supports larger payloads. The implementation should use an abstraction (`RosterStore`) so the storage backend can be swapped. For v1, `localStorage` is acceptable (each hero payload is ~200 bytes). Recommend migrating to `IndexedDB` before launch if the roster grows to support more metadata (run history per hero, etc.).

---

### 4.4 QR Scanner Screen (`/scan`)

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

### 4.5 Game Mode Selection (`/play/mode`)

**Purpose**: Pick the scoring ruleset for the run.

**Layout**: vertical list of mode cards, each showing:
- Mode name + difficulty badge
- 3-line description
- Key difference indicators (e.g., death penalty, time bonus)

Modes: Casual, Normal, Hardcore, Speed Run, Endless (from `game-design/game-modes.md`).

Each card expands on tap to show the full parameter comparison table vs Normal.

Action at bottom: **[ Continue → Party Selection ]**

> ⚠️ **OI-7 (Custom modes via QR)**: `game-modes.md` defines a flow where game modes can also be exported/imported via QR. This requires a separate QR binary format for mode payloads (different magic bytes, different schema). Since the game mode QR payload is smaller (no behaviour bytes), it can be simpler. However, the same `blink-qr` encoding package should handle both hero and mode payloads (differentiated by the `magic` header bytes). **Defer to v2** unless there is user demand.

---

### 4.6 Party Selection (`/play/party`)

**Purpose**: Choose 1–6 heroes from the roster to form the party.

**Layout**: grid of hero cards from the roster (same format as Roster screen but selectable). A footer shows the selected party (avatars row) and a "Start Battle" button.

Constraints:
- Minimum 1 hero
- Maximum 6 heroes
- The same hero cannot be in the party twice
- Mode-specific constraints (if any — none defined yet)

> ⚠️ **OI-8 (Multi-player party composition)**: `blink-qr.md` mentions "scan friends for party" — each player brings one hero scanned from their physical figurine, and the phones running the game would share party composition. This requires either:
> - **Local only (v1)**: All heroes are on the same device. Player manually selects.
> - **Multi-device (v2+)**: One device is the "host", others scan a session QR to join. Requires either a WebRTC/WebSocket server or a clever NFC/local-wifi peer approach.
>
> **For v1**: local-only party selection. Design the QR scan flow so "scan → add to roster → select for party" is seamless.

Decision: absolutely local only

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

> ⚠️ **OI-9 (WASM/JS engine integration)**: The battle screen requires the engine to produce a "snapshot" each tick for the React layer to render. The current JS engine exposes `getAllEntities()`, `step()`, etc. The WASM engine should expose the same `BlinkGame` interface. Key design question: **should the engine run synchronously (blocked JS thread) or asynchronously (Worker + postMessage)?** Recommendation: run the WASM engine in a **Web Worker** so it never blocks the UI thread. The Worker posts `GameSnapshot` messages at each frame boundary. This requires careful serialisation (JSON or a shared `SharedArrayBuffer` ring buffer).

Decision: it's good to make it run asynchronously. In terms of user experience, we are looking at roughly 30 steps overall to complete the game, with 1 update per second. The UI should show 1 update per second despite how far the simulation run. Note that since there is no user interaction, the simulation might even complete in half a second, but nevertheless we need to show roughly 30 updates to the user before the game ends. This means we might have to "snapshot" values at given progress steps. In general I prefer decoupling the simulation from the UI.

>
> See also: `doc/engine/wasm-engine-plan.md` for the existing WASM design.

> ⚠️ **OI-10 (Hero AI integration)**: The behaviour bytes from the hero QR must drive the simulation AI. The connection point is the `decision_values` fields on the hero template entity (defined in `characters.md`). The QR encode/decode package must map the 12 (or 24) behaviour bytes onto the `decision_values` component fields before the hero entity is loaded into the engine. The exact mapping depends on the resolution of OI-5.


Decision: I don't understand the open points. The hero values, together with other "data" (e.g. enemy, levels) must be loaded into the engine when the game runs

---

### 4.8 Post-Battle Results Screen (`/play/results`)

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

### 4.9 Figurine / QR Generator Screen (`/figurine/:heroId`)

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

> ⚠️ **OI-11 (QR in shared PNG survival)**: WhatsApp and Telegram recompress images (JPEG, ~70% quality). A QR code embedded in a 360 × 640 displayed image may not survive this compression at small sizes. Mitigation strategies:
> - Render the QR at 400 × 400 px within the 1080 × 1920 canvas (large modules = compression-resistant).
> - Use EC-Q error correction (recovers up to 25% of damaged data).
> - Optionally omit the scannable QR from the shared image and instead include only the plain-text URL. Instruct users to copy the URL manually.
> - Provide two export variants: "Share (image)" (portrait art only, no QR) and "Share (figurine card with QR)".
>
> **Recommend testing empirically** with real WhatsApp sharing before deciding. The design should support both variants regardless.

Decision: let's test this empirically.

> ⚠️ **OI-12 (Hero portrait artwork)**: The figurine screen requires hero class portraits. For v1, use large class emojis or simple SVG placeholder art. For production, commission or generate (AI) per-class artwork in a consistent style. The canvas drawing code should accept an `img` element as the portrait layer, so swapping in real art is a drop-in change.

Decision: for now let's not use portraits. We'll add them later

---

## 5. Hero Binary Format

See `doc/figurine-qr-design.md` for the full specification. Summary for implementation:

### 5.1 Encoding Pipeline

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

### 5.2 Encoding Package Structure

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

### 5.3 Hero Binary Layout (byte-aligned first pass)

Based on `doc/figurine-qr-design.md` Section 2.1, adapted to align with `characters.md`:

```
Offset  Size    Field
──────  ──────  ─────────────────────────────────────────────────────
0       2B      magic: 0x42 0x51  ("BQ" — Blink QR)
2       1B      version: 0x01
3       1B      flags: bit 0 = compressed, bits 1-7 = reserved
4       2B      payload_len (LE uint16)
6       2B      crc16 (CRC-16/CCITT-FALSE of bytes 0..payload_len+5)
──── header (8 bytes) ────────────────────────────────────────────────
8       1B      name_length (0–24)
9       ≤24B    name (ASCII, 1 byte per char)
?       1B      class_id  (0=Warrior, 1=Mage, 2=Ranger, 3=Paladin,
                           4=Rogue, 5=Cleric)
?       5B      base_stats  (STR, DEX, INT, CON, WIS; each 0–15, 4 bits)
                            packed 2 stats per byte (5 stats → 3 bytes, 4 bits unused)
?       3B      growth_rates (STR, DEX, INT, CON, WIS; each 0–7, 3 bits)
                             packed (5 × 3 = 15 bits → 2 bytes)
?       1B      skills_count (0–10)
?       ≤10B    skill_ids  (each 0–255, 1 byte per skill ID)
?       1B      section_flags (bit 0 = mid present, bit 1 = end present)
──── early game behaviour (27B) ──────────────────────────────────────
?       24B     early_behaviour_bytes (signed, -128 to +127)
?       1B      early_primary_skill_id
?       1B      early_secondary_skill_id
?       1B      early_passive_skill_id
──── mid game behaviour (28B, if section_flags bit 0) ────────────────
?       1B      mid_level_trigger (2–48)
?       24B     mid_behaviour_bytes
?       3B      mid skill IDs
──── end game behaviour (28B, if section_flags bit 1) ────────────────
?       1B      end_level_trigger (3–49, > mid trigger)
?       24B     end_behaviour_bytes
?       3B      end skill IDs
──── footer ──────────────────────────────────────────────────────────
(CRC is in header; no separate footer needed)
```

> ⚠️ **OI-13 (behaviour bytes vs decision values alignment)**: See OI-5 above. The bit layout above uses 24 bytes per phase as in `blink-qr.md`; characters.md uses 12 signed 6-bit values (-32 to +31). Until OI-5 is resolved, implement the QR format with 24 bytes per phase (the superset) and map bytes 0–11 to the 12 named decision values using `clamp(byte, -32, 31)` (lower 6 bits of the signed byte). Bytes 12–23 are reserved and written as 0.

Decision: this is ok as a first version. We'll revised this later.

---

## 6. WASM Engine Integration

### 6.1 Engine Abstraction Interface

Both the JS engine and the WASM engine must implement the same `IBlinkEngine` interface. The battle screen and game context only speak to `IBlinkEngine`.

```typescript
// packages/blink-engine-interface/src/index.ts
export interface GameSnapshot {
  simulationTime: number;
  heroes: HeroSnapshot[];
  enemies: EnemySnapshot[];
  score: number;
  wave: number;
  tier: number;
  enemiesDefeated: number;
  log: LogEntry[];           // events since last snapshot
}

export interface IBlinkEngine {
  loadIR(ir: IRModule): Promise<void>;
  reset(): void;
  runSteps(n: number): void;       // advance simulation by n steps
  getSnapshot(): GameSnapshot;     // current UI state
  scheduleEvent(type: string, delay?: number, fields?: Record<string, unknown>): void;
  destroy(): void;
}
```

### 6.2 Pre-compilation at Build Time

BRL source files are compiled to IR JSON during the Vite build process:

```
make compile-brl
  → runs blink-compiler-ts on game/brl/*.brl
  → outputs game/ir/*.ir.json
  → Vite includes game/ir/ as static assets
```

At runtime, the app fetches the IR JSON files:
```typescript
const ir = await fetch('/game-files/classic-rpg.ir.json').then(r => r.json());
await engine.loadIR(ir);
```

### 6.3 Web Worker Architecture (for WASM)

```
Main Thread (React)              Worker Thread (WASM Engine)
─────────────────────────        ─────────────────────────────
BattleScreen renders UI  ←─────  postMessage({ type: 'snapshot', data })
                                                ↑
scheduleEvent('Retreat') ─────►  onmessage → engine.scheduleEvent(...)
setSpeed(2) ────────────────►  onmessage → tickMultiplier = 2
                                requestAnimationFrame loop:
                                  engine.runSteps(tickMultiplier)
                                  postMessage(engine.getSnapshot())
```

The Worker is initialized lazily when the battle screen mounts and terminated when it unmounts.

> ⚠️ **OI-14 (Worker vs main thread for JS engine)**: The JS engine is synchronous and runs on the main thread in the current prototype. For v1 (JS engine), keeping it on the main thread is acceptable since JS execution is fast enough at 1× speed. When the WASM engine is added, always run it in a Worker. The `IBlinkEngine` abstraction should make the Worker wrapper transparent.

Decision: forget the JS engine for now. In terms of WASM engine design. Also see OI-9 related to stepping behaviour

### 6.4 Hero Entity Injection

The hero QR payload must be converted to IR initial state entities before the engine is loaded:

```
QRHero[] (from roster selection)
  ↓  HeroEntityBuilder.build(qrHero)
IRInitialState entities (Character, Health, Stats, Skills, DecisionValues)
  ↓  merge into loaded IR's initial_state
engine.loadIR(mergedIR)
```

`HeroEntityBuilder` is responsible for:
1. Reading `qrHero.base_stats` → `Stats` component fields
2. Reading `qrHero.behaviour_bytes` → `DecisionValues` component fields (see OI-5 / OI-10)
3. Reading `qrHero.skill_ids` → `Skills` component fields
4. Creating the hero entity with `Character`, `Team`, `HeroTemplate` components

Decision: watch out, at runtime we're not going to work with the IR. The Engine must expose an interface allowing to set entities / components, that's how we'll load the initial state.

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

## 9. Open Issues Summary

All issues marked ⚠️ above are collected here for decision tracking.

| ID | Description | Impact | Recommended Path |
|---|---|---|---|
| OI-1 | JS vs WASM engine for v1 | Build complexity | Use JS engine behind abstraction; swap in WASM when ready |
| OI-2 | Stat value range and progression model | QR format, hero creator UI | 4-bit base stats, 3-bit growth rates |
| OI-3 | Stat/growth point budget shared or independent | Hero balance | Independent budgets with soft guidance |
| OI-4 | Skill tree structure (DAG prerequisites, skill count) | Hero creator Step 4 | Blocking: requires game design completion |
| OI-5 | 24 behaviour bytes vs 12 decision values — alignment | QR format, engine AI | Use 24 bytes in QR; map bytes 0–11 to decision values |
| OI-6 | localStorage vs IndexedDB for roster | Roster reliability | localStorage for v1; migrate to IndexedDB for v2 |
| OI-7 | Game mode QR export/import | QR format scope | Defer to v2 |
| OI-8 | Multi-device party composition | Social gameplay | Local-only for v1 |
| OI-9 | WASM engine Worker vs main thread | Performance architecture | Worker (recommended); main thread acceptable for JS engine v1 |
| OI-10 | Hero AI behaviour bytes → engine decision values wiring | Engine integration | Depends on OI-5; implement after OI-5 resolved |
| OI-11 | QR survival in WhatsApp/Telegram shared image | Figurine usability | Test empirically; provide both variants |
| OI-12 | Hero portrait artwork | Figurine visual quality | Emoji/SVG placeholders for v1 |
| OI-13 | Behaviour byte bit layout in QR | QR format stability | 24 bytes per phase; bytes 12–23 reserved as 0 |
| OI-14 | Worker wrapper for JS engine | Code architecture | Defer; JS engine on main thread is acceptable for v1 |

---

## 10. Implementation Order

The following sequence minimises blocking dependencies:

1. **Setup**: React Router, Tailwind, Vite config, base layout shell.
2. **`packages/blink-qr`**: Hero codec (encode/decode), BitWriter/BitReader, skill registry, CRC-16. *(No UI dependency)*
3. **Hero Creator Wizard**: Steps 1–3 (Identity, Stats, Growth) — no skill tree needed.
4. **Roster Screen**: Display, add, delete, persist to `localStorage`.
5. **Figurine Screen** (basic): QR generation only (no portrait art).
6. **QR Scanner**: Image import tab first (no camera permission complexity); camera tab second.
7. **Home Screen**: Import from URL param.
8. **Hero Creator Step 4** (Skill Progression): Unblocked once skill tree is designed (OI-4).
9. **Hero Creator Steps 5–7** (Behaviour): Unblocked once OI-5 is resolved.
10. **Game Mode Selection + Party Selection**.
11. **Engine abstraction** (`IBlinkEngine`) + load IR + inject hero entities.
12. **Battle Screen**: Render engine snapshots; combat log.
13. **Post-Battle Results Screen**.
14. **WASM engine**: Replace JS engine behind the abstraction (Track 7, parallel).
15. **PWA**: Add Vite PWA plugin, service worker, manifest.
16. **Portrait art**: Replace placeholders.
