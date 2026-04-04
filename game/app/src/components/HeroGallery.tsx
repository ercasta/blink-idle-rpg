import { useState, useRef, useEffect, useCallback } from 'react';
import type { SavedHero } from '../lib/figurineUtils';
import {
  loadGallery,
  deleteFromGallery,
  drawDigitalFigurine,
  drawPrintFigurine,
  embedPngMetadata,
  encodeHeroUrl,
  CANVAS_CSS_WIDTH,
  CANVAS_CSS_HEIGHT,
} from '../lib/figurineUtils';

interface GalleryCardProps {
  entry: SavedHero;
  onDelete: (id: string) => void;
}

/**
 * Renders a single gallery card.
 * The figurine is drawn into a hidden canvas and displayed as an <img> tag
 * to avoid keeping live canvas elements for every card simultaneously.
 */
function GalleryCard({ entry, onDelete }: GalleryCardProps) {
  const [dataUrl, setDataUrl] = useState('');
  const [mode, setMode] = useState<'digital' | 'print'>('digital');
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setIsLoading(true);

    const run = async () => {
      try {
        if (mode === 'print') {
          await drawPrintFigurine(canvas, entry.heroData);
        } else {
          drawDigitalFigurine(canvas, entry.heroData);
        }
        if (!cancelled) setDataUrl(canvas.toDataURL('image/png'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [entry.heroData, mode]);

  const handleDownload = useCallback(() => {
    const heroUrl = encodeHeroUrl(entry.heroData);
    const meta = JSON.stringify({
      hero: entry.heroData.name,
      class: entry.heroData.class,
      url: heroUrl,
    });
    const withMeta = embedPngMetadata(dataUrl, 'blink-hero', meta);
    const a = document.createElement('a');
    a.href = withMeta;
    a.download = `${entry.heroData.name.replace(/\s+/g, '-').toLowerCase()}-${mode}.png`;
    a.click();
  }, [dataUrl, entry.heroData, mode]);

  const handleShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      const heroUrl = encodeHeroUrl(entry.heroData);
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const file = new File(
        [blob],
        `${entry.heroData.name.replace(/\s+/g, '-').toLowerCase()}.png`,
        { type: 'image/png' }
      );
      const shareData: ShareData = {
        title: `${entry.heroData.name} – Blink Idle RPG`,
        text: `Check out my hero ${entry.heroData.name} the ${entry.heroData.class}!`,
        url: heroUrl,
      };
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ ...shareData, files: [file] });
      } else {
        await navigator.share(shareData);
      }
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        console.warn('Share failed', err);
      }
    }
  }, [dataUrl, entry.heroData]);

  const savedDate = new Date(entry.savedAt).toLocaleDateString();

  return (
    <div className="gallery-card">
      {/* Hidden canvas used to render; result is shown as <img> */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
        width={CANVAS_CSS_WIDTH * 2}
        height={CANVAS_CSS_HEIGHT * 2}
      />

      <div className="gallery-card-preview">
        {isLoading ? (
          <div className="gallery-card-loading">⏳ Rendering…</div>
        ) : (
          <img
            src={dataUrl}
            alt={`${entry.heroData.name} figurine`}
            className="gallery-card-img"
          />
        )}
      </div>

      <div className="gallery-card-info">
        <span className="gallery-card-name">{entry.heroData.name}</span>
        <span className="gallery-card-class">{entry.heroData.class}</span>
        <span className="gallery-card-date">{savedDate}</span>
      </div>

      <div className="gallery-card-mode-toggle">
        <button
          className={`gallery-mode-btn${mode === 'digital' ? ' active' : ''}`}
          onClick={() => setMode('digital')}
        >
          📱
        </button>
        <button
          className={`gallery-mode-btn${mode === 'print' ? ' active' : ''}`}
          onClick={() => setMode('print')}
        >
          🖨️
        </button>
      </div>

      <div className="gallery-card-actions">
        <button
          className="gallery-action-btn gallery-download-btn"
          onClick={handleDownload}
          disabled={isLoading}
          title="Download PNG"
        >
          📥
        </button>
        {'share' in navigator && (
          <button
            className="gallery-action-btn gallery-share-btn"
            onClick={handleShare}
            disabled={isLoading}
            title="Share"
          >
            📤
          </button>
        )}
        <button
          className="gallery-action-btn gallery-delete-btn"
          onClick={() => onDelete(entry.id)}
          title="Remove from gallery"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

interface Props {
  onClose: () => void;
}

/**
 * Modal that shows all heroes saved to the browser's localStorage gallery.
 * Each card can be downloaded, shared, or removed.
 */
export function HeroGallery({ onClose }: Props) {
  const [gallery, setGallery] = useState<SavedHero[]>([]);

  useEffect(() => {
    setGallery(loadGallery());
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteFromGallery(id);
    setGallery((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    if (!window.confirm('Remove all saved heroes from the gallery?')) return;
    localStorage.removeItem('blink-rpg-hero-gallery');
    setGallery([]);
  }, []);

  return (
    <div className="figurine-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gallery-modal">
        <div className="figurine-modal-header">
          <h3>📚 Hero Gallery</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {gallery.length > 0 && (
              <button className="gallery-clear-btn" onClick={handleClearAll}>
                🗑️ Clear all
              </button>
            )}
            <button className="figurine-close-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {gallery.length === 0 ? (
          <div className="gallery-empty">
            <p>📭 No saved heroes yet.</p>
            <p>Click <strong>💾 Save to Gallery</strong> on a hero figurine to add one here.</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {gallery.map((entry) => (
              <GalleryCard key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
