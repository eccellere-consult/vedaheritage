import Link from 'next/link'
import type { Entry } from '@/lib/content'
import { PROVIDER_TYPES, getProviders, organicFor, sponsoredFor } from '@/lib/providers'
import ProviderCard from './ProviderCard'

const KIND: Record<string, string> = { 'tourism-office': 'Tourism office', 'temple-office': 'Temple office', 'transport-enquiry': 'Transport enquiries', emergency: 'Emergency', hospital: 'Hospital', police: 'Police', other: 'Official contact' }
const date = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** Official contacts (from the entry) plus verified local services and limited, labelled sponsored slots. */
export default function ContactsBlock({ entry }: { entry: Entry }) {
  const providers = getProviders()
  const sponsored = sponsoredFor(entry.district, providers)
  const sponsoredIds = new Set(sponsored.map(p => p.id))
  const organic = organicFor(entry.district, providers).filter(p => !sponsoredIds.has(p.id))
  const types = Object.keys(PROVIDER_TYPES) as (keyof typeof PROVIDER_TYPES)[]
  const contacts = entry.contacts || []

  return (
    <section className="mt-12" aria-labelledby="contacts">
      <p className="section-label">Contacts &amp; services</p>
      <h2 id="contacts" className="section-title mb-3">Who to contact for {entry.name}</h2>

      {contacts.length > 0 && (
        <div className="mb-8">
          <h3 className="font-serif text-xl text-ink mb-3">Official contacts</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {contacts.map(c => (
              <div key={c.label + c.sourceUrl} className="card !p-5">
                <p className="text-xs text-accent">{KIND[c.kind] || 'Official contact'}</p>
                <h4 className="font-serif text-lg text-ink">{c.label}</h4>
                <ul className="text-sm mt-2 space-y-1">
                  {c.phone && <li><span className="text-ink-mid">Phone: </span><a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="text-primary underline">{c.phone}</a></li>}
                  {c.email && <li><span className="text-ink-mid">Email: </span><a href={`mailto:${c.email}`} className="text-primary underline break-all">{c.email}</a></li>}
                  {c.website && <li><span className="text-ink-mid">Website: </span><a href={c.website} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{c.website.replace(/^https?:\/\//, '')}</a></li>}
                  {c.address && <li className="text-ink-mid">{c.address}</li>}
                </ul>
                <p className="text-xs text-ink-mid/80 mt-3">Taken from <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">the official page</a> and checked {date(c.verifiedOn)}. Confirm before travelling.</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {organic.length > 0 && (
        <div className="mb-8">
          <h3 className="font-serif text-xl text-ink mb-1">Verified local services in {entry.district}</h3>
          <p className="text-xs text-ink-mid mb-3">Listed free, in alphabetical order. Payment never changes the order.</p>
          {types.filter(t => organic.some(p => p.type === t)).map(t => (
            <div key={t} className="mb-5">
              <h4 className="text-sm font-medium text-ink mb-2">{PROVIDER_TYPES[t]}</h4>
              <div className="grid sm:grid-cols-2 gap-4">{organic.filter(p => p.type === t).map(p => <ProviderCard key={p.id} p={p} />)}</div>
            </div>
          ))}
        </div>
      )}

      {sponsored.length > 0 && (
        <div className="mb-8">
          <h3 className="font-serif text-xl text-ink mb-1">Sponsored</h3>
          <p className="text-xs text-ink-mid mb-3">Paid placements by verified providers. At most two per page.</p>
          <div className="grid sm:grid-cols-2 gap-4">{sponsored.map(p => <ProviderCard key={p.id} p={p} sponsored />)}</div>
        </div>
      )}

      <p className="text-xs text-ink-mid">
        Providers are independent businesses. Veda Heritage checks contact details and, where required, registration, but does not endorse, inspect or guarantee any service. Confirm prices and availability directly.{' '}
        <Link href="/services/standards/" className="underline">How listings are verified</Link> · <Link href="/services/join/" className="underline">List your service</Link> · <Link href="/services/" className="underline">All services</Link>
      </p>
    </section>
  )
}
