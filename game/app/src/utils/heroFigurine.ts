import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { HeroClass, HeroDefinition } from '../types';
import { encodeHeroToParams } from '../data/heroDescription';

// Credit-card dimensions in mm (vertical orientation)
const CARD_W = 54;
const CARD_H = 85.6;

// A4 page dimensions in mm
const PAGE_W = 210;
const PAGE_H = 297;

// Offsets to center the card on an A4 page
const CARD_X = (PAGE_W - CARD_W) / 2;
const CARD_Y = (PAGE_H - CARD_H) / 2;

// Margins & layout constants (mm)
const MARGIN = 4;
const INNER_W = CARD_W - MARGIN * 2;

// Fixed QR code size reserved at the bottom of the card (mm)
const QR_SIZE = 30;

// Fraction of the class-icon height at which the class name text baseline sits
const ICON_TEXT_VERTICAL_OFFSET = 0.65;

function getHeroShareUrl(hero: HeroDefinition): string {
  const params = encodeHeroToParams({
    name: hero.name,
    heroClass: hero.heroClass,
    traits: hero.traits,
    adventuresPlayed: hero.adventuresPlayed,
  });
  const base = window.location.origin + window.location.pathname;
  return `${base}?${params.toString()}`;
}

// ── Class icon SVG helpers ──────────────────────────────────────────────────

const CLASS_ICON_COLOR: Record<HeroClass, string> = {
  Warrior: '#b85454',
  Mage:    '#4a7fc0',
  Ranger:  '#4a9060',
  Paladin: '#5a80b0',
  Rogue:   '#8b5e3c',
  Cleric:  '#c8a850',
};

function classIconSvg(heroClass: HeroClass): string {
  const c = CLASS_ICON_COLOR[heroClass];
  switch (heroClass) {
    case 'Warrior':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <line x1="18" y1="3" x2="7" y2="18" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <line x1="10.5" y1="8" x2="15" y2="12.5" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <line x1="7" y1="18" x2="5.5" y2="21" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="4.8" cy="21.8" r="1.5" fill="${c}"/>
      </svg>`;
    case 'Mage':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <line x1="5" y1="20" x2="13" y2="11" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <line x1="7" y1="19" x2="8.5" y2="17.5" stroke="${c}" stroke-width="1" stroke-linecap="round" opacity="0.6"/>
        <path d="M17 5 L17.7 8.3 L21 9 L17.7 9.7 L17 13 L16.3 9.7 L13 9 L16.3 8.3 Z" fill="${c}"/>
      </svg>`;
    case 'Ranger':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M7 4 Q2.5 12 7 20" stroke="${c}" stroke-width="2" stroke-linecap="round" fill="none"/>
        <line x1="7" y1="4" x2="7" y2="20" stroke="${c}" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
        <line x1="10" y1="12" x2="21" y2="12" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M18 9.5 L21 12 L18 14.5" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 12 L12 10 M10 12 L12 14" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;
    case 'Paladin':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 3 L19 7 L19 14 C19 18 16 21 12 22.5 C8 21 5 18 5 14 L5 7 Z" fill="#1e3050" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>
        <line x1="12" y1="8.5" x2="12" y2="17.5" stroke="#d4b48a" stroke-width="2" stroke-linecap="round"/>
        <line x1="8.5" y1="13" x2="15.5" y2="13" stroke="#d4b48a" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    case 'Rogue':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <line x1="17" y1="5" x2="9" y2="18" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <line x1="12.5" y1="8" x2="16" y2="11" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <line x1="9" y1="18" x2="7.5" y2="21" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="6.8" cy="21.8" r="1.5" fill="${c}"/>
        <line x1="14" y1="10.5" x2="15" y2="9.5" stroke="${c}" stroke-width="1" stroke-linecap="round" opacity="0.6"/>
        <line x1="12.5" y1="12.5" x2="13.5" y2="11.5" stroke="${c}" stroke-width="1" stroke-linecap="round" opacity="0.6"/>
      </svg>`;
    case 'Cleric':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="22" x2="12" y2="12" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="8" r="3.5" fill="none" stroke="${c}" stroke-width="1.5"/>
        <line x1="12" y1="3.5" x2="12" y2="2" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="17.5" y1="8" x2="19" y2="8" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="6.5" y1="8" x2="5" y2="8" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="14.5" y1="5.5" x2="15.5" y2="4.5" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="9.5" y1="5.5" x2="8.5" y2="4.5" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="14.5" y1="10.5" x2="15.5" y2="11.5" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="9.5" y1="10.5" x2="8.5" y2="11.5" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;
  }
}

/** Render an SVG string to a PNG data URL via an off-screen canvas. */
function svgToPng(svgString: string, pxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = pxSize;
        canvas.height = pxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No 2d context')); return; }
        ctx.drawImage(img, 0, 0, pxSize, pxSize);
        resolve(canvas.toDataURL('image/png'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')); };
    img.src = url;
  });
}

/**
 * Generate and download a credit-card-sized black & white PDF figurine for a hero.
 * Layout (top → bottom): name, class (with icons), separator, description, QR code.
 */
export async function printHeroFigurine(hero: HeroDefinition): Promise<void> {
  const url = getHeroShareUrl(hero);

  // Generate QR code and class icon PNG in parallel
  const [qrDataUrl, iconPng] = await Promise.all([
    QRCode.toDataURL(url, {
      width: 256,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    }),
    svgToPng(classIconSvg(hero.heroClass), 64),
  ]);

  // Create PDF in portrait orientation, mm units, A4 page size
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Background: white (full A4 page)
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Card background
  doc.setFillColor(255, 255, 255);
  doc.rect(CARD_X, CARD_Y, CARD_W, CARD_H, 'F');

  // Border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(CARD_X + 1, CARD_Y + 1, CARD_W - 2, CARD_H - 2, 'S');

  let cursorY = CARD_Y + MARGIN + 2;

  // ── Hero name ──────────────────────────────────────────────────────────────
  doc.setFont('times', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(hero.name, CARD_X + CARD_W / 2, cursorY, { align: 'center' });
  cursorY += 4;

  // ── Hero class (icon | class name | icon) ──────────────────────────────────
  const iconMm = 4; // icon width/height in mm
  const iconY = cursorY - 0.5; // top of icon (slightly above text baseline)
  // Left icon
  doc.addImage(iconPng, 'PNG', CARD_X + MARGIN, iconY, iconMm, iconMm);
  // Right icon
  doc.addImage(iconPng, 'PNG', CARD_X + CARD_W - MARGIN - iconMm, iconY, iconMm, iconMm);
  // Class name text centred between icons
  doc.setFont('times', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(60, 60, 60);
  doc.text(hero.heroClass.toUpperCase(), CARD_X + CARD_W / 2, cursorY + iconMm * ICON_TEXT_VERTICAL_OFFSET, { align: 'center' });
  cursorY += iconMm + 1.5;

  // Thin separator line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(CARD_X + MARGIN, cursorY, CARD_X + CARD_W - MARGIN, cursorY);
  cursorY += 3;

  // ── Description ───────────────────────────────────────────────────────────
  // Reserve space at the bottom for the QR code; truncate description to fit.
  const qrTop = CARD_Y + CARD_H - MARGIN - QR_SIZE;
  const maxDescY = qrTop - 2; // 2 mm gap above QR code
  const description = hero.description ?? '';
  doc.setFont('times', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(0, 0, 0);
  const lineHeight = 2.8;
  const allLines: string[] = doc.splitTextToSize(description, INNER_W) as string[];
  for (const line of allLines) {
    if (cursorY + lineHeight > maxDescY) break;
    doc.text(line, CARD_X + MARGIN, cursorY);
    cursorY += lineHeight;
  }

  // ── QR code ────────────────────────────────────────────────────────────────
  // Always place at a fixed position at the bottom, centred horizontally
  const qrX = CARD_X + MARGIN + (INNER_W - QR_SIZE) / 2;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrTop, QR_SIZE, QR_SIZE);

  // Download the PDF
  const safeName = hero.name
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'hero';
  doc.save(`hero-${safeName}.pdf`);
}
