import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CATEGORIES, CATEGORY_KEYS, SITE_URL, getEntries, entryPath, type CategoryKey } from '@/lib/content'
import EntryCard from '@/components/EntryCard'
import JsonLd from '@/components/JsonLd'

type Props = { params: Promise<{ category: string }> }

export function generateStaticParams() {
  return CATEGORY_KEYS.map(category => ({ category }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  const c = CATEGORIES[category as CategoryKey]
  if (!c) return {}
  return { title: c.seoTitle, description: c.blurb, alternates: { canonical: `${SITE_URL}/discover/${category}/` } }
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params
  if (!CATEGORY_KEYS.includes(category as CategoryKey)) notFound()
  const key = category as CategoryKey
  const c = CATEGORIES[key]
  const entries = getEntries(key)

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'CollectionPage', name: c.seoTitle, description: c.blurb, url: `${SITE_URL}/discover/${key}/`,
            mainEntity: { '@type': 'ItemList', itemListElement: entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}${entryPath(e)}`, name: e.name })) } },
          { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Discover', item: `${SITE_URL}/discover/` },
            { '@type': 'ListItem', position: 2, name: c.label, item: `${SITE_URL}/discover/${key}/` },
          ] },
        ],
      }} />
      <section className="pt-32 pb-16 text-center" style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}>
        <p className="section-label text-gold/80"><Link href="/discover/" className="hover:underline">Discover Kerala</Link></p>
        <h1 className="font-serif text-4xl md:text-5xl text-white mb-4 px-4">{c.label} of Kerala</h1>
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-xl mx-auto text-sm leading-relaxed px-4">{c.blurb}</p>
      </section>
      <section className="py-14 bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {entries.length === 0 ? (
            <p className="text-center text-ink-mid">New {c.label.toLowerCase()} guides are being prepared. Check back soon, or <Link className="underline" href="/stories/">share a story</Link>.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {entries.map(e => <EntryCard key={e.slug} entry={e} />)}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
