# Plan: Blink-QR — Streamlined Mobile Idle RPG

Created: 2026-04-04
Status: Draft — pending user review

## TL;DR

Transform the current developer-oriented Blink Idle RPG into a streamlined mobile-first game where players configure heroes via a compact binary format (~140 bytes) that fits in a QR code URL. No compilation screens — heroes are configured through a mobile-friendly character creation UI, shared as QR codes / digital figurines, and the game runs in-browser (potentially via WebAssembly).

---

## Current State Assessment

### What works
- TypeScript compiler (BRL → IR) is functional
- JavaScript engine (ECS, timeline, rule execution) works
- Game rules (classic-rpg.brl) define complete combat system (3 tiers, wave-based, boss fight)
- Enemy definitions and game config are solid
- Testing framework with fluent API exists
- React 19 + Vite UI with scenario/party selection and battle screen
- 36 skills across 4 classes (Warrior, Mage, Rogue, Cleric — 9 each)

### What's broken / incomplete
- Game described as "unfinished / buggy" — complete restructuring planned
- No mobile optimization
- No QR/figurine functionality

### What must fundamentally change for Blink-QR
- Hero definition: from BRL entity templates → compact binary (~140 bytes)
- Player interaction: from code editing → mobile UI sliders/pickers
- Decision logic: 24 "behaviour bytes" per game phase drive hero AI
- IDE removed from player app (kept for future "Studio" version)
- Potentially port engine to WebAssembly for mobile perf

---

## Work Areas (Parallel Tracks)

### Track 1: Language & Engine
- BRL is the single language for both game rules and game data
- No separate BCL — decision logic is encoded in the QR hero binary format as "behaviour bytes"
- Engine improvements for mobile performance
- Compiler cleanup and test suite

### Track 2: Game Design
- Define the complete skill set (36 skills, 4 classes)
- Assign skill IDs 0-255
- Design behaviour byte semantics (24 bytes per game phase)
- Define stat progression model
- Balance wave difficulty and boss encounters

### Track 3: UX & Figurines
- Mobile-first character creation wizard
- QR code generation and scanning
- Digital figurine creation and sharing
- Roster management

---

## Hero Binary Format

Goal: Encode a complete hero in a URL-safe string fitting in a QR code.

### Hero Payload Structure (~141-166 bytes)

| Field | Size | Notes |
|-------|------|-------|
| Header | 8B | magic(2), version(1), flags(1), payload_len(2), crc16(2) |
| name_len + name | 1+25B max | ASCII hero name |
| class_id | 1B | Warrior=0, Mage=1, Rogue=2, Cleric=3 |
| base_stats | 5B | STR, DEX, INT, CON, WIS (each 0-255) |
| stats_growth | 5B | Per-level growth for each stat |
| skill_progression | 1+10B | count(1) + up to 10 skill_ids learned in level order |
| Early game behaviour | 27B | 24 behaviour bytes + primary(1) + secondary(1) + passive(1) |
| Mid game behaviour | 28B | trigger_level(1) + 24 behaviour bytes + 3 skills |
| End game behaviour | 28B | trigger_level(1) + 24 behaviour bytes + 3 skills |
| Footer | 2B | CRC16 validation |

### 24 Behaviour Bytes (proposed — needs game design review)

| Byte | Name | -128 extreme | +127 extreme |
|------|------|-------------|-------------|
| 0 | fight_flight | Always flee | Never flee |
| 1 | aggression | Very passive | Very aggressive |
| 2 | target_priority | Weakest first | Strongest first |
| 3 | target_type | Ignore healers | Focus healers |
| 4 | skill_vs_basic | Always basic attack | Always use skills |
| 5 | conserve_mana | Hoard mana | Spend freely |
| 6 | burst_vs_sustain | Sustained damage | Front-load burst |
| 7 | aoe_vs_single | Always single target | Always AoE |
| 8 | self_preservation | Sacrifice self | Self above all |
| 9 | ally_protection | Ignore allies | Protect allies |
| 10 | heal_threshold | Heal at low HP only | Heal proactively |
| 11 | buff_priority | Never buff | Always buff first |
| 12 | debuff_priority | Never debuff | Always debuff first |
| 13 | positioning | Stay back | Push forward |
| 14 | risk_tolerance | Play safe | Take risks |
| 15 | area_selection | Easy areas | Hard areas |
| 16 | difficulty_pref | Avoid challenges | Seek challenges |
| 17-23 | reserved | Default 0 | Reserved for future |

---

## Implementation Steps

### QR Package

1. Create packages/blink-qr/ package
   - encode/decode hero to/from Uint8Array
   - Base64URL conversion (URL-safe, no +/=)
   - CRC16 validation, version checking
   - DEFLATE compression (optional, flagged in header)

2. Create skill registry — Map 36 existing skills to IDs 0-255
   - File: packages/blink-qr/src/skill-registry.ts

3. Create behaviour interpreter — byte-driven hero AI
   - Maps 24 bytes + context → engine decisions (target selection, skill choice, flee)
   - File: packages/blink-qr/src/behaviour-interpreter.ts

4. Create hero-to-IR bridge — Convert QRHero → engine entities
   - Generate IR initial_state entries the engine expects
   - Wire behaviour interpreter as decision layer

### WebAssembly Engine (conditional)

5. Benchmark JS engine on real mobile devices — Profile Android/iOS

6. If WASM needed: Port ECS/Timeline/RuleExecutor to Rust with wasm-bindgen

### Mobile UI

7. Split app into two targets:
   - game/app/ → Player-facing (Blink-QR)
   - game/studio/ → Developer IDE (future, not initially published)

8. Add React Router
   - Routes: / (home), /create (hero creator), /roster, /play, /scan, /figurine
   - Support ?h=<base64> URL param for auto-import

9. Build mobile-friendly hero creator — Step-by-step wizard:
   1. Identity: Name input, class picker with icons
   2. Stats: 5 sliders with point-buy, per-level growth sliders
   3. Skills: Skill progression picker from class pool
   4. Early Game: 24 behaviour sliders + skill selection
   5. Mid Game: Same + level trigger
   6. End Game: Same + level trigger
   7. Review & QR: Summary card, QR code, share/print

10. QR generation — qrcode or qr-code-styling library
    - QR overlaid on hero card art

11. QR scanning — html5-qrcode library
    - Camera scanning (mobile) + image file import (gallery) + clipboard paste (desktop)

12. Roster screen — localStorage/IndexedDB hero storage

13. Figurine creator — Canvas rendering: hero art + stats + QR
    - Export PNG/JPEG, Web Share API, print layout

14. Redesign battle screen for mobile — Vertical layout, auto-play

---

## Key Files

### Keep (core)
- packages/blink-engine/src/ — Engine (ECS, timeline, rule executor)
- packages/blink-compiler-ts/src/ — Compiler (for Studio)
- packages/blink-test/ — Test framework
- game/brl/classic-rpg.brl — Combat rules
- game/brl/enemies.brl — Enemy definitions
- game/brl/game-config.brl — Game config

### Modify
- game/app/src/App.tsx — Remove IDE split-pane, add router
- game/app/src/components/GameUI.tsx — Mobile vertical layout
- game/app/src/components/GameContext.tsx — Load QR heroes
- game/app/src/main.tsx — URL param parsing (?h=)
- game/app/package.json — Add QR, router, UI deps

### Create
- packages/blink-qr/ — Hero format, encode/decode, QR, skill registry, behaviour interpreter, hero bridge
- game/app/src/screens/ — HeroCreator, Roster, Scanner, Figurine, Battle
- game/app/src/components/qr/ — QR generation & scanning
- game/app/src/components/figurine/ — Figurine renderer

### Move to Studio (future)
- game/app/src/components/ide/ — Editor, Inspector, Toolbar, Console, StepControls

---

## Open Issues

1. **WASM necessity**: Benchmark JS first (Option C) or commit to Rust upfront (Option A)?
   Recommendation: Benchmark first. Event-driven game may not need WASM.

2. **Behaviour byte semantics**: 24 bytes need careful game design. Start with 8-10 well-defined, reserve rest.
   Recommendation: Iterate via playtesting.

3. **Stat progression model**: (A) Fixed growth/level — simplest, fits QR. (B) Growth curve — more interesting. (C) Point allocation — most control but won't fit.
   Recommendation: Option A — fixed linear growth.

4. **Hosting/deployment**: Static hosting (GitHub Pages/Netlify/Cloudflare) is sufficient. Decide now or defer?

5. **Art/visuals**: Character creation and figurines need artwork. Placeholder for MVP?

6. **PWA**: Progressive Web App would allow offline play, home screen icon, easier gallery import. Add to Phase 4?

7. **Content scope**: 36 skills + 3 tiers sufficient for launch? 
   Recommendation: Launch with current content, expand post-launch.

8. **Party composition UX**: Each player brings 1 hero (scan friends for party)? Or configure all 3-4?
   Recommendation: Support both — 1 required, fill from roster/scans.
