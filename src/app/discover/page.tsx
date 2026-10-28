import type { Metadata } from 'next'
import Link from 'next/link'
import { CATEGORIES, CATEGORY_KEYS, SITE_URL, entryPath, getEntries, getStories } from '@/lib/content'
import DiscoverSearch from '@/components/DiscoverSearch'
import StoryList from '@/components/StoryList'
import JsonLd from '@/components/JsonLd'

export const metadata: Metadata = {
  title: 'Discover Kerala — Temples, Beaches, Backwaters, Ayurveda & Legends',
  description: "A living guide to Kerala's temples, beaches, backwaters, tourist places and Ayurveda — with the folklore behind each place and stories from fellow travellers.",
  alternates: { canonical: `${SITE_URL}/discover/` },
}

export default function DiscoverPage() {
  const entries = getEntries()
  const stories = getStories().slice(0, 3)
  const items = entries.map(e => ({
    href: entryPath(e), name: e.name, tagline: e.tagline, district: e.district,
    category: e.category, categoryLabel: CATEGORIES[e.category].label, tags: e.tags,
  }))

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Discover Kerala',
        url: `${SITE_URL}/discover/`,
        description: metadata.description,
        mainEntity: { '@type': 'ItemList', itemListElement: entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}${entryPath(e)}`, name: e.name })) },
      }} />

      <section className="pt-32 pb-20 text-center" style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}>
        <p className="section-label text-gold/80">Discover Kerala</p>
        <h1 className="font-serif text-4xl md:text-5xl text-white mb-4 px-4">Kerala, with the stories behind the places</h1>
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-2xl mx-auto text-sm leading-relaxed px-4">
          Temples, beaches, backwaters, hill towns and Ayurveda — each guide carries the legend that made the place,
          practical visitor advice, and notes from travellers who have been there.
        </p>
      </section>

      <section className="py-14 bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-14">
            {CATEGORY_KEYS.map(k => (
              <Link key={k} href={`/discover/${k}/`} className="card text-center hover:shadow-md transition-shadow !p-5">
                <h2 className="font-serif text-xl text-ink">{CATEGORIES[k].label}</h2>
                <p className="text-xs text-gold mt-1">{getEntries(k).length} guides</p>
              </Link>
            ))}
          </div>
          <DiscoverSearch items={items} />
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="section-label">From fellow travellers</p>
          <h2 className="section-title mb-6">Notes &amp; stories</h2>
          <StoryList stories={stories} />
          <Link href="/stories/" className="btn-outline mt-8">Read all &amp; share yours</Link>
        </div>
      </section>
    </>
  )
}
