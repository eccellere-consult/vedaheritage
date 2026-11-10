'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SITE } from '@/lib/config'
import BookingRequest from '@/components/BookingRequest'
import { acct, acctStore } from '@/lib/accountApi'

export interface PickPlace { id: string; name: string; district: string; kind: string; tagline: string; href: string }
export interface PickEvent { id: string; name: string; district: string; place: string; start: string; end: string; when: string; expected: boolean }

// A stop is self-contained, so a shared link still opens even after the site content changes.
interface Stop { k: 'p' | 'e' | 'n'; id: string; label: string; sub: string; href?: string; start?: string; end?: string }
interface Plan { start: string; days: Stop[][] }

const KEY = 'vh-itinerary-v1'
const EMPTY: Plan = { start: '', days: [[]] }
const inp = 'w-full border border-ink/20 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/40'

const enc = (p: Plan) => { try { return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(p))))) } catch { return '' } }
const dec = (s: string): Plan | null => {
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(s)))))
    if (!p || !Array.isArray(p.days)) return null
    return { start: typeof p.start === 'string' ? p.start : '', days: p.days.slice(0, 30).map((d: unknown) => (Array.isArray(d) ? d.slice(0, 20) : [])) as Stop[][] }
  } catch { return null }
}
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
const fmt = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function ItineraryBuilder({ places, events }: { places: PickPlace[]; events: PickEvent[] }) {
  const [plan, setPlan] = useState<Plan>(EMPTY)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<'places' | 'events'>('places')
  const [q, setQ] = useState(''); const [district, setDistrict] = useState('')
  const [day, setDay] = useState(0); const [note, setNote] = useState(''); const [msg, setMsg] = useState('')

  useEffect(() => {
    let p: Plan | null = null
    try { const m = window.location.hash.match(/plan=([^&]+)/); if (m) p = dec(m[1]) } catch { /* ignore */ }
    if (!p) { try { const s = localStorage.getItem(KEY); if (s) p = JSON.parse(s) } catch { /* ignore */ } }
    if (p && Array.isArray(p.days) && p.days.length) setPlan(p)
    setReady(true)
  }, [])
  useEffect(() => { if (ready) { try { localStorage.setItem(KEY, JSON.stringify(plan)) } catch { /* private mode: fine */ } } }, [plan, ready])
  useEffect(() => { if (day >= plan.days.length) setDay(Math.max(0, plan.days.length - 1)) }, [plan.days.length, day])

  const districts = useMemo(() => [...new Set([...places.map(p => p.district), ...events.map(e => e.district)])].filter(Boolean).sort(), [places, events])
  const ql = q.trim().toLowerCase()
  const shownPlaces = places.filter(p => (!district || p.district === district) && (!ql || `${p.name} ${p.district} ${p.kind}`.toLowerCase().includes(ql))).slice(0, 60)
  const shownEvents = events.filter(e => (!district || e.district === district) && (!ql || `${e.name} ${e.place} ${e.district}`.toLowerCase().includes(ql))).slice(0, 60)
  const used = new Set(plan.days.flat().map(s => s.k + s.id))

  const update = (fn: (d: Stop[][]) => Stop[][]) => setPlan(p => ({ ...p, days: fn(p.days.map(d => [...d])) }))
  const addStop = (s: Stop, to = day) => update(d => { d[to] = [...(d[to] || []), s]; return d })
  const addPlace = (p: PickPlace) => addStop({ k: 'p', id: p.id, label: p.name, sub: `${p.kind} · ${p.district}`, href: p.href })
  const addEvent = (e: PickEvent) => {
    // When a trip date is set and the event falls inside the trip, drop it on the matching day.
    let to = day
    if (plan.start) { for (let i = 0; i < plan.days.length; i++) { const d = addDays(plan.start, i); if (d >= e.start && d <= e.end) { to = i; break } } }
    addStop({ k: 'e', id: e.id, label: e.name, sub: `${e.when} · ${e.place}, ${e.district}${e.expected ? ' (usual dates; confirm)' : ''}`, start: e.start, end: e.end }, to)
  }
  const move = (di: number, si: number, dir: -1 | 1) => update(d => { const j = si + dir; if (j < 0 || j >= d[di].length) return d; [d[di][si], d[di][j]] = [d[di][j], d[di][si]]; return d })
  const remove = (di: number, si: number) => update(d => { d[di].splice(si, 1); return d })
  const shift = (di: number, si: number, to: number) => update(d => { if (to < 0 || to >= d.length) return d; const [s] = d[di].splice(si, 1); d[to].push(s); return d })

  const total = plan.days.flat().length
  const planDistricts = [...new Set(plan.days.flat().map(s => s.sub.split(' · ').pop()?.split(',').pop()?.trim() || '').filter(Boolean))]
  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(''), 3500) }
  const saveToAccount = async () => {
    if (!acctStore.get()) { flash('Sign in to save this plan to your account.'); window.setTimeout(() => { window.location.href = '/account/' }, 1200); return }
    const r = await acct('itinerary_save', { name: `Trip ${plan.start || new Date().toISOString().slice(0, 10)}`, plan })
    flash(r.ok ? 'Saved to your account.' : r.status === 401 ? 'Please sign in again to save.' : r.data.error || 'Could not save.')
  }
  const share = async () => {
    const url = `${window.location.origin}/itinerary/#plan=${enc(plan)}`
    try { await navigator.clipboard.writeText(url); flash('Link copied. Anyone with it sees this plan.') } catch { window.prompt('Copy this link', url) }
  }
  const summary = () => [
    `Kerala trip plan${plan.start ? ` from ${fmt(plan.start)}` : ''}`,
    ...plan.days.map((d, i) => `Day ${i + 1}${plan.start ? ` (${fmt(addDays(plan.start, i))})` : ''}: ${d.map(s => s.label).join(', ') || 'free day'}`),
  ].join('\n')
  const waHref = `https://wa.me/${SITE.phone}?text=${encodeURIComponent(`Hello Veda Heritage, please help me arrange stay and transport for this plan.\n\n${summary()}`)}`

  if (!ready) return <p className="text-sm text-ink-mid">Loading your plan…</p>
  return (
    <div className="grid lg:grid-cols-5 gap-8">
      {/* PICKER */}
      <div className="lg:col-span-2 print:hidden">
        <div className="card !p-4">
          <div className="flex gap-2 mb-3" role="tablist" aria-label="What to add">
            {(['places', 'events'] as const).map(t => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`${tab === t ? 'btn-primary' : 'btn-outline'} text-xs`}>{t === 'places' ? `Places (${places.length})` : `Festivals & events (${events.length})`}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input className={inp} placeholder="Search" aria-label="Search" value={q} onChange={e => setQ(e.target.value)} />
            <select className={inp} aria-label="District" value={district} onChange={e => setDistrict(e.target.value)}>
              <option value="">All districts</option>{districts.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <label className="text-xs text-ink-mid flex items-center gap-2 mb-3">Add to
            <select className={inp + ' !w-auto'} value={day} onChange={e => setDay(Number(e.target.value))}>{plan.days.map((_, i) => <option key={i} value={i}>Day {i + 1}</option>)}</select>
          </label>
          <ul className="space-y-2 max-h-[34rem] overflow-y-auto pr-1">
            {tab === 'places' && shownPlaces.map(p => (
              <li key={p.id} className="flex items-start justify-between gap-3 border-b border-ink/10 pb-2">
                <div className="min-w-0"><p className="text-sm font-medium text-ink">{p.name}</p><p className="text-xs text-ink-mid">{p.kind} · {p.district}</p></div>
                <button className="btn-outline text-xs shrink-0 disabled:opacity-40" disabled={used.has('p' + p.id)} onClick={() => addPlace(p)}>{used.has('p' + p.id) ? 'Added' : 'Add'}</button>
              </li>))}
            {tab === 'events' && shownEvents.map(e => (
              <li key={e.id} className="flex items-start justify-between gap-3 border-b border-ink/10 pb-2">
                <div className="min-w-0"><p className="text-sm font-medium text-ink">{e.name}</p><p className="text-xs text-ink-mid">{e.when} · {e.district}{e.expected ? ' · usual dates' : ''}</p></div>
                <button className="btn-outline text-xs shrink-0 disabled:opacity-40" disabled={used.has('e' + e.id)} onClick={() => addEvent(e)}>{used.has('e' + e.id) ? 'Added' : 'Add'}</button>
              </li>))}
            {((tab === 'places' && !shownPlaces.length) || (tab === 'events' && !shownEvents.length)) && <li className="text-sm text-ink-mid">Nothing matches. Clear the search or the district.</li>}
          </ul>
        </div>
      </div>

      {/* PLAN */}
      <div className="lg:col-span-3">
        <div className="flex flex-wrap items-end gap-3 mb-4 print:hidden">
          <label className="text-xs text-ink-mid">Trip starts<input type="date" className={inp + ' mt-1 !w-auto block'} value={plan.start} onChange={e => setPlan(p => ({ ...p, start: e.target.value }))} /></label>
          <button className="btn-outline text-xs" onClick={() => setPlan(p => ({ ...p, days: [...p.days, []] }))}>Add a day</button>
          <button className="btn-outline text-xs" onClick={share}>Copy share link</button>
          <button className="btn-outline text-xs" onClick={saveToAccount}>Save to my account</button>
          <button className="btn-outline text-xs" onClick={() => window.print()}>Print or save as PDF</button>
          <button className="text-xs underline text-ink-mid" onClick={() => { if (window.confirm('Clear the whole plan?')) setPlan(EMPTY) }}>Clear</button>
        </div>
        <p role="status" className="text-sm text-primary min-h-[1.25rem] print:hidden">{msg}</p>
        <h2 className="font-serif text-2xl text-ink mb-3 hidden print:block">Kerala trip plan{plan.start ? ` from ${fmt(plan.start)}` : ''}</h2>

        <div className="space-y-4">
          {plan.days.map((stops, di) => (
            <div key={di} className="card !p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif text-lg text-ink">Day {di + 1}{plan.start && <span className="text-sm text-ink-mid font-sans"> · {fmt(addDays(plan.start, di))}</span>}</h3>
                {plan.days.length > 1 && <button className="text-xs underline text-ink-mid print:hidden" onClick={() => update(d => { d.splice(di, 1); return d })}>Remove day</button>}
              </div>
              {!stops.length && <p className="text-sm text-ink-mid">Free day. Add places or festivals from the left.</p>}
              <ol className="space-y-2">
                {stops.map((s, si) => {
                  const dayIso = plan.start ? addDays(plan.start, di) : ''
                  const clash = s.k === 'e' && dayIso && s.start && (dayIso < s.start || dayIso > (s.end || s.start))
                  return (
                    <li key={s.k + s.id + si} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        {s.href ? <Link href={s.href} className="font-medium text-primary underline">{s.label}</Link> : <span className="font-medium text-ink">{s.label}</span>}
                        <p className="text-xs text-ink-mid">{s.sub}</p>
                        {clash && <p className="text-xs text-accent">This event is on other dates. Move it to the matching day.</p>}
                      </div>
                      <div className="flex gap-1 shrink-0 print:hidden" aria-label={`Actions for ${s.label}`}>
                        <button className="btn-outline !px-2 text-xs" aria-label="Move up" onClick={() => move(di, si, -1)}>↑</button>
                        <button className="btn-outline !px-2 text-xs" aria-label="Move down" onClick={() => move(di, si, 1)}>↓</button>
                        {plan.days.length > 1 && <select className="border border-ink/20 rounded text-xs px-1" aria-label="Move to day" value="" onChange={e => e.target.value !== '' && shift(di, si, Number(e.target.value))}><option value="">Day…</option>{plan.days.map((_, j) => j !== di && <option key={j} value={j}>Day {j + 1}</option>)}</select>}
                        <button className="btn-outline !px-2 text-xs" aria-label="Remove" onClick={() => remove(di, si)}>✕</button>
                      </div>
                    </li>)
                })}
              </ol>
              <form className="mt-3 flex gap-2 print:hidden" onSubmit={e => { e.preventDefault(); const t = note.trim(); if (t) { addStop({ k: 'n', id: String(Date.now()), label: t.slice(0, 120), sub: 'Note' }, di); setNote('') } }}>
                <input className={inp} placeholder="Add a note, e.g. lunch at Alappuzha" aria-label={`Note for day ${di + 1}`} value={di === day ? note : ''} onFocus={() => setDay(di)} onChange={e => { setDay(di); setNote(e.target.value) }} />
                <button className="btn-outline text-xs shrink-0">Add note</button>
              </form>
            </div>
          ))}
        </div>

        {/* STAY AND TRANSPORT */}
        <div className="mt-8 grid sm:grid-cols-2 gap-4 print:hidden">
          <div className="card !p-4">
            <h3 className="font-serif text-lg text-ink mb-1">Stay and local transport</h3>
            <p className="text-sm text-ink-mid mb-3">Send your plan to us on WhatsApp. We reply with stay options and a local driver or auto you can pay directly on arrival.</p>
            <a className="btn-primary text-xs" href={waHref} target="_blank" rel="noopener noreferrer">{total ? 'Send my plan on WhatsApp' : 'Ask on WhatsApp'}</a>
            {planDistricts.length > 0 && <p className="text-xs text-ink-mid mt-3">Your plan covers: {planDistricts.join(', ')}.</p>}
            <BookingRequest summary={summary()} start={plan.start} days={plan.days.length} />
          </div>
          <div className="card !p-4">
            <h3 className="font-serif text-lg text-ink mb-1">Book tickets on the official sites</h3>
            <ul className="text-sm space-y-1 text-ink-mid">
              <li><a className="underline text-primary" href="https://www.irctc.co.in/" target="_blank" rel="noopener noreferrer">Trains: IRCTC</a> · <a className="underline" href="https://enquiry.indianrail.gov.in/ntes/" target="_blank" rel="noopener noreferrer">live status</a></li>
              <li><a className="underline text-primary" href="https://onlineksrtcswift.com/" target="_blank" rel="noopener noreferrer">Buses: KSRTC Swift</a></li>
              <li><a className="underline text-primary" href="https://www.redbus.in/" target="_blank" rel="noopener noreferrer">Private buses: redBus</a></li>
              <li><a className="underline text-primary" href="https://swtd.kerala.gov.in/" target="_blank" rel="noopener noreferrer">Ferries: State Water Transport</a></li>
              <li><a className="underline text-primary" href="https://www.ktdc.com/" target="_blank" rel="noopener noreferrer">KTDC stays and packages</a></li>
            </ul>
            <p className="text-xs text-ink-mid/70 mt-2">Veda Heritage is not affiliated with these services. Confirm fares and timings on their sites.</p>
          </div>
        </div>
        <p className="text-xs text-ink-mid/70 mt-4 print:hidden">Your plan is saved in this browser only. Use Copy share link to keep or send it. Festival dates marked "usual dates" are not yet announced; confirm before you travel.</p>
      </div>
    </div>
  )
}
