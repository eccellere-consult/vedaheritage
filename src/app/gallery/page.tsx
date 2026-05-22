'use client'

import { useState, useEffect, useCallback } from 'react'
import { PHOTOS } from '@/lib/config'

type Photo = { src: string; alt: string; caption: string }

export default function GalleryPage() {
  const photos = PHOTOS.gallery
  const [selected, setSelected] = useState<number | null>(null)

  const prev = useCallback(() =>
    setSelected(n => (n !== null ? (n - 1 + photos.length) % photos.length : null)), [photos.length])
  const next = useCallback(() =>
    setSelected(n => (n !== null ? (n + 1) % photos.length : null)), [photos.length])
  const close = useCallback(() => setSelected(null), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close, next, prev])

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = selected !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selected])

  return (
    <>
      {/* Header */}
      <section
        className="pt-32 pb-20 text-center"
        style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}
      >
        <p className="section-label text-gold/80">Visual Journey</p>
        <h1 className="font-serif text-5xl text-white mb-4">Gallery</h1>
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-lg mx-auto text-sm leading-relaxed px-4">
          Kerala backwaters, the Ayurvedic garden, heritage rooms, and the landscape around Vavvakkavu.
          Click any photo to view full size.
        </p>
      </section>

      {/* Grid */}
      <section className="py-16 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {photos.map((photo: Photo, i: number) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className="relative aspect-square overflow-hidden group focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
                aria-label={`Open photo: ${photo.caption}`}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/40 transition-colors duration-300 flex items-end">
                  <div className="p-3 w-full translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-white text-xs font-sans">{photo.caption}</p>
                  </div>
                </div>
                {/* Expand icon */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center text-white text-xs">
                    ⛶
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Upload prompt */}
          <div className="mt-12 bg-white border border-gold/30 p-8 text-center">
            <p className="section-label mb-2">Your Own Kerala Photos</p>
            <p className="text-ink-mid text-sm mb-4">
              Are you a past guest with photos of your stay? We would love to feature them here.
            </p>
            <a
              href="https://wa.me/919964694566?text=Hello%2C%20I%20have%20photos%20from%20my%20stay%20at%20Veda%20Heritage%20that%20I%20would%20like%20to%20share."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-xs"
            >
              Share Your Photos
            </a>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {selected !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={close}
        >
          {/* Close */}
          <button
            onClick={close}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-3xl leading-none z-10 w-10 h-10 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>

          {/* Counter */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-xs font-sans tracking-wider">
            {selected + 1} / {photos.length}
          </div>

          {/* Photo container */}
          <div
            className="relative max-w-5xl mx-auto px-16 flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={photos[selected].src.replace('w=800', 'w=1200')}
              alt={photos[selected].alt}
              className="max-h-[82vh] max-w-full object-contain shadow-2xl"
            />
            <p className="absolute -bottom-7 left-0 right-0 text-center text-white/50 text-sm font-sans">
              {photos[selected].caption}
            </p>
          </div>

          {/* Previous */}
          <button
            onClick={e => { e.stopPropagation(); prev() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white w-12 h-12 flex items-center justify-center text-4xl"
            aria-label="Previous photo"
          >
            ‹
          </button>

          {/* Next */}
          <button
            onClick={e => { e.stopPropagation(); next() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white w-12 h-12 flex items-center justify-center text-4xl"
            aria-label="Next photo"
          >
            ›
          </button>

          {/* Thumbnail strip */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-sm overflow-hidden">
            {photos.map((_: Photo, i: number) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setSelected(i) }}
                className={`w-8 h-8 flex-shrink-0 overflow-hidden rounded-sm ${i === selected ? 'ring-2 ring-gold' : 'opacity-50 hover:opacity-80'}`}
              >
                <img src={photos[i].src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
