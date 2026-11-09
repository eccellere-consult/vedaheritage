'use client'

import { useEffect, useState } from 'react'
import { type BookingStatus, fieldClass as inp, getStatus, inr, postForm } from '@/lib/bookingApi'

type Stay = BookingStatus['stays'][number]
const today = () => new Date().toISOString().slice(0, 10)
const plus = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)

export default function StayFinder() {
  const [st, setSt] = useState<BookingStatus | null | undefined>(undefined)
  const [f, setF] = useState({ checkIn: plus(today(), 7), checkOut: plus(today(), 9), guests: '2', district: '' })
  const [avail, setAvail] = useState<Record<string, { available: boolean; amountInr?: number; reason?: string }>>({})
  const [pick, setPick] = useState<{ stay: Stay; roomId: string } | null>(null)
  const [t, setT] = useState({ name: '', phone: '', email: '', message: '', consent: false, website: '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState<{ ref: string } | null>(null)

  useEffect(() => { getStatus().then(s => setSt(s)) }, [])
  useEffect(() => {
    if (!st?.caps.stays || f.checkOut <= f.checkIn) return
    let live = true; setAvail({})
    for (const s of st.stays) for (const r of s.rooms) {
      fetch(`/api/stay-avail.php?providerId=${s.id}&roomId=${r.id}&checkIn=${f.checkIn}&checkOut=${f.checkOut}&guests=${f.guests}`).then(x => x.json()).then(j => { if (live && j.ok) setAvail(a => ({ ...a, [s.id + r.id]: { available: j.available, amountInr: j.amountInr, reason: j.reason } })) }).catch(() => {})
    }
    return () => { live = false }
  }, [st, f.checkIn, f.checkOut, f.guests])

  if (st === undefined) return <p className="text-sm text-ink-mid">Loading…</p>
  if (!st?.caps.stays) return <div className="card"><p className="font-serif text-xl text-ink mb-1">Stay booking opens soon</p><p className="text-sm text-ink-mid">Online stay booking is not open yet. Plan your trip with the <a className="underline" href="/itinerary/">itinerary planner</a> or ask us about stays on WhatsApp.</p></div>

  const districts = [...new Set(st.stays.flatMap(s => s.districts))].sort()
  const list = st.stays.filter(s => !f.district || s.districts.includes(f.district))
  const book = async (e: React.FormEvent) => {
    e.preventDefault(); if (!pick) return; setBusy(true); setErr('')
    const r = await postForm('stay-book.php', { providerId: pick.stay.id, roomId: pick.roomId, checkIn: f.checkIn, checkOut: f.checkOut, guests: f.guests, name: t.name, contactPhone: t.phone, contactEmail: t.email, message: t.message, consent: t.consent, website: t.website })
    setBusy(false)
    if (!r.ok) { setErr(r.data.error || 'Could not book.'); return }
    if (r.data.mode === 'online' && r.data.payToken) { window.location.href = `/pay/#ref=${encodeURIComponent(r.data.ref)}&t=${r.data.payToken}`; return }
    setDone({ ref: r.data.ref })
  }

  if (done) return <p role="status" className="card text-sm text-primary">Request sent. Your reference is <strong>{done.ref}</strong>. We check it and pass it to the stay, which confirms directly with you. You pay the stay on arrival.</p>
  return (
    <div className="space-y-6">
      <div className="card !p-4 grid sm:grid-cols-4 gap-3 text-xs">
        <label>Check in<input type="date" min={today()} className={inp + ' mt-1'} value={f.checkIn} onChange={e => setF({ ...f, checkIn: e.target.value, checkOut: e.target.value >= f.checkOut ? plus(e.target.value, 1) : f.checkOut })} /></label>
        <label>Check out<input type="date" min={plus(f.checkIn, 1)} className={inp + ' mt-1'} value={f.checkOut} onChange={e => setF({ ...f, checkOut: e.target.value })} /></label>
        <label>Guests<input type="number" min={1} max={30} className={inp + ' mt-1'} value={f.guests} onChange={e => setF({ ...f, guests: e.target.value })} /></label>
        <label>District<select className={inp + ' mt-1'} value={f.district} onChange={e => setF({ ...f, district: e.target.value })}><option value="">All</option>{districts.map(d => <option key={d}>{d}</option>)}</select></label>
      </div>
      {!list.length && <p className="text-sm text-ink-mid">No stays match yet.</p>}
      {list.map(s => (
        <div key={s.id} className="card">
          <h2 className="font-serif text-xl text-ink">{s.name}</h2><p className="text-xs text-ink-mid mb-2">{s.districts.join(', ')} · verified partner</p><p className="text-sm text-ink-mid mb-3">{s.summary}</p>
          <ul className="space-y-2">{s.rooms.map(r => { const a = avail[s.id + r.id]; return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-2 text-sm">
              <div><p className="font-medium text-ink">{r.name}</p><p className="text-xs text-ink-mid">Sleeps {r.capacity} · {inr(r.rateInr)} per night</p></div>
              <div className="text-right">{!a ? <span className="text-xs text-ink-mid">Checking…</span> : a.available ? <><p className="text-sm font-medium text-primary">{inr(a.amountInr || 0)} total</p><button className="btn-primary text-xs mt-1" onClick={() => { setPick({ stay: s, roomId: r.id }); setErr('') }}>Book this room</button></> : <span className="text-xs text-ink-mid">{a.reason}</span>}</div>
            </li>) })}</ul>
        </div>))}
      {pick && (
        <form onSubmit={book} className="card space-y-3">
          <h3 className="font-serif text-lg text-ink">Book {pick.stay.rooms.find(r => r.id === pick.roomId)?.name} at {pick.stay.name}</h3>
          <p className="text-xs text-ink-mid">{f.checkIn} to {f.checkOut}, {f.guests} guest(s). The price is confirmed by our system when you book. {st.caps.payments ? 'You pay online next; the room is held for 30 minutes.' : 'No payment now: you pay the stay on arrival.'}</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="text-xs">Your name<input required className={inp + ' mt-1'} value={t.name} onChange={e => setT({ ...t, name: e.target.value })} /></label>
            <label className="text-xs">Phone<input className={inp + ' mt-1'} value={t.phone} onChange={e => setT({ ...t, phone: e.target.value })} /></label>
            <label className="text-xs">Email<input type="email" className={inp + ' mt-1'} value={t.email} onChange={e => setT({ ...t, email: e.target.value })} /></label>
          </div>
          <label className="text-xs block">Message (optional)<textarea rows={3} className={inp + ' mt-1'} value={t.message} onChange={e => setT({ ...t, message: e.target.value })} /></label>
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={t.website} onChange={e => setT({ ...t, website: e.target.value })} />
          <label className="text-xs flex gap-2 items-start"><input type="checkbox" className="mt-0.5" checked={t.consent} onChange={e => setT({ ...t, consent: e.target.checked })} />I agree that Veda Heritage shares these details with the stay to arrange this booking. Details are deleted when the booking is completed or cancelled.</label>
          {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
          <div className="flex gap-2"><button disabled={busy} className="btn-primary text-xs disabled:opacity-50">{busy ? 'Booking…' : st.caps.payments ? 'Continue to payment' : 'Send request'}</button><button type="button" className="text-xs underline text-ink-mid" onClick={() => setPick(null)}>Cancel</button></div>
        </form>)}
    </div>
  )
}
