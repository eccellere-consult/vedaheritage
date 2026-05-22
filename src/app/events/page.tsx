import type { Metadata } from 'next'
import Link from 'next/link'
import { KERALA_EVENTS, EVENT_TYPE_COLOURS, EventType } from '@/data/events'

export const metadata: Metadata = {
  title: 'Kerala Events & Festivals',
  description: 'A month-by-month guide to Kerala festivals, Amritapuri ashram programs, and cultural events near Veda Heritage, Vavvakkavu, Kollam.',
}

export default function EventsPage() {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  const eventsByMonth = months.map(month => ({
    month,
    events: KERALA_EVENTS.filter(e => e.month === month || e.month.startsWith(month)),
  })).filter(m => m.events.length > 0)

  return (
    <>
      {/* Header */}
      <section
        className="pt-32 pb-20 text-center"
        style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}
      >
        <p className="section-label text-gold/80">Plan Your Visit</p>
        <h1 className="font-serif text-5xl text-white mb-4">Kerala Events & Festivals</h1>
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-xl mx-auto text-sm leading-relaxed px-4">
          From Thrissur Pooram to Amma's Birthday, from Onam to the Karkidakam Ayurveda season —
          Kerala's calendar is extraordinarily rich. Plan around what matters to you.
        </p>
      </section>

      {/* Legend */}
      <section className="bg-white border-b border-gold/10 py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3 justify-center">
            {(Object.entries(EVENT_TYPE_COLOURS) as [EventType, string][]).map(([type, colours]) => (
              <span key={type} className={`text-xs font-sans font-medium px-3 py-1 rounded-full border ${colours}`}>
                {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 bg-cream">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {eventsByMonth.map(({ month, events }) => (
            <div key={month} className="mb-16">
              {/* Month header */}
              <div className="flex items-center gap-4 mb-8">
                <h2 className="font-serif text-3xl text-ink">{month}</h2>
                <div className="flex-1 h-px bg-gold/30" />
              </div>

              {/* Events */}
              <div className="space-y-6">
                {events.map(event => (
                  <div
                    key={event.name}
                    className={`bg-white p-6 md:p-8 border-l-4 ${event.highlight ? 'border-gold shadow-md' : 'border-gold/30'}`}
                  >
                    <div className="flex flex-wrap items-start gap-3 mb-3">
                      <span className={`text-xs font-sans font-medium px-2 py-0.5 rounded-full border ${EVENT_TYPE_COLOURS[event.type]}`}>
                        {event.type}
                      </span>
                      {event.highlight && (
                        <span className="text-xs font-sans font-bold text-gold tracking-wider uppercase">
                          ★ Highlight
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif text-xl text-ink mb-1">{event.name}</h3>
                    <p className="text-gold text-xs font-sans tracking-wide mb-3">{event.dates}</p>

                    <p className="text-sm text-ink-mid leading-relaxed mb-4">{event.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-ink-mid/50 uppercase tracking-wider mb-1">Location</p>
                        <p className="text-ink-mid">{event.location}</p>
                      </div>
                      <div>
                        <p className="text-ink-mid/50 uppercase tracking-wider mb-1">From the Retreat</p>
                        <p className="text-forest font-medium">{event.distanceFromRetreat}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-ink-mid/50 uppercase tracking-wider mb-1">Best For</p>
                        <p className="text-ink-mid">{event.bestFor}</p>
                      </div>
                    </div>

                    {event.tip && (
                      <div className="mt-4 pt-4 border-t border-gold/20 flex gap-2">
                        <span className="text-gold flex-shrink-0 text-sm">💡</span>
                        <p className="text-xs text-ink-mid italic">{event.tip}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Year note */}
      <section className="py-6 bg-white border-t border-gold/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs text-ink-mid/50 italic">
            Note: Festival dates vary each year based on the Malayalam lunar calendar.
            Verify exact dates at the relevant official website or with your host before travel.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-ink text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-serif text-3xl text-white mb-3">Plan Around Your Festival</h2>
          <p className="text-white/60 text-sm mb-6">
            Tell us which event you want to attend and we will suggest the best dates to stay.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/919964694566?text=Hello%2C%20I%20want%20to%20plan%20my%20stay%20around%20a%20Kerala%20festival."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold text-xs"
            >
              Plan My Visit on WhatsApp
            </a>
            <Link href="/contact" className="btn-outline border-white text-white hover:bg-white hover:text-forest text-xs">
              Send an Enquiry
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
