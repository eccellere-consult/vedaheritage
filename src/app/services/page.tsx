import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/content'
import { DISTRICT_NAMES } from '@/lib/provider-options'
import { getProviders, sponsoredFor } from '@/lib/providers'
import ServiceDirectory from '@/components/services/ServiceDirectory'
import PageHero from '@/components/PageHero'

export const metadata: Metadata = {
  title: 'Kerala Services Directory: Verified Guides, Stays, Taxis, Shops & Classes',
  description: 'Verified contacts for local guides, stays, taxis, craft shops, restaurants, classes and tour operators across Kerala. Listings are checked by phone and email.',
  alternates: { canonical: `${SITE_URL}/services/` },
}

export default function ServicesPage() {
  const providers = getProviders()
  const sponsoredByDistrict = Object.fromEntries(DISTRICT_NAMES.map(d => [d, sponsoredFor(d, providers)]))
  return (
    <>
      <PageHero label="Services" title="Verified local contacts across Kerala" subtitle="Guides, stays, taxis, craft shops, restaurants, classes and tour operators. Each listing is checked by phone and email before it appears." />
      <section className="py-14 bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <p role="note" className="rounded-lg border border-accent/30 bg-accent-pale px-4 py-3 text-sm text-ink">
            Providers are independent businesses. Veda Heritage verifies contact details and, where required, registration, but does not endorse, inspect or guarantee any service. Official contacts for each place are on its Discover page.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/services/join/" className="btn-primary text-xs">List your service</Link>
            <Link href="/services/standards/" className="btn-outline text-xs">How we verify and advertise</Link>
          </div>
          <ServiceDirectory providers={providers} sponsoredByDistrict={sponsoredByDistrict} />
        </div>
      </section>
    </>
  )
}
