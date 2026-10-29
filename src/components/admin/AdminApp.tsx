'use client'

import { useCallback, useEffect, useState } from 'react'

const API = '/api/admin/'
type Json = Record<string, any>
type Tab = 'overview' | 'drafts' | 'market' | 'providers' | 'prs' | 'stories' | 'agents' | 'activity'
const TABS: [Tab, string][] = [['overview', 'Overview'], ['drafts', 'Drafts'], ['market', 'Marketplace'], ['providers', 'Directory'], ['prs', 'Pull requests'], ['stories', 'Stories'], ['agents', 'Run agents'], ['activity', 'Activity']]

let csrf = ''
async function api(a: string, body?: Json, query = ''): Promise<{ ok: boolean; status: number; data: Json }> {
  try {
    const r = await fetch(`${API}?a=${a}${query}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(body && csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach the admin service. It runs on the live site (Hostinger), not in local dev.' } }
  }
}

const badge = (t: string, tone: 'ok' | 'warn' | 'bad' | 'mute') =>
  <span className={`text-xs px-2 py-0.5 rounded-full border ${tone === 'ok' ? 'bg-primary/10 text-primary border-primary/30' : tone === 'warn' ? 'bg-amber-50 text-amber-800 border-amber-300' : tone === 'bad' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-white text-ink-mid border-accent/30'}`}>{t}</span>

export default function AdminApp() {
  const [phase, setPhase] = useState<'loading' | 'setup' | 'login' | 'app' | 'error'>('loading')
  const [tab, setTab] = useState<Tab>('overview')
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const r = await api('status')
    if (!r.ok) { setErr(r.data.error || 'Admin service unavailable.'); setPhase('error'); return }
    if (!r.data.configured) { setPhase('setup'); return }
    if (r.data.authed) { csrf = r.data.csrf; setPhase('app') } else setPhase('login')
  }, [])
  useEffect(() => { load() }, [load])

  const say = (text: string, bad = false) => setMsg({ text, bad })

  if (phase === 'loading') return <p className="text-ink-mid">Loading…</p>
  if (phase === 'error') return <div className="card"><h1 className="font-serif text-2xl mb-2">Admin unavailable</h1><p className="text-ink-mid text-sm">{err}</p></div>
  if (phase === 'setup') return <Setup needsHash={true} />
  if (phase === 'login') return <Login onDone={(t: string) => { csrf = t; setPhase('app') }} />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl text-ink">Admin</h1>
        <button className="btn-outline text-xs" onClick={async () => { await api('logout', {}); csrf = ''; setPhase('login') }}>Log out</button>
      </div>
      <div role="tablist" className="flex flex-wrap gap-2 mb-6">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setMsg(null) }}
            className={`px-4 py-2 text-sm border ${tab === k ? 'bg-primary text-white border-primary' : 'bg-white text-ink-mid border-accent/30'}`}>{l}</button>
        ))}
      </div>
      {msg && <p role="status" className={`mb-4 px-4 py-3 text-sm border ${msg.bad ? 'bg-red-50 border-red-300 text-red-800' : 'bg-primary/10 border-primary/30 text-ink'}`}>{msg.text}</p>}
      {tab === 'overview' && <Overview go={setTab} />}
      {tab === 'drafts' && <Drafts say={say} />}
      {tab === 'market' && <Market say={say} />}
      {tab === 'providers' && <Providers say={say} />}
      {tab === 'prs' && <Prs say={say} />}
      {tab === 'stories' && <Stories say={say} />}
      {tab === 'agents' && <Agents say={say} />}
      {tab === 'activity' && <Activity />}
    </div>
  )
}

function Setup({ needsHash }: { needsHash: boolean }) {
  const [pw, setPw] = useState(''); const [hash, setHash] = useState(''); const [e, setE] = useState('')
  return (
    <div className="card max-w-xl">
      <h1 className="font-serif text-2xl mb-2">Admin setup</h1>
      <p className="text-sm text-ink-mid mb-4">The admin is not configured on this server yet. Follow <strong>docs/ADMIN.md</strong>. Step 2 uses this box to turn your chosen password into a code you paste into <code>vh-config.php</code>. The password is never stored.</p>
      {needsHash && !hash && (
        <form onSubmit={async ev => { ev.preventDefault(); setE(''); const r = await api('setup', { password: pw }); if (r.ok) setHash(r.data.hash); else setE(r.data.error || 'Failed') }}>
          <label className="block text-sm mb-1" htmlFor="pw">Choose a passphrase (14+ characters)</label>
          <input id="pw" type="password" autoComplete="new-password" value={pw} onChange={x => setPw(x.target.value)} className="w-full border border-accent/30 px-3 py-2 mb-3" />
          <button className="btn-primary text-xs" disabled={pw.length < 14}>Make my code</button>
        </form>
      )}
      {e && <p className="text-sm text-red-700 mt-3">{e}</p>}
      {hash && <><p className="text-sm mb-2">Copy this whole line into <code>vh-config.php</code> as <code>admin_password_hash</code>:</p><textarea readOnly rows={3} className="w-full border border-accent/30 p-2 text-xs font-mono" value={hash} onFocus={x => x.currentTarget.select()} /></>}
    </div>
  )
}

function Login({ onDone }: { onDone: (t: string) => void }) {
  const [pw, setPw] = useState(''); const [e, setE] = useState(''); const [busy, setBusy] = useState(false)
  return (
    <form className="card max-w-md mx-auto" onSubmit={async ev => {
      ev.preventDefault(); setBusy(true); setE('')
      const r = await api('login', { password: pw }); setBusy(false)
      if (r.ok) onDone(r.data.csrf); else setE(r.data.error || 'Login failed')
    }}>
      <h1 className="font-serif text-2xl mb-4">Admin login</h1>
      <label className="block text-sm mb-1" htmlFor="pw">Password</label>
      <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={x => setPw(x.target.value)} className="w-full border border-accent/30 px-3 py-2 mb-3" autoFocus />
      {e && <p role="alert" className="text-sm text-red-700 mb-3">{e}</p>}
      <button className="btn-primary text-xs" disabled={busy || !pw}>{busy ? 'Checking…' : 'Log in'}</button>
    </form>
  )
}

function useLoad(a: string, query = '') {
  const [data, setData] = useState<Json | null>(null); const [err, setErr] = useState('')
  const reload = useCallback(async () => { const r = await api(a, undefined, query); if (r.ok) { setData(r.data); setErr('') } else { setErr(r.data.error || 'Failed to load'); if (r.status === 401) location.reload() } }, [a, query])
  useEffect(() => { reload() }, [reload])
  return { data, err, reload }
}

function Overview({ go }: { go: (t: Tab) => void }) {
  const ov = useLoad('overview'); const site = useLoad('site'); const mk = useLoad('market'); const pv = useLoad('prov')
  const d = ov.data; const s = site.data
  const tile = (n: any, label: string, t: Tab) => <button key={label} onClick={() => go(t)} className="card text-left hover:shadow-md"><p className="font-serif text-4xl text-primary">{n ?? '…'}</p><p className="text-sm text-ink-mid">{label}</p></button>
  return (
    <div className="space-y-8">
      {ov.err && <p className="text-red-700 text-sm">{ov.err}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {tile(d?.drafts, 'Drafts waiting', 'drafts')}{tile(d?.approved, 'Published guides', 'drafts')}{tile(d?.openPrs, 'Open pull requests', 'prs')}{tile(d?.stories, 'Stories to review', 'stories')}{tile(mk.data ? mk.data.pending.length + mk.data.enquiries.length : undefined, 'Marketplace to review', 'market')}{tile(pv.data ? pv.data.queue.length + pv.data.reports.length : undefined, 'Directory to review', 'providers')}
      </div>
      <div className="card">
        <h2 className="font-serif text-xl mb-3">Site and deploy</h2>
        {site.err && <p className="text-red-700 text-sm">{site.err}</p>}
        {s && <>
          <p className="text-sm text-ink-mid mb-1">Latest on main: <code>{s.main}</code> {s.mainMessage}</p>
          <p className="text-sm text-ink-mid mb-4">Live site: {s.liveOk ? <>{badge('online', 'ok')} version <code>{s.liveVersion || 'unknown'}</code> {s.liveVersion && !String(s.liveVersion).includes(s.main) && badge('may be behind main (a deploy takes a few minutes)', 'warn')}</> : badge('could not read version.txt', 'bad')}</p>
          <table className="w-full text-sm"><tbody>{(s.runs || []).map((r: Json, i: number) => (
            <tr key={i} className="border-t border-accent/10"><td className="py-1.5">{r.workflow.replace('.yml', '')}</td><td>{r.status !== 'completed' ? badge('running', 'warn') : badge(r.conclusion, r.conclusion === 'success' ? 'ok' : 'bad')}</td><td className="text-ink-mid">{new Date(r.when).toLocaleString()}</td><td><a className="underline text-primary" href={r.url} target="_blank" rel="noopener noreferrer">log</a></td></tr>
          ))}</tbody></table>
        </>}
      </div>
    </div>
  )
}

function Drafts({ say }: { say: (t: string, bad?: boolean) => void }) {
  const { data, err, reload } = useLoad('drafts'); const [show, setShow] = useState<'draft' | 'approved'>('draft'); const [busy, setBusy] = useState('')
  const rows: Json[] = (data?.entries || []).filter((e: Json) => (show === 'draft') === (e.status !== 'approved'))
  async function setStatus(e: Json, status: 'approved' | 'draft', override = false) {
    setBusy(e.slug)
    const r = await api('set_status', { category: e.category, slug: e.slug, status, override })
    setBusy('')
    if (r.ok) { say(r.data.message); reload(); return }
    if (r.status === 409 && r.data.needsOverride) {
      if (window.confirm(`The verifier flagged this entry:\n\n- ${(r.data.gates || []).join('\n- ')}\n\nPublish anyway? Check the facts first.`)) return setStatus(e, status, true)
      return
    }
    say([r.data.error, ...(r.data.blockers || [])].filter(Boolean).join(' · '), true)
  }
  async function findImages(e: Json) { const r = await api('run_workflow', { workflow: 'fetch-images', inputs: { slug: e.slug } }); say(r.ok ? 'Image search started. A pull request with photos appears in a few minutes; merge it under Pull requests, then publish.' : r.data.error, !r.ok) }
  return (
    <div>
      <div className="flex gap-2 mb-4">{(['draft', 'approved'] as const).map(k => <button key={k} onClick={() => setShow(k)} className={`px-3 py-1 text-sm border ${show === k ? 'bg-ink text-white border-ink' : 'bg-white border-accent/30 text-ink-mid'}`}>{k === 'draft' ? 'Drafts' : 'Published'}</button>)}</div>
      {err && <p className="text-red-700 text-sm">{err}</p>}{!data && !err && <p className="text-ink-mid">Loading…</p>}
      {data && !rows.length && <p className="text-ink-mid text-sm">Nothing here.</p>}
      <div className="space-y-3">
        {rows.map(e => {
          const v = e.verification
          return (
            <div key={e.slug} className="card !p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-serif text-lg text-ink">{e.name}</h3><p className="text-xs text-ink-mid">{e.category} · {e.district} · {e.images} image(s) · {e.sources} source(s)</p></div>
                <div className="flex flex-wrap gap-2 items-center">
                  {v && badge(`verifier ${v.score ?? '?'}${v.gateReasons?.length ? ' · needs edit' : ' · ready'}`, v.gateReasons?.length ? 'warn' : 'ok')}
                  {e.status === 'approved'
                    ? <button className="btn-outline text-xs" disabled={busy === e.slug} onClick={() => setStatus(e, 'draft')}>Unpublish</button>
                    : <>
                        {e.images === 0 && <button className="btn-outline text-xs" onClick={() => findImages(e)}>Find images</button>}
                        <button className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed" disabled={busy === e.slug || e.blockers.length > 0} onClick={() => setStatus(e, 'approved')}>Approve &amp; publish</button>
                      </>}
                </div>
              </div>
              {e.status !== 'approved' && e.blockers.length > 0 && <ul className="list-disc pl-5 mt-3 text-sm text-amber-800">{e.blockers.map((b: string) => <li key={b}>{b}</li>)}</ul>}
              {v?.issues?.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer text-primary">Verifier notes ({v.issues.length})</summary><ul className="list-disc pl-5 mt-2 text-ink-mid">{v.issues.map((i: Json, k: number) => <li key={k}><strong>{i.severity}</strong> {i.field}: {i.problem || i.detail || i.issue}</li>)}</ul><p className="mt-2 text-ink-mid">{v.folkloreAssessment}</p></details>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Market({ say }: { say: (t: string, bad?: boolean) => void }) {
  const { data, err, reload } = useLoad('market'); const [busy, setBusy] = useState('')
  const rupees = (n: number) => '₹' + Number(n).toLocaleString('en-IN')
  async function decide(id: string, decision: 'approve' | 'reject', override = false): Promise<void> {
    if (decision === 'reject' && !window.confirm('Reject this listing? The seller\'s photos and contact details are deleted immediately.')) return
    setBusy(id); const r = await api('market_decide', { id, decision, override }); setBusy('')
    if (r.ok) { say(r.data.message); reload(); return }
    if (r.status === 409 && r.data.needsOverride) {
      if (window.confirm(`This listing needs a second look:\n\n- ${(r.data.flags || []).join('\n- ')}\n\nCheck the photos and description. Publish anyway?`)) return decide(id, decision, true)
      return
    }
    say([r.data.error, ...(r.data.blockers || [])].filter(Boolean).join(' · '), true)
  }
  async function setStatus(id: string, status: 'sold' | 'removed') {
    if (status === 'removed' && !window.confirm('Remove this listing from the site? The seller contact details are deleted.')) return
    setBusy(id); const r = await api('market_status', { id, status }); setBusy(''); say(r.ok ? r.data.message : r.data.error, !r.ok); reload()
  }
  async function introduced(id: string) { const r = await api('market_enquiry_done', { id }); say(r.ok ? 'Marked as introduced. The buyer\'s contact details were deleted.' : r.data.error, !r.ok); reload() }
  const contact = (e?: string, p?: string) => [e, p].filter(Boolean).join(' · ') || 'none'
  return (
    <div className="space-y-10">
      {err && <p className="text-red-700 text-sm">{err}</p>}{!data && !err && <p className="text-ink-mid">Loading…</p>}
      {data && <>
        <section>
          <h2 className="font-serif text-xl mb-3">Listings to review ({data.pending.length})</h2>
          {!data.pending.length && <p className="text-sm text-ink-mid">Nothing waiting.</p>}
          <div className="space-y-4">{data.pending.map((l: Json) => (
            <div key={l.id} className="card !p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div><h3 className="font-serif text-lg text-ink">{l.title}</h3><p className="text-xs text-ink-mid">{l.category} · {l.condition} · {rupees(l.price)} · {l.district} · {new Date(l.created).toLocaleDateString()}</p></div>
                <div className="flex gap-2 items-start">
                  <button className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed" disabled={busy === l.id || l.blockers.length > 0} onClick={() => decide(l.id, 'approve')}>Approve &amp; publish</button>
                  <button className="btn-outline text-xs" disabled={busy === l.id} onClick={() => decide(l.id, 'reject')}>Reject</button>
                </div>
              </div>
              <div className="flex gap-2 my-3">{Array.from({ length: l.photos }, (_, i) => <a key={i} href={`${API}?a=market_photo&id=${l.id}&n=${i + 1}`} target="_blank" rel="noopener noreferrer"><img src={`${API}?a=market_photo&id=${l.id}&n=${i + 1}`} alt={`${l.title} photo ${i + 1}`} className="h-24 w-32 object-cover border border-accent/30" /></a>)}</div>
              <p className="text-sm text-ink-mid whitespace-pre-wrap">{l.description}</p>
              <p className="text-xs text-ink-mid mt-2">Seller: {l.sellerName} · private contact: {contact(l.contactEmail, l.contactPhone)}</p>
              {l.blockers.length > 0 && <ul className="list-disc pl-5 mt-2 text-sm text-amber-800">{l.blockers.map((b: string) => <li key={b}>{b}</li>)}</ul>}
              {l.flags.length > 0 && <ul className="list-disc pl-5 mt-2 text-sm text-red-700">{l.flags.map((b: string) => <li key={b}>Check: {b}</li>)}</ul>}
            </div>))}</div>
        </section>
        <section>
          <h2 className="font-serif text-xl mb-3">Enquiries to introduce ({data.enquiries.length})</h2>
          {!data.enquiries.length && <p className="text-sm text-ink-mid">No open enquiries.</p>}
          <div className="space-y-3">{data.enquiries.map((e: Json) => (
            <div key={e.id} className="card !p-5">
              <div className="flex flex-wrap justify-between gap-3"><h3 className="font-serif text-lg text-ink">{e.listingTitle}</h3><button className="btn-primary text-xs" onClick={() => introduced(e.id)}>Mark introduced</button></div>
              <p className="text-sm text-ink-mid whitespace-pre-wrap mt-2">{e.message}</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-3 text-xs text-ink-mid">
                <p><strong>Buyer:</strong> {e.name} · {contact(e.contactEmail, e.contactPhone)}</p>
                <p><strong>Seller:</strong> {e.seller ? `${e.seller.name} · ${contact(e.seller.email, e.seller.phone)}` : 'unknown'}</p>
              </div>
              <p className="text-xs text-ink-mid/70 mt-2">Introduce them by email or WhatsApp, then mark introduced. Marking deletes the buyer's details.</p>
            </div>))}</div>
        </section>
        <section>
          <h2 className="font-serif text-xl mb-3">Live and sold ({data.live.length})</h2>
          {!data.live.length && <p className="text-sm text-ink-mid">No live listings.</p>}
          <div className="space-y-2">{data.live.map((l: Json) => (
            <div key={l.id} className="card !p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm"><span className="font-medium text-ink">{l.title}</span> <span className="text-ink-mid">{rupees(l.price)} · {l.district}</span> {badge(l.status, l.status === 'approved' ? 'ok' : 'mute')}</p>
              <div className="flex gap-2">
                {l.status === 'approved' && <button className="btn-outline text-xs" disabled={busy === l.id} onClick={() => setStatus(l.id, 'sold')}>Mark sold</button>}
                <button className="btn-outline text-xs" disabled={busy === l.id} onClick={() => setStatus(l.id, 'removed')}>Remove</button>
              </div>
            </div>))}</div>
        </section>
      </>}
    </div>
  )
}

function Providers({ say }: { say: (t: string, bad?: boolean) => void }) {
  const { data, err, reload } = useLoad('prov'); const [busy, setBusy] = useState('')
  const [chk, setChk] = useState<Record<string, Json>>({}); const [ad, setAd] = useState<Record<string, Json>>({}); const [openAd, setOpenAd] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const setC = (id: string, k: string, v: boolean) => setChk(c => ({ ...c, [id]: { ...(c[id] || {}), [k]: v } }))
  async function decide(id: string, decision: 'approve' | 'reject', override = false): Promise<void> {
    if (decision === 'reject' && !window.confirm('Reject this application? The applicant\'s private details are deleted.')) return
    setBusy(id); const r = await api('prov_decide', { id, decision, checks: chk[id] || {}, override }); setBusy('')
    if (r.ok) { say(r.data.message); reload(); return }
    if (r.status === 409 && r.data.needsOverride) {
      if (window.confirm(`This application needs a second look:\n\n- ${(r.data.flags || []).join('\n- ')}\n\nPublish anyway?`)) return decide(id, decision, true)
      return
    }
    say([r.data.error, ...(r.data.blockers || [])].filter(Boolean).join(' · '), true)
  }
  async function status(id: string, to: string, extra: Json = {}) {
    if (to === 'removed' && !window.confirm('Remove this listing? Private details are deleted.')) return
    if (to === 'reverified' && !window.confirm('Confirm you called the business and re-checked its details?')) return
    setBusy(id); const r = await api('prov_status', { id, status: to, ...(to === 'reverified' ? { confirmed: true } : {}), ...extra }); setBusy(''); say(r.ok ? r.data.message : r.data.error, !r.ok); reload()
  }
  async function sponsor(id: string, clear = false) {
    setBusy(id); const a = ad[id] || {}
    const r = await api('prov_sponsor', clear ? { id, clear: true } : { id, headline: a.headline || '', line: a.line || '', from: a.from || today, until: a.until || '' }); setBusy('')
    if (r.ok) { say(r.data.message); setOpenAd(''); reload() } else say([r.data.error, ...(r.data.blockers || [])].filter(Boolean).join(' · '), true)
  }
  const inp = 'border border-accent/30 px-2 py-1 text-sm w-full'
  const yn = (ok: any, t: string) => badge(t, ok ? 'ok' : 'warn')
  return (
    <div className="space-y-10">
      {err && <p className="text-red-700 text-sm">{err}</p>}{!data && !err && <p className="text-ink-mid">Loading…</p>}
      {data && <>
        <section>
          <h2 className="font-serif text-xl mb-3">Applications to verify ({data.queue.length})</h2>
          {!data.queue.length && <p className="text-sm text-ink-mid">Nothing waiting.</p>}
          <div className="space-y-4">{data.queue.map((q: Json) => (
            <div key={q.id} className="card !p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div><h3 className="font-serif text-lg text-ink">{q.name}</h3><p className="text-xs text-ink-mid">{q.type} · {q.districts.join(', ')} · applied {new Date(q.created).toLocaleDateString()}</p></div>
                <div className="flex gap-2 items-start">
                  <button className="btn-primary text-xs" disabled={busy === q.id} onClick={() => decide(q.id, 'approve')}>Verify &amp; publish</button>
                  <button className="btn-outline text-xs" disabled={busy === q.id} onClick={() => decide(q.id, 'reject')}>Reject</button>
                </div>
              </div>
              <p className="text-sm text-ink-mid mt-2">{q.summary}</p>
              <div className="grid md:grid-cols-2 gap-4 mt-3 text-xs text-ink-mid">
                <div><p className="font-medium text-ink mb-1">Public details</p><p>Phone {q.phone} · Email {q.email}</p><p>Website {q.website || 'none'}{q.address ? ` · ${q.address}` : ''}</p></div>
                <div><p className="font-medium text-ink mb-1">Private (for verification)</p><p>{q.contactPerson} {q.contactPersonPhone && `· ${q.contactPersonPhone}`}</p><p>{q.credentialKind ? `${q.credentialKind}: ${q.credentialNumber}` : 'No credential given'}</p></div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {yn(q.emailVerified, q.emailVerified ? 'email link confirmed' : (q.emailSent ? 'email link not clicked yet' : 'email could not be sent'))}
                {q.website ? yn(q.site?.ok, q.site?.ok ? `website OK (${q.site.status})` : `website problem (${q.site?.status ?? 0})`) : badge('no website', 'mute')}
                {q.website && q.site?.ok && !q.site.sameHost && badge(`redirects to ${q.site.finalHost}`, 'warn')}
                {q.website && q.emailMatchesSite && badge('email domain matches website', 'ok')}
                {q.duplicates.length > 0 && badge(`possible duplicate: ${q.duplicates.join(', ')}`, 'bad')}
              </div>
              {q.flags.length > 0 && <ul className="list-disc pl-5 mt-2 text-sm text-red-700">{q.flags.map((f: string) => <li key={f}>Check: {f}</li>)}</ul>}
              <fieldset className="mt-3 border border-accent/30 p-3 text-sm space-y-1">
                <legend className="px-1 text-xs uppercase tracking-wider text-ink-mid">What you verified yourself</legend>
                <label className="flex gap-2"><input type="checkbox" onChange={e => setC(q.id, 'phone', e.target.checked)} /> I called or messaged the business phone and spoke to the business</label>
                {q.needsCredential && <label className="flex gap-2"><input type="checkbox" onChange={e => setC(q.id, 'credential', e.target.checked)} /> I checked the registration or licence against the official register</label>}
                {!q.emailVerified && <label className="flex gap-2"><input type="checkbox" onChange={e => setC(q.id, 'emailManual', e.target.checked)} /> The email is verified by other means (e.g. they replied to me from it)</label>}
              </fieldset>
            </div>))}</div>
        </section>

        <section>
          <h2 className="font-serif text-xl mb-3">Reports ({data.reports.length})</h2>
          {!data.reports.length && <p className="text-sm text-ink-mid">No open reports.</p>}
          <div className="space-y-3">{data.reports.map((r: Json) => (
            <div key={r.id} className="card !p-4 flex flex-wrap justify-between gap-3">
              <div><p className="text-sm"><span className="font-medium text-ink">{r.providerName}</span> {badge(r.reason, 'warn')}</p><p className="text-sm text-ink-mid whitespace-pre-wrap mt-1">{r.details}</p>{r.contactEmail && <p className="text-xs text-ink-mid mt-1">Reporter: {r.contactEmail}</p>}</div>
              <button className="btn-outline text-xs self-start" onClick={async () => { await api('prov_report_done', { id: r.id }); say('Closed. The reporter\'s details were deleted.'); reload() }}>Close report</button>
            </div>))}</div>
        </section>

        <section>
          <h2 className="font-serif text-xl mb-3">Listings ({data.live.length})</h2>
          {!data.live.length && <p className="text-sm text-ink-mid">No listings yet.</p>}
          <div className="space-y-3">{data.live.map((l: Json) => (
            <div key={l.id} className="card !p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm"><span className="font-medium text-ink">{l.name}</span> <span className="text-ink-mid">{l.typeLabel} · {l.districts.join(', ')}</span> {badge(l.status, l.status === 'approved' ? 'ok' : 'warn')} {l.due && badge(`re-verify by ${l.reverifyBy}`, 'warn')} {l.sponsored && badge(`sponsored ${l.sponsored.from} to ${l.sponsored.until}`, 'ok')}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-outline text-xs" disabled={busy === l.id} onClick={() => status(l.id, 'reverified')}>Re-verify</button>
                  {l.sponsorable && l.status === 'approved' && (l.sponsored
                    ? <button className="btn-outline text-xs" onClick={() => sponsor(l.id, true)}>End sponsorship</button>
                    : <button className="btn-outline text-xs" onClick={() => setOpenAd(openAd === l.id ? '' : l.id)}>Sponsor…</button>)}
                  {l.status === 'approved' ? <button className="btn-outline text-xs" onClick={() => status(l.id, 'suspended')}>Suspend</button> : <button className="btn-outline text-xs" onClick={() => status(l.id, 'approved')}>Restore</button>}
                  <button className="btn-outline text-xs" onClick={() => status(l.id, 'removed')}>Remove</button>
                </div>
              </div>
              {!l.sponsorable && <p className="text-xs text-ink-mid mt-1">This type cannot be advertised (health-related).</p>}
              {openAd === l.id && (
                <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                  <label className="md:col-span-2">Headline (5–60 characters)<input className={inp} maxLength={60} onChange={e => setAd(a => ({ ...a, [l.id]: { ...(a[l.id] || {}), headline: e.target.value } }))} /></label>
                  <label className="md:col-span-2">One line (15–140 characters, no links)<input className={inp} maxLength={140} onChange={e => setAd(a => ({ ...a, [l.id]: { ...(a[l.id] || {}), line: e.target.value } }))} /></label>
                  <label>From<input type="date" defaultValue={today} className={inp} onChange={e => setAd(a => ({ ...a, [l.id]: { ...(a[l.id] || {}), from: e.target.value } }))} /></label>
                  <label>Until (max 90 days, before {l.reverifyBy})<input type="date" className={inp} onChange={e => setAd(a => ({ ...a, [l.id]: { ...(a[l.id] || {}), until: e.target.value } }))} /></label>
                  <button className="btn-primary text-xs md:col-span-2 justify-self-start" disabled={busy === l.id} onClick={() => sponsor(l.id)}>Start sponsorship</button>
                </div>)}
            </div>))}</div>
        </section>
      </>}
    </div>
  )
}

function Prs({ say }: { say: (t: string, bad?: boolean) => void }) {
  const { data, err, reload } = useLoad('prs'); const [busy, setBusy] = useState(0)
  const tone = (c: string) => c === 'passed' ? 'ok' : c === 'failed' ? 'bad' : 'warn'
  async function act(a: 'merge_pr' | 'close_pr', n: number) {
    if (a === 'merge_pr' && !window.confirm(`Merge #${n}? This publishes to the live site.`)) return
    setBusy(n); const r = await api(a, { number: n }); setBusy(0)
    say(r.ok ? (r.data.message || 'Done.') : r.data.error, !r.ok); reload()
  }
  return (
    <div className="space-y-3">
      {err && <p className="text-red-700 text-sm">{err}</p>}{!data && !err && <p className="text-ink-mid">Loading…</p>}
      {data && !data.prs.length && <p className="text-ink-mid text-sm">No open pull requests.</p>}
      {(data?.prs || []).map((p: Json) => (
        <div key={p.number} className="card !p-5 flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-serif text-lg text-ink">#{p.number} {p.title}</h3><p className="text-xs text-ink-mid">{p.by} · {p.branch} · {p.files} file(s)</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {badge(p.checks === 'needs_approval' ? 'checks need approval on GitHub' : `checks ${p.checks}`, tone(p.checks))}
            {p.mergeable === false && badge('conflict', 'bad')}
            <a className="btn-outline text-xs" href={p.url} target="_blank" rel="noopener noreferrer">View on GitHub</a>
            <button className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed" disabled={busy === p.number || p.checks !== 'passed' || p.mergeable === false || p.draft} onClick={() => act('merge_pr', p.number)}>Merge</button>
            <button className="btn-outline text-xs" disabled={busy === p.number} onClick={() => act('close_pr', p.number)}>Close</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function Stories({ say }: { say: (t: string, bad?: boolean) => void }) {
  const { data, err, reload } = useLoad('stories')
  async function decide(n: number, decision: 'approve' | 'reject') { const r = await api('story_decision', { number: n, decision }); say(r.ok ? r.data.message : r.data.error, !r.ok); reload() }
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-mid">Visitor text is shown as plain text. Check photos on GitHub before approving.</p>
      {err && <p className="text-red-700 text-sm">{err}</p>}{!data && !err && <p className="text-ink-mid">Loading…</p>}
      {data && !data.stories.length && <p className="text-ink-mid text-sm">No stories waiting.</p>}
      {(data?.stories || []).map((s: Json) => (
        <div key={s.number} className="card !p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h3 className="font-serif text-lg text-ink">#{s.number} {s.title}</h3>
            <div className="flex gap-2 items-center">
              {s.approved ? badge('approved, PR pending', 'ok') : <>
                <button className="btn-primary text-xs" onClick={() => decide(s.number, 'approve')}>Approve</button>
                <button className="btn-outline text-xs" onClick={() => decide(s.number, 'reject')}>Reject</button></>}
              <a className="underline text-primary text-xs" href={s.url} target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-ink-mid font-sans">{s.body}</pre>
        </div>
      ))}
    </div>
  )
}

function Agents({ say }: { say: (t: string, bad?: boolean) => void }) {
  const [f, setF] = useState({ command: 'pipeline', max: '3', budget: '5', slugs: '' }); const [im, setIm] = useState({ slug: '', force: false })
  const run = async (workflow: string, inputs: Json) => { const r = await api('run_workflow', { workflow, inputs }); say(r.ok ? r.data.message : r.data.error, !r.ok) }
  const inp = 'border border-accent/30 px-3 py-2 w-full text-sm'
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="font-serif text-xl mb-1">Content agents</h2>
        <p className="text-sm text-ink-mid mb-4">Scout, Enricher and Verifier draft new guides. Output arrives as a pull request. Costs real money per run; the budget is a hard cap.</p>
        <label className="text-sm block mb-1" htmlFor="cmd">What to run</label>
        <select id="cmd" className={inp + ' mb-3'} value={f.command} onChange={e => setF({ ...f, command: e.target.value })}>{['pipeline', 'scout', 'enrich', 'verify'].map(c => <option key={c}>{c}</option>)}</select>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="text-sm block mb-1" htmlFor="max">Max entries (1–10)</label><input id="max" className={inp} value={f.max} onChange={e => setF({ ...f, max: e.target.value })} /></div>
          <div><label className="text-sm block mb-1" htmlFor="bud">Budget cap, USD (1–20)</label><input id="bud" className={inp} value={f.budget} onChange={e => setF({ ...f, budget: e.target.value })} /></div>
        </div>
        {f.command === 'verify' && <><label className="text-sm block mb-1" htmlFor="sl">Slugs to verify (comma-separated, blank = all drafts)</label><input id="sl" className={inp + ' mb-3'} value={f.slugs} onChange={e => setF({ ...f, slugs: e.target.value })} /></>}
        <button className="btn-primary text-xs" onClick={() => run('content-agents', f)}>Start agents</button>
      </div>
      <div className="space-y-6">
        <div className="card">
          <h2 className="font-serif text-xl mb-1">Find licensed images</h2>
          <p className="text-sm text-ink-mid mb-4">Searches Wikimedia Commons for open-licence photos and opens a pull request. Check each photo before merging.</p>
          <label className="text-sm block mb-1" htmlFor="is">Entry slug (blank = all entries with fewer than 2 images)</label>
          <input id="is" className={inp + ' mb-3'} value={im.slug} onChange={e => setIm({ ...im, slug: e.target.value })} />
          <label className="text-sm flex gap-2 mb-3"><input type="checkbox" checked={im.force} onChange={e => setIm({ ...im, force: e.target.checked })} /> Replace existing images</label>
          <button className="btn-primary text-xs" onClick={() => run('fetch-images', im)}>Find images</button>
        </div>
        <div className="card">
          <h2 className="font-serif text-xl mb-1">Check official links</h2>
          <p className="text-sm text-ink-mid mb-4">Tests the official KTDC, Kerala Tourism and railway links used in guides.</p>
          <button className="btn-outline text-xs" onClick={() => run('link-check', {})}>Run link check</button>
        </div>
      </div>
    </div>
  )
}

function Activity() {
  const { data, err } = useLoad('activity')
  return (
    <div className="card">
      <h2 className="font-serif text-xl mb-3">Recent admin activity</h2>
      {err && <p className="text-red-700 text-sm">{err}</p>}
      <table className="w-full text-sm"><tbody>{(data?.events || []).map((e: Json, i: number) => (
        <tr key={i} className="border-t border-accent/10 align-top"><td className="py-1.5 pr-3 text-ink-mid whitespace-nowrap">{e.t ? new Date(e.t).toLocaleString() : ''}</td><td className="pr-3 font-medium">{e.e}</td><td className="text-ink-mid break-all">{[e.entry, e.pr && `#${e.pr}`, e.issue && `#${e.issue}`, e.workflow, e.to, e.ip].filter(Boolean).join(' · ')}</td></tr>
      ))}</tbody></table>
    </div>
  )
}
