import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { HeroDefinition } from '../types';
import { encodeHeroToParams } from '../data/heroDescription';

// Credit-card dimensions in mm (vertical orientation)
const CARD_W = 54;
const CARD_H = 85.6;

// Margins & layout constants (mm)
const MARGIN = 4;
const INNER_W = CARD_W - MARGIN * 2;

function getHeroShareUrl(hero: HeroDefinition): string {
  const params = encodeHeroToParams({ name: hero.name, heroClass: hero.heroClass, traits: hero.traits });
  const base = window.location.origin + window.location.pathname;
  return `${base}?${params.toString()}`;
}

/**
 * Generate and download a credit-card-sized black & white PDF figurine for a hero.
 * Layout (top → bottom): name, class, separator, description, QR code.
 */
export async function printHeroFigurine(hero: HeroDefinition): Promise<void> {
  const url = getHeroShareUrl(hero);

  // Generate QR code as a data URL (black on white)
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 256,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  // Create PDF in portrait orientation, mm units, credit-card size
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [CARD_W, CARD_H],
  });

  // Background: white
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');

  // Border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(1, 1, CARD_W - 2, CARD_H - 2, 'S');

  let cursorY = MARGIN + 2;

  // ── Hero name ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(hero.name, CARD_W / 2, cursorY, { align: 'center' });
  cursorY += 5;

  // ── Hero class ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text(hero.heroClass.toUpperCase(), CARD_W / 2, cursorY, { align: 'center' });
  cursorY += 3;

  // Thin separator line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, cursorY, CARD_W - MARGIN, cursorY);
  cursorY += 3;

  // ── Description ───────────────────────────────────────────────────────────
  const description = hero.description ?? '';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  const lines: string[] = doc.splitTextToSize(description, INNER_W) as string[];
  const lineHeight = 3.2;
  for (const line of lines) {
    doc.text(line, MARGIN, cursorY);
    cursorY += lineHeight;
  }
  cursorY += 1;

  // ── QR code ────────────────────────────────────────────────────────────────
  // Place QR code centred at the bottom, leaving a small bottom margin
  const qrSize = INNER_W;
  const qrY = CARD_H - MARGIN - qrSize;

  if (qrY > cursorY) {
    // Fits without overlap
    doc.addImage(qrDataUrl, 'PNG', MARGIN, qrY, qrSize, qrSize);
  } else {
    // Shrink to fit remaining vertical space
    const availableH = CARD_H - MARGIN - cursorY - 1;
    const shrunkSize = Math.min(qrSize, availableH);
    if (shrunkSize > 5) {
      const centreX = MARGIN + (INNER_W - shrunkSize) / 2;
      doc.addImage(qrDataUrl, 'PNG', centreX, cursorY, shrunkSize, shrunkSize);
    }
  }

  // Download the PDF
  const safeName = hero.name
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'hero';
  doc.save(`hero-${safeName}.pdf`);
}
