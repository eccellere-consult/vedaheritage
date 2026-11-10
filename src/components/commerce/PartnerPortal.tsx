'use client'

import { useCallback, useEffect, useState } from 'react'
import { TEST_BANNER, fieldClass as inp, hashParams, inr } from '@/lib/bookingApi'

type Json = Record<string, any>
const KEY = 'vh-partner-session', DRV = 'vh-partner-driver'
const store = { get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }, del: (k: string) => { try { localStorage.removeItem(k) } catch { /* ignore */ } } }

async function call(a: string, session: string | null, body?: unknown) {
  try {
    const r = await fetch(`/api/partner.php?a=${a}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { 'X-Partner-Token': session } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Json }
  } catch { return { ok: false, status: 0, data: { error: 'Could not reach the server.' } as Json } }
}

/** Partner page: email sign-in link (no password), then rides, bookings, rooms and vehicles, payouts. */
export default function PartnerPortal() {
  const [session, setSession] = useState<string | null>(null); const [phase, setPhase] = useState<'start' | 'out' | 'in'>('start')
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [me, setMe] = useState<Json | null>(null); const [ov, setOv] = useState<Json | null>(null); const [tab, setTab] = useState<'rides' | 'bookings' | 'inventory' | 'payouts' | 'verify' | 'formc'>('rides')

  const refresh = useCallback(async (s: string) => {
    const [a, b] = await Promise.all([call('me', s), call('overview', s)])
    if (a.status === 401 || b.status === 401) { store.del(KEY); setSession(null); setPhase('out'); setErr('Please sign in again.'); return }
    if (!a.ok) { setErr(a.data.error || ''); setPhase('out'); return }
    setMe(a.data); setOv(b.data); setPhase('in')
  }, [])
  useEffect(() => {
    const start = () => {
      const t = hashParams().get('t')
      if (t) { history.replaceState(null, '', '/partner/'); call('session', null, { token: t }).then(r => { if (r.ok) { store.set(KEY, r.data.session); setSession(r.data.session); setErr(''); refresh(r.data.session) } else { setErr(r.data.error || 'This link did not work.'); setPhase('out') } }); return }
      const s = store.get(KEY); if (s) { setSession(s); refresh(s) } else setPhase('out')
    }
    start(); const h = () => { if (hashParams().get('t')) start() }
    window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h)
  }, [refresh])
  useEffect(() => { if (phase !== 'in' || !session) return; const id = window.setInterval(() => refresh(session), 15000); return () => window.clearInterval(id) }, [phase, session, refresh])

  const act = async (a: string, body: Json) => { const r = await call(a, session, body); setMsg(r.ok ? (r.data.message || 'Done.') : ''); setErr(r.ok ? '' : r.data.error || 'Something went wrong.'); if (session) await refresh(session); return r }
  const signOut = async () => { await call('logout', session, {}); store.del(KEY); setSession(null); setMe(null); setPhase('out'); setSent(false) }

  if (phase === 'start') return <p className="text-sm text-ink-mid">Loading…</p>
  if (phase === 'out') return (
    <form className="card space-y-3" onSubmit={async e => { e.preventDefault(); const r = await call('login', null, { email }); if (r.ok) { setSent(true); setErr('') } else setErr(r.data.error || 'Please try again.') }}>
      <h2 className="font-serif text-xl text-ink">Partner sign-in</h2>
      <p className="text-sm text-ink-mid">For verified stays and drivers. Enter the email you registered with and we send you a sign-in link. No password.</p>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {sent ? <p role="status" className="text-sm text-primary">If that email belongs to a partner, a sign-in link is on its way. It works once and expires in 20 minutes.</p> : <>
        <input required type="email" className={inp} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /><button className="btn-primary text-xs">Email me a sign-in link</button></>}
    </form>)

  const open: Json[] = ov?.openRides || [], rides: Json[] = ov?.rides || [], stays: Json[] = ov?.bookings || []
  const isCab = me?.partner.type === 'transport'
  const tabs: [typeof tab, string][] = [...(isCab ? [['rides', `Rides${open.length ? ` (${open.length} open)` : ''}`] as [typeof tab, string]] : []), ['bookings', 'Bookings'], ['inventory', isCab ? 'Vehicles' : 'Rooms and dates'], ['payouts', 'Payouts'], ['verify', 'Verification'], ...(!isCab ? [['formc', 'Guest registration (Form C)'] as [typeof tab, string]] : [])]
  const cur = tabs.some(([k]) => k === tab) ? tab : tabs[0][0]
  return (
    <div className="space-y-4">
      {me?.testMode && <p role="status" className="rounded border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs">{TEST_BANNER}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-serif text-xl text-ink">{me?.partner.name}</p><p className="text-xs text-ink-mid">{me?.partner.typeLabel} · {me?.partner.districts.join(', ')}</p></div><button className="text-xs underline text-ink-mid" onClick={signOut}>Sign out</button></div>
      <div className="flex flex-wrap gap-2" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={cur === k} onClick={() => setTab(k)} className={`${cur === k ? 'btn-primary' : 'btn-outline'} text-xs`}>{l}</button>)}</div>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}{msg && <p role="status" className="text-sm text-primary">{msg}</p>}
      {cur === 'rides' && <Rides open={open} rides={rides} act={act} />}
      {cur === 'bookings' && <Bookings stays={stays} act={act} />}
      {cur === 'inventory' && <Inventory me={me!} act={act} />}
      {cur === 'payouts' && <Payouts rides={rides} stays={stays} />}
      {cur === 'verify' && <Verification session={session} />}
      {cur === 'formc' && <FormC session={session} />}
    </div>)
}

function b64(f: File) { return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('read')); r.readAsDataURL(f) }) }
function showFile(mime: string, data: string) { const bin = atob(data); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); window.open(URL.createObjectURL(new Blob([u], { type: mime })), '_blank') }

/** Documents and location: uploaded here, reviewed by Veda Heritage, with expiry dates tracked. */
function Verification({ session }: { session: string | null }) {
  const [v, setV] = useState<Json | null>(null); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [geo, setGeo] = useState({ lat: '', lng: '' })
  const load = useCallback(async () => { const r = await call('verification', session); if (r.ok) { setV(r.data); if (r.data.geo && !geo.lat) setGeo({ lat: String(r.data.geo.lat), lng: String(r.data.geo.lng) }) } else setErr(r.data.error || '') }, [session]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  const say = (r: { ok: boolean; data: Json }) => { setMsg(r.ok ? r.data.message || 'Done.' : ''); setErr(r.ok ? '' : r.data.error || 'Something went wrong.'); load() }
  if (!v) return <p className="text-sm text-ink-mid">Loading…</p>
  if (!v.kycOpen) return <p className="card text-sm text-ink-mid">Identity verification is not open yet. We will tell you when to upload your documents.</p>
  const tone = (s: string) => s === 'approved' ? 'text-primary' : s === 'rejected' ? 'text-red-700' : 'text-amber-800'
  const items: Json[] = [...v.required, ...(v.optional || []).map((t: string) => ({ docType: t, label: v.docLabels[t], optional: true }))]
  return (
    <div className="space-y-4">
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}{msg && <p role="status" className="text-sm text-primary">{msg}</p>}
      <div className="card"><p className="text-sm">{v.state.ok ? <strong className="text-primary">You are verified. You can take bookings.</strong> : <><strong>Not verified yet.</strong> Still needed: {v.state.missing.map((m: string) => v.docLabels[m] || (m === 'location' ? 'approved location' : m)).join('; ')}.</>}</p>
        <p className="text-xs text-ink-mid mt-1">Upload clear photos or PDFs (up to 5 MB). They are stored encrypted and only our verification team opens them, with a logged reason. We set the expiry date when we approve; when a document expires you are taken off bookings until you upload a new one.</p></div>
      <div className="card space-y-3"><h3 className="font-serif text-lg">Documents</h3>
        {items.map(it => { const d: Json | undefined = (v.docs as Json[]).find(x => x.docType === it.docType); return (
          <div key={it.docType} className="border-t border-ink/10 pt-2 first:border-0 first:pt-0 text-sm"><p className="font-medium">{it.label}{it.optional ? ' (optional)' : ''}</p>
            {d ? <p className={`text-xs ${tone(d.status)}`}>{d.status}{d.expires ? `, valid until ${d.expires}` : ''}{d.note ? `. ${d.note}` : ''} <button className="underline text-ink-mid ml-2" onClick={async () => { if (window.confirm('Delete this document?')) say(await call('vdoc_delete', session, { docId: d.docId })) }}>Delete</button></p> : <p className="text-xs text-ink-mid">Not uploaded</p>}
            <input type="file" accept="image/jpeg,image/png,application/pdf" className={inp + ' mt-1 text-xs'} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { setErr('The file must be under 5 MB.'); return } say(await call('vdoc_upload', session, { docType: it.docType, data: await b64(f) })); e.target.value = '' }} /></div>) })}</div>
      <div className="card space-y-2"><h3 className="font-serif text-lg">Location</h3>
        <p className="text-xs text-ink-mid">{v.geo ? `Saved: ${v.geo.lat}, ${v.geo.lng} (${v.geo.status}${v.geo.note ? `: ${v.geo.note}` : ''})` : 'Stand at your property or stand and tap Use my location. We check it against your address.'}</p>
        <div className="flex flex-wrap gap-2 items-end text-xs"><label>Latitude<input className={inp + ' mt-1 !w-32'} value={geo.lat} onChange={e => setGeo({ ...geo, lat: e.target.value })} /></label><label>Longitude<input className={inp + ' mt-1 !w-32'} value={geo.lng} onChange={e => setGeo({ ...geo, lng: e.target.value })} /></label>
          <button className="btn-outline text-xs" onClick={() => { if (!navigator.geolocation) { setErr('This device cannot share its location. Type the coordinates instead.'); return } navigator.geolocation.getCurrentPosition(async pos => { say(await call('geo_save', session, { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'device' })) }, () => setErr('We could not get your location. Allow location access or type the coordinates.')) }}>Use my location</button>
          <button className="btn-primary text-xs" onClick={async () => say(await call('geo_save', session, { lat: Number(geo.lat), lng: Number(geo.lng), source: 'typed' }))}>Save location</button></div></div>
    </div>)
}

/** Guest registration help for stays: foreign guests' details for Form C. The host files Form C; every view here is logged. */
function FormC({ session }: { session: string | null }) {
  const [list, setList] = useState<Json | null>(null); const [open, setOpen] = useState<Json | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [ack, setAck] = useState('')
  const load = useCallback(async () => { const r = await call('formc_list', session); if (r.ok) setList(r.data); else setErr(r.data.error || '') }, [session])
  useEffect(() => { load() }, [load])
  if (err && !list) return <p className="card text-sm text-ink-mid">{err}</p>
  if (!list) return <p className="text-sm text-ink-mid">Loading…</p>
  const labels: Record<string, string> = { fullName: 'Full name', dob: 'Date of birth', nationality: 'Nationality', passportNo: 'Passport number', passportIssuePlace: 'Passport place of issue', passportIssueDate: 'Passport date of issue', passportExpiry: 'Passport expiry', visaNo: 'Visa number', visaType: 'Visa type', visaIssueDate: 'Visa date of issue', visaExpiry: 'Visa expiry', arrivalDate: 'Date of arrival in India', arrivedFrom: 'Arrived from', purpose: 'Purpose of visit', nextDestination: 'Next destination', addressAbroad: 'Address abroad' }
  return (
    <div className="space-y-4"><div className="card"><p className="text-xs text-ink-mid">{list.note} Every time you open a guest's details it is recorded. Use the details only for the guest registration.</p></div>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}{msg && <p role="status" className="text-sm text-primary">{msg}</p>}
      {!list.guests.length && <p className="card text-sm text-ink-mid">No confirmed guest stays yet.</p>}
      <ul className="space-y-3">{(list.guests as Json[]).map(g => (
        <li key={g.id} className="card text-sm"><p><strong>{g.ref}</strong> · {g.guest} · {g.checkIn} to {g.checkOut} {g.filed && <span className="text-xs text-primary">· filed ({g.filed.ack})</span>}</p>
          {g.available ? <button className="btn-primary text-xs mt-2" onClick={async () => { const r = await call('formc_view', session, { id: g.id }); if (r.ok) { setOpen({ ...r.data, id: g.id, ref: g.ref }); setErr('') } else setErr(r.data.error || '') }}>Open guest details</button> : <p className="text-xs text-ink-mid mt-1">{g.reason || 'Not available.'}</p>}
          {open && open.id === g.id && <div className="mt-3 border-t border-ink/10 pt-3"><dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">{Object.entries(open.identity as Record<string, string>).map(([k, v]) => <div key={k}><dt className="text-ink-mid">{labels[k] || k}</dt><dd className="font-medium">{v}</dd></div>)}<div><dt className="text-ink-mid">Guest phone</dt><dd className="font-medium">{open.phone}</dd></div></dl>
            {open.docs.length > 0 && <p className="text-xs mt-2">Documents: {(open.docs as Json[]).map(d => <button key={d.id} className="underline mr-3" onClick={async () => { const r = await call('formc_doc', session, { id: g.id, docId: d.id }); if (r.ok) showFile(r.data.mime, r.data.data); else setErr(r.data.error || '') }}>{d.label}</button>)}</p>}
            <div className="flex flex-wrap gap-2 items-end mt-3 text-xs"><label>FRRO acknowledgement number<input className={inp + ' mt-1 !w-56'} value={ack} onChange={e => setAck(e.target.value)} /></label><button className="btn-outline text-xs" onClick={async () => { const r = await call('formc_filed', session, { id: g.id, ack }); setMsg(r.ok ? r.data.message : ''); setErr(r.ok ? '' : r.data.error || ''); if (r.ok) { setAck(''); load() } }}>Mark as filed</button><button className="text-xs underline" onClick={() => setOpen(null)}>Close</button></div></div>}
        </li>))}</ul></div>)
}

function Rides({ open, rides, act }: { open: Json[]; rides: Json[]; act: (a: string, b: Json) => Promise<unknown> }) {
  const [d, setD] = useState(() => { try { return JSON.parse(store.get(DRV) || '') } catch { return { driverName: '', driverPhone: '', vehicleNo: '' } } }); const [otp, setOtp] = useState<Record<string, string>>({})
  const active = rides.filter(r => ['assigned', 'started'].includes(r.status)), done = rides.filter(r => r.status === 'completed')
  return (
    <div className="space-y-4">
      <div className="card"><h3 className="font-serif text-lg mb-2">Open ride requests</h3>
        {!open.length && <p className="text-sm text-ink-mid">No open rides right now. This page checks every 15 seconds.</p>}
        {open.length > 0 && <div className="grid sm:grid-cols-3 gap-2 mb-3 text-xs">
          <input className={inp} placeholder="Driver name" value={d.driverName} onChange={e => setD({ ...d, driverName: e.target.value })} />
          <input className={inp} placeholder="Driver phone" value={d.driverPhone} onChange={e => setD({ ...d, driverPhone: e.target.value })} />
          <input className={inp} placeholder="Vehicle no. KL 02 AB 1234" value={d.vehicleNo} onChange={e => setD({ ...d, vehicleNo: e.target.value })} /></div>}
        <ul className="space-y-3">{open.map(r => <li key={r.id} className="text-sm border-t border-ink/10 pt-2"><p><strong>{r.ref}</strong> {r.test && <span className="text-xs text-amber-800">TEST</span>} · {r.pickup} → {r.drop}</p><p className="text-xs text-ink-mid">{r.when} · {r.vehicle} · {r.guests} passenger(s) · about {r.km} km · {inr(r.fareInr)} {r.online ? '(paid online)' : '(traveller pays you)'}</p>
          <button className="btn-primary text-xs mt-1" onClick={() => { store.set(DRV, JSON.stringify(d)); act('claim', { id: r.id, ...d }) }}>Accept this ride</button></li>)}</ul></div>
      {active.length > 0 && <div className="card"><h3 className="font-serif text-lg mb-2">My active rides</h3><ul className="space-y-3">{active.map(r => <li key={r.id} className="text-sm border-t border-ink/10 pt-2"><p><strong>{r.ref}</strong> · {r.pickup} → {r.drop} · {r.when}</p>
        <p className="text-xs text-ink-mid">Traveller: {r.rideName} {r.ridePhone} · driver {r.driver?.name} {r.driver?.vehicleNo} · {r.status}</p>
        {r.status === 'assigned' && <div className="flex gap-2 items-end mt-1"><input className={inp + ' !w-32'} inputMode="numeric" maxLength={4} placeholder="Trip code" value={otp[r.id] || ''} onChange={e => setOtp({ ...otp, [r.id]: e.target.value })} /><button className="btn-primary text-xs" onClick={() => act('trip', { id: r.id, action: 'start', otp: otp[r.id] || '' })}>Start trip</button></div>}
        {r.status === 'started' && <button className="btn-primary text-xs mt-1" onClick={() => act('trip', { id: r.id, action: 'complete' })}>Complete trip</button>}</li>)}</ul></div>}
      {done.length > 0 && <p className="text-xs text-ink-mid">{done.length} completed ride(s): see Payouts.</p>}
    </div>)
}

function Bookings({ stays, act }: { stays: Json[]; act: (a: string, b: Json) => Promise<unknown> }) {
  if (!stays.length) return <p className="card text-sm text-ink-mid">No bookings or requests yet.</p>
  return <div className="card"><ul className="space-y-3">{stays.map(b => (
    <li key={b.id} className="text-sm border-t border-ink/10 pt-2 first:border-0 first:pt-0"><p><strong>{b.ref}</strong> {b.test && <span className="text-xs text-amber-800">TEST</span>} · {b.status} · {b.checkIn} to {b.checkOut} · {b.people} guest(s){b.roomName ? ` · ${b.roomName}` : ''}{b.amountInr ? ` · ${inr(b.amountInr)}` : ''}{b.online ? (b.paid ? ' · paid online' : ' · awaiting payment') : ''}</p>
      {(b.name || b.phone || b.email) && <p className="text-xs text-ink-mid">Traveller: {b.name} {b.phone} {b.email}</p>}{b.message && <p className="text-xs text-ink-mid whitespace-pre-line">{b.message}</p>}
      {['new', 'sent'].includes(b.status) && !b.online && <div className="flex gap-2 mt-1"><button className="btn-primary text-xs" onClick={() => act('respond', { id: b.id, decision: 'confirm' })}>Confirm</button><button className="btn-outline text-xs" onClick={() => { if (window.confirm('Decline this request?')) act('respond', { id: b.id, decision: 'decline' }) }}>Decline</button></div>}</li>))}</ul></div>
}

function Inventory({ me, act }: { me: Json; act: (a: string, b: Json) => Promise<unknown> }) {
  const isCab = me.partner.type === 'transport'
  const [rooms, setRooms] = useState<Json[]>((me.inventory.rooms || []).map((r: Json) => ({ ...r, rateInr: String(r.rateInr), capacity: String(r.capacity), count: String(r.count) })))
  const [blocked, setBlocked] = useState<Record<string, string>>(Object.fromEntries(Object.entries(me.inventory.blocked || {}).map(([k, v]) => [k, (v as string[]).join(', ')]))); const [veh, setVeh] = useState<string[]>(me.inventory.vehicles || [])
  if (isCab) return <div className="card space-y-2"><p className="text-sm text-ink-mid">Tick the vehicle types you can take. You only see rides for these, in your districts.</p>
    <div className="flex flex-wrap gap-4 text-sm">{Object.entries(me.vehicles as Record<string, string>).map(([k, l]) => <label key={k} className="flex gap-1 items-center"><input type="checkbox" checked={veh.includes(k)} onChange={e => setVeh(e.target.checked ? [...veh, k] : veh.filter(x => x !== k))} />{l}</label>)}</div>
    <button className="btn-primary text-xs" onClick={() => act('inventory_save', { vehicles: veh })}>Save vehicles</button></div>
  return (
    <div className="card space-y-3"><p className="text-sm text-ink-mid">Your rooms, nightly rates and the nights you cannot take guests. Changes apply to new bookings straight away.</p>
      {rooms.map((r, i) => (<div key={i} className="flex flex-wrap gap-2 items-end text-xs border border-ink/10 p-2">
        {([['id', 'Id'], ['name', 'Room name'], ['capacity', 'Sleeps'], ['count', 'Units'], ['rateInr', 'Rs per night']] as const).map(([f, l]) => <label key={f}>{l}<input className={inp + ' mt-1 ' + (f === 'name' ? '!w-40' : '!w-24')} value={r[f]} onChange={e => setRooms(rooms.map((x, j) => j === i ? { ...x, [f]: e.target.value } : x))} /></label>)}
        <label>Blocked nights (YYYY-MM-DD, comma separated)<input className={inp + ' mt-1 !w-72'} value={blocked[r.id] || ''} onChange={e => setBlocked({ ...blocked, [r.id]: e.target.value })} /></label>
        <button type="button" className="underline" onClick={() => setRooms(rooms.filter((_, j) => j !== i))}>Remove</button></div>))}
      <div className="flex gap-2"><button className="btn-outline text-xs" onClick={() => setRooms([...rooms, { id: '', name: '', capacity: '2', count: '1', rateInr: '' }])}>Add a room</button>
        <button className="btn-primary text-xs" onClick={() => act('inventory_save', { rooms: rooms.map(r => ({ ...r, capacity: Number(r.capacity), count: Number(r.count), rateInr: Number(r.rateInr) })), blocked: Object.fromEntries(Object.entries(blocked).map(([k, v]) => [k, v.split(',').map(x => x.trim()).filter(Boolean)])) })}>Save</button></div></div>)
}

function Payouts({ rides, stays }: { rides: Json[]; stays: Json[] }) {
  const rows = [...rides.filter(r => r.paid).map(r => ({ ref: r.ref, what: 'Ride', share: r.partnerShareInr, held: r.payoutHeld, amt: r.fareInr })), ...stays.filter(b => b.paid).map(b => ({ ref: b.ref, what: 'Stay', share: b.partnerShareInr, held: b.payoutHeld, amt: b.amountInr }))]
  return <div className="card"><p className="text-sm text-ink-mid mb-2">Online payments: your share is paid out after the stay or trip is completed. Pay-on-site bookings are not listed here.</p>
    {!rows.length ? <p className="text-sm text-ink-mid">No online payments yet.</p> : <table className="w-full text-sm"><thead><tr className="text-left text-xs text-ink-mid"><th>Booking</th><th>Paid</th><th>Your share</th><th>Status</th></tr></thead><tbody>{rows.map(r => <tr key={r.ref} className="border-t border-ink/10"><td className="py-1">{r.ref} · {r.what}</td><td>{inr(r.amt)}</td><td>{r.share != null ? inr(r.share) : '-'}</td><td>{r.held ? 'held until completed' : 'released'}</td></tr>)}</tbody></table>}</div>
}
