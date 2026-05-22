import type { Metadata } from 'next'
import { PHOTOS } from '@/lib/config'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Ayurveda',
  description: 'Ayurvedic garden with 40+ medicinal plants, traditional Ayurvedic treatment room, and an authorised Vaidyaratnam retail corner at Veda Heritage, Kerala.',
}

const plants = [
  'Brahmi (Bacopa monnieri)', 'Tulsi (Holy Basil)', 'Ashwagandha', 'Neem',
  'Turmeric (Curcuma longa)', 'Vetiver (Khus)', 'Aloe Vera', 'Giloy',
  'Moringa (Drumstick)', 'Curry Leaf', 'Lemongrass', 'Jasmine',
  'Hibiscus', 'Amla (Indian Gooseberry)', 'Ginger', 'Castor',
  'Calotropis (Erukku)', 'Pathimukham (Red Sandalwood)', '+ 22 more rare species',
]

const products = [
  { name: 'Kunkumadi Thailam', use: 'Traditional saffron skin-brightening face oil — globally sought' },
  { name: 'Brahmi Thailam', use: 'Classical hair and scalp oil for calm and clarity' },
  { name: 'Dhanwantaram Thailam', use: 'The signature Kerala Ayurveda massage oil — authentic classical formula' },
  { name: 'Chyavanaprasam', use: 'Immunity, vitality, and rejuvenation — traditional daily supplement' },
  { name: 'Triphala', use: 'Three-fruit digestive and detox — the most recommended Ayurveda supplement globally' },
  { name: 'Ashwagandha', use: 'Stress, sleep, and immunity — the world\'s most in-demand Ayurveda herb' },
  { name: 'Brahmi tablet', use: 'Memory, focus, and mental clarity' },
  { name: 'Herbal soaps & tea', use: 'Neem, turmeric, sandalwood soap; brahmi and tulsi herbal infusions' },
]

export default function AyurvedaPage() {
  return (
    <>
      {/* Header */}
      <section
        className="pt-32 pb-20 text-center"
        style={{ background: 'linear-gradient(160deg, #0A2E1A 0%, #2A7A4E 100%)' }}
      >
        <p className="section-label text-gold/80">Wellness</p>
        <h1 className="font-serif text-5xl text-white mb-4">Ayurveda at Veda Heritage</h1>
        <div className="w-12 h-px bg-gold mx-auto mb-4" />
        <p className="text-white/70 max-w-xl mx-auto text-sm leading-relaxed px-4">
          From the living garden to the treatment room to the retail corner — Ayurveda is not a feature here. It is the foundation.
        </p>
      </section>

      {/* Garden */}
      <section className="py-24 bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="section-label">Living Heritage</p>
              <h2 className="section-title mb-4">The Ayurvedic Medicinal Garden</h2>
              <div className="gold-rule" />
              <p className="text-ink-mid leading-relaxed mb-4">
                The property's Ayurvedic garden is home to 40+ medicinal plants — each identified with
                its Sanskrit name, Malayalam name, and traditional use. This is not a decorative garden.
                Every plant has a classical Ayurvedic application documented in the Ashtanga Hridayam
                and Charaka Samhita.
              </p>
              <p className="text-ink-mid leading-relaxed mb-6">
                Each morning, your host walks guests through the garden — explaining the plants, their
                stories, and their uses. It is a 20-minute living classroom that stays with guests for life.
              </p>
              <p className="text-sm text-gold font-medium italic mb-6">
                "The garden is the retreat's curriculum. Everything else is the practice."
              </p>
            </div>
            {/* Garden photo */}
            <img
              src={PHOTOS.garden}
              alt={PHOTOS.gardenAlt}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>

          {/* Plant grid */}
          <div className="mt-16">
            <p className="section-label text-center mb-8">Plants in the Garden</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {plants.map(p => (
                <div key={p} className="bg-white border-l-2 border-gold px-4 py-2">
                  <p className="text-sm text-ink-mid">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Treatment Room */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            {/* Treatment photo */}
            <img
              src={PHOTOS.treatment}
              alt={PHOTOS.treatmentAlt}
              className="aspect-[4/3] w-full object-cover order-2 md:order-1"
            />

            <div className="order-1 md:order-2">
              <p className="section-label">Treatments</p>
              <h2 className="section-title mb-4">Traditional Ayurvedic Treatment Room</h2>
              <div className="gold-rule" />
              <p className="text-ink-mid leading-relaxed mb-4">
                The retreat has a dedicated Ayurvedic treatment room with a traditional wooden massage
                droni (table). Treatments are performed by a trained local Ayurvedic practitioner using
                authentic classical oils — including Vaidyaratnam Dhanwantaram, Ksheerabala, and
                Murivenna.
              </p>
              <p className="text-ink-mid leading-relaxed mb-6">
                Treatments available include Abhyanga (full-body oil massage), Shirodhara
                (forehead oil stream), Padabhyanga (foot and leg massage), and Nasyam
                (nasal oil therapy). Booking in advance is required.
              </p>
              <div className="bg-gold-pale border-l-4 border-gold p-4 text-sm text-ink-mid italic">
                Treatments are offered as a separate service. Rates and availability on request.
                Please mention your interest when booking the retreat.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vaidyaratnam Retail Corner */}
      <section className="py-24 bg-gold-pale">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="section-label">Authorised Retail Partner</p>
            <h2 className="section-title">Vaidyaratnam Ayurveda Products</h2>
            <div className="gold-rule mx-auto" />
            <p className="text-ink-mid mt-4 max-w-2xl mx-auto text-sm leading-relaxed">
              Veda Heritage is an authorised retail display partner of{' '}
              <strong>Vaidyaratnam Oushadhasala</strong> — India's most prestigious classical Ayurveda
              brand, founded in 1941 by the Ashtavaidya Neelakandhan Mooss lineage and recipient of
              the Dhanwantari Award (Ministry of AYUSH, 2025). 893+ outlets. 500+ products.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {products.map(p => (
              <div key={p.name} className="bg-white p-5 border-t-2 border-gold">
                <h4 className="font-serif text-base text-ink mb-2">{p.name}</h4>
                <p className="text-xs text-ink-mid leading-relaxed">{p.use}</p>
              </div>
            ))}
          </div>

          <div className="bg-forest text-white p-8 text-center max-w-2xl mx-auto">
            <p className="font-serif text-lg mb-2 text-gold">Take Kerala Home</p>
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              All products are available for purchase at the retreat — MRP-priced, genuinely
              authentic, sourced directly from Vaidyaratnam's authorised distribution network.
              The perfect gifts, and the best personal Ayurveda supplements to continue your
              wellness journey at home.
            </p>
            <Link href="/contact" className="btn-gold text-xs">
              Ask Us About Products
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-ink text-center">
        <h2 className="font-serif text-3xl text-white mb-4">Begin Your Ayurveda Journey</h2>
        <p className="text-white/60 mb-8 text-sm">Book your stay and let the healing begin from Day 1.</p>
        <a
          href="https://www.airbnb.co.in/h/stay-near-amritapuri"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gold text-xs"
        >
          Book on Airbnb →
        </a>
      </section>
    </>
  )
}
