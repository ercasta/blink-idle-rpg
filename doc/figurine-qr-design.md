# Figurine & QR Code Design

*Status: Draft for review — open issues are marked ⚠️*

---

## 1. Scope

This document explores:

1. How to encode a complete hero description in a compact binary format that fits inside a QR code payload (target ≤ 350 bytes including the game URL prefix).
2. Multiple sharing channels and figurine formats — physical printed card, sharable PNG image, direct link — and how they differ from each other.
3. Web client library options for QR-code generation and figurine image composition.
4. Player personalisation options: portrait, background, description text.

---

## 2. Hero Data Model & Field Budget

Based on `doc/blink-qr.md`, a hero is defined by:

| Field | Notes |
|---|---|
| Name | up to 24 ASCII characters |
| Stats progression | per-level allocation choices |
| Skill progression | ordered list of acquired skill IDs (≤ 256 skills in game) |
| Early-game behaviour | 24 "behaviour bytes" + primary/secondary/passive skill |
| Mid-game behaviour | level trigger + 24 behaviour bytes + 3 skills |
| End-game behaviour | level trigger + 24 behaviour bytes + 3 skills |

### 2.1 Byte Budget Analysis (byte-aligned first pass)

```
Header                           4 bytes  (magic 2B, version 1B, flags 1B)
Name length                      1 byte
Name body                     ≤ 24 bytes
Stats (e.g. 8 stats × 1B)        8 bytes
Skill progression (e.g. 8 IDs)   8 bytes  (at most 256 skills → 1B per ID)
Early behaviour bytes            24 bytes
Early primary/secondary/passive   3 bytes
Mid level trigger                 1 byte
Mid behaviour bytes              24 bytes
Mid primary/secondary/passive     3 bytes
End level trigger                 1 byte
End behaviour bytes              24 bytes
End primary/secondary/passive     3 bytes
CRC-16 footer                     2 bytes
─────────────────────────────────────────
Estimated total (raw)          ≈ 130 bytes
```

After base64-URL encoding (33 % overhead): ≈ 174 characters.
Add game URL prefix (`https://allsoulsrun.net/g.html?h=`, ~36 chars): **≈ 210 characters total** — well within a 350-byte QR payload.

This leaves generous headroom for future fields or compression layers.

### 2.2 Bit-Efficient Encoding

The problem statement requests bit-level packing: "if 3 bits are sufficient, use 3 bits". A custom bit-packed format can substantially reduce the raw byte count before compression is applied.

#### Proposed bit-packed fields

| Field | Range | Required bits | Notes |
|---|---|---|---|
| Name length | 0–24 | 5 bits | saves 3 bits vs 1 byte |
| Name chars | ASCII 32–95 | 6 bits each | saves 2 bits per char vs full ASCII; max 24 × 6 = 144 bits = 18 bytes |
| Class / archetype | 0–15 | 4 bits | |
| Stat value (per stat) | 0–7 | 3 bits | if values fit in 8 levels |
| Stat value (per stat) | 0–15 | 4 bits | if values fit in 16 levels |
| Skill ID | 0–255 | 8 bits | "at most 256 skills" |
| Behaviour byte | −128–127 | 8 bits | signed; already 1 byte |
| Level trigger | 1–100 | 7 bits | saves 1 bit vs 1 byte |
| Behaviour section presence | early/mid/end | 2 bits | flags |

#### Bit-packed layout sketch

```
Bits  0– 4   name_length (5 bits)
Bits  5–148  name_chars  (name_length × 6 bits, padded to byte boundary)
Bits ...      class_id   (4 bits)
Bits ...      stats_count (4 bits)  → stats_count × stat entries
              each stat: stat_id (6 bits) + stat_value (4 bits) = 10 bits
Bits ...      skills_count (5 bits) → skills_count × 8-bit skill IDs
Bits ...      section_flags (2 bits: mid_present, end_present)
Bits ...      [optional mid_trigger (7 bits)]
Bits ...      early: 24 × 8-bit behaviour + 3 × 8-bit skill IDs
Bits ...      [mid:  7-bit trigger + 24 × 8B + 3 × 8B]
Bits ...      [end:  7-bit trigger + 24 × 8B + 3 × 8B]
Bits ...      CRC-16 (16 bits, always byte-aligned at the end)
```

#### Estimated bit-packed sizes

| Hero profile | Raw bytes (byte-aligned) | Bit-packed bytes | Saving |
|---|---|---|---|
| 12-char name, 8 stats (4-bit), 8 skills, early only | ≈ 60 B | ≈ 46 B | ~23% |
| 20-char name, 12 stats (4-bit), 12 skills, all 3 sections | ≈ 130 B | ≈ 99 B | ~24% |
| Max: 24-char name, 16 stats (4-bit), 16 skills, all 3 sections | ≈ 148 B | ≈ 113 B | ~24% |

After bit-packing, apply DEFLATE compression (zlib). Typical DEFLATE savings on structured data: 20–40%, giving a final compressed size of **60–90 bytes** for a typical hero profile.

> ⚠️ **Open Issue OI-1**: What is the actual number of distinct stats, their value ranges, and the maximum skill list length? These numbers directly control the encoding width. Please confirm or adjust the table above.

---

## 3. QR Code Capacity & Version Selection

QR codes use a "version" (1–40) that sets the module grid size. The following table gives binary-mode capacity at common error correction (EC) levels:

| QR Version | Modules | EC-L capacity (bytes) | EC-M capacity (bytes) | EC-Q capacity (bytes) |
|---|---|---|---|---|
| 10 | 57 × 57 | 271 | 213 | 151 |
| 11 | 61 × 61 | 321 | 253 | 177 |
| 12 | 65 × 65 | 367 | 287 | 203 |
| 14 | 73 × 73 | 461 | 365 | 259 |
| 15 | 77 × 77 | 523 | 415 | 295 |
| 20 | 97 × 97 | 858 | 666 | 482 |

For a 210-character (byte) URL payload, **QR version 10 with EC-L** is sufficient. For physical prints where robustness matters, EC-M (version 12) is recommended — it still comfortably holds the 210-byte URL.

### 3.1 URL vs. Binary QR

**Option A — URL payload (recommended for broad compatibility)**

```
QR content:  https://allsoulsrun.net/g.html?h=<base64url-hero>
```

- Scannable by any phone camera app without the Blink app installed.
- Opens the game in the browser automatically.
- Base64URL adds ~33% overhead over the raw bytes.
- URL-safe characters: use `base64url` alphabet (`A–Z a–z 0–9 - _`) with no padding (`=`).

**Option B — binary payload + deep link**

Encode the compressed hero bytes directly in QR byte mode. The QR scanner produces raw bytes; the app (running as PWA/service worker) intercepts the share/scan and parses the bytes natively. Saves the base64 overhead but requires the Blink app to already be installed and handling the scan.

**Option C — short URL via server**

Store the hero JSON on the server and encode only a short ID in the QR:

```
QR content:  https://allsoulsrun.net/h/XK7Z
```

Requires server infrastructure. Eliminates all client-side size constraints. Makes sharing trivially small QR codes. The hero card image can then be regenerated from the server.

> ⚠️ **Open Issue OI-2**: Is a server backend planned? If yes, Option C simplifies everything. If no server, Option A is the practical default.

### 3.2 Encoding Pipeline (Option A)

```
Hero struct
    ↓  bit-pack
Raw bytes (≈ 60–100 B)
    ↓  DEFLATE (zlib, level 6)
Compressed bytes (≈ 45–80 B)
    ↓  base64url (no padding)
URL-safe string (≈ 60–107 chars)
    ↓  prepend URL prefix
Final URL (≈ 96–143 chars)
    ↓  encode in QR (byte mode, EC-M)
QR version 7–9  ← very compact
```

---

## 4. Figurine Sharing Channels

The physical QR card and the digital figurine image serve different use cases. Below are the proposed variants.

### 4.1 Physical Printed Card (Phygital Figurine)

**Layout options:**

| Layout | Elements | Notes |
|---|---|---|
| A — Portrait + QR | Hero portrait (top), QR code (bottom) | No space for description; cleanest look |
| B — Portrait + QR + Name | Portrait (top), Name (centre), QR (bottom) | Tight on small cards |
| C — QR only | Large QR with decorative border | Most scan-friendly; no portrait |

**Recommended for print**: Layout A with a 4 × 6 cm card. The QR should be at least 2 × 2 cm to be reliably scanned.

**Printing notes:**
- High-contrast (black on white) QR is essential.
- At 2 × 2 cm and version 12 (65 modules), each module ≈ 0.31 mm — marginal but printable at 300 DPI.
- Add a 4-module quiet zone around the QR.
- EC-Q is recommended for printed cards to survive minor damage or smudging.

### 4.2 Digital Figurine Image (PNG for sharing)

A 1080 × 1080 px or 1080 × 1920 px PNG generated entirely client-side using a `<canvas>` element. The image contains:

- Hero portrait
- Decorative frame / background
- QR code (rendered at high resolution inside the canvas)
- Optionally: hero name, short stat summary, player description

Users share this PNG image directly via WhatsApp, Telegram, Discord, etc.

**WhatsApp / Telegram sharing notes:**
- WhatsApp compresses images unless sent as "Document". Produce a PNG no larger than 1 MB and test that the embedded QR code remains decodable after compression.
- Alternatively, do NOT embed a scannable QR in the shared image (because compression will break it) — instead, embed the hero URL as text in the image and rely on "tap to copy link" or "scan from camera" using a separate QR.
- Another option: embed a large QR at 400 × 400 px within the image so that even after 70% JPEG recompression the QR survives (test empirically).

> ⚠️ **Open Issue OI-3**: Should the digital figurine PNG include a scannable QR, or only the link as visible text? The two approaches (high-res QR vs. plain URL text) have different trade-offs for messaging app compression.

### 4.3 Link + Preview (Open Graph / Meta Image)

If a server backend exists (see OI-2), the game site can serve an Open Graph image for any hero URL:

```
https://allsoulsrun.net/h/XK7Z
   → og:image  https://allsoulsrun.net/h/XK7Z/preview.png
```

When pasted into WhatsApp, iMessage, Slack, etc., the link unfurls with the hero portrait and name — no image attachment needed. Requires server-side image generation.

### 4.4 Comparison Summary

| Channel | QR needed | Server needed | Works offline | Best for |
|---|---|---|---|---|
| Physical card (print) | Yes (high quality) | No | Yes | Tabletop play, gifts |
| Digital PNG image | Optional (large) | No | Yes | WhatsApp, gallery |
| Short URL / link | In QR on card | Yes | No | Discord, SMS |
| Open Graph preview | No | Yes | No | Social, messaging |

---

## 5. Web Client Libraries

All generation runs client-side (no server required for Options A/B).

### 5.1 QR Code Generation

| Library | Size | Notes |
|---|---|---|
| **qrcode.js** (`davidshimjs/qrcodejs`) | ~17 KB | Simple, no deps, renders to canvas or img. Good for basic use. |
| **qrcode** (`soldair/node-qrcode`) | ~40 KB (browser bundle) | Promise-based, supports canvas/SVG/string. Widely maintained. |
| **qr-creator** (`nimiq/qr-creator`) | ~10 KB | Tiny, outputs SVG or canvas. Rounded/styled QR support. |
| **ZXing-js** | ~200 KB | Full barcode suite (encode + decode). Heavy but covers scanning too. |
| **jsQR** | ~70 KB | Decode only (reading QR from image/camera frame). |

**Recommended:**
- Generation: `qrcode` (soldair) — maintained, canvas output, supports binary payloads.
- Decoding (import from image): `jsQR` — fast, pure JS, works with `ImageData` from canvas.

### 5.2 Figurine / Card Image Composition

The figurine image is assembled on an HTML5 `<canvas>` element. No heavy library is strictly necessary, but the following helpers are useful:

| Library | Purpose | Size |
|---|---|---|
| **Fabric.js** | Canvas object model, layering, export to PNG | ~280 KB |
| **Konva.js** | Canvas layers, groups, events, export | ~200 KB |
| **html-to-image** | Convert a styled HTML/CSS div to a PNG | ~30 KB |
| **dom-to-image-more** | Similar to html-to-image | ~20 KB |
| Bare `canvas` API | Zero deps; requires manual draw calls | 0 KB |

**Options:**

**Option I — Bare canvas API** (zero dependency): Draw portrait, frame, QR, and text with `ctx.drawImage()` / `ctx.fillText()`. Lightweight but requires custom code for each layout.

**Option II — HTML + CSS → PNG**: Design the figurine card as a regular HTML `div` with CSS styling. Use `html-to-image` to rasterise it. Easiest for designers; respects CSS borders, shadows, web fonts, flexbox layout.

**Option III — Fabric.js / Konva**: Canvas object model with layers. Best if the figurine editor needs interactive drag-and-drop (e.g., repositioning the portrait or QR code).

> ⚠️ **Open Issue OI-4**: Is the figurine editor an interactive designer (drag elements), or a "pick a template then export" flow? This determines whether a full canvas object model (Fabric.js/Konva) is worth the bundle size, or whether the HTML+CSS → PNG approach is sufficient.

### 5.3 Compression

- **fflate** (~25 KB): Pure JS DEFLATE/gzip/zip. Fast, tree-shakable. Recommended.
- **pako** (~50 KB): Mature zlib port. Slightly larger.
- **lz-string** (~3 KB): LZW-based, URL-safe output. Smaller library and output is already URL-safe, but compression ratio is inferior to DEFLATE for binary data.

**Recommendation**: Use `fflate` for DEFLATE compression on the hero binary blob.

### 5.4 QR Scanning (Import from Image or Camera)

| Use case | Library | Notes |
|---|---|---|
| Decode from gallery image | `jsQR` | Feed `ImageData` from canvas |
| Live camera scan | `html5-qrcode` | Wraps camera API and ZXing |
| Full-featured | `@zxing/browser` | Heavier, handles more barcode types |

**Import from gallery flow (all client-side, no server):**

```
<input type="file" accept="image/*">
  ↓
FileReader.readAsDataURL(file)
  ↓
new Image() → load data URL
  ↓
draw to offscreen canvas → ctx.getImageData(...)
  ↓
jsQR(imageData.data, width, height)
  ↓
Parse & validate QR payload → import hero
```

---

## 6. Player Personalisation

### 6.1 Figurine Template & Background

Offer a set of built-in figurine templates that the player chooses from:

| Template | Description |
|---|---|
| Classic | Parchment-style scroll frame |
| Heroic | Bold metallic border with class icon |
| Dark | Shadow frame for rogue/warlock heroes |
| Nature | Leafy green border for druids/rangers |
| (custom upload) | Player provides their own background image |

Background selection should be persisted client-side (localStorage) so it is remembered when the player regenerates the figurine.

### 6.2 Hero Portrait

Three possible approaches:

**Approach A — AI-generated portrait asset library**

- Provide 50–200 pre-generated portraits grouped by hero class (warrior, mage, rogue, ranger, …).
- Player picks one. The portrait is identified by a small ID (1–2 bytes) that is stored in the figurine image metadata, but NOT in the QR payload (the QR only carries game data).
- Portraits are stored as web-optimised images (WebP, ~30–60 KB each) in a CDN folder.
- Pros: consistent art style, no upload needed, works offline if preloaded.
- Cons: limited variety; players may not find a portrait that feels like their hero.

**Approach B — Custom photo / image upload**

- Player uploads their own image (photo, AI-generated art, drawing).
- Cropped and scaled to the portrait slot client-side.
- Not stored on server; embedded in the exported PNG only.
- Pros: maximum personalisation.
- Cons: wildly varying art quality; no portrait in the QR (QR only carries hero stats).

**Approach C — AI-generation on device or via API**

- Integrate a free-tier text-to-image API (e.g., Stable Diffusion API, Ideogram free tier).
- Player types a short prompt ("old wizard with silver beard") and gets a portrait.
- Generated image is embedded in the figurine PNG only.
- Pros: maximum personalisation with consistent quality.
- Cons: requires external API key / service; not fully offline; cost at scale.

> ⚠️ **Open Issue OI-5**: Which portrait approach(es) should be supported at launch? The recommendation is to start with **Approach A** (curated asset library, no external dependency) and optionally add **Approach B** (custom upload) as a secondary option. Approach C can be revisited later.

### 6.3 Hero Description

The player may type a short flavour text (e.g., "Veteran of the Ash Wars, bearer of the Obsidian Axe").

- Description is **not** encoded in the QR code (it is purely cosmetic).
- It is included as text in the figurine PNG image (overlaid or in a text box area of the card).
- Description stored in localStorage and pre-filled when the figurine generator is opened.
- Maximum recommended length: 120 characters to fit in the card layout.

### 6.4 Figurine Layout Variants

The space constraint on a printed card is real. Proposed layout options:

**Layout A: Portrait + QR (minimal, print-safe)**
```
┌─────────────────────────┐
│     [Hero Portrait]     │  ← 60% card height
│                         │
├─────────────────────────┤
│   ████████████████      │
│   ██  [QR Code]  ██     │  ← 40% card height
│   ████████████████      │
└─────────────────────────┘
```
No text. Maximum portrait and QR size. Best for small cards.

**Layout B: Portrait + Name + QR**
```
┌─────────────────────────┐
│     [Hero Portrait]     │  ← 55%
├─────────────────────────┤
│    THORDAIN IRONVEIL    │  ← 10% (name, bold)
├─────────────────────────┤
│       [QR Code]         │  ← 35%
└─────────────────────────┘
```

**Layout C: Portrait + Stats strip + QR (digital-only)**
```
┌─────────────────────────┐
│     [Hero Portrait]     │  ← 50%
├─────────────────────────┤
│  LVL 42 ⚔ 78  🛡 55    │  ← 10% (stat strip)
├─────────────────────────┤
│  "Veteran of Ash Wars"  │  ← 10% (description)
├─────────────────────────┤
│       [QR Code]         │  ← 30%
└─────────────────────────┘
```
Too much content for a physical 4 × 6 cm card; suitable for a 1080 × 1920 digital share image.

**Recommendation**: Offer Layout A and Layout B for print; Layout C for digital sharing.

---

## 7. Implementation Roadmap (Proposed)

The following steps are ordered by dependency:

1. **Define canonical hero binary format** (bit-packed). Finalise field list, widths, and version byte. Write a reference JavaScript encoder/decoder with unit tests.
2. **QR generation prototype**: Use `qrcode` library to generate a test QR for a sample hero URL. Verify scan with multiple phone cameras.
3. **Figurine canvas prototype**: Render Layout A (portrait + QR) on a `<canvas>` using the bare canvas API. Export as PNG. Verify WhatsApp share quality.
4. **Asset library**: Create or source 20 test hero portraits (one per class/race). Integrate the portrait picker UI.
5. **Template / background picker**: Implement background selection with 4 starter templates.
6. **Description field**: Add a text input; overlay text on the canvas render.
7. **Import from image**: Implement the FileReader → canvas → jsQR flow.
8. **Live camera scan**: Integrate `html5-qrcode` for direct scanning.
9. **Polish & mobile UX**: Ensure figurine generation works on mobile Chrome (Android) and Safari (iOS).

---

## 8. Open Issues Summary

| ID | Description | Impact |
|---|---|---|
| OI-1 | Confirm number of stats, value ranges, and max skill list length | Encoding width, QR version |
| OI-2 | Is a server backend available? | Enables short-URL QR and OG preview |
| OI-3 | Should digital PNG embed a scannable QR, or just visible URL text? | WhatsApp compression risk |
| OI-4 | Is the figurine editor interactive (drag/drop) or template-based? | Library choice |
| OI-5 | Portrait approach at launch: curated library, custom upload, or AI? | Asset work, external deps |

---

## 9. References

- `doc/blink-qr.md` — hero data model and QR concept
- `doc/digital-figurines.md` — figurine payload spec and import flow
- QR code capacity tables: ISO/IEC 18004:2015
- `qrcode` library: https://github.com/soldair/node-qrcode
- `jsQR` library: https://github.com/cozmo/jsQR
- `fflate` library: https://github.com/101arrowz/fflate
- `html-to-image` library: https://github.com/bubkoo/html-to-image
