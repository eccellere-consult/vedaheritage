import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL, getDistricts, getKerala } from '@/lib/content'
import PageHero from '@/components/PageHero'
import Timeline from '@/components/Timeline'
import JsonLd from '@/components/JsonLd'

export const metadata: Metadata = {
  title: 'Kerala at a Glance: History, 14 Districts, Best Time to Visit',
  description: 'A brief history of Kerala, its three regions and 14 districts, what makes each unique, the best time to visit and what to look for.',
  alternates: { canonical: `${SITE_URL}/kerala/` },
}

export default function KeralaPage() {
  const k = getKerala()
  const districts = getDistricts()
  const regions = ['South', 'Central', 'North'] as const

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Kerala at a Glance', url: `${SITE_URL}/kerala/`,
        mainEntity: { '@type': 'ItemList', itemListElement: districts.map((d, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/kerala/${d.slug}/`, name: d.name })) },
      }} />
      <PageHero label="Know Kerala" title="Kerala at a Glance" subtitle={k?.summary || 'A brief history of Kerala and its 14 districts.'} />
      <section className="py-14 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {!k ? (
            <p className="text-center text-ink-mid">This guide is being prepared. Please check back soon.</p>
          ) : (
            <>
              {k.intro.map(p => <p key={p} className="text-ink-mid leading-relaxed mb-4">{p}</p>)}

              <h2 className="section-title mt-10 mb-4">A brief history</h2>
              <Timeline items={k.history} />

              <h2 className="section-title mt-12 mb-4">Three regions, 14 districts</h2>
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {k.regions.map(r => (
                  <div key={r.name} className="card !p-5"><h3 className="font-serif text-lg text-ink">{r.name}</h3><p className="text-xs text-accent mt-1">{r.districts}</p><p className="text-sm text-ink-mid mt-2">{r.character}</p></div>
                ))}
              </div>
              {regions.map(region => (
                <div key={region} className="mb-8">
                  <h3 className="text-xs tracking-widest uppercase text-accent font-medium mb-3">{region === 'North' ? 'North (Malabar)' : region} Kerala</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {districts.filter(d => d.region === region).map(d => (
                      <Link key={d.slug} href={`/kerala/${d.slug}/`} className="card block hover:shadow-md transition-shadow !p-5">
                        <h4 className="font-serif text-xl text-ink">{d.name}</h4>
                        <p className="text-sm text-ink-mid mt-1">{d.tagline}</p>
                        <p className="text-xs text-accent mt-2">Best: {d.bestTime.season}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <h2 className="section-title mt-12 mb-4">When to visit</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {k.seasons.map(s => (
                  <div key={s.season} className="card !p-5"><h3 className="font-serif text-lg text-ink">{s.season}</h3><p className="text-xs text-accent">{s.months}</p><p className="text-sm text-ink-mid mt-2">{s.notes}</p></div>
                ))}
              </div>

              <h2 className="section-title mt-12 mb-4">Essentials</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm text-ink-mid">{k.essentials.map(e => <li key={e}>{e}</li>)}</ul>
              <p className="text-xs text-ink-mid/70 mt-8">Last verified {new Date(k.lastVerified).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Sources: {k.sources.map((s, i) => <span key={s.url}>{i > 0 && ', '}<a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.label}</a></span>)}.</p>
            </>
          )}
        </div>
      </section>
    </>
  )
}
