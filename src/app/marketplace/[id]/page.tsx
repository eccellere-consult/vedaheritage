import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SITE_URL } from '@/lib/content'
import { LISTING_CATEGORIES, LISTING_CONDITIONS, getListing, getListings, listingPath, rupees } from '@/lib/listings'
import EnquiryForm from '@/components/market/EnquiryForm'
import Notice from '@/components/market/Notice'
import JsonLd from '@/components/JsonLd'
import PageHero from '@/components/PageHero'

type Props = { params: Promise<{ id: string }> }

export function generateStaticParams() {
  const ids = getListings().map(l => ({ id: l.id }))
  // Static export needs at least one param; before the first listing this placeholder renders a 404.
  return ids.length ? ids : [{ id: '_placeholder' }]
}
export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = getListing((await params).id)
  if (!l) return { robots: { index: false, follow: false } }
  const description = l.description.length > 160 ? l.description.slice(0, 157) + '…' : l.description
  const url = `${SITE_URL}${listingPath(l.id)}`
  return {
    title: `${l.title}: ${rupees(l.priceInr)}, ${l.district}`, description, alternates: { canonical: url },
    openGraph: { title: l.title, description, url, type: 'website', images: l.photos.map(p => ({ url: p.src, alt: p.alt })) },
  }
}

export default async function ListingPage({ params }: Props) {
  const l = getListing((await params).id)
  if (!l) notFound()
  const sold = l.status === 'sold'
  const url = `${SITE_URL}${listingPath(l.id)}`
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Product', name: l.title, description: l.description, image: l.photos.map(p => `${SITE_URL}${p.src}`),
        itemCondition: l.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition', category: LISTING_CATEGORIES[l.category],
        offers: { '@type': 'Offer', price: l.priceInr, priceCurrency: 'INR', availability: sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock', url, priceValidUntil: l.expiresOn },
      }} />
      <PageHero label={<><Link href="/marketplace/" className="hover:underline">Marketplace</Link> · {LISTING_CATEGORIES[l.category]}</>} title={l.title} subtitle={`${rupees(l.priceInr)} · ${LISTING_CONDITIONS[l.condition]} · ${l.district}${sold ? ' · Sold' : ''}`} />
      <article className="py-14 bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-3 space-y-6">
            <div className="grid gap-3">{l.photos.map(p => <img key={p.src} src={p.src} alt={p.alt} className="w-full object-cover" />)}</div>
            <div>
              <h2 className="font-serif text-2xl text-ink mb-2">About this item</h2>
              {l.description.split(/\n+/).map((p, i) => <p key={i} className="text-ink-mid leading-relaxed mb-3">{p}</p>)}
              <p className="text-xs text-ink-mid/80">Listed by {l.sellerFirstName} on {new Date(l.listedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Condition, age and authenticity are the seller's description and are not verified by Veda Heritage.</p>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Notice />
            {sold ? <p className="card text-sm text-ink-mid">This item has been sold. <Link href="/marketplace/" className="underline text-primary">See other items</Link>.</p> : <EnquiryForm listingId={l.id} />}
            <p className="text-xs text-ink-mid">Concerned about this listing? Tell us on <Link href="/stay/#book" className="underline">the contact form</Link> and we will review it. Read the <Link href="/marketplace/rules/" className="underline">rules and safe buying tips</Link>.</p>
          </div>
        </div>
      </article>
    </>
  )
}
