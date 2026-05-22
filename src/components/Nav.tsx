'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WA, SITE } from '@/lib/config'

const links = [
  { href: '/stay', label: 'Stay' },
  { href: '/ayurveda', label: 'Ayurveda' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/blog', label: 'Blog' },
  { href: '/events', label: 'Events' },
  { href: '/location', label: 'Location' },
  { href: '/contact', label: 'Contact' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-gold/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Logo */}
          <Link href="/" className="flex flex-col leading-none">
            <span className="font-serif text-xl md:text-2xl text-forest tracking-wide">Veda Heritage</span>
            <span className="font-sans text-[10px] text-gold tracking-[0.2em] uppercase mt-0.5">Vavvakkavu · Kerala</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link ${pathname === l.href ? 'text-forest font-medium' : ''}`}
              >
                {l.label}
              </Link>
            ))}
            <a
              href={WA.enquiry}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-xs py-2 px-5 ml-4"
            >
              Book Now
            </a>
          </nav>

          {/* Mobile burger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <span className={`block w-6 h-0.5 bg-ink transition-transform duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-ink transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-ink transition-transform duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-cream border-t border-gold/20 px-4 pb-6">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-3 nav-link border-b border-gold/10 last:border-0"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/contact" onClick={() => setOpen(false)} className="btn-primary block text-center mt-4 text-xs">
            Book Now
          </Link>
        </div>
      )}
    </header>
  )
}
