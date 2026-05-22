import type { Metadata } from 'next'
import Link from 'next/link'
import { PHOTOS, WA, SITE } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Veda Heritage | Traditional Kerala Retreat near Amritapuri',
}

const features = [
  {
    icon: '🌿',
    title: 'Ayurvedic Garden',
    desc: '40+ medicinal plants — tulsi, brahmi, vetiver, neem, turmeric, and rare classical herbs. Walk, breathe, and heal.',
  },
  {
    icon: '🏛️',
    title: 'Heritage Residence',
    desc: 'A traditional Kerala nalukettu-style home. Teakwood, laterite stone, handmade tiles — authentic in every detail.',
  },
  {
    icon: '🕊️',
    title: '5 km from Amritapuri',
    desc: 'The only heritage retreat this close to Mata Amritanandamayi\'s ashram. Reach the ashram in 12 minutes by auto.',
  },
]

const highlights = [
  { label: '2 Bedrooms', sub: 'Sleeps 4 guests' },
  { label: '4.2 ★ Rated', sub: 'Airbnb Superhost' },
  { label: 'Self Check-in', sub: 'Arrive any time' },
  { label: 'Free Cancellation', sub: '48-hour policy' },
]

const testimonials = [
  {
    quote: 'The most peaceful stay in Kerala. The garden, the silence, the proximity to Amma\'s ashram — everything was perfect. We will be back.',
    author: 'Maria, Germany',
  },
  {
    quote: 'Woke up to birdsong and coconut trees. Yesodharan is a wonderful host. We felt completely at home.',
    author: 'James, Australia',
  },
]

export default function HomePage() {
  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        {/* Hero photo — update src in src/lib/config.ts → PHOTOS.hero */}
        <img
          src={PHOTOS.hero}
          alt={PHOTOS.heroAlt}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-ink/55" />

        <div className="relative text-center px-4 max-w-4xl mx-auto">
          <p className="font-sans text-gold text-xs tracking-[0.35em] uppercase mb-6">
            Vavvakkavu · Kollam · Kerala
          </p>
          <h1 className="font-serif text-5xl md:text-7xl text-white leading-tight mb-4">
            Where Kerala's<br />
            <span className="text-gold">Soul Lives</span>
          </h1>
          <div className="w-16 h-px bg-gold mx-auto my-6" />
          <p className="font-sans text-white/80 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
            A traditional heritage villa with an Ayurvedic garden, 5 km from Amritapuri Ashram.
            Authentic Kerala. Absolute stillness. International hosting.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={SITE.airbnb}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold text-sm"
            >
              Book on Airbnb
            </a>
            <a
              href={WA.enquiry}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline border-white text-white hover:bg-white hover:text-forest text-sm"
            >
              WhatsApp Us
            </a>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40">
          <span className="text-xs tracking-widest uppercase font-sans">Scroll</span>
          <div className="w-px h-8 bg-white/30" />
        </div>
      </section>

      {/* ── QUICK HIGHLIGHTS BAR ─────────────────────────────── */}
      <section className="bg-forest text-white py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/20">
            {highlights.map(h => (
              <div key={h.label} className="text-center px-4 py-2">
                <p className="font-serif text-lg text-gold">{h.label}</p>
                <p className="font-sans text-xs text-white/60 tracking-wide">{h.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THREE PILLARS ────────────────────────────────────── */}
      <section className="py-24 bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="section-label">The Experience</p>
            <h2 className="section-title">Three Reasons Guests Return</h2>
            <div className="gold-rule mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map(f => (
              <div key={f.title} className="card text-center">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="font-serif text-xl text-ink mb-3">{f.title}</h3>
                <p className="text-sm text-ink-mid leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT SECTION ────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            {/* About photo — update src in src/lib/config.ts → PHOTOS.about */}
            <img
              src={PHOTOS.about}
              alt={PHOTOS.aboutAlt}
              className="aspect-[4/3] w-full object-cover rounded-sm shadow-lg"
            />

            <div>
              <p className="section-label">Our Story</p>
              <h2 className="section-title mb-4">A Kerala Family Home, Open to the World</h2>
              <div className="gold-rule" />
              <p className="text-ink-mid leading-relaxed mb-4">
                Veda Heritage is a traditional Kerala family residence in Vavvakkavu — a quiet fishing
                and farming village on the backwaters of Kollam, where the land and the sea meet in
                ancient harmony.
              </p>
              <p className="text-ink-mid leading-relaxed mb-4">
                The home has been in the family for generations. Today, your host Yesodharan opens
                it to international guests who come seeking the authentic Kerala — the one beyond the
                tourist brochures. The one that smells of curry leaves and coconut oil, where neighbours
                know each other by name and evenings are marked by temple bells.
              </p>
              <p className="text-ink-mid leading-relaxed mb-8">
                For spiritual travellers visiting Amritapuri, this is the closest traditional home
                experience available — 5 km from Amma's ashram, 12 minutes by auto-rickshaw.
              </p>
              <Link href="/stay" className="btn-primary text-xs">
                Explore the Stay →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── AMRITAPURI CALLOUT ───────────────────────────────── */}
      <section className="py-20 bg-gold-pale">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="section-label">For Spiritual Guests</p>
          <h2 className="font-serif text-3xl md:text-4xl text-ink mb-4">
            The Perfect Base for Amritapuri
          </h2>
          <div className="gold-rule mx-auto mb-6" />
          <p className="text-ink-mid leading-relaxed mb-6">
            Amritapuri — the ashram of Mata Amritanandamayi (Amma) — draws 30,000–40,000 visitors
            each year from 100+ countries. The ashram's own accommodation is limited and basic.
            Veda Heritage offers the comfortable, authentic Kerala alternative — just 5 km away,
            with private rooms, a traditional kitchen, and the peace of a family compound.
          </p>
          <div className="grid grid-cols-3 gap-6 mt-8 mb-8">
            {[['5 km', 'from Amritapuri'], ['12 min', 'by auto-rickshaw'], ['100+', 'countries of guests hosted']].map(([v, l]) => (
              <div key={l} className="text-center">
                <p className="font-serif text-3xl text-forest">{v}</p>
                <p className="font-sans text-xs text-ink-mid tracking-wide mt-1">{l}</p>
              </div>
            ))}
          </div>
          <a
            href={SITE.airbnb}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs"
          >
            Check Availability on Airbnb →
          </a>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="py-24 bg-ink">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="section-label text-gold/70">Guest Voices</p>
            <h2 className="font-serif text-3xl text-white">What Our Guests Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map(t => (
              <div key={t.author} className="border border-white/10 p-8">
                <p className="text-gold text-3xl font-serif leading-none mb-4">"</p>
                <p className="text-white/80 italic font-serif text-lg leading-relaxed mb-6">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-px bg-gold" />
                  <p className="text-gold/70 text-sm font-sans">{t.author}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a
              href="https://www.airbnb.co.in/h/stay-near-amritapuri"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold/60 text-sm font-sans hover:text-gold transition-colors"
            >
              Read all reviews on Airbnb ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section
        className="py-24 text-center"
        style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #1A5C38 100%)' }}
      >
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-serif text-4xl text-white mb-4">Ready to Arrive?</h2>
          <p className="text-white/70 mb-8 leading-relaxed">
            Book directly via Airbnb or send us a WhatsApp message — we respond within the hour.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={SITE.airbnb} target="_blank" rel="noopener noreferrer" className="btn-gold text-sm">
              Book on Airbnb
            </a>
            <a href={WA.book} target="_blank" rel="noopener noreferrer" className="btn-outline border-white text-white hover:bg-white hover:text-forest text-sm">
              WhatsApp Us
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
