export default function Timeline({ items }: { items: { period: string; event: string }[] }) {
  return (
    <ol className="border-l-2 border-gold/40 ml-2 space-y-5">
      {items.map(t => (
        <li key={t.period + t.event} className="pl-5 relative">
          <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-gold" aria-hidden="true" />
          <p className="text-xs tracking-widest uppercase text-gold font-medium">{t.period}</p>
          <p className="text-sm text-ink-mid leading-relaxed">{t.event}</p>
        </li>
      ))}
    </ol>
  )
}
