import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/content'
import { LISTING_CATEGORIES, LISTING_CONDITIONS, getListings, listingPath, rupees } from '@/lib/listings'
import MarketBrowse from '@/components/market/MarketBrowse'
import Notice from '@/components/market/Notice'
import PageHero from '@/components/PageHero'

export const metadata: Metadata = {
  title: 'Kerala Heritage Marketplace: Traditional Items, Moderated',
  description: 'Buy and sell traditional Kerala items: bell-metal lamps, handloom, woodwork, instruments and crafts. Every listing is reviewed; buyer and seller deal directly.',
  alternates: { canonical: `${SITE_URL}/marketplace/` },
}

export default function MarketplacePage() {
  const items = getListings().map(l => ({
    id: l.id, href: listingPath(l.id), title: l.title, category: l.category, categoryLabel: LISTING_CATEGORIES[l.category], condition: LISTING_CONDITIONS[l.condition],
    price: rupees(l.priceInr), district: l.district, photo: l.photos[0]?.src, alt: l.photos[0]?.alt, sold: l.status === 'sold',
  }))
  return (
    <>
      <PageHero label="Marketplace" title="Traditional Kerala items, passed on with care" subtitle="Lamps, handloom, woodwork, instruments and crafts from Kerala homes and workshops. Every listing is reviewed before it appears." />
      <section className="py-14 bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <Notice />
          <div className="flex flex-wrap gap-3">
            <Link href="/marketplace/sell/" className="btn-primary text-xs">List an item (free)</Link>
            <Link href="/marketplace/rules/" className="btn-outline text-xs">Rules and safe buying</Link>
          </div>
          <MarketBrowse items={items} />
        </div>
      </section>
    </>
  )
}
