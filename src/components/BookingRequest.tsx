'use client'

import { useEffect, useState } from 'react'

interface Partner { id: string; name: string; type: string; typeLabel: string; districts: string[]; summary: string }
const inp = 'w-full border border-ink/20 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/40'

/**
 * "Ask a verified partner" form. It shows ONLY when the admin has opened Partner enquiries (the server decides);
 * while bookings are locked it renders nothing, so travellers never see a feature that does not work yet.
 */
export default function BookingRequest({ summary, start, days }: { summary: string; start: string; days: number }) {
  const [partners, setPartners] = useState<Partner[] | null>(null)
  const [openForm, setOpenForm] = useState(false)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ref, setRef] = useState('')
  const [f, setF] = useState({ providerId: '', name: '', phone: '', email: '', checkIn: '', checkOut: '', people: '2', message: '', consent: false, website: '' })

  useEffect(() => {
    let live = true
    fetch('/api/booking-status.php', { cache: 'no-store' }).then(r => r.json()).then(j => { if (live && j?.open && Array.isArray(j.partners) && j.partners.length) setPartners(j.partners) }).catch(() => { /* locked or offline: show nothing */ })
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (!openForm) return
    const end = start ? new Date(Date.parse(start + 'T00:00:00Z') + Math.max(0, days - 1) * 864e5).toISOString().slice(0, 10) : ''
    setF(p => ({ ...p, checkIn: p.checkIn || start, checkOut: p.checkOut || end, message: p.message || summary }))
  }, [openForm, start, days, summary])

  if (!partners) return null
  const stays = partners.filter(p => p.type === 'stay'), rides = partners.filter(p => p.type !== 'stay')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('')
    const fd = new FormData(); fd.set('providerId', f.providerId); fd.set('name', f.name); fd.set('contactPhone', f.phone); fd.set('contactEmail', f.email)
    fd.set('checkIn', f.checkIn); fd.set('checkOut', f.checkOut); fd.set('people', f.people); fd.set('message', f.message.replace(/https?:\/\/\S+/g, '')); fd.set('website', f.website); if (f.consent) fd.set('consent', '1')
    try {
      const r = await fetch('/api/submit-booking.php', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}))
      if (r.ok && j.ok) setRef(j.ref || 'received'); else setErr(j.error || 'Could not send the request. Please try again.')
    } catch { setErr('Could not reach the server. Please try again.') }
    setBusy(false)
  }

  return (
    <div className="mt-4 border-t border-ink/10 pt-4">
      {ref ? (
        <p role="status" className="text-sm text-primary">Request sent. Your reference is <strong>{ref}</strong>. We check it and pass it to the partner, who confirms directly with you. You pay the partner on site.</p>
      ) : !openForm ? (
        <button className="btn-primary text-xs" onClick={() => setOpenForm(true)}>Ask a verified partner for a stay or a ride</button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-ink-mid">Partners are verified by us and have a signed agreement. No payment now: you pay the partner directly on site.</p>
          <label className="text-xs block">Partner<select required className={inp + ' mt-1'} value={f.providerId} onChange={e => setF({ ...f, providerId: e.target.value })}><option value="">Choose…</option>
            {stays.length > 0 && <optgroup label="Stays">{stays.map(p => <option key={p.id} value={p.id}>{p.name} · {p.districts.join(', ')}</option>)}</optgroup>}
            {rides.length > 0 && <optgroup label="Taxi, auto and transport">{rides.map(p => <option key={p.id} value={p.id}>{p.name} · {p.districts.join(', ')}</option>)}</optgroup>}</select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">From<input required type="date" className={inp + ' mt-1'} value={f.checkIn} onChange={e => setF({ ...f, checkIn: e.target.value })} /></label>
            <label className="text-xs">To<input required type="date" className={inp + ' mt-1'} value={f.checkOut} onChange={e => setF({ ...f, checkOut: e.target.value })} /></label>
            <label className="text-xs">People<input required type="number" min={1} max={30} className={inp + ' mt-1'} value={f.people} onChange={e => setF({ ...f, people: e.target.value })} /></label>
            <label className="text-xs">Your name<input required className={inp + ' mt-1'} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
            <label className="text-xs">Phone<input className={inp + ' mt-1'} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
            <label className="text-xs">Email<input type="email" className={inp + ' mt-1'} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
          </div>
          <label className="text-xs block">Message and plan<textarea rows={5} className={inp + ' mt-1'} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} /></label>
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={e => setF({ ...f, website: e.target.value })} />
          <label className="text-xs flex gap-2 items-start"><input type="checkbox" className="mt-0.5" checked={f.consent} onChange={e => setF({ ...f, consent: e.target.checked })} />I agree that Veda Heritage shares these details with the partner to arrange this request. Details are deleted when the request is completed or cancelled.</label>
          {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
          <div className="flex gap-2"><button disabled={busy} className="btn-primary text-xs disabled:opacity-50">{busy ? 'Sending…' : 'Send request'}</button><button type="button" className="text-xs underline text-ink-mid" onClick={() => setOpenForm(false)}>Close</button></div>
        </form>
      )}
    </div>
  )
}
