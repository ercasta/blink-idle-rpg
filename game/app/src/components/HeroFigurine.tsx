import { useState, useRef, useEffect, useCallback } from 'react';
import type { HeroData } from '../lib/figurineUtils';
import {
  drawPrintFigurine,
  drawDigitalFigurine,
  embedPngMetadata,
  encodeHeroUrl,
  saveHeroToGallery,
  CANVAS_CSS_WIDTH,
  CANVAS_CSS_HEIGHT,
} from '../lib/figurineUtils';

type FigurineMode = 'digital' | 'print';

interface Props {
  hero: HeroData;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Modal that lets the player generate and share/download a hero figurine in
 * two formats:
 *
 * • Digital  – colourful portrait card (WhatsApp / social-friendly, URL text)
 * • Print    – black-and-white card with QR code (print on paper)
 *
 * Download embeds hero data as a PNG iTXt metadata chunk so the link is
 * preserved inside the file itself.  The Web Share API is used on Android
 * to pass the image + URL to any installed app (WhatsApp, etc.).
 */
export function HeroFigurine({ hero, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<FigurineMode>('digital');
  const [isRendering, setIsRendering] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Re-render the canvas whenever mode or hero changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setIsRendering(true);

    const run = async () => {
      try {
        if (mode === 'print') {
          await drawPrintFigurine(canvas, hero);
        } else {
          drawDigitalFigurine(canvas, hero);
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [mode, hero]);

  /** Returns the current canvas as a base64 data-URL with embedded metadata. */
  const getDataUrl = useCallback((): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    const raw = canvas.toDataURL('image/png');
    const heroUrl = encodeHeroUrl(hero);
    const meta = JSON.stringify({
      hero: hero.name,
      class: hero.class,
      level: hero.level,
      url: heroUrl,
    });
    return embedPngMetadata(raw, 'blink-hero', meta);
  }, [hero]);

  const handleDownload = useCallback(() => {
    const dataUrl = getDataUrl();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${hero.name.replace(/\s+/g, '-').toLowerCase()}-${mode}.png`;
    a.click();
  }, [getDataUrl, hero.name, mode]);

  const handleShare = useCallback(async () => {
    if (!navigator.share) {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(encodeHeroUrl(hero));
        setSavedMsg('🔗 Hero URL copied to clipboard!');
        setTimeout(() => setSavedMsg(''), 3000);
      } catch {
        setSavedMsg('❌ Sharing not supported on this device.');
        setTimeout(() => setSavedMsg(''), 3000);
      }
      return;
    }

    try {
      const dataUrl = getDataUrl();
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const file = new File(
        [blob],
        `${hero.name.replace(/\s+/g, '-').toLowerCase()}.png`,
        { type: 'image/png' }
      );
      const heroUrl = encodeHeroUrl(hero);
      const shareData: ShareData = {
        title: `${hero.name} – Blink Idle RPG`,
        text: `Check out my hero ${hero.name} the ${hero.class}! Play Blink Idle RPG →`,
        url: heroUrl,
      };
      // Files + url together may not be supported everywhere; fall back to
      // sharing without the file if the combination is rejected.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ ...shareData, files: [file] });
      } else {
        await navigator.share(shareData);
      }
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        setSavedMsg('❌ Share failed. Try Download instead.');
        setTimeout(() => setSavedMsg(''), 3000);
      }
    }
  }, [getDataUrl, hero]);

  const handleSaveToGallery = useCallback(() => {
    saveHeroToGallery(hero);
    setSavedMsg('✅ Saved to Gallery!');
    setTimeout(() => setSavedMsg(''), 3000);
    onSaved?.();
  }, [hero, onSaved]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div className="figurine-overlay" onClick={handleOverlayClick}>
      <div className="figurine-modal">
        {/* Header */}
        <div className="figurine-modal-header">
          <h3>🖼️ Hero Figurine – {hero.name}</h3>
          <button className="figurine-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Mode tabs */}
        <div className="figurine-tabs">
          <button
            className={`figurine-tab${mode === 'digital' ? ' active' : ''}`}
            onClick={() => setMode('digital')}
          >
            📱 Digital
          </button>
          <button
            className={`figurine-tab${mode === 'print' ? ' active' : ''}`}
            onClick={() => setMode('print')}
          >
            🖨️ Print
          </button>
        </div>

        {/* Canvas preview */}
        <div className="figurine-canvas-wrapper">
          <canvas
            ref={canvasRef}
            style={{ width: CANVAS_CSS_WIDTH, height: CANVAS_CSS_HEIGHT }}
          />
          {isRendering && <div className="figurine-rendering">Rendering…</div>}
        </div>

        {/* Mode description */}
        <p className="figurine-description">
          {mode === 'digital'
            ? '📱 Full-colour portrait — share via WhatsApp or save to your gallery. The hero URL at the bottom is a clickable link.'
            : '🖨️ Black & white — optimised for printing. The QR code links back to this hero in the game.'}
        </p>

        {/* Actions */}
        <div className="figurine-actions">
          <button className="figurine-btn figurine-btn-download" onClick={handleDownload}>
            📥 Download PNG
          </button>
          <button className="figurine-btn figurine-btn-share" onClick={handleShare}>
            📤 Share
          </button>
          <button className="figurine-btn figurine-btn-save" onClick={handleSaveToGallery}>
            💾 Save to Gallery
          </button>
        </div>

        {savedMsg && <p className="figurine-saved-msg">{savedMsg}</p>}
      </div>
    </div>
  );
}
