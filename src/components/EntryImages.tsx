import type { EntryImage } from '@/lib/content'

export default function EntryImages({ images }: { images: EntryImage[] }) {
  if (images.length === 0) return null
  return (
    <div className={`grid gap-4 mb-10 ${images.length > 1 ? 'sm:grid-cols-2' : ''}`}>
      {images.map(im => (
        <figure key={im.src}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={im.src} alt={im.alt} loading="lazy" className="w-full h-64 object-cover" />
          <figcaption className="text-[11px] text-ink-mid/70 mt-1">
            Photo: {im.credit} · <a href={im.licenseUrl || im.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{im.license}</a> · <a href={im.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">source</a>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
