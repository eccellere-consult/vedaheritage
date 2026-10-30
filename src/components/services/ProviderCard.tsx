import Link from 'next/link'
import { PROVIDER_TYPES } from '@/lib/provider-options'
import type { Provider } from '@/lib/providers'

const month = (d: string) => new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

export default function ProviderCard({ p, sponsored = false }: { p: Provider; sponsored?: boolean }) {
  const s = p.sponsored
  return (
    <div className={`card !p-5 ${sponsored ? 'border-l-4 border-accent' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        {sponsored && <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 border border-accent text-accent">Sponsored</span>}
        <span className="text-xs text-ink-mid">{PROVIDER_TYPES[p.type]} · {p.districts.join(', ')}</span>
      </div>
      <h3 className="font-serif text-lg text-ink">{sponsored && s ? s.headline : p.name}</h3>
      {sponsored && s && <p className="text-xs text-ink-mid">{p.name}</p>}
      <p className="text-sm text-ink-mid mt-1">{sponsored && s ? s.line : p.summary}</p>
      <ul className="text-sm mt-3 space-y-1">
        <li><span className="text-ink-mid">Phone: </span><a href={`tel:${p.phone}`} className="text-primary underline">{p.phone}</a></li>
        <li><span className="text-ink-mid">Email: </span><a href={`mailto:${p.email}`} className="text-primary underline break-all">{p.email}</a></li>
        {p.website && <li><span className="text-ink-mid">Website: </span><a href={p.website} target="_blank" rel={sponsored ? 'sponsored nofollow noopener noreferrer' : 'nofollow noopener noreferrer'} className="text-primary underline break-all">{p.website.replace(/^https?:\/\//, '')}</a></li>}
        {p.address && <li className="text-ink-mid">{p.address}</li>}
      </ul>
      <p className="text-xs text-ink-mid/80 mt-3">
        {p.credentialLabel ? `${p.credentialLabel} · ` : ''}Contact details verified {month(p.verifiedOn)}.{' '}
        <Link href={`/services/report/?id=${p.id}`} className="underline">Report a problem</Link>
      </p>
    </div>
  )
}
