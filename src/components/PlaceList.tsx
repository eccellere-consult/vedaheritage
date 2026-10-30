import type { Place } from '@/lib/content'

const KIND_LABEL: Record<string, string> = {
  cooperative: 'Co-operative', emporium: 'Emporium', workshop: 'Workshop', market: 'Market', online: 'Listings',
  restaurant: 'Restaurant', oottupura: 'Traditional meals house', thattukada: 'Street stall', 'kanji-kada': 'Kanji shop', 'temple-canteen': 'Temple canteen', 'homestay-meal': 'Homestay meal', 'toddy-shop': 'Licensed toddy shop',
  museum: 'Museum', 'heritage-home': 'Heritage home', 'cultural-centre': 'Cultural centre',
}

export default function PlaceList({ places }: { places: Place[] }) {
  return (
    <ul className="space-y-3">
      {places.map(p => (
        <li key={p.name} className="bg-white border-l-4 border-accent/40 p-4">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <p className="font-medium text-ink text-sm">
              {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.name} ↗</a> : p.name}
            </p>
            {p.kind && <span className="text-[11px] uppercase tracking-widest text-accent">{KIND_LABEL[p.kind] || p.kind}</span>}
          </div>
          <p className="text-xs text-ink-mid/70 mt-0.5">{p.district}</p>
          <p className="text-sm text-ink-mid mt-1 leading-relaxed">{p.note}</p>
        </li>
      ))}
    </ul>
  )
}
