import { OFFICIAL_LINKS, type OfficialLink } from '@/data/official-links'
import type { Source } from '@/lib/content'

export default function OfficialLinks({ extra = [], groups }: { extra?: Source[]; groups?: OfficialLink['group'][] }) {
  const base = OFFICIAL_LINKS.filter(l => !groups || groups.includes(l.group))
  return (
    <ul className="grid sm:grid-cols-2 gap-3 text-sm">
      {[...extra.map(e => ({ ...e, note: 'Official body for this place.' })), ...base].map(l => (
        <li key={l.url} className="bg-white border border-gold/30 p-3">
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium text-forest hover:underline">{l.label} ↗</a>
          <p className="text-xs text-ink-mid mt-1">{l.note}</p>
        </li>
      ))}
    </ul>
  )
}
