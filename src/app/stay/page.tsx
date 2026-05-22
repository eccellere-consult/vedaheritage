import type { Metadata } from 'next'
import Link from 'next/link'
import { PHOTOS } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Your Stay',
  description: 'Two beautifully appointed heritage bedrooms, a traditional Kerala kitchen, an Ayurvedic garden, and a private compound — near Amritapuri, Kollam.',
}

const amenities = [
  { icon: '🛏️', label: '2 Private Bedrooms' },
  { icon: '🚿', label: 'Hot Water Shower' },
  { icon: '📶', label: 'High-Speed Wi-Fi' },
  { icon: '❄️', label: 'Air Conditioning' },
  { icon: '🍳', label: 'Traditional Kitchen Access' },
  { icon: '🌿', label: 'Ayurvedic Garden' },
  { icon: '🔑', label: 'Self Check-in / Checkout' },
  { icon: '🧺', label: 'Fresh Towels & Linen' },
  { icon: '🏡', label: 'Private Compound' },
  { icon: '🐦', label: 'Garden Seating Area' },
  { icon: '🚗', label: 'Auto-rickshaw to Amritapuri' },
  { icon: '🛡️', label: '24 hr Security' },
]

const rooms = [
  {
    name: 'The Heritage Room',
    desc: 'Ground-floor room with original teakwood fittings, handmade ceramic tiles, and a garden-facing window. Sleeps 2. King bed. Air conditioning.',
    features: ['King bed', 'AC', 'Garden view', 'En-suite bathroom'],
    photo: PHOTOS.room1,
  },
  {
    name: 'The Terrace Room',
    desc: 'Upper-floor room with a private balcony overlooking the coconut grove. Cross-ventilated with sea breeze. Sleeps 2. Queen bed.',
    features: ['Queen bed', 'AC', 'Private balcony', 'Coconut grove view'],
    photo: PHOTOS.room2,
  },
]

const rules = [
  'Check-in: 2 PM onwards (flexible with advance notice)',
  'Checkout: 11 AM',
  'Maximum 4 guests',
  'No smoking inside the property',
  'Pets on request only',
  'Quiet hours: 10 PM – 7 AM (ashram guests often rise early)',
  'Free cancellation up to 48 hours before check-in',
]

export default function StayPage() {
  return (
    <>
      {/* Header */}
      <section
        className="pt-32 pb-20 text-center"
        style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}
      >
        <p className="section-label text-gold/80">Accommodation</p>
        <h1 className="font-serif text-5xl text-white mb-4">Your Stay</h1>
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-xl mx-auto text-sm leading-relaxed px-4">
          Two private heritage rooms in an authentic Kerala family home. Wake to birdsong, step into the Ayurvedic garden, and have the day to yourself.
        </p>
      </section>

      {/* Rooms */}
      <section className="py-24 bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="section-label">Accommodation</p>
            <h2 className="section-title">The Rooms</h2>
            <div className="gold-rule mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {rooms.map(r => (
              <div key={r.name} className="card">
                {/* Room photo */}
                <img
                  src={r.photo}
                  alt={r.name}
                  className="w-full aspect-video object-cover mb-6"
                />
                <h3 className="font-serif text-2xl text-ink mb-3">{r.name}</h3>
                <p className="text-ink-mid text-sm leading-relaxed mb-4">{r.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {r.features.map(f => (
                    <span key={f} className="text-xs bg-gold-pale text-ink-mid px-3 py-1 border border-gold/30">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="section-label">Facilities</p>
            <h2 className="section-title">Everything You Need</h2>
            <div className="gold-rule mx-auto" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {amenities.map(a => (
              <div key={a.label} className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{a.icon}</span>
                <span className="text-sm text-ink-mid">{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* House Rules */}
      <section className="py-20 bg-gold-pale">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="section-label">Policies</p>
            <h2 className="section-title">House Rules</h2>
            <div className="gold-rule mx-auto" />
          </div>
          <div className="bg-white p-8 border-l-4 border-gold">
            {rules.map(r => (
              <div key={r} className="flex items-start gap-3 py-2 border-b border-gold/10 last:border-0">
                <span className="text-gold text-lg leading-none flex-shrink-0">›</span>
                <p className="text-sm text-ink-mid">{r}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-forest text-center">
        <h2 className="font-serif text-3xl text-white mb-4">Ready to Book?</h2>
        <p className="text-white/70 mb-8 text-sm max-w-md mx-auto">
          Book instantly on Airbnb or message us directly on WhatsApp for custom rates and extended stays.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://www.airbnb.co.in/h/stay-near-amritapuri"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold text-xs"
          >
            Book on Airbnb
          </a>
          <Link href="/contact" className="btn-outline border-white text-white hover:bg-white hover:text-forest text-xs">
            Send an Enquiry
          </Link>
        </div>
      </section>
    </>
  )
}
