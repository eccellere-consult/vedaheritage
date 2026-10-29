'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export interface BrowseItem { id: string; href: string; title: string; category: string; categoryLabel: string; condition: string; price: string; district: string; photo?: string; alt?: string; sold: boolean }

export default function MarketBrowse({ items }: { items: BrowseItem[] }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const cats = useMemo(() => Array.from(new Map(items.map(i => [i.category, i.categoryLabel])).entries()), [items])
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    return items.filter(i => (cat === 'all' || i.category === cat) && (!t || `${i.title} ${i.district} ${i.categoryLabel}`.toLowerCase().includes(t)))
  }, [items, q, cat])
  const pill = (on: boolean) => `text-xs font-medium px-3 py-1 rounded-full border ${on ? 'bg-primary text-white border-primary' : 'border-accent/40 text-ink-mid hover:border-primary'}`

  if (!items.length) {
    return (
      <div className="card text-center">
        <h2 className="font-serif text-2xl text-ink mb-2">The first listings are coming soon</h2>
        <p className="text-sm text-ink-mid mb-4">Every item is reviewed before it appears. Have a traditional Kerala item to pass on? List it for free.</p>
        <Link href="/marketplace/sell/" className="btn-primary text-xs">List an item</Link>
      </div>
    )
  }
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search lamps, mundu, instruments, district…" aria-label="Search the marketplace" className="w-full border border-accent/40 bg-white px-4 py-3 text-sm mb-4 focus:outline-none focus:border-primary" />
      <div className="flex flex-wrap gap-2 mb-6">
        <button className={pill(cat === 'all')} onClick={() => setCat('all')}>All</button>
        {cats.map(([k, l]) => <button key={k} className={pill(cat === k)} onClick={() => setCat(k)}>{l}</button>)}
      </div>
      {!results.length && <p className="text-sm text-ink-mid">No items match. Try another word or category.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map(i => (
          <Link key={i.id} href={i.href} className="card !p-0 overflow-hidden hover:shadow-md transition-shadow">
            {i.photo ? <img src={i.photo} alt={i.alt || i.title} loading="lazy" className="w-full aspect-[4/3] object-cover" /> : <div className="aspect-[4/3] bg-accent-pale" />}
            <div className="p-4">
              <div className="flex items-center justify-between gap-2"><span className="font-serif text-xl text-primary">{i.price}</span>{i.sold && <span className="text-xs px-2 py-0.5 border border-ink-mid/40 text-ink-mid rounded-full">Sold</span>}</div>
              <h3 className="font-serif text-lg text-ink leading-snug">{i.title}</h3>
              <p className="text-xs text-ink-mid mt-1">{i.categoryLabel} · {i.condition} · {i.district}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
