import type { ReactNode } from 'react'

// One page header for the whole site: label, title, rule, optional subtitle.
// Use this instead of hand-building hero bands.
export default function PageHero({
  label, title, subtitle, sub, children,
}: { label: ReactNode; title: ReactNode; subtitle?: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section className="pt-32 pb-16 md:pb-20 text-center bg-hero-gradient">
      <p className="section-label text-accent-light">{label}</p>
      <h1 className="font-serif text-4xl md:text-5xl text-white mb-3 px-4">{title}</h1>
      {sub && <p className="text-accent-light text-lg mb-3">{sub}</p>}
      <div className="w-12 h-px bg-accent-light mx-auto mb-4" />
      {subtitle && <p className="text-white/75 max-w-2xl mx-auto text-sm leading-relaxed px-4">{subtitle}</p>}
      {children}
    </section>
  )
}
