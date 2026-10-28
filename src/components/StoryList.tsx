import type { Story } from '@/lib/content'

export default function StoryList({ stories }: { stories: Story[] }) {
  if (stories.length === 0) {
    return <p className="text-sm text-ink-mid">No visitor stories yet. Be the first to share one.</p>
  }
  return (
    <div className="space-y-6">
      {stories.map(s => (
        <article key={s.id} className="bg-white border-l-4 border-gold/40 p-6">
          <p className="text-xs tracking-widest uppercase text-gold font-medium mb-1">{s.type}</p>
          <h3 className="font-serif text-xl text-ink mb-2">{s.title}</h3>
          {s.body.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="text-sm text-ink-mid leading-relaxed mb-2">{p}</p>
          ))}
          <p className="text-xs text-ink-mid/70 mt-3">
            — {s.author}{s.origin ? `, ${s.origin}` : ''} · {new Date(s.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })}
          </p>
        </article>
      ))}
    </div>
  )
}
