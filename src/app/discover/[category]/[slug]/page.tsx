import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CATEGORIES, CATEGORY_KEYS, SITE_URL, getEntries, getEntry, getStories, entryPath, type CategoryKey } from '@/lib/content'
import { SITE, WA } from '@/lib/config'
import EntryCard from '@/components/EntryCard'
import StoryList from '@/components/StoryList'
import StoryForm from '@/components/StoryForm'
import JsonLd from '@/components/JsonLd'

type Props = { params: Promise<{ category: string; slug: string }> }

export function generateStaticParams() {
  const params = getEntries().map(e => ({ category: e.category, slug: e.slug }))
  // Static export needs at least one param; before the first approval this
  // placeholder renders a 404 page (see notFound() below).
  return params.length ? params : [{ category: 'temples', slug: '_placeholder' }]
}

export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params
  const e = getEntry(category as CategoryKey, slug)
  if (!e) return { robots: { index: false, follow: false } }
  const url = `${SITE_URL}${entryPath(e)}`
  const title = `${e.name} — Guide, Legend & Visiting Tips`
  return {
    title,
    description: e.summary,
    keywords: [...e.tags, e.district, 'Kerala', e.name],
    alternates: { canonical: url },
    openGraph: { title, description: e.summary, url, type: 'article', siteName: SITE.name, locale: 'en_IN', images: e.image ? [e.image] : undefined },
    twitter: { card: 'summary_large_image', title, description: e.summary },
  }
}

export default async function EntryPage({ params }: Props) {
  const { category, slug } = await params
  if (!CATEGORY_KEYS.includes(category as CategoryKey)) notFound()
  const e = getEntry(category as CategoryKey, slug)
  if (!e) notFound()

  const cat = CATEGORIES[e.category]
  const url = `${SITE_URL}${entryPath(e)}`
  const stories = getStories(e)
  const related = getEntries().filter(x => x.slug !== e.slug && (x.category === e.category || x.district === e.district)).slice(0, 3)
  const allPlaces = getEntries().map(x => ({ category: x.category, slug: x.slug, name: x.name }))

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': ['TouristAttraction', ...(cat.schemaType !== 'TouristAttraction' ? [cat.schemaType] : [])],
            name: e.name,
            alternateName: e.malayalamName,
            description: e.summary,
            url,
            image: e.image,
            touristType: 'Cultural tourism',
            address: { '@type': 'PostalAddress', addressRegion: 'Kerala', addressLocality: e.district, addressCountry: 'IN' },
            ...(e.coordinates ? { geo: { '@type': 'GeoCoordinates', latitude: e.coordinates.lat, longitude: e.coordinates.lng } } : {}),
            keywords: e.tags.join(', '),
          },
          {
            '@type': 'Article',
            headline: `${e.name} — Guide, Legend & Visiting Tips`,
            description: e.summary,
            url,
            dateModified: e.lastVerified,
            inLanguage: 'en-IN',
            author: { '@type': 'Organization', name: SITE.name },
            publisher: { '@type': 'Organization', name: SITE.name, url: SITE_URL },
            mainEntityOfPage: url,
          },
          { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Discover', item: `${SITE_URL}/discover/` },
            { '@type': 'ListItem', position: 2, name: cat.label, item: `${SITE_URL}/discover/${e.category}/` },
            { '@type': 'ListItem', position: 3, name: e.name, item: url },
          ] },
        ],
      }} />

      <section className="pt-32 pb-16 text-center" style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}>
        <p className="section-label text-gold/80">
          <Link href="/discover/" className="hover:underline">Discover</Link> · <Link href={`/discover/${e.category}/`} className="hover:underline">{cat.label}</Link> · {e.district}
        </p>
        <h1 className="font-serif text-4xl md:text-5xl text-white mb-2 px-4">{e.name}</h1>
        {e.malayalamName && <p className="text-gold-light text-lg mb-3">{e.malayalamName}</p>}
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-2xl mx-auto text-sm leading-relaxed px-4">{e.tagline}</p>
      </section>

      <article className="py-14 bg-cream">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {e.description.map((p, i) => <p key={i} className="text-ink-mid leading-relaxed mb-4">{p}</p>)}

          <h2 className="section-title mt-10 mb-4">Highlights</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-mid">{e.highlights.map(h => <li key={h}>{h}</li>)}</ul>

          <section className="mt-12 bg-gold-pale border-l-4 border-gold p-6 md:p-8" aria-labelledby="folklore">
            <p className="section-label">Legend &amp; folklore</p>
            <h2 id="folklore" className="font-serif text-2xl text-ink mb-3">{e.folklore.title}</h2>
            {e.folklore.story.map((p, i) => <p key={i} className="text-ink-mid leading-relaxed mb-3">{p}</p>)}
            {e.folklore.note && <p className="text-xs text-ink-mid/70 italic mt-2">{e.folklore.note}</p>}
          </section>

          <h2 className="section-title mt-12 mb-4">Plan your visit</h2>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="card !p-4"><dt className="font-medium text-forest">Best time</dt><dd className="text-ink-mid mt-1">{e.visitorInfo.bestTime}</dd></div>
            <div className="card !p-4"><dt className="font-medium text-forest">How to reach</dt><dd className="text-ink-mid mt-1">{e.visitorInfo.howToReach}</dd></div>
            {e.visitorInfo.duration && <div className="card !p-4"><dt className="font-medium text-forest">Suggested time</dt><dd className="text-ink-mid mt-1">{e.visitorInfo.duration}</dd></div>}
          </dl>
          <h3 className="font-serif text-xl text-ink mt-6 mb-2">Etiquette &amp; good to know</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-ink-mid">{e.visitorInfo.etiquette.map(t => <li key={t}>{t}</li>)}</ul>

          <p className="text-xs text-ink-mid/70 mt-8">
            Last verified {new Date(e.lastVerified).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Timings, fees and dates change — confirm with the venue before travelling.
            Sources: {e.sources.map((s, i) => (
              <span key={s.url}>{i > 0 && ', '}<a href={s.url} rel="noopener noreferrer" target="_blank" className="underline">{s.label}</a></span>
            ))}.
          </p>

          <div className="mt-10 bg-white border-t-2 border-gold p-6 text-sm">
            <p className="font-serif text-xl text-ink mb-1">Staying nearby?</p>
            <p className="text-ink-mid mb-3">Veda Heritage in Vavvakkavu, Kollam is a traditional Kerala home base for exploring the region.</p>
            <a href={WA.enquiry} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs">Ask about a stay</a>
          </div>

          <section className="mt-14" aria-labelledby="stories">
            <h2 id="stories" className="section-title mb-4">Traveller notes &amp; stories</h2>
            <StoryList stories={stories} />
            <h3 className="font-serif text-xl text-ink mt-10 mb-3">Share your own story about {e.name}</h3>
            <StoryForm places={allPlaces} defaultPlace={`${e.category}/${e.slug}`} />
          </section>
        </div>
      </article>

      {related.length > 0 && (
        <section className="py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="section-title mb-6">Keep exploring</h2>
            <div className="grid md:grid-cols-3 gap-6">{related.map(r => <EntryCard key={r.slug} entry={r} />)}</div>
          </div>
        </section>
      )}
    </>
  )
}
