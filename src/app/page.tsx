import type { Metadata } from 'next'
import Link from 'next/link'
import { PHOTOS, WA, SITE } from '@/lib/config'
import { CATEGORIES, getEntries, type CategoryKey } from '@/lib/content'
import { NAV_GROUPS } from '@/lib/nav'

export const metadata: Metadata = {
  title: "Veda Heritage | Discover Kerala's Vedic & Traditional Heritage",
  description: "Temples, Vedic heritage and mantras, Ayurveda and healing plants, music, dance, astrology and wedding traditions of Kerala, with the stories behind each.",
}

export default function HomePage() {
  const count = (href: string) => getEntries(href.split('/').pop() as CategoryKey).length
  return (
    <>
      {/* HERO */}
      <section className="relative min-h-[80vh] flex items-center justify-center pt-16">
        <img src={PHOTOS.hero} alt={PHOTOS.heroAlt} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-ink/60" />
        <div className="relative text-center px-4 max-w-4xl mx-auto">
          <p className="font-sans text-accent-light text-xs tracking-[0.35em] uppercase mb-6">Kerala · Vedic · Traditional</p>
          <h1 className="font-serif text-5xl md:text-7xl text-white leading-tight mb-4">
            Kerala's Living<br /><span className="text-accent-light">Heritage</span>
          </h1>
          <div className="w-16 h-px bg-accent mx-auto my-6" />
          <p className="font-sans text-white/85 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
            Temples and mantras, Ayurveda and healing plants, music and dance, astrology and wedding rituals,
            with the history and folklore behind each.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/discover" className="btn-accent text-sm">Explore all guides</Link>
            <Link href="/kerala" className="btn-outline border-white text-white hover:bg-white hover:text-primary text-sm">Kerala &amp; its 14 districts</Link>
          </div>
        </div>
      </section>

      {/* TOPIC GROUPS: the main real estate */}
      <section className="py-20 bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="section-label">Discover</p>
            <h2 className="section-title">Every thread of Kerala's tradition</h2>
            <div className="accent-rule mx-auto" />
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {NAV_GROUPS.map(g => (
              <div key={g.label} className="card !p-7">
                <h3 className="font-serif text-2xl text-ink">{g.label}</h3>
                <p className="text-sm text-ink-mid mb-5">{g.blurb}</p>
                <ul className="space-y-4">
                  {g.items.map(i => {
                    const key = i.href.split('/').pop() as CategoryKey
                    const n = count(i.href)
                    return (
                      <li key={i.href}>
                        <Link href={i.href} className="group block">
                          <span className="font-medium text-primary group-hover:underline">{i.label}</span>
                          <span className="text-xs text-accent ml-2">{n > 0 ? `${n} guide${n > 1 ? 's' : ''}` : 'coming soon'}</span>
                          <span className="block text-sm text-ink-mid leading-snug">{CATEGORIES[key].blurb}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KERALA + STORIES */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-6">
          {[
            ['/kerala', 'Kerala & its 14 districts', 'A brief history, what is unique in each district, the best time to visit and what to look for.'],
            ['/stories', 'Stories from travellers', 'Experiences, folklore people heard and practical tips, reviewed before they are published. Share yours.'],
            ['/travel', 'Travel planner', 'Trains, KSRTC buses, ferries and official KTDC and Kerala Tourism links.'],
          ].map(([href, t, d]) => (
            <Link key={href} href={href} className="card hover:shadow-md transition-shadow">
              <h3 className="font-serif text-xl text-ink mb-2">{t}</h3>
              <p className="text-sm text-ink-mid leading-relaxed">{d}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* STAY: one small, independent section */}
      <section className="py-10 bg-accent-pale">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="section-label">Stay with us</p>
          <p className="text-ink-mid text-sm leading-relaxed mb-4">
            Our family heritage home in Vavvakkavu, Kollam, is 5 km from Amritapuri, with an Ayurvedic garden and a quiet, traditional setting.
          </p>
          <div className="flex gap-4 justify-center text-sm">
            <Link href="/stay" className="text-primary underline">About the stay</Link>
            <a href={SITE.airbnb} target="_blank" rel="noopener noreferrer" className="text-primary underline">Airbnb ↗</a>
            <a href={WA.enquiry} target="_blank" rel="noopener noreferrer" className="text-primary underline">WhatsApp ↗</a>
          </div>
        </div>
      </section>
    </>
  )
}
