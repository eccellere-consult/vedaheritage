import Link from 'next/link'
import { CATEGORIES, entryPath, type Entry } from '@/lib/content'

export default function EntryCard({ entry }: { entry: Entry }) {
  return (
    <Link href={entryPath(entry)} className="card block hover:shadow-md transition-shadow h-full">
      <p className="section-label !mb-1">{CATEGORIES[entry.category].singular} · {entry.district}</p>
      <h3 className="font-serif text-2xl text-ink mb-2">{entry.name}</h3>
      <p className="text-sm text-ink-mid leading-relaxed mb-3">{entry.tagline}</p>
      <span className="text-xs tracking-widest uppercase text-primary font-medium">Read the guide &amp; legend →</span>
    </Link>
  )
}
