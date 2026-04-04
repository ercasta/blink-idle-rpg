### Digital figurines & gallery import

- Target QR payload: assume up to 500 bytes (after any compression). This fits comfortably in a reasonably small QR with error-correction level M or Q and is practical for printed figurines and digital images.

- Digital figurine format & sharing:
  - Produce a PNG/JPEG image of the figurine that includes the QR code and visual art. Users can share this image via WhatsApp, Telegram, or save it to their phone gallery.
  - When shared in chats, recipients can save the image to their gallery and then import it into the web app.

- Client-side gallery import on Android (no server required):
  - UI: provide an "Import from image" button that opens an <input type="file" accept="image/*"> picker.
  - Flow (high level): File input → FileReader.readAsDataURL(file) → create Image() and load the data URL → draw image to an offscreen canvas → ctx.getImageData(...) → run a JS QR decoder (jsQR or ZXing) on the ImageData → parse payload (decompress/decode if needed) → validate and import hero/template.
  - All decoding runs in-browser (Chrome on Android and most modern Android browsers support this flow).

- Alternative / convenience flows:
  - Live camera scanning: use getUserMedia with a live QR scanner (html5-qrcode, ZXing) for instant scanning without saving images.
  - Clipboard/image paste & drag/drop are useful fallbacks on desktop.
  - Web Share Target or receiving images directly via share sheet typically requires a PWA/service worker and (often) a server endpoint; for a purely client-side approach the save-to-gallery → import flow is the most reliable.

- Encoding & reliability recommendations:
  - Compress payload (LZ-string or DEFLATE/gzip) before encoding in the QR to improve scan reliability and reduce required QR version.
  - Use byte-mode/UTF-8 payloads when possible to avoid base64 overhead; if base64 is required expect ~33% overhead.
  - Choose error correction M or Q for a balance of capacity and robustness.
  - WhatsApp/Telegram may recompress or resize images; produce a high-resolution image for sharing and include a plain-text short ID in the image as a fallback.

- UX & validation:
  - Provide clear guidance: "Save the shared figurine image to your gallery, then open the app and tap Import → choose the image."
  - Offer both "Import from image" and live "Scan with camera" options.
  - Validate decoded payload schema and version before importing; prompt for passphrase if payload is encrypted.

- Security & privacy:
  - Treat imported payloads as untrusted: validate schema, sanitize fields, and show a preview before applying changes.
  - Warn users about importing content from untrusted sources and about any public links embedded in images.

- Next steps (in-doc actions):
  - Add a small code snippet example for the FileReader→canvas→jsQR flow in the docs.
  - Recommend testing with representative 500-byte payloads and with images shared via WhatsApp to confirm decoding success.


  ### Phygital (printed) figurines
- Print physical hero figurines with an integrated QR code on the base or card so anyone can scan and instantly open the public web page to play or import that hero.
- QR payload options:
  - Short link to a hosted hero JSON or public hero page (preferred for large payloads).
  - Encoded/compressed hero JSON directly in the QR if the data is small.
- Requirements & UX:
  - Use short, stable URLs (or encourage users to upload the JSON to a cloud storage link) to reduce QR complexity and increase scan reliability.
  - Include a human-readable hero name/ID and minimal stats on the base for quick identification.
  - Offer an in-app flow that recognizes scanned links, fetches the hero (with CORS guidance), and prompts to import or view.
- Printing notes:
  - Test QR contrast/size for reliable scanning from typical phone cameras.
  - Consider adding a fallback short code (hero ID) printed on the base for manual entry.
- Optional enhancements:
  - NFC tag on the figurine with the same link (for devices that support it).
  - Seed-based hero generation so QR can contain a short seed/string instead of full JSON.
---

## Proposed canonical encoding (documentation-only)

This section defines the concrete information content that can be carried in a 512-byte figurine payload. It is intended for discussion and review — implementation is paused.

Canonical fields
- name: fixed ASCII, max 25 bytes (name_len:1 + name)
- class_id: 1 byte
- stats: sequence of (stat_id:1, value:1) pairs
- skills: sequence of (skill_id:1, level:1) pairs
- embedding: raw byte vector (0..255 values), prefixed with length (1 byte)
- header: magic(2), version(1), flags(1), payload_len(2), crc16(2)
- footer: optional crc16 (2 bytes)

Canonical layout (human-readable)
- Header (8 bytes): magic(2), version(1), flags(1), payload_len(2), crc16(2)
- Body:
  - name_len(1) + name (up to 25 bytes)
  - class_id(1)
  - stats_count(1) + stats[stat_id(1), value(1)] * stats_count
  - skills_count(1) + skills[skill_id(1), level(1)] * skills_count
  - embed_len(1) + embed_bytes[embed_len]
  - optional footer crc16(2)

Size-budget examples
- Fixed overhead: header(8) + name(1+25) + class(1) + embed_len(1) + footer(2) = 39 bytes
- Examples:
  - Small: 64-dim embedding, 10 stats, 8 skills => ~140 bytes
  - Medium: 128-dim, 20 stats, 16 skills => ~240 bytes
  - Large: 256-dim, 50 stats, 20 skills => ~436 bytes
(All examples ≤ 512 bytes)

Compression & QR guidance
- Compress body with DEFLATE (zlib) and set compressed flag in header.
- Use QR byte mode (binary) and error correction M; use Q for risky physical prints.
- For 4x4 cm prints, target module size 0.45–0.5mm (quiet zone included) → QR versions ~14–16 typically sufficient for compressed 512-byte payloads.
- If compressed payload exceeds capacity for print size, use a short hosted URL encoded in the QR and include the short code on the figurine.

Trade-offs & notes
- ASCII names are simpler and fixed-size; switch to UTF-8 later if needed.
- Per-entry stat/skill pairs are simple and extensible; use bitmasks to save space when entries are presence-only.
- Embedding as raw bytes is convenient; consider quantization/delta encoding for tighter packing if needed.

Examples to include (for review)
- Example A: 25-char name, class 3, 10 stats, 8 skills, 64-dim embedding — include hex sample and estimated QR version.
- Example B: 12-char name, class 7, 20 stats, 16 skills, 128-dim embedding — include compressed size sample.
- Example C: 8-char name, class 2, 50 stats, 20 skills, 256-dim embedding — show packing and trade-offs.

Next steps
- This document is the requested artefact. Implementation/prototyping will remain paused until review.
- If approved, the next action would be to add a reference serializer and test payloads.

---

