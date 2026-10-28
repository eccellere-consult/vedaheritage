import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/content'
import { linksFor } from '@/data/official-links'
import OfficialLinks from '@/components/OfficialLinks'

import PageHero from '@/components/PageHero'

export const metadata: Metadata = {
  title: 'Kerala Travel Planner — Trains, KSRTC Buses, Ferries & Official Sites',
  description: 'Plan travel across Kerala with official links to IRCTC, live train status, KSRTC buses, state ferries, KTDC stays and Kerala Tourism, plus practical tips.',
  alternates: { canonical: `${SITE_URL}/travel/` },
}

const tips = [
  ['Trains', 'Kerala is well served by Indian Railways along the coast: Thiruvananthapuram – Kollam – Alappuzha/Kottayam – Ernakulam – Thrissur – Kozhikode. Book early for festival dates and weekends; check live status on NTES.'],
  ['Buses', 'KSRTC runs the state-wide network, including AC Swift and Super-fast services. Reserve long-distance seats online, and use ordinary buses for short hops.'],
  ['Ferries & backwater boats', 'State Water Transport Department boats offer an inexpensive way to see the backwaters, including Alappuzha–Kottayam and Kollam–Alappuzha routes.'],
  ['Airports', 'Thiruvananthapuram (TRV), Cochin (COK), Calicut (CCJ) and Kannur (CNN) serve most routes. Choose by the region you want to explore.'],
  ['Festival & pilgrimage season', 'Expect crowds and special services for Sabarimala (Nov–Jan), Thrissur Pooram (Apr–May) and Onam (Aug–Sep). Plan transport weeks ahead.'],
]

export default function TravelPage() {
  return (
    <>
      <PageHero label="Plan Your Journey" title="Kerala Travel Planner" subtitle="Official links for tickets, live status, government-run stays and tourism information." />
      <section className="py-14 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {(['Tourism', 'Train', 'Bus', 'Water', 'Temples'] as const).map(g => (
            <div key={g}>
              <h2 className="font-serif text-2xl text-ink mb-3">{g === 'Tourism' ? 'Tourism & stays' : g === 'Temples' ? 'Temples & pilgrimage' : g === 'Water' ? 'Ferries & backwaters' : g === 'Bus' ? 'Buses (KSRTC)' : 'Trains'}</h2>
              <OfficialLinks extra={[]} groups={[g]} />
            </div>
          ))}
          <div>
            <h2 className="font-serif text-2xl text-ink mb-3">Practical tips</h2>
            <div className="space-y-3">
              {tips.map(([t, d]) => <div key={t} className="card !p-4"><h3 className="font-medium text-primary text-sm">{t}</h3><p className="text-sm text-ink-mid mt-1">{d}</p></div>)}
            </div>
          </div>
          <p className="text-xs text-ink-mid/70">Veda Heritage is not affiliated with these organisations. Always confirm fares, timings and rules on the official site. Heading to the retreat? See <Link href="/location/" className="underline">how to reach Veda Heritage</Link>.</p>
        </div>
      </section>
    </>
  )
}
