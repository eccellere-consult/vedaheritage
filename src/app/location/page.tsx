import type { Metadata } from 'next'
import Link from 'next/link'
import { WA } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Location & How to Reach',
  description: 'Veda Heritage is located in Vavvakkavu, Kollam, Kerala — 5 km from Amritapuri Ashram, 90 km from Trivandrum airport, 150 km from Kochi.',
}

const byOptions = [
  {
    icon: '✈️',
    title: 'By Air',
    options: [
      { label: 'Trivandrum International Airport (TRV)', dist: '90 km · 1.5 hrs · Cab ~₹1,800' },
      { label: 'Cochin International Airport (COK)', dist: '150 km · 2.5 hrs · Cab ~₹3,000' },
    ],
    tip: 'Trivandrum is the closer and easier option for most guests. Pre-book a cab — your host can arrange.',
  },
  {
    icon: '🚂',
    title: 'By Train',
    options: [
      { label: 'Karunagapally Railway Station', dist: '8 km · 15 min by auto-rickshaw' },
      { label: 'Kollam Junction', dist: '30 km · 40 min by cab' },
    ],
    tip: 'Train from Trivandrum to Karunagapally takes 1.5 hours. Very scenic Kerala coastal route.',
  },
  {
    icon: '🚌',
    title: 'By Bus',
    options: [
      { label: 'KSRTC to Karunagapally / Kayamkulam', dist: 'Regular buses from Trivandrum and Kochi' },
      { label: 'Alappuzha → Karunagapally route', dist: 'Via NH66 (National Highway)' },
    ],
    tip: 'Buses are frequent. Ask to alight at "Vavvakkavu junction" — your host will guide.',
  },
  {
    icon: '🚗',
    title: 'By Car / Cab',
    options: [
      { label: 'From Trivandrum: Via NH66 northwards', dist: '90 km · 1.5 hrs' },
      { label: 'From Kochi: Via NH66 southwards', dist: '150 km · 2.5 hrs' },
    ],
    tip: 'Search "Vavvakkavu, Karunagapally, Kollam" on Google Maps. Your host will share the exact pin on WhatsApp.',
  },
]

const nearby = [
  { name: 'Amritapuri Ashram (Amma\'s Ashram)', dist: '5 km', time: '12 min by auto' },
  { name: 'Vavvakkavu Beach', dist: '1.5 km', time: '5 min walk / 3 min by auto' },
  { name: 'Kollam Backwaters (Ashtamudi Lake)', dist: '20 km', time: '30 min' },
  { name: 'Karunagapally Town (shops, pharmacy)', dist: '8 km', time: '15 min' },
  { name: 'Kollam City', dist: '30 km', time: '40 min' },
  { name: 'Alappuzha (Alleppey) Backwaters', dist: '55 km', time: '75 min' },
  { name: 'Marari Beach', dist: '60 km', time: '80 min' },
  { name: 'Trivandrum (Thiruvananthapuram)', dist: '90 km', time: '1.5 hrs' },
]

export default function LocationPage() {
  return (
    <>
      {/* Header */}
      <section
        className="pt-32 pb-20 text-center"
        style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}
      >
        <p className="section-label text-gold/80">Getting Here</p>
        <h1 className="font-serif text-5xl text-white mb-4">Location</h1>
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-xl mx-auto text-sm leading-relaxed px-4">
          Vavvakkavu, Kollam, Kerala — on the Kerala backwater coast between Kollam and Alappuzha, 5 km from Amritapuri.
        </p>
      </section>

      {/* Map */}
      <section className="bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-8">
            <p className="section-label">Find Us</p>
            <h2 className="section-title">Vavvakkavu, Kollam, Kerala</h2>
            <div className="gold-rule mx-auto" />
          </div>
          {/* Google Maps embed */}
          <div className="w-full overflow-hidden border border-gold/20" style={{ height: '420px' }}>
            <iframe
              title="Veda Heritage location"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3940.6!2d76.5536!3d9.1717!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3b062d7fdf3b5555%3A0x1234567890abcdef!2sVavvakkavu%2C%20Kerala!5e0!3m2!1sen!2sin!4v1714000000000!5m2!1sen!2sin"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <p className="text-xs text-center text-ink-mid/50 mt-3 italic">
            Exact GPS pin shared via WhatsApp on booking confirmation.
          </p>
        </div>
      </section>

      {/* How to Reach */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="section-label">Directions</p>
            <h2 className="section-title">How to Reach Us</h2>
            <div className="gold-rule mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {byOptions.map(o => (
              <div key={o.title} className="card">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{o.icon}</span>
                  <h3 className="font-serif text-xl text-ink">{o.title}</h3>
                </div>
                {o.options.map(op => (
                  <div key={op.label} className="mb-3">
                    <p className="text-sm font-medium text-ink">{op.label}</p>
                    <p className="text-xs text-gold mt-0.5">{op.dist}</p>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-gold/20">
                  <p className="text-xs text-ink-mid italic">{o.tip}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-forest text-white p-8 text-center">
            <p className="font-serif text-xl mb-2 text-gold">Host Will Guide You</p>
            <p className="text-white/80 text-sm mb-4">
              Once you confirm your booking, your host Yesodharan will send you the exact Google Maps
              pin, pickup options from the nearest station, and a full arrival guide — on WhatsApp.
            </p>
            <a
              href={WA.directions}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold text-xs"
            >
              WhatsApp for Directions
            </a>
          </div>
        </div>
      </section>

      {/* Nearby */}
      <section className="py-24 bg-cream">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="section-label">Explore the Region</p>
            <h2 className="section-title">What's Nearby</h2>
            <div className="gold-rule mx-auto" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {nearby.map(n => (
              <div key={n.name} className="flex items-start justify-between bg-white p-4 border-l-2 border-gold">
                <div>
                  <p className="text-sm font-medium text-ink">{n.name}</p>
                  <p className="text-xs text-ink-mid/60 mt-0.5">{n.time}</p>
                </div>
                <span className="text-gold font-sans text-xs font-medium whitespace-nowrap ml-4 mt-0.5">{n.dist}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Amritapuri callout */}
      <section className="py-20 bg-ink text-center">
        <div className="max-w-2xl mx-auto px-4">
          <p className="section-label text-gold/60">For Ashram Visitors</p>
          <h2 className="font-serif text-3xl text-white mb-4">Visiting Amritapuri?</h2>
          <p className="text-white/60 text-sm leading-relaxed mb-8">
            Amritapuri Ashram is just 5 km from Veda Heritage. A shared auto-rickshaw takes 12 minutes.
            We host many guests who come for Amma's darshan programs, especially during Amma's birthday
            celebrations (September) and the winter season (December–February).
          </p>
          <Link href="/contact" className="btn-gold text-xs">
            Book Your Stay →
          </Link>
        </div>
      </section>
    </>
  )
}
