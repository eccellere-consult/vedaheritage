import type { Metadata } from 'next'
import PageHero from '@/components/PageHero'
import ItineraryBuilder, { type PickPlace, type PickEvent } from '@/components/ItineraryBuilder'
import { CATEGORIES, SITE_URL, entryPath, getEntries } from '@/lib/content'
import { formatRange, getCalendar } from '@/lib/events'

export const metadata: Metadata = {
  title: 'Kerala Itinerary Planner: Pick Places and Festivals, Plan Day by Day',
  description: 'Build a Kerala trip plan from temples, beaches, backwaters, heritage places and upcoming festivals. Share the plan, print it, and get stay and transport help.',
  alternates: { canonical: `${SITE_URL}/itinerary/` },
}

export default function ItineraryPage() {
  const today = new Date().toISOString().slice(0, 10)
  const places: PickPlace[] = getEntries().map(e => ({
    id: `${e.category}/${e.slug}`, name: e.name, district: e.district, kind: CATEGORIES[e.category].singular, tagline: e.tagline, href: entryPath(e),
  })).sort((a, b) => a.name.localeCompare(b.name))
  const events: PickEvent[] = getCalendar().events.filter(e => e.end >= today).sort((a, b) => a.start.localeCompare(b.start)).map(e => ({
    id: e.id, name: e.name, district: e.district, place: e.place, start: e.start, end: e.end, when: formatRange(e), expected: e.certainty !== 'confirmed',
  }))
  return (
    <>
      <PageHero label="Plan Your Journey" title="Kerala Itinerary Planner" subtitle="Pick places and festivals, arrange them day by day, then share, print or ask us to help with stay and transport." />
      <section className="py-10 bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ItineraryBuilder places={places} events={events} />
        </div>
      </section>
    </>
  )
}
