import { useState, useCallback } from "react";

type Photo = {
  filename: string;
  date: string;
  year: string;
  category?: string;
  tags?: string[];
  description?: string;
};

function Lightbox({ photo, onClose, onPrev, onNext }: { photo: Photo; onClose: () => void; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>
      <button className="lightbox-prev" onClick={(e) => { e.stopPropagation(); onPrev(); }}>‹</button>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={`/photos/${photo.filename}`} alt={photo.date} className="lightbox-img" />
        <div className="lightbox-info">
          <span className="lightbox-location">{photo.date}</span>
          {photo.category && <span className="lightbox-category">{photo.category}</span>}
        </div>
        {photo.description && <p className="lightbox-description">{photo.description}</p>}
      </div>
      <button className="lightbox-next" onClick={(e) => { e.stopPropagation(); onNext(); }}>›</button>
    </div>
  );
}

export default function Gallery({ photos }: { photos: Photo[] }) {
  const categories = ["All", ...Array.from(new Set(photos.filter(p => p.category).map((p) => p.category!))).sort()];
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filtered = activeCategory === "All" ? photos : photos.filter((p) => p.category === activeCategory);

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(() => setLightboxIndex((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length)), [filtered.length]);
  const next = useCallback(() => setLightboxIndex((i) => (i === null ? null : (i + 1) % filtered.length)), [filtered.length]);

  return (
    <>
      <nav className="filter-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`filter-btn ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </nav>

      <div className="masonry">
        {filtered.map((photo, i) => (
          <div key={photo.filename} className="photo-card" onClick={() => openLightbox(i)}>
            <img src={`/photos/${photo.filename}`} alt={photo.date} loading="lazy" />
            <div className="photo-overlay">
              <span className="photo-location">{photo.date}</span>
              {photo.category && <span className="photo-tag">{photo.category}</span>}
            </div>
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photo={filtered[lightboxIndex]}
          onClose={closeLightbox}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}
