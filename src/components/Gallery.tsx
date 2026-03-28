import { useState, useCallback } from "react";

const photos = [
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80",
    thumb: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=70",
    alt: "Mountain at sunset",
    location: "Swiss Alps",
    category: "Mountain",
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1200&q=80",
    thumb: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=70",
    alt: "Ocean waves",
    location: "Maldives",
    category: "Ocean",
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=1200&q=80",
    thumb: "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=600&q=70",
    alt: "Forest path",
    location: "Pacific Northwest",
    category: "Forest",
  },
  {
    id: 4,
    src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80",
    thumb: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=70",
    alt: "Desert dunes",
    location: "Sahara",
    category: "Desert",
  },
  {
    id: 5,
    src: "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1200&q=80",
    thumb: "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=600&q=70",
    alt: "Waterfall",
    location: "Iceland",
    category: "Waterfall",
  },
  {
    id: 6,
    src: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&q=80",
    thumb: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&q=70",
    alt: "Night sky",
    location: "Patagonia",
    category: "Night",
  },
  {
    id: 7,
    src: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200&q=80",
    thumb: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=70",
    alt: "Green valley",
    location: "New Zealand",
    category: "Mountain",
  },
  {
    id: 8,
    src: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1200&q=80",
    thumb: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=600&q=70",
    alt: "Arctic fox",
    location: "Norway",
    category: "Wildlife",
  },
  {
    id: 9,
    src: "https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=1200&q=80",
    thumb: "https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=600&q=70",
    alt: "Canyon",
    location: "Arizona",
    category: "Desert",
  },
];

const categories = ["All", ...Array.from(new Set(photos.map((p) => p.category)))];

type Photo = (typeof photos)[number];

function Lightbox({ photo, onClose, onPrev, onNext }: { photo: Photo; onClose: () => void; onPrev: () => void; onNext: () => void }) {
  return (
    <div
      className="lightbox-overlay"
      onClick={onClose}
    >
      <button className="lightbox-close" onClick={onClose}>✕</button>
      <button className="lightbox-prev" onClick={(e) => { e.stopPropagation(); onPrev(); }}>‹</button>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={photo.src} alt={photo.alt} className="lightbox-img" />
        <div className="lightbox-info">
          <span className="lightbox-location">📍 {photo.location}</span>
          <span className="lightbox-category">{photo.category}</span>
        </div>
      </div>
      <button className="lightbox-next" onClick={(e) => { e.stopPropagation(); onNext(); }}>›</button>
    </div>
  );
}

export default function Gallery() {
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
          <div key={photo.id} className="photo-card" onClick={() => openLightbox(i)}>
            <img src={photo.thumb} alt={photo.alt} loading="lazy" />
            <div className="photo-overlay">
              <span className="photo-location">📍 {photo.location}</span>
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
