'use client'

import { useEffect, useState } from 'react'
import { type BookingStatus, fieldClass as inp, getStatus, hashParams, inr, postForm } from '@/lib/bookingApi'

const SEATS: Record<string, number> = { auto: 3, car: 4, suv: 6 }
const localNow = () => { const d = new Date(Date.now() + 3 * 3600e3); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

export default function RideBooking() {
  const [st, setSt] = useState<BookingStatus | null | undefined>(undefined)
  const [f, setF] = useState({ pickup: '', drop: '', vehicle: '', when: localNow(), guests: '2' })
  const [q, setQ] = useState<{ km: number; fareInr: number; partners: number; note: string } | null>(null); const [qerr, setQerr] = useState('')
  const [t, setT] = useState({ name: '', phone: '', email: '', message: '', consent: false, website: '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [track, setTrack] = useState<{ ref: string; t: string } | null>(null)
  const [ride, setRide] = useState<Record<string, any> | null>(null)

  useEffect(() => { getStatus().then(s => { setSt(s); if (s?.rides) setF(p => ({ ...p, vehicle: s.rides!.vehicles[0]?.id || '' })) }); const h = hashParams(); if (h.get('ref') && h.get('t')) setTrack({ ref: h.get('ref')!, t: h.get('t')! }) }, [])
  useEffect(() => {
    if (!st?.caps.rides || !f.pickup || !f.drop || !f.vehicle || !f.when) { setQ(null); return }
    let live = true
    fetch(`/api/ride-quote.php?pickup=${f.pickup}&drop=${f.drop}&vehicle=${f.vehicle}&when=${encodeURIComponent(f.when)}`).then(r => r.json()).then(j => { if (!live) return; if (j.ok) { setQ(j); setQerr('') } else { setQ(null); setQerr(j.error || '') } }).catch(() => {})
    return () => { live = false }
  }, [st, f.pickup, f.drop, f.vehicle, f.when])
  useEffect(() => {
    if (!track) return
    let live = true, timer: number
    const poll = async () => { try { const j = await (await fetch(`/api/ride-status.php?ref=${encodeURIComponent(track.ref)}&t=${track.t}`)).json(); if (live && j.ok) setRide(j) } catch { /* retry */ } timer = window.setTimeout(poll, 8000) }
    poll(); return () => { live = false; window.clearTimeout(timer) }
  }, [track])

  if (st === undefined) return <p className="text-sm text-ink-mid">Loading…</p>
  if (!st?.caps.rides) return <div className="card"><p className="font-serif text-xl text-ink mb-1">Ride booking opens soon</p><p className="text-sm text-ink-mid">Cab and auto booking is not open yet. Ask us on WhatsApp and we will arrange a local driver.</p></div>

  if (track) return (
    <div className="card space-y-2" aria-live="polite">
      <h2 className="font-serif text-xl text-ink">Your ride {track.ref}</h2>
      {!ride ? <p className="text-sm text-ink-mid">Loading…</p> : <>
        <p className="text-sm">Status: <strong>{({ pay_pending: 'waiting for payment', paid: 'paid, finding a driver', searching: 'finding a driver', assigned: 'driver on the way', started: 'trip in progress', completed: 'completed', cancelled: 'cancelled', expired: 'expired' } as Record<string, string>)[ride.status] || ride.status}</strong> · {inr(ride.amountInr)}</p>
        {ride.driver && <div className="text-sm"><p>Driver: <strong>{ride.driver.name}</strong>, <a className="underline" href={`tel:${ride.driver.phone}`}>{ride.driver.phone}</a></p><p>Vehicle: {ride.driver.vehicleNo}</p>{ride.tripCode && <p className="text-lg mt-1">Trip code: <strong className="tracking-widest">{ride.tripCode}</strong> <span className="text-xs text-ink-mid">(tell the driver when the trip starts)</span></p>}</div>}
        {ride.status === 'pay_pending' && <a className="btn-primary text-xs" href={`/pay/#ref=${encodeURIComponent(track.ref)}&t=${track.t}`}>Pay now</a>}
      </>}
    </div>)

  const book = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('')
    const r = await postForm('ride-book.php', { ...f, name: t.name, contactPhone: t.phone, contactEmail: t.email, message: t.message, consent: t.consent, website: t.website })
    setBusy(false); if (!r.ok) { setErr(r.data.error || 'Could not book.'); return }
    if (r.data.mode === 'online') window.location.href = `/pay/#ref=${encodeURIComponent(r.data.ref)}&t=${r.data.payToken}`
    else { window.location.hash = `ref=${encodeURIComponent(r.data.ref)}&t=${r.data.payToken}`; setTrack({ ref: r.data.ref, t: r.data.payToken }) }
  }
  const pts = st.rides?.points || []
  return (
    <form onSubmit={book} className="card space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs">Pickup<select required className={inp + ' mt-1'} value={f.pickup} onChange={e => setF({ ...f, pickup: e.target.value })}><option value="">Choose…</option>{pts.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="text-xs">Drop<select required className={inp + ' mt-1'} value={f.drop} onChange={e => setF({ ...f, drop: e.target.value })}><option value="">Choose…</option>{pts.filter(p => p.id !== f.pickup).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="text-xs">Vehicle<select className={inp + ' mt-1'} value={f.vehicle} onChange={e => setF({ ...f, vehicle: e.target.value })}>{st.rides?.vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
        <label className="text-xs">Pickup time (India time)<input required type="datetime-local" min={localNow()} className={inp + ' mt-1'} value={f.when} onChange={e => setF({ ...f, when: e.target.value })} /></label>
        <label className="text-xs">Passengers<input type="number" min={1} max={SEATS[f.vehicle] || 6} className={inp + ' mt-1'} value={f.guests} onChange={e => setF({ ...f, guests: e.target.value })} /></label>
      </div>
      {q && <p className="text-sm rounded border border-primary/30 bg-primary/5 p-3"><strong>{inr(q.fareInr)}</strong> estimated · about {q.km} km · {q.partners} partner(s) can take it. <span className="text-xs text-ink-mid block">{q.note}</span></p>}
      {qerr && <p className="text-xs text-ink-mid">{qerr}</p>}
      <div className="grid sm:grid-cols-3 gap-2">
        <label className="text-xs">Your name<input required className={inp + ' mt-1'} value={t.name} onChange={e => setT({ ...t, name: e.target.value })} /></label>
        <label className="text-xs">Phone<input className={inp + ' mt-1'} value={t.phone} onChange={e => setT({ ...t, phone: e.target.value })} /></label>
        <label className="text-xs">Email<input type="email" className={inp + ' mt-1'} value={t.email} onChange={e => setT({ ...t, email: e.target.value })} /></label>
      </div>
      <label className="text-xs block">Note for the driver (optional)<textarea rows={2} className={inp + ' mt-1'} value={t.message} onChange={e => setT({ ...t, message: e.target.value })} /></label>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={t.website} onChange={e => setT({ ...t, website: e.target.value })} />
      <label className="text-xs flex gap-2 items-start"><input type="checkbox" className="mt-0.5" checked={t.consent} onChange={e => setT({ ...t, consent: e.target.checked })} />I agree that Veda Heritage shares these details with the driver to arrange this ride. Details are deleted when the trip is completed or cancelled.</label>
      <p className="text-xs text-ink-mid">{st.caps.payments ? 'You pay online next; we then find a driver.' : 'No payment now: we find a driver and you pay the driver.'} The driver starts the trip with a code we send you.</p>
      {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
      <button disabled={busy} className="btn-primary text-xs disabled:opacity-50">{busy ? 'Booking…' : st.caps.payments ? 'Continue to payment' : 'Find me a driver'}</button>
    </form>
  )
}
