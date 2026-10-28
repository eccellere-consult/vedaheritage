import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SITE_URL, entryPath, getDistrict, getDistricts, getEntriesForDistrict } from '@/lib/content'
import PageHero from '@/components/PageHero'
import Timeline from '@/components/Timeline'
import EntryCard from '@/components/EntryCard'
import JsonLd from '@/components/JsonLd'

type Props = { params: Promise<{ district: string }> }

export function generateStaticParams() {
  const all = getDistricts().map(d => ({ district: d.slug }))
  // Static export needs one param; before the first approval this placeholder 404s (noindex).
  return all.length ? all : [{ district: '_placeholder' }]
}
export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { district } = await params
  const d = getDistrict(district)
  if (!d) return { robots: { index: false, follow: false } }
  const title = `${d.name} District, Kerala: History, What's Unique & Best Time to Visit`
  const url = `${SITE_URL}/kerala/${d.slug}/`
  return { title, description: d.summary, alternates: { canonical: url }, openGraph: { title, description: d.summary, url, type: 'article' } }
}

export default async function DistrictPage({ params }: Props) {
  const { district } = await params
  const d = getDistrict(district)
  if (!d) notFound()
  const entries = getEntriesForDistrict(d.name)
  const url = `${SITE_URL}/kerala/${d.slug}/`

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'AdministrativeArea', name: `${d.name} district`, description: d.summary, url, containedInPlace: { '@type': 'AdministrativeArea', name: 'Kerala' } },
          { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Kerala', item: `${SITE_URL}/kerala/` },
            { '@type': 'ListItem', position: 2, name: d.name, item: url },
          ] },
        ],
      }} />
      <PageHero label={<><Link href="/kerala/" className="hover:underline">Kerala</Link> · {d.region} Kerala</>} title={d.name} subtitle={d.tagline} />
      <article className="py-14 bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-ink-mid leading-relaxed mb-6">{d.summary}</p>
          <p className="text-xs text-ink-mid/70 mb-8">Headquarters: {d.headquarters}</p>

          <h2 className="section-title mb-3">A brief history</h2>
          <p className="text-ink-mid leading-relaxed mb-5">{d.history.overview}</p>
          <Timeline items={d.history.timeline} />

          <h2 className="section-title mt-12 mb-3">What makes {d.name} unique</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-mid">{d.unique.map(u => <li key={u}>{u}</li>)}</ul>

          <section className="mt-12 bg-accent-pale border-l-4 border-accent p-6" aria-labelledby="best">
            <p className="section-label">Best time to visit</p>
            <h2 id="best" className="font-serif text-2xl text-ink mb-2">{d.bestTime.season}</h2>
            <p className="text-sm text-ink-mid">{d.bestTime.why}</p>
            <p className="text-sm text-ink-mid mt-2"><span className="font-medium text-primary">Avoid:</span> {d.bestTime.avoid}</p>
          </section>

          <h2 className="section-title mt-12 mb-3">What to look for</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-mid">{d.lookFor.map(l => <li key={l}>{l}</li>)}</ul>

          <div className="grid sm:grid-cols-2 gap-4 mt-10">
            <div className="card !p-5"><h3 className="font-serif text-lg text-ink mb-2">Highlights</h3><ul className="list-disc pl-5 text-sm text-ink-mid space-y-1">{d.highlights.map(h => <li key={h}>{h}</li>)}</ul></div>
            <div className="card !p-5"><h3 className="font-serif text-lg text-ink mb-2">Festivals &amp; events</h3><ul className="list-disc pl-5 text-sm text-ink-mid space-y-1">{d.festivals.map(f => <li key={f}>{f}</li>)}</ul><p className="text-xs text-ink-mid/70 mt-2">Dates change yearly; confirm before travelling.</p></div>
          </div>
          {d.crafts.length > 0 && <p className="text-sm text-ink-mid mt-6"><span className="font-medium text-primary">Crafts &amp; local products:</span> {d.crafts.join(', ')}.</p>}

          <p className="text-xs text-ink-mid/70 mt-8">Last verified {new Date(d.lastVerified).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Sources: {d.sources.map((s, i) => <span key={s.url}>{i > 0 && ', '}<a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.label}</a></span>)}.</p>
        </div>
      </article>
      {entries.length > 0 && (
        <section className="py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="section-title mb-6">Guides in {d.name}</h2>
            <div className="grid md:grid-cols-3 gap-6">{entries.map(e => <EntryCard key={entryPath(e)} entry={e} />)}</div>
          </div>
        </section>
      )}
    </>
  )
}
