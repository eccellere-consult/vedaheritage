'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { TEST_BANNER, fieldClass as inp, getStatus, hashParams, inr } from '@/lib/bookingApi'
import { type Json, acct, acctStore, fileToBase64, openBase64 } from '@/lib/accountApi'

const FOREIGN: [string, string, string][] = [['fullName', 'Full name (as in passport)', 'text'], ['dob', 'Date of birth', 'date'], ['nationality', 'Nationality', 'text'], ['passportNo', 'Passport number', 'text'], ['passportIssuePlace', 'Passport place of issue', 'text'], ['passportIssueDate', 'Passport date of issue', 'date'], ['passportExpiry', 'Passport expiry', 'date'],
  ['visaNo', 'Indian visa number', 'text'], ['visaType', 'Visa type (e.g. Tourist, e-Visa)', 'text'], ['visaIssueDate', 'Visa date of issue', 'date'], ['visaExpiry', 'Visa expiry', 'date'], ['arrivalDate', 'Date of arrival in India', 'date'], ['arrivedFrom', 'Arrived from (city or country)', 'text'], ['purpose', 'Purpose of visit', 'text'], ['nextDestination', 'Next destination', 'text'], ['addressAbroad', 'Home address abroad', 'text']]
const INDIAN: [string, string, string][] = [['fullName', 'Full name', 'text'], ['dob', 'Date of birth', 'date'], ['idType', 'ID type', 'select'], ['idNumber', 'ID number (not Aadhaar)', 'text'], ['address', 'Address', 'text'], ['purpose', 'Purpose of visit', 'text']]

/** Traveller account: register or sign in by email link; dashboard (trips, bookings, payments, contacts); my details (identity, documents, privacy). */
export default function AccountPortal() {
  const [phase, setPhase] = useState<'start' | 'out' | 'in'>('start'); const [open, setOpen] = useState<boolean | null>(null); const [mode, setMode] = useState<'register' | 'login'>('register')
  const [f, setF] = useState({ name: '', email: '', phone: '', country: '', residency: 'indian', consent: false }); const [sent, setSent] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [me, setMe] = useState<Json | null>(null); const [dash, setDash] = useState<Json | null>(null); const [tab, setTab] = useState<'dash' | 'details'>('dash'); const [testMode, setTestMode] = useState(false)

  const refresh = useCallback(async () => {
    const [a, b] = await Promise.all([acct('me'), acct('dashboard')])
    if (a.status === 401 || b.status === 401) { acctStore.del(); setPhase('out'); return }
    if (!a.ok) { setErr(a.data.error || ''); setPhase('out'); return }
    setMe(a.data); setDash(b.data); setPhase('in')
  }, [])
  useEffect(() => {
    getStatus().then(s => { setOpen(!!s?.caps.accounts); setTestMode(!!s?.testMode) })
    const start = () => {
      const t = hashParams().get('t')
      if (t) { history.replaceState(null, '', '/account/'); acct('session', { token: t }, null).then(r => { if (r.ok) { acctStore.set(r.data.session); setErr(''); refresh() } else { setErr(r.data.error || 'This link did not work.'); setPhase('out') } }); return }
      if (acctStore.get()) refresh(); else setPhase('out')
    }
    start(); const h = () => { if (hashParams().get('t')) start() }; window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h)
  }, [refresh])

  const say = (r: { ok: boolean; data: Json }) => { setMsg(r.ok ? (r.data.message || 'Done.') : ''); setErr(r.ok ? '' : r.data.error || 'Something went wrong.') }
  if (phase === 'start') return <p className="text-sm text-ink-mid">Loading…</p>

  if (phase === 'out') return (
    <div className="space-y-4">
      {testMode && <p role="status" className="rounded border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs">{TEST_BANNER}</p>}
      {open === false && <div className="card"><p className="font-serif text-xl text-ink mb-1">Accounts open soon</p><p className="text-sm text-ink-mid">Traveller accounts are not open yet. You can still plan with the <Link className="underline" href="/itinerary/">itinerary planner</Link>.</p></div>}
      {open !== false && (
        <form className="card space-y-3" onSubmit={async e => { e.preventDefault(); setErr(''); const r = mode === 'register' ? await acct('register', f, null) : await acct('login', { email: f.email }, null); if (r.ok) setSent(true); else setErr(r.data.error || 'Please try again.') }}>
          <div className="flex gap-2"><button type="button" className={`${mode === 'register' ? 'btn-primary' : 'btn-outline'} text-xs`} onClick={() => { setMode('register'); setSent(false) }}>Register</button><button type="button" className={`${mode === 'login' ? 'btn-primary' : 'btn-outline'} text-xs`} onClick={() => { setMode('login'); setSent(false) }}>Sign in</button></div>
          <p className="text-sm text-ink-mid">{mode === 'register' ? 'Create an account to keep your itineraries, see your bookings, payments and contacts in one place, and store the identity details a stay needs. No password: we email you a link.' : 'We email you a sign-in link. No password.'}</p>
          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
          {sent ? <p role="status" className="text-sm text-primary">Check your email for a sign-in link. It works once and expires in 20 minutes.</p> : <>
            {mode === 'register' && <div className="grid sm:grid-cols-2 gap-2"><label className="text-xs">Name<input required className={inp + ' mt-1'} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label><label className="text-xs">Phone (optional)<input className={inp + ' mt-1'} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
              <label className="text-xs">Country<input className={inp + ' mt-1'} value={f.country} onChange={e => setF({ ...f, country: e.target.value })} /></label>
              <label className="text-xs">I am<select className={inp + ' mt-1'} value={f.residency} onChange={e => setF({ ...f, residency: e.target.value })}><option value="indian">An Indian resident</option><option value="foreign">A foreign national</option></select></label></div>}
            <label className="text-xs block">Email<input required type="email" className={inp + ' mt-1'} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
            {mode === 'register' && <label className="text-xs flex gap-2 items-start"><input type="checkbox" className="mt-0.5" checked={f.consent} onChange={e => setF({ ...f, consent: e.target.checked })} />I accept the terms and privacy notice. We keep only what a trip needs, you can delete everything at any time.</label>}
            <button className="btn-primary text-xs">{mode === 'register' ? 'Create my account' : 'Email me a sign-in link'}</button></>}
        </form>)}
    </div>)

  const bookings: Json[] = dash?.bookings || []
  return (
    <div className="space-y-4">
      {me?.testMode && <p role="status" className="rounded border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs">{TEST_BANNER}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-serif text-xl text-ink">Hello, {me?.account.name}</p><p className="text-xs text-ink-mid">{me?.account.email}</p></div><button className="text-xs underline text-ink-mid" onClick={async () => { await acct('logout', {}); acctStore.del(); setPhase('out'); setSent(false) }}>Sign out</button></div>
      <div className="flex gap-2" role="tablist">{([['dash', 'My trips'], ['details', 'My details and documents']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`${tab === k ? 'btn-primary' : 'btn-outline'} text-xs`}>{l}</button>)}</div>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}{msg && <p role="status" className="text-sm text-primary">{msg}</p>}
      {tab === 'dash' && <Dashboard dash={dash!} bookings={bookings} go={() => setTab('details')} reload={refresh} say={say} />}
      {tab === 'details' && <Details me={me!} reload={refresh} say={say} onErased={() => { acctStore.del(); setPhase('out') }} />}
    </div>)
}

function Dashboard({ dash, bookings, go, reload, say }: { dash: Json; bookings: Json[]; go: () => void; reload: () => void; say: (r: { ok: boolean; data: Json }) => void }) {
  return (
    <div className="space-y-4">
      {dash.identityNeeded && <div className="card border-amber-300 bg-amber-50"><p className="text-sm text-amber-900"><strong>Your stay needs your passport and visa details.</strong> Indian law requires hosts to register foreign guests. Add them now so check-in is quick.</p><button className="btn-primary text-xs mt-2" onClick={go}>Add my details</button></div>}
      <div className="card"><h2 className="font-serif text-lg mb-2">Bookings</h2>{!bookings.length && <p className="text-sm text-ink-mid">No bookings yet. <Link className="underline" href="/stays/">Book a stay</Link> or <Link className="underline" href="/rides/">a ride</Link> while signed in and they show here.</p>}
        <ul className="space-y-4">{bookings.map(b => (
          <li key={b.id} className="border-t border-ink/10 pt-3 first:border-0 first:pt-0 text-sm">
            <p><strong>{b.ref}</strong> {b.test && <span className="text-xs text-amber-800">TEST</span>} · {b.kind === 'ride' ? `Ride: ${b.pickup} to ${b.drop}, ${b.when}` : `${b.partner}${b.room ? `, ${b.room}` : ''}: ${b.checkIn} to ${b.checkOut}`}</p>
            <ol className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" aria-label="Status">{b.steps.map(([l, done]: [string, boolean]) => <li key={l} className={done ? 'text-primary font-medium' : 'text-ink-mid'}>{done ? '✓' : '○'} {l}</li>)}</ol>
            {b.contact && <p className="text-xs mt-2">{b.contact.label}: <strong>{b.contact.name}</strong>{b.contact.phone && <> · <a className="underline" href={`tel:${b.contact.phone}`}>{b.contact.phone}</a></>}{b.contact.extra && ` · ${b.contact.extra}`}</p>}
            <p className="text-xs text-ink-mid mt-1">{b.payment.mode === 'online' ? `Paid online: ${b.payment.status === 'paid' ? inr(b.payment.amountInr) + (b.payment.receipt ? ` (receipt ${b.payment.receipt})` : '') : b.payment.status}${b.payment.refundedInr ? `, refunded ${inr(b.payment.refundedInr)}` : ''}` : `Pay on arrival${b.payment.amountInr ? ` (${inr(b.payment.amountInr)})` : ''}`}</p>
          </li>))}</ul></div>
      <div className="card"><h2 className="font-serif text-lg mb-2">Saved itineraries</h2>{!dash.trips.length && <p className="text-sm text-ink-mid">None yet. Build one in the <Link className="underline" href="/itinerary/">itinerary planner</Link> and choose Save to my account.</p>}
        <ul className="space-y-2">{dash.trips.map((t: Json) => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span><strong>{t.name}</strong> <span className="text-xs text-ink-mid">{t.plan.days.flat().length} stop(s), {t.plan.days.length} day(s)</span></span>
          <span className="flex gap-2"><a className="btn-outline text-xs" href={`/itinerary/#plan=${encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(t.plan)))))}`}>Open</a><button className="text-xs underline" onClick={async () => { if (window.confirm('Delete this itinerary?')) { say(await acct('itinerary_delete', { id: t.id })); reload() } }}>Delete</button></span></li>)}</ul></div>
      <div className="card"><h2 className="font-serif text-lg mb-2">Key contacts and emergency numbers</h2><ul className="text-sm space-y-1">{dash.emergency.map((e: Json) => <li key={e.phone}>{e.label}: <a className="underline" href={`tel:${e.phone}`}>{e.phone}</a></li>)}</ul></div>
      {dash.payments.length > 0 && <div className="card"><h2 className="font-serif text-lg mb-2">Payments</h2><table className="w-full text-sm"><thead><tr className="text-left text-xs text-ink-mid"><th>Booking</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{dash.payments.map((p: Json) => <tr key={p.ref} className="border-t border-ink/10"><td className="py-1">{p.ref}</td><td>{inr(p.amountInr)}</td><td>{p.status}{p.refundedInr ? ` (refunded ${inr(p.refundedInr)})` : ''}</td><td>{p.receipt || '-'}</td></tr>)}</tbody></table></div>}
    </div>)
}

function Details({ me, reload, say, onErased }: { me: Json; reload: () => void; say: (r: { ok: boolean; data: Json }) => void; onErased: () => void }) {
  const a = me.account; const [p, setP] = useState({ name: a.name, phone: a.phone, country: a.country, residency: a.residency, ecName: a.emergencyContact?.name || '', ecPhone: a.emergencyContact?.phone || '' })
  const [id, setId] = useState<Record<string, string>>({}); const [consent, setConsent] = useState(false); const [docType, setDocType] = useState('passport_photo'); const [loadedId, setLoadedId] = useState(false)
  const fields = a.residency === 'foreign' ? FOREIGN : INDIAN
  useEffect(() => { if (a.identityOn && !loadedId) { setLoadedId(true); acct('identity_get').then(r => { if (r.ok && r.data.identity) setId(r.data.identity) }) } }, [a.identityOn, loadedId])
  return (
    <div className="space-y-4">
      <form className="card space-y-3" onSubmit={async e => { e.preventDefault(); say(await acct('profile_save', { name: p.name, phone: p.phone, country: p.country, residency: p.residency, emergencyContact: p.ecName && p.ecPhone ? { name: p.ecName, phone: p.ecPhone } : null })); reload() }}>
        <h2 className="font-serif text-lg">Profile</h2>
        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          <label>Name<input required className={inp + ' mt-1'} value={p.name} onChange={e => setP({ ...p, name: e.target.value })} /></label><label>Phone<input className={inp + ' mt-1'} value={p.phone} onChange={e => setP({ ...p, phone: e.target.value })} /></label><label>Country<input className={inp + ' mt-1'} value={p.country} onChange={e => setP({ ...p, country: e.target.value })} /></label>
          <label>I am<select className={inp + ' mt-1'} value={p.residency} onChange={e => setP({ ...p, residency: e.target.value })}><option value="indian">An Indian resident</option><option value="foreign">A foreign national</option></select></label>
          <label>Emergency contact name<input className={inp + ' mt-1'} value={p.ecName} onChange={e => setP({ ...p, ecName: e.target.value })} /></label><label>Emergency contact phone<input className={inp + ' mt-1'} value={p.ecPhone} onChange={e => setP({ ...p, ecPhone: e.target.value })} /></label></div>
        <button className="btn-primary text-xs">Save profile</button></form>

      {!me.kycOpen ? <p className="card text-sm text-ink-mid">Identity details and documents are not open yet.</p> : !me.vaultReady ? <p className="card text-sm text-ink-mid">Secure storage is being set up. Please try again later.</p> : <>
        <form className="card space-y-3" onSubmit={async e => { e.preventDefault(); say(await acct('identity_save', { consent, identity: id })); reload() }}>
          <h2 className="font-serif text-lg">{a.residency === 'foreign' ? 'Passport and visa details (for Form C)' : 'Government ID'}</h2>
          <p className="text-xs text-ink-mid">{a.residency === 'foreign' ? 'Stays in India must register foreign guests (Form C). Your host files it, using these details. ' : 'Hosts must record a government ID for guests. '}Stored encrypted. Only the stays you book (for this registration) and our verification team can see it, and every view is logged. We never store Aadhaar numbers or images. It is deleted automatically {me.retentionDays} days after you save it, and you can delete it any time.</p>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">{fields.map(([k, l, t]) => t === 'select' ? <label key={k}>{l}<select className={inp + ' mt-1'} value={id[k] || ''} onChange={e => setId({ ...id, [k]: e.target.value })}><option value="">Choose…</option>{(me.idTypes as string[]).map(x => <option key={x}>{x}</option>)}</select></label> : <label key={k}>{l}<input required type={t} className={inp + ' mt-1'} value={id[k] || ''} onChange={e => setId({ ...id, [k]: e.target.value })} /></label>)}</div>
          <label className="text-xs flex gap-2 items-start"><input type="checkbox" className="mt-0.5" checked={consent} onChange={e => setConsent(e.target.checked)} />I agree to Veda Heritage storing these details, and sharing them only with the stays I book for their legal guest registration.</label>
          <button className="btn-primary text-xs">Save details</button></form>
        <div className="card space-y-3"><h2 className="font-serif text-lg">Documents</h2>
          {!a.kycConsentOn && <p className="text-xs text-ink-mid">Save your details and consent above first.</p>}
          <ul className="space-y-1 text-sm">{(me.docs as Json[]).map(d => <li key={d.id} className="flex flex-wrap items-center justify-between gap-2"><span>{d.label} <span className="text-xs text-ink-mid">({Math.round(d.size / 1024)} KB, deleted on {d.deleteAfter})</span></span>
            <span className="flex gap-2"><button className="text-xs underline" onClick={async () => { const r = await acct(`doc_get&id=${d.id}`); if (r.ok) openBase64(r.data.mime, r.data.data); else say(r) }}>View</button><button className="text-xs underline" onClick={async () => { if (window.confirm('Delete this document?')) { say(await acct('doc_delete', { id: d.id })); reload() } }}>Delete</button></span></li>)}</ul>
          <div className="flex flex-wrap gap-2 items-end text-xs"><label>Type<select className={inp + ' mt-1'} value={docType} onChange={e => setDocType(e.target.value)}>{Object.entries(me.docTypes as Record<string, string>).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label>File (JPEG, PNG or PDF, up to 5 MB)<input type="file" accept="image/jpeg,image/png,application/pdf" className={inp + ' mt-1'} disabled={!a.kycConsentOn} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { say({ ok: false, data: { error: 'The file must be under 5 MB.' } }); return } say(await acct('doc_upload', { docType, data: await fileToBase64(f) })); e.target.value = ''; reload() }} /></label></div></div></>}

      <div className="card"><h2 className="font-serif text-lg mb-1">Delete my account</h2><p className="text-xs text-ink-mid mb-2">Deletes your profile, identity details, documents and saved itineraries. Completed bookings stay on record without your contact details.</p>
        <button className="btn-outline text-xs" onClick={async () => { const w = window.prompt('Type DELETE to delete your account and everything stored about you'); if (w === null) return; const r = await acct('erase', { confirm: w }); say(r); if (r.ok) onErased() }}>Delete my account</button></div>
    </div>)
}
