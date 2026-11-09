'use client'

import { useEffect, useState } from 'react'
import { fieldClass as inp, hashParams, inr, postJson } from '@/lib/bookingApi'

/** Driver page from the private dispatch link: see the ride, accept it, start with the traveller's code, complete. */
export default function DriverClient() {
  const [k, setK] = useState<{ id: string; p: string; t: string } | null>(null)
  const [ride, setRide] = useState<Record<string, any> | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [d, setD] = useState({ driverName: '', driverPhone: '', vehicleNo: '' }); const [otp, setOtp] = useState('')

  const load = async (x = k) => { if (!x) return; try { const j = await (await fetch(`/api/ride-claim.php?id=${x.id}&p=${x.p}&t=${x.t}`)).json(); if (j.ok) { setRide(j.ride); setErr('') } else setErr(j.error || 'This link is not valid.') } catch { setErr('Could not reach the server.') } }
  useEffect(() => { const h = hashParams(); const x = { id: h.get('id') || '', p: h.get('p') || '', t: h.get('t') || '' }; if (!x.id || !x.p || !x.t) { setErr('This link is incomplete.'); return } setK(x); load(x) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (ep: string, body: Record<string, unknown>) => { if (!k) return; const r = await postJson(ep, { id: k.id, p: k.p, t: k.t, ...body }); setMsg(r.ok ? 'Done.' : ''); setErr(r.ok ? '' : r.data.error || 'Something went wrong.'); await load() }

  if (err && !ride) return <p role="alert" className="card text-sm text-red-700">{err}</p>
  if (!ride) return <p className="text-sm text-ink-mid">Loading…</p>
  return (
    <div className="card space-y-3">
      <h2 className="font-serif text-xl text-ink">Ride {ride.ref}</h2>
      <p className="text-sm">{ride.pickup} → {ride.drop}<br />{ride.when} · {ride.vehicle} · {ride.guests} passenger(s) · about {ride.km} km</p>
      <p className="text-sm">Fare: <strong>{inr(ride.fareInr)}</strong> {ride.online ? '(paid online; your share is released after the trip)' : '(the traveller pays you)'}</p>
      {ride.note && <p className="text-xs text-ink-mid">Note: {ride.note}</p>}
      {err && <p role="alert" className="text-xs text-red-700">{err}</p>}{msg && <p role="status" className="text-xs text-primary">{msg}</p>}
      {ride.status === 'searching' && (
        <form className="space-y-2" onSubmit={e => { e.preventDefault(); act('ride-claim.php', d) }}>
          <p className="text-sm text-ink-mid">First driver to accept gets this ride. Who will drive?</p>
          <input required className={inp} placeholder="Driver name" value={d.driverName} onChange={e => setD({ ...d, driverName: e.target.value })} />
          <input required className={inp} placeholder="Driver phone" value={d.driverPhone} onChange={e => setD({ ...d, driverPhone: e.target.value })} />
          <input required className={inp} placeholder="Vehicle number, e.g. KL 02 AB 1234" value={d.vehicleNo} onChange={e => setD({ ...d, vehicleNo: e.target.value })} />
          <button className="btn-primary text-xs">Accept this ride</button>
        </form>)}
      {ride.status !== 'searching' && !ride.mine && <p className="text-sm text-ink-mid">This ride was taken by another driver.</p>}
      {ride.mine && ride.status === 'assigned' && (
        <form className="flex flex-wrap gap-2 items-end" onSubmit={e => { e.preventDefault(); act('ride-trip.php', { action: 'start', otp }) }}>
          <label className="text-xs">Trip code from the traveller<input required inputMode="numeric" maxLength={4} className={inp + ' mt-1 w-32'} value={otp} onChange={e => setOtp(e.target.value)} /></label>
          <button className="btn-primary text-xs">Start trip</button>
        </form>)}
      {ride.mine && ride.status === 'started' && <button className="btn-primary text-xs" onClick={() => act('ride-trip.php', { action: 'complete' })}>Complete trip</button>}
      {ride.mine && ride.status === 'completed' && <p className="text-sm text-primary">Trip completed. Thank you.</p>}
    </div>)
}
