import Link from 'next/link'
import { WA, SITE } from '@/lib/config'

export default function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

          {/* Brand */}
          <div>
            <h3 className="font-serif text-2xl text-white mb-1">Veda Heritage</h3>
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Vavvakkavu · Kerala</p>
            <div className="w-10 h-px bg-gold mb-4" />
            <p className="text-white/60 text-sm leading-relaxed">
              A traditional Kerala heritage villa where ancient Ayurvedic wisdom meets timeless
              hospitality — 5 km from Amritapuri Ashram.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <p className="section-label text-gold/70 mb-4">Explore</p>
            <div className="flex flex-col gap-2">
              {[
                ['/stay', 'Your Stay'],
                ['/ayurveda', 'Ayurveda'],
                ['/location', 'Location & How to Reach'],
                ['/contact', 'Book & Contact'],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="text-white/60 text-sm hover:text-gold transition-colors">
                  {label}
                </Link>
              ))}
              <a
                href="https://www.airbnb.co.in/h/stay-near-amritapuri"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 text-sm hover:text-gold transition-colors"
              >
                Book on Airbnb ↗
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="section-label text-gold/70 mb-4">Contact</p>
            <div className="flex flex-col gap-3 text-sm text-white/60">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Address</p>
                <p>Vavvakkavu, Karunagapally<br />Kollam District, Kerala 690536</p>
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-1">WhatsApp / Phone</p>
                {/* Replace with actual number */}
                <a href={WA.base} className="hover:text-gold transition-colors">
                  {SITE.phoneDisplay}
                </a>
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Email</p>
                <a href="mailto:stay@vedaheritage.co.in" className="hover:text-gold transition-colors">
                  stay@vedaheritage.co.in
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Veda Heritage. All rights reserved. · www.vedaheritage.co.in
          </p>
          <p className="text-white/30 text-xs">
            Near Amritapuri · Kollam · Kerala · India
          </p>
        </div>
      </div>
    </footer>
  )
}
