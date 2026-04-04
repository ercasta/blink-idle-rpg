import QRCode from 'qrcode';

export interface HeroData {
  id?: string | number;
  name: string;
  class: string;
  level: number;
  baseHealth: number;
  baseMana: number;
  baseDamage: number;
  baseDefense: number;
  description: string;
  role: string;
  difficulty: string;
}

export interface SavedHero {
  id: string;
  savedAt: number;
  heroData: HeroData;
}

export const GALLERY_KEY = 'blink-rpg-hero-gallery';
export const MAX_GALLERY_ITEMS = 20;

// ── Class icons ─────────────────────────────────────────────────────────────
const CLASS_EMOJIS: Record<string, string> = {
  Warrior: '⚔️',
  Mage: '🔮',
  Rogue: '🗡️',
  Cleric: '✨',
  Ranger: '🏹',
  Paladin: '🛡️',
};
const DEFAULT_EMOJI = '🦸';
export function getClassEmoji(heroClass: string): string {
  return CLASS_EMOJIS[heroClass] ?? DEFAULT_EMOJI;
}

// ── URL helpers ──────────────────────────────────────────────────────────────
/** Encodes hero data into a URL-safe base64 fragment so the game can reconstruct it. */
export function encodeHeroUrl(hero: HeroData): string {
  const base = window.location.href.split('?')[0].split('#')[0];
  const payload = JSON.stringify({
    n: hero.name,
    c: hero.class,
    l: hero.level,
    h: hero.baseHealth,
    m: hero.baseMana,
    d: hero.baseDamage,
    def: hero.baseDefense,
    r: hero.role,
    diff: hero.difficulty,
  });
  const encoded = btoa(payload)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${base}#hero/${encoded}`;
}

/** Decodes a hero from the URL hash fragment. Returns null if the hash is absent/invalid. */
export function decodeHeroFromHash(hash: string): Partial<HeroData> | null {
  try {
    const match = hash.match(/^#hero\/([A-Za-z0-9\-_]+)/);
    if (!match) return null;
    const padded = match[1].replace(/-/g, '+').replace(/_/g, '/');
    // Re-add the base64 '=' padding that was stripped during URL-safe encoding
    const paddingNeeded = (4 - (padded.length % 4)) % 4;
    const json = atob(padded + '='.repeat(paddingNeeded));
    const d = JSON.parse(json);
    return {
      name: d.n,
      class: d.c,
      level: d.l,
      baseHealth: d.h,
      baseMana: d.m,
      baseDamage: d.d,
      baseDefense: d.def,
      role: d.r,
      difficulty: d.diff,
    };
  } catch {
    return null;
  }
}

// ── PNG iTXt metadata injection ──────────────────────────────────────────────
/**
 * Builds a CRC-32 lookup table (PNG uses the standard polynomial 0xEDB88320).
 * Computed once at module load time.
 */
const CRC32_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Embeds an iTXt (international text) chunk into a PNG data-URL.
 * The metadata is readable by tools like ExifTool / pnginfo.
 * Inserted right after the mandatory IHDR chunk (offset 33).
 */
export function embedPngMetadata(
  dataUrl: string,
  keyword: string,
  text: string
): string {
  try {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const enc = new TextEncoder();
    const kwBytes = enc.encode(keyword); // keyword (max 79 Latin-1 chars)
    const txBytes = enc.encode(text);

    // iTXt layout: keyword NUL compFlag compMethod lang NUL transKW NUL text
    const chunkData = new Uint8Array(
      kwBytes.length + 1 + 1 + 1 + 1 + 1 + txBytes.length
    );
    let pos = 0;
    chunkData.set(kwBytes, pos);
    pos += kwBytes.length;
    chunkData[pos++] = 0x00; // NUL terminator for keyword
    chunkData[pos++] = 0x00; // compression flag  (0 = uncompressed)
    chunkData[pos++] = 0x00; // compression method (0 = deflate)
    chunkData[pos++] = 0x00; // language tag – empty, NUL terminated
    chunkData[pos++] = 0x00; // translated keyword – empty, NUL terminated
    chunkData.set(txBytes, pos);

    const typeBytes = enc.encode('iTXt');
    const crcInput = new Uint8Array(typeBytes.length + chunkData.length);
    crcInput.set(typeBytes);
    crcInput.set(chunkData, typeBytes.length);
    const checksum = crc32(crcInput);

    // Full chunk: 4-byte length + 4-byte type + data + 4-byte CRC
    const chunk = new Uint8Array(4 + 4 + chunkData.length + 4);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, chunkData.length, false); // big-endian
    chunk.set(typeBytes, 4);
    chunk.set(chunkData, 8);
    dv.setUint32(8 + chunkData.length, checksum, false);

    // PNG signature (8 bytes) + IHDR chunk (4+4+13+4 = 25 bytes) = 33 bytes
    const ihdrEnd = 33;
    const out = new Uint8Array(bytes.length + chunk.length);
    out.set(bytes.slice(0, ihdrEnd));
    out.set(chunk, ihdrEnd);
    out.set(bytes.slice(ihdrEnd), ihdrEnd + chunk.length);

    // Convert to binary string in 8 KiB chunks to avoid call-stack limits on large PNGs
    const chunks: string[] = [];
    for (let i = 0; i < out.length; i += 8192) {
      chunks.push(String.fromCharCode(...Array.from(out.subarray(i, i + 8192))));
    }
    return 'data:image/png;base64,' + btoa(chunks.join(''));
  } catch {
    return dataUrl; // fallback: return original on any error
  }
}

// ── Canvas helpers ───────────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Logical canvas dimensions (drawing coordinate space, independent of DPI scale)
const LW = 300;
const LH = 450;
/** High-DPI scale applied to all canvases (2× → 600×900 actual pixels). */
const CANVAS_SCALE = 2;

export const CANVAS_CSS_WIDTH = LW;
export const CANVAS_CSS_HEIGHT = LH;

function initCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = LW * CANVAS_SCALE;
  canvas.height = LH * CANVAS_SCALE;
  canvas.style.width = `${LW}px`;
  canvas.style.height = `${LH}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(CANVAS_SCALE, CANVAS_SCALE);
  return ctx;
}

// ── Print-friendly figurine (black & white) ──────────────────────────────────
/**
 * Draws a print-friendly (B&W) figurine onto the given canvas.
 * Includes: game title, hero name/class, stats table, and QR code.
 */
export async function drawPrintFigurine(
  canvas: HTMLCanvasElement,
  hero: HeroData
): Promise<void> {
  const ctx = initCanvas(canvas);
  const W = LW,
    H = LH;

  // ── Background ──
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // ── Outer + inner border ──
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.lineWidth = 1;
  ctx.strokeRect(9, 9, W - 18, H - 18);

  // ── Game title header ──
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 11px serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚔  BLINK IDLE RPG  ⚔', W / 2, 30);

  ctx.beginPath();
  ctx.moveTo(15, 36);
  ctx.lineTo(W - 15, 36);
  ctx.stroke();

  // ── Class emoji (portrait area) ──
  ctx.font = '56px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(getClassEmoji(hero.class), W / 2, 95);
  ctx.textBaseline = 'alphabetic';

  // ── Hero name ──
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 22px serif';
  ctx.textAlign = 'center';
  ctx.fillText(hero.name, W / 2, 148);

  // ── Class + Level ──
  ctx.font = '13px serif';
  ctx.fillStyle = '#333333';
  ctx.fillText(`${hero.class}  ·  Level ${hero.level}`, W / 2, 166);

  // ── Separator ──
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 176);
  ctx.lineTo(W - 50, 176);
  ctx.stroke();

  // ── Stats ──
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';

  const stats: [string, string | number, string, string | number][] = [
    ['HP', hero.baseHealth, 'MP', hero.baseMana],
    ['ATK', hero.baseDamage, 'DEF', hero.baseDefense],
  ];
  stats.forEach(([l1, v1, l2, v2], i) => {
    const y = 196 + i * 20;
    ctx.fillText(`${l1}: ${v1}`, 30, y);
    ctx.fillText(`${l2}: ${v2}`, W / 2 + 10, y);
  });

  // Role + difficulty
  ctx.font = '10px monospace';
  ctx.fillStyle = '#555555';
  ctx.textAlign = 'center';
  ctx.fillText(`Role: ${hero.role}   |   Difficulty: ${hero.difficulty}`, W / 2, 240);

  // ── QR code label ──
  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'center';
  ctx.fillText('Scan to view this hero in Blink Idle RPG', W / 2, 264);

  // ── QR code ──
  const heroUrl = encodeHeroUrl(hero);
  const qrDataUrl = await QRCode.toDataURL(heroUrl, {
    width: 130,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject(new Error('QR image failed to load'));
    qrImg.src = qrDataUrl;
  });
  ctx.drawImage(qrImg, (W - 130) / 2, 270, 130, 130);

  // ── Bottom separator ──
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(15, H - 36);
  ctx.lineTo(W - 15, H - 36);
  ctx.stroke();

  // ── Footer ──
  ctx.font = '8px sans-serif';
  ctx.fillStyle = '#888888';
  ctx.textAlign = 'center';
  ctx.fillText('blink-idle-rpg', W / 2, H - 20);
}

// ── Digital figurine (full colour, sharing-friendly) ────────────────────────
/**
 * Draws a colourful portrait-style figurine suitable for sharing via
 * WhatsApp, social media, or saving to the device gallery.
 * Does NOT include a QR code – the game URL appears as readable text.
 */
export function drawDigitalFigurine(
  canvas: HTMLCanvasElement,
  hero: HeroData
): void {
  const ctx = initCanvas(canvas);
  const W = LW,
    H = LH;

  // ── Background gradient ──
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, '#2d2520');
  bg.addColorStop(1, '#1a1008');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Gold outer border ──
  ctx.strokeStyle = '#c9956b';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.strokeStyle = 'rgba(201,149,107,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(9, 9, W - 18, H - 18);

  // ── Corner ornaments ──
  const corners = [
    [14, 14],
    [W - 14, 14],
    [14, H - 14],
    [W - 14, H - 14],
  ] as const;
  ctx.fillStyle = '#c9956b';
  ctx.font = '10px serif';
  ctx.textBaseline = 'middle';
  corners.forEach(([x, y]) => {
    ctx.textAlign = x < W / 2 ? 'left' : 'right';
    ctx.fillText('◆', x, y);
  });
  ctx.textBaseline = 'alphabetic';

  // ── Game title ──
  ctx.font = 'bold 11px serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9956b';
  ctx.fillText('⚔  BLINK IDLE RPG  ⚔', W / 2, 30);

  ctx.strokeStyle = 'rgba(201,149,107,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 38);
  ctx.lineTo(W - 20, 38);
  ctx.stroke();

  // ── Portrait circle ──
  const cx = W / 2,
    cy = 128,
    r = 68;

  // Subtle outer glow
  ctx.shadowColor = '#c9956b';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#c9956b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Circle fill gradient
  const portraitGrad = ctx.createRadialGradient(cx, cy - 20, 8, cx, cy, r);
  portraitGrad.addColorStop(0, 'rgba(201,149,107,0.28)');
  portraitGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = portraitGrad;
  ctx.fill();

  // ── Class emoji portrait ──
  ctx.font = '60px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(getClassEmoji(hero.class), cx, cy);
  ctx.textBaseline = 'alphabetic';

  // ── Hero name ──
  ctx.fillStyle = '#c9956b';
  ctx.font = 'bold 23px serif';
  ctx.textAlign = 'center';
  ctx.fillText(hero.name, W / 2, 220);

  // ── Class + Level ──
  ctx.fillStyle = '#8a7a68';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${hero.class}  ·  Level ${hero.level}`, W / 2, 237);

  // ── Role badge ──
  const roleText = hero.role;
  ctx.font = '11px sans-serif';
  const roleW = ctx.measureText(roleText).width + 18;
  const roleX = (W - roleW) / 2;
  roundRect(ctx, roleX, 245, roleW, 20, 4);
  ctx.fillStyle = 'rgba(201,149,107,0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,149,107,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#c9956b';
  ctx.textAlign = 'center';
  ctx.fillText(roleText, W / 2, 259);

  // ── Separator ──
  ctx.strokeStyle = 'rgba(201,149,107,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 274);
  ctx.lineTo(W - 20, 274);
  ctx.stroke();

  // ── Stats 2×2 grid ──
  const statBoxW = 118,
    statBoxH = 44,
    gap = 8;
  const gridX = (W - (2 * statBoxW + gap)) / 2;
  const gridY = 282;

  const statItems: { label: string; value: number; icon: string }[] = [
    { icon: '❤️', label: 'HP', value: hero.baseHealth },
    { icon: '⚔️', label: 'ATK', value: hero.baseDamage },
    { icon: '💧', label: 'MP', value: hero.baseMana },
    { icon: '🛡️', label: 'DEF', value: hero.baseDefense },
  ];

  statItems.forEach((stat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = gridX + col * (statBoxW + gap);
    const sy = gridY + row * (statBoxH + gap);

    roundRect(ctx, sx, sy, statBoxW, statBoxH, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,149,107,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#8a7a68';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${stat.icon} ${stat.label}`, sx + 8, sy + 16);

    ctx.fillStyle = '#c9956b';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(stat.value), sx + statBoxW - 8, sy + 36);
  });

  // ── Description (truncated) ──
  if (hero.description) {
    const maxLen = 68;
    const desc =
      hero.description.length > maxLen
        ? hero.description.slice(0, maxLen) + '…'
        : hero.description;
    ctx.fillStyle = '#7a6a58';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(desc, W / 2, 382);
  }

  // ── Bottom separator ──
  ctx.strokeStyle = 'rgba(201,149,107,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, H - 50);
  ctx.lineTo(W - 20, H - 50);
  ctx.stroke();

  // ── Hero URL (acts as the "clickable link" text) ──
  const heroUrl = encodeHeroUrl(hero);
  const displayUrl = heroUrl.replace(/^https?:\/\//, '');
  ctx.fillStyle = '#4a3a2a';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(displayUrl, W / 2, H - 33);

  // ── Footer caption ──
  ctx.fillStyle = '#6a5a48';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Blink Idle RPG  ·  Free browser game', W / 2, H - 18);
}

// ── Gallery persistence ──────────────────────────────────────────────────────
export function loadGallery(): SavedHero[] {
  try {
    const raw = localStorage.getItem(GALLERY_KEY);
    return raw ? (JSON.parse(raw) as SavedHero[]) : [];
  } catch {
    return [];
  }
}

export function saveHeroToGallery(hero: HeroData): SavedHero {
  const gallery = loadGallery();
  const entry: SavedHero = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    savedAt: Date.now(),
    heroData: hero,
  };
  // Prepend; keep at most MAX_GALLERY_ITEMS
  gallery.unshift(entry);
  const trimmed = gallery.slice(0, MAX_GALLERY_ITEMS);
  localStorage.setItem(GALLERY_KEY, JSON.stringify(trimmed));
  return entry;
}

export function deleteFromGallery(id: string): void {
  const gallery = loadGallery().filter((h) => h.id !== id);
  localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery));
}
