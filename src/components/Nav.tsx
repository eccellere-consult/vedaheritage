'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_GROUPS, NAV_LINKS, NAV_PLAN } from '@/lib/nav'

const MENU = [...NAV_GROUPS, NAV_PLAN]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const close = () => setOpen(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-accent/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Logo */}
          <Link href="/" className="flex flex-col leading-none whitespace-nowrap shrink-0">
            <span className="font-serif text-xl md:text-2xl text-primary tracking-wide">Veda Heritage</span>
            <span className="font-sans text-[10px] text-accent tracking-[0.2em] uppercase mt-0.5">Discover Kerala</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden xl:flex items-center gap-4 whitespace-nowrap" aria-label="Main">
            {MENU.map(g => (
              <div key={g.label} className="relative group">
                <button type="button" className="nav-link whitespace-nowrap inline-flex items-center gap-1" aria-haspopup="true">
                  {g.label} <span aria-hidden className="text-[10px]">▾</span>
                </button>
                <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 top-full pt-3 w-64">
                  <div className="bg-surface border border-accent/20 rounded-sm shadow-lg py-2">
                    {g.items.map(i => (
                      <Link key={i.href} href={i.href} className={`block px-4 py-2 text-sm hover:bg-accent-pale ${pathname.startsWith(i.href) ? 'text-primary font-medium' : 'text-ink-mid'}`}>
                        {i.label}
                      </Link>
                    ))}
                    <Link href="/discover" className="block px-4 py-2 text-xs text-accent border-t border-accent/10 mt-1">All guides →</Link>
                  </div>
                </div>
              </div>
            ))}
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className={`nav-link ${pathname.startsWith(l.href) ? 'text-primary font-medium' : ''}`}>{l.label}</Link>
            ))}
            <Link href="/stay" className="text-xs text-ink-mid/70 hover:text-primary border-l border-accent/20 pl-5 ml-1 whitespace-nowrap">Stay with us</Link>
          </nav>

          {/* Mobile burger */}
          <button onClick={() => setOpen(!open)} className="xl:hidden flex flex-col gap-1.5 p-2" aria-label="Toggle menu" aria-expanded={open}>
            <span className={`block w-6 h-0.5 bg-ink transition-transform duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-ink transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-ink transition-transform duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="xl:hidden bg-surface border-t border-accent/20 px-4 pb-6 max-h-[80vh] overflow-y-auto">
          {MENU.map(g => (
            <div key={g.label} className="py-3 border-b border-accent/10">
              <p className="section-label mb-1">{g.label}</p>
              {g.items.map(i => (
                <Link key={i.href} href={i.href} onClick={close} className="block py-1.5 text-sm text-ink-mid">{i.label}</Link>
              ))}
            </div>
          ))}
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={close} className="block py-3 nav-link border-b border-accent/10">{l.label}</Link>
          ))}
          <Link href="/stay" onClick={close} className="block pt-4 text-xs text-ink-mid/70">Stay with us</Link>
        </div>
      )}
    </header>
  )
}
