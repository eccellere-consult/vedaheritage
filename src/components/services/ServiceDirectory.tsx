'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { DISTRICT_NAMES, PROVIDER_TYPES } from '@/lib/provider-options'
import type { Provider } from '@/lib/providers'
import ProviderCard from './ProviderCard'

const sel = 'border border-accent/40 bg-white px-3 py-2 text-sm focus:outline-none focus:border-primary'

/** `sponsoredByDistrict` holds the (already capped and rotated) sponsors per district, chosen at build time. */
export default function ServiceDirectory({ providers, sponsoredByDistrict }: { providers: Provider[]; sponsoredByDistrict: Record<string, Provider[]> }) {
  const [district, setDistrict] = useState('all')
  const [type, setType] = useState('all')
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    return providers.filter(p => (district === 'all' || p.districts.includes(district)) && (type === 'all' || p.type === type) && (!t || `${p.name} ${p.summary}`.toLowerCase().includes(t)))
  }, [providers, district, type, q])
  const sponsors = district === 'all' ? [] : (sponsoredByDistrict[district] || []).filter(p => type === 'all' || p.type === type)
  const sIds = new Set(sponsors.map(p => p.id))

  if (!providers.length) return (
    <div className="card text-center">
      <h2 className="font-serif text-2xl text-ink mb-2">The first listings are being verified</h2>
      <p className="text-sm text-ink-mid mb-4">Every provider is checked by phone and email before it appears. Run a guide, stay, taxi, shop or class? Apply to be listed.</p>
      <Link href="/services/join/" className="btn-primary text-xs">List your service</Link>
    </div>
  )
  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <select aria-label="District" className={sel} value={district} onChange={e => setDistrict(e.target.value)}><option value="all">All districts</option>{DISTRICT_NAMES.map(d => <option key={d}>{d}</option>)}</select>
        <select aria-label="Type of service" className={sel} value={type} onChange={e => setType(e.target.value)}><option value="all">All services</option>{Object.entries(PROVIDER_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input aria-label="Search services" placeholder="Search…" className={sel} value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {sponsors.length > 0 && (
        <div className="mb-8"><p className="text-xs uppercase tracking-wider text-ink-mid mb-2">Sponsored</p><div className="grid sm:grid-cols-2 gap-4">{sponsors.map(p => <ProviderCard key={p.id} p={p} sponsored />)}</div></div>
      )}
      {!results.length && <p className="text-sm text-ink-mid">No services match. Try another district or type.</p>}
      <div className="grid sm:grid-cols-2 gap-4">{results.filter(p => !sIds.has(p.id)).map(p => <ProviderCard key={p.id} p={p} />)}</div>
    </div>
  )
}
