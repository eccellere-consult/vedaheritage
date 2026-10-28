'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export interface SearchItem {
  href: string
  name: string
  tagline: string
  district: string
  category: string
  categoryLabel: string
  tags: string[]
}

export default function DiscoverSearch({ items }: { items: SearchItem[] }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const cats = useMemo(() => Array.from(new Map(items.map(i => [i.category, i.categoryLabel])).entries()), [items])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items.filter(i =>
      (cat === 'all' || i.category === cat) &&
      (!term || [i.name, i.tagline, i.district, ...i.tags].join(' ').toLowerCase().includes(term))
    )
  }, [items, q, cat])

  const pill = (active: boolean) =>
    `text-xs font-medium px-3 py-1 rounded-full border transition-colors ${active ? 'bg-forest text-white border-forest' : 'border-gold/40 text-ink-mid hover:border-forest'}`

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search temples, beaches, districts, festivals…"
          aria-label="Search Kerala heritage"
          className="flex-1 border border-gold/40 bg-white px-4 py-3 text-sm focus:outline-none focus:border-forest"
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        <button className={pill(cat === 'all')} onClick={() => setCat('all')}>All</button>
        {cats.map(([k, label]) => (
          <button key={k} className={pill(cat === k)} onClick={() => setCat(k)}>{label}</button>
        ))}
      </div>
      {results.length === 0 ? (
        <p className="text-sm text-ink-mid">No matches yet — more guides are added every week.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map(r => (
            <Link key={r.href} href={r.href} className="card block hover:shadow-md transition-shadow">
              <p className="section-label !mb-1">{r.categoryLabel} · {r.district}</p>
              <h3 className="font-serif text-xl text-ink mb-2">{r.name}</h3>
              <p className="text-sm text-ink-mid leading-relaxed">{r.tagline}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
