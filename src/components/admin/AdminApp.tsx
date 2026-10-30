'use client'

import { useCallback, useEffect, useState } from 'react'

// Explicit file name: a folder URL only works if the server's DirectoryIndex lists index.php.
const API = '/api/admin/index.php'
type Json = Record<string, any>
type Tab = 'overview' | 'review' | 'drafts' | 'market' | 'providers' | 'prs' | 'stories' | 'agents' | 'activity'
const TABS: [Tab, string][] = [['overview', 'Overview'], ['review', 'Review agent work'], ['drafts', 'Drafts'], ['market', 'Marketplace'], ['providers', 'Directory'], ['prs', 'Pull requests'], ['stories', 'Stories'], ['agents', 'Run agents'], ['activity', 'Activity']]

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
  const [code, setCode] = useState(0)
  const [missing, setMissing] = useState<string[]>([])
  const [where, setWhere] = useState<Where | null>(null)

  const load = useCallback(async () => {
    const r = await api('status')
    if (!r.ok) { setErr(r.data.error || ''); setCode(r.status); setPhase('error'); return }
    if (r.data.configError) { setErr(`The file vh-config.php has a typing mistake near line ${r.data.configError}. Open it in Hostinger File Manager and compare it with docs/ADMIN.md: every line ends with a comma, text is inside single quotes, and the file starts with <?php return [ and ends with ];`); setCode(200); setPhase('error'); return }
    if (!r.data.configured) { setMissing(r.data.missing || []); setWhere(r.data.config || null); setPhase('setup'); return }
    if (r.data.authed) { csrf = r.data.csrf; setPhase('app') } else setPhase('login')
  }, [])
  useEffect(() => { load() }, [load])

  const say = (text: string, bad = false) => setMsg({ text, bad })

  if (phase === 'loading') return <p className="text-ink-mid">Loading…</p>
  if (phase === 'error') return (
    <div className="card space-y-3">
      <h1 className="font-serif text-2xl">Admin unavailable</h1>
      <p className="text-ink-mid text-sm">{err || 'The admin service did not answer correctly.'}{code ? ` (server said ${code})` : ''}</p>
      <div className="text-sm text-ink-mid">
        <p className="font-medium text-ink mb-1">How to find the cause (about 2 minutes)</p>
        <p>Open <a className="underline text-primary" href="/api/admin/index.php?a=status">/api/admin/index.php?a=status</a> in a new tab. You should see a short line of text starting with <code>{'{"authed"'}</code>.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><strong>Not found (404):</strong> the latest deploy has not reached Hostinger yet. Wait a few minutes, then check hPanel → Git shows a green deploy.</li>
          <li><strong>Forbidden (403):</strong> the site&apos;s .htaccess is out of date. Deploy again.</li>
          <li><strong>Blank page or &quot;error 500&quot;:</strong> usually a typing mistake in <code>vh-config.php</code>, or PHP older than 7.4. Check the file, and the PHP version under hPanel → Advanced → PHP Configuration.</li>
        </ul>
      </div>
    </div>
  )
  if (phase === 'setup') return <Setup missing={missing} where={where} />
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
      {tab === 'review' && <Review say={say} />}
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

interface Diag { phpOk: boolean; dirExists: boolean; dirReadable: boolean; openBasedirSet: boolean; openBasedirCoversDir: boolean | null; similarFile: string | null; fileInWebFolder: boolean; fileOneLevelTooHigh: boolean; privateFolderReady?: boolean; entryCount?: number | null; vhNames?: string[] }
interface Where { found: boolean; looked: string[]; diag?: Diag }

/** Plain-language reason the settings file was not found, most specific first. */
function whyNotFound(w: Where): string[] {
  const d = w.diag, target = w.looked[0]
  if (!d) return []
  const r: string[] = []
  if (!d.phpOk) r.push('This server runs PHP older than 7.4. In hPanel go to Advanced → PHP Configuration and choose 8.1 or newer.')
  if (d.fileInWebFolder) r.push('A vh-config.php sits inside public_html. That is the wrong place (the web folder is public and the file is never read from there). Move it up one level, into the folder that contains public_html.')
  if (d.fileOneLevelTooHigh) r.push(`A vh-config.php sits one folder too high. Move it down into ${target.replace('/vh-config.php', '')}.`)
  if (d.vhNames && d.vhNames.length && !d.similarFile) r.push(`The server sees these names starting with "vh" in that folder: ${d.vhNames.join(', ')}. If one looks like vh-config.php but has \\u{...} codes in it, the name contains a hidden or look-alike character: delete that file and create a new one by typing the name yourself.`)
  if (d.similarFile) r.push(`There is a file named "${d.similarFile}". Rename it to exactly vh-config.php (no .txt, no spaces, a hyphen not an underscore).`)
  if (d.openBasedirSet && d.openBasedirCoversDir === false) r.push('This host blocks PHP from reading above public_html (open_basedir). Easiest fix: move vh-config.php into the protected folder public_html/api/private/ (visitors cannot open anything in it), then reload this page. Alternatively widen open_basedir under hPanel → Advanced → PHP Configuration.')
  else if (!d.dirReadable && d.dirExists) r.push('The folder exists but the server is not allowed to read it. Move vh-config.php into the protected folder public_html/api/private/ and reload, or check the folder permissions in File Manager (755 for folders).')
  else if (!d.dirExists && !d.openBasedirSet) r.push('That folder does not exist on the server. Check the domain folder name in File Manager.')
  else if (!d.dirExists && d.openBasedirCoversDir !== false) r.push('The server cannot see that folder (it may not exist, or it may be blocked). Compare the path with File Manager.')
  if (!r.length) r.push(`The folder is readable but contains no file named vh-config.php. Create it there: ${target}.`)
  if (d.openBasedirSet && !d.dirReadable && !d.privateFolderReady) r.push('The protected folder public_html/api/private/ is not on the server yet; it arrives with the next deploy.')
  return r
}

function Setup({ missing, where }: { missing: string[]; where: Where | null }) {
  const [pw, setPw] = useState(''); const [hash, setHash] = useState(''); const [e, setE] = useState('')
  const needsHash = missing.includes('admin_password_hash')
  const items: [string, string][] = [['repo', "'repo' (the GitHub repository name)"], ['admin_github_token', "'admin_github_token' (the GitHub token)"], ['admin_password_hash', "'admin_password_hash' (your password code)"]]
  return (
    <div className="card max-w-xl space-y-4">
      <h1 className="font-serif text-2xl">Admin setup</h1>
      <p className="text-sm text-ink-mid">The admin service is running, but <code>vh-config.php</code> on the server is still missing some settings. All three must be present before you can log in. Steps are in <strong>docs/ADMIN.md</strong>.</p>
      {where && (
        <div className={`text-sm border px-3 py-2 ${where.found ? 'border-primary/30 bg-primary/10' : 'border-red-300 bg-red-50 text-red-800'}`}>
          {where.found ? '✔ The server found vh-config.php.' : '✖ The server cannot find vh-config.php.'}
          {!where.found && <> It looks for the file at <code>{where.looked[0]}</code>, in the folder that also contains <code>public_html</code>.</>}
          {!where.found && <ul className="list-disc pl-5 mt-2 space-y-1">{whyNotFound(where).map(t => <li key={t}>{t}</li>)}</ul>}
        </div>
      )}
      <ul className="text-sm space-y-1">{items.map(([k, l]) => <li key={k}>{missing.includes(k) ? '✖' : '✔'} <span className={missing.includes(k) ? 'text-ink' : 'text-ink-mid'}>{l}</span></li>)}</ul>
      {needsHash && !hash && (
        <form onSubmit={async ev => { ev.preventDefault(); setE(''); const r = await api('setup', { password: pw }); if (r.ok) setHash(r.data.hash); else setE(r.data.error || 'Failed') }}>
          <p className="text-sm text-ink-mid mb-2">Make your password code here. The password itself is never stored.</p>
          <label className="block text-sm mb-1" htmlFor="pw">Choose a passphrase (14+ characters)</label>
          <input id="pw" type="password" autoComplete="new-password" value={pw} onChange={x => setPw(x.target.value)} className="w-full border border-accent/30 px-3 py-2 mb-3" />
          <button className="btn-primary text-xs" disabled={pw.length < 14}>Make my code</button>
        </form>
      )}
      {e && <p className="text-sm text-red-700">{e}</p>}
      {hash && <><p className="text-sm">Copy this whole line into <code>vh-config.php</code> as <code>admin_password_hash</code>, then reload this page:</p><textarea readOnly rows={3} className="w-full border border-accent/30 p-2 text-xs font-mono" value={hash} onFocus={x => x.currentTarget.select()} /></>}
      {!needsHash && <p className="text-sm text-ink-mid">Your password code is in place. Add the items marked ✖, save the file, then reload this page.</p>}
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
        {tile(d?.drafts, 'Drafts waiting', 'drafts')}{tile('→', 'Review agent work', 'review')}{tile(d?.approved, 'Published guides', 'drafts')}{tile(d?.openPrs, 'Open pull requests', 'prs')}{tile(d?.stories, 'Stories to review', 'stories')}{tile(mk.data ? mk.data.pending.length + mk.data.enquiries.length : undefined, 'Marketplace to review', 'market')}{tile(pv.data ? pv.data.queue.length + pv.data.reports.length : undefined, 'Directory to review', 'providers')}
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

/** Pick a photo you took, type the credit, attach it to a guide. The browser shrinks and re-encodes it (no GPS or camera data survives). */
function PhotoUpload({ category, slug, number, say, onDone }: { category: string; slug: string; number?: number; say: (t: string, bad?: boolean) => void; onDone: () => void }) {
  const [open, setOpen] = useState(false); const [file, setFile] = useState<File | null>(null); const [credit, setCredit] = useState(''); const [alt, setAlt] = useState(''); const [busy, setBusy] = useState(false)
  async function shrink(f: File): Promise<string> {
    const bmp = await createImageBitmap(f); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k)
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height)
    return cv.toDataURL('image/jpeg', 0.85)
  }
  async function send() {
    if (!file) return say('Choose a picture first.', true)
    setBusy(true)
    try {
      const image = await shrink(file)
      const r = await api('photo_upload', { category, slug, number, image, credit, alt })
      say(r.ok ? r.data.message : r.data.error, !r.ok)
      if (r.ok) { setOpen(false); setFile(null); setCredit(''); setAlt(''); onDone() }
    } catch { say('That file could not be read as a picture. Try a JPEG or PNG.', true) }
    setBusy(false)
  }
  if (!open) return <button className="btn-outline text-xs" onClick={() => setOpen(true)}>Upload your own photo</button>
  const inp = 'border border-accent/30 px-2 py-1 text-sm w-full'
  return (
    <div className="mt-2 p-3 border border-accent/30 space-y-2 w-full text-sm">
      <label className="block">Picture you took<input type="file" accept="image/jpeg,image/png" className="block mt-1" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <label className="block">Credit (shown under the photo, e.g. &quot;Photo: Your Name&quot;)<input className={inp} value={credit} maxLength={120} onChange={e => setCredit(e.target.value)} /></label>
      <label className="block">What it shows (for screen readers)<input className={inp} value={alt} maxLength={200} onChange={e => setAlt(e.target.value)} /></label>
      <div className="flex gap-2"><button className="btn-primary text-xs disabled:opacity-40" disabled={busy || !file || credit.trim().length < 2 || alt.trim().length < 5} onClick={send}>{busy ? 'Uploading…' : 'Attach photo'}</button><button className="btn-outline text-xs" onClick={() => setOpen(false)}>Cancel</button></div>
    </div>
  )
}

function Review({ say }: { say: (t: string, bad?: boolean) => void }) {
  const list = useLoad('review_list'); const [open, setOpen] = useState(0)
  return (
    <div className="space-y-4">
      <div className="card !p-5 text-sm text-ink-mid">
        <h2 className="font-serif text-xl text-ink mb-2">What you are approving</h2>
        <p>Each agent run proposes new or improved <strong>Discover Kerala pages</strong>. Nothing is public until you publish it. For every page below you see what it is, its photos, its sources and the fact-checker&apos;s verdict. Tick the pages you are happy with, then press <strong>one button</strong>: the chosen pages are published and the whole batch goes live in a single update. Pages you leave unticked stay as drafts.</p>
      </div>
      {list.err && <p className="text-red-700 text-sm">{list.err}</p>}{!list.data && !list.err && <p className="text-ink-mid">Loading…</p>}
      {list.data && !list.data.prs.length && <p className="text-ink-mid text-sm">No agent batches waiting. Start one under <strong>Run agents</strong>.</p>}
      {(list.data?.prs || []).map((p: Json) => (
        <div key={p.number}>
          <button onClick={() => setOpen(open === p.number ? 0 : p.number)} className="card !p-4 w-full text-left flex justify-between items-center" aria-expanded={open === p.number}>
            <span><span className="font-serif text-lg text-ink">{p.title}</span><span className="block text-xs text-ink-mid">Batch #{p.number} · {p.branch}</span></span>
            <span className="text-primary text-sm">{open === p.number ? 'Hide' : 'Review'}</span>
          </button>
          {open === p.number && <Batch number={p.number} say={say} done={() => { setOpen(0); list.reload() }} />}
        </div>
      ))}
    </div>
  )
}

function Batch({ number, say, done }: { number: number; say: (t: string, bad?: boolean) => void; done: () => void }) {
  const { data, err, reload } = useLoad('review_pr', `&number=${number}`)
  const [pick, setPick] = useState<Record<string, boolean>>({}); const [init, setInit] = useState(false); const [step, setStep] = useState(''); const [more, setMore] = useState('')
  const cards: Json[] = data?.cards || []
  const key = (c: Json) => `${c.category}/${c.slug}`
  const ready = (c: Json) => !c.live && c.blockers.length === 0
  useEffect(() => { if (data && !init) { setPick(Object.fromEntries(cards.filter(c => ready(c) && (!c.verifier || c.verifier.ready)).map(c => [key(c), true]))); setInit(true) } }, [data, init]) // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = cards.filter(c => pick[key(c)])
  async function go(override: string[] = []) {
    setStep('Saving your choices…')
    const r = await api('review_apply', { number, head: data?.head, override, publish: chosen.map(c => ({ category: c.category, slug: c.slug })) })
    if (!r.ok) {
      setStep('')
      if (r.status === 409 && r.data.needsOverride) {
        const lines = (r.data.gated || []).map((g: Json) => `${g.name}: ${(g.gates || []).join('; ')}`).join('\n\n')
        if (window.confirm(`The fact-checker flagged:\n\n${lines}\n\nPublish these anyway? Check the facts against the sources first.`)) return go((r.data.gated || []).map((g: Json) => g.slug))
        return
      }
      say([r.data.error, ...(r.data.blockers || [])].filter(Boolean).join(' · '), true); if (r.data.stale) reload(); return
    }
    for (let i = 0; i < 40; i++) {
      setStep(r.data.committed ? 'Waiting for the safety checks to pass…' : 'Checking the batch…')
      await new Promise(res => setTimeout(res, i === 0 ? 4000 : 8000))
      const q = await api('review_pr', undefined, `&number=${number}`)
      if (!q.ok) continue
      if (q.data.checks === 'failed') { setStep(''); say('The safety checks failed. Open the pull request on GitHub to see why. Nothing was published.', true); return }
      if (q.data.checks === 'needs_approval') { setStep(''); say('GitHub wants you to approve the checks first. Open the pull request and press "Approve and run".', true); return }
      if (q.data.checks === 'passed') {
        setStep('Publishing…')
        const m = await api('merge_pr', { number }); setStep('')
        say(m.ok ? `Done. ${r.data.published} page(s) published; the site updates in a few minutes.` : m.data.error, !m.ok); if (m.ok) done(); return
      }
    }
    setStep(''); say('The checks are taking long. Come back and press the button again, or merge under Pull requests.', true)
  }
  return (
    <div className="mt-3 space-y-3">
      {err && <p className="text-red-700 text-sm">{err}</p>}{!data && !err && <p className="text-ink-mid">Loading…</p>}
      {data && <p className="text-sm text-ink-mid">{cards.length} page(s) · {data.photoFiles} photo file(s) · safety checks: <strong>{data.checks}</strong>{data.mergeable === false && ' · conflict with main'} · <a className="underline text-primary" href={data.url} target="_blank" rel="noopener noreferrer">view on GitHub</a></p>}
      {(data?.events || []).length > 0 && (
        <div className="card !p-5">
          <h3 className="font-serif text-lg text-ink">Events calendar: {data?.events.length} new event(s)</h3>
          <p className="text-sm text-ink-mid mb-3">These appear on the Events page under This week, This month and The year ahead. Each date comes from a page the agent retrieved. Open the link to check it.</p>
          <ul className="space-y-3 text-sm">{data?.events.map((e: Json, i: number) => (
            <li key={i}><strong>{e.name}</strong> · {e.start === e.end ? e.start : `${e.start} to ${e.end}`} · {e.place}, {e.district} · {e.certainty === 'confirmed' ? badge('dates published', 'ok') : badge('usual dates, unconfirmed', 'warn')}
              <span className="block text-ink-mid">{e.summary}</span>
              <span className="block">{e.sources.map((s: Json, k: number) => <a key={k} className="underline text-primary mr-3 text-xs" href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}</span></li>))}</ul>
        </div>
      )}
      {cards.map(c => (
        <div key={key(c)} className="card !p-5">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1.5 h-4 w-4" checked={!!pick[key(c)]} disabled={!ready(c) || !!step} onChange={e => setPick({ ...pick, [key(c)]: e.target.checked })} aria-label={`Publish ${c.name}`} />
            <span className="flex-1">
              <span className="font-serif text-lg text-ink">{c.name}</span>
              <span className="block text-xs text-ink-mid">{c.category} · {c.district} · {c.change}</span>
            </span>
            {c.live ? badge('already live, edit only', 'warn') : c.blockers.length ? badge('not ready', 'bad') : c.verifier && !c.verifier.ready ? badge('check the facts', 'warn') : badge('ready to publish', 'ok')}
          </label>
          {c.images.length > 0 && <div className="flex gap-2 mt-3 overflow-x-auto">{c.images.map((im: Json, i: number) => <figure key={i} className="shrink-0"><img src={im.url} alt={im.alt} className="h-28 w-40 object-cover border border-accent/30" /><figcaption className="text-[11px] text-ink-mid max-w-[10rem]">{im.credit} · {im.license}</figcaption></figure>)}</div>}
          <div className="mt-3"><PhotoUpload category={c.category} slug={c.slug} number={number} say={say} onDone={() => { setInit(false); reload() }} /></div>
          <p className="text-sm text-ink mt-3">{c.summary}</p>
          <button className="text-xs text-primary underline mt-2" onClick={() => setMore(more === key(c) ? '' : key(c))}>{more === key(c) ? 'Hide detail' : 'Read more, sources and fact-check'}</button>
          {more === key(c) && <div className="mt-3 space-y-3 text-sm text-ink-mid">
            {c.about && <p><strong>History:</strong> {c.about}</p>}
            {c.tradition && <p><strong>Tradition and folklore (told as tradition, not fact):</strong> {c.tradition}</p>}
            {c.meaning && <p><strong>Spiritual meaning:</strong> {c.meaning}</p>}
            <div><strong>Sources:</strong><ul className="list-disc pl-5">{c.sources.map((s: Json) => <li key={s.url}><a className="underline text-primary" href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul></div>
            {c.verifier ? <div><strong>Fact-check:</strong> score {c.verifier.score ?? '?'}. {c.verifier.facts}{c.verifier.gates.length > 0 && <ul className="list-disc pl-5 text-amber-800">{c.verifier.gates.map((g: string) => <li key={g}>{g}</li>)}</ul>}{c.verifier.notes.length > 0 && <ul className="list-disc pl-5">{c.verifier.notes.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>}</div> : <p><strong>Fact-check:</strong> none recorded for this page.</p>}
          </div>}
          {c.blockers.length > 0 && <ul className="list-disc pl-5 mt-3 text-sm text-amber-800">{c.blockers.map((b: string) => <li key={b}>{b}</li>)}</ul>}
        </div>
      ))}
      {data && <div className="sticky bottom-0 bg-white/95 border-t border-accent/20 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-mid">{step || (chosen.length ? `${chosen.length} page(s) will be published; the rest stay as drafts.` : (data.events || []).length ? 'Nothing ticked: only the events calendar update is merged.' : 'Nothing ticked: the batch is saved as drafts, nothing goes public.')}</p>
        <button className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed" disabled={!!step || data.mergeable === false || data.checks === 'failed'} onClick={() => { if (window.confirm(chosen.length ? `Publish ${chosen.length} page(s) and update the live site?` : 'Save this batch as drafts? Nothing becomes public.')) go() }}>{chosen.length ? `Publish ${chosen.length} & finish batch` : (data.events || []).length ? 'Merge events calendar' : 'Save batch as drafts'}</button>
      </div>}
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
                        <PhotoUpload category={e.category} slug={e.slug} say={say} onDone={reload} />
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

const PROVIDERS: [string, string][] = [['auto', 'Automatic (cheapest with a key)'], ['xai', 'xAI (Grok)'], ['openai', 'OpenAI'], ['anthropic', 'Anthropic (Claude)']]
const VERIFIERS: [string, string][] = [['auto', 'A different vendor from the writer (recommended)'], ['xai', 'xAI (Grok)'], ['openai', 'OpenAI'], ['anthropic', 'Anthropic (Claude)']]

function Agents({ say }: { say: (t: string, bad?: boolean) => void }) {
  const st = useLoad('agent_settings')
  const [f, setF] = useState({ command: 'pipeline', max: '3', budget: '5', slugs: '', provider: 'saved', verifier: 'saved' }); const [im, setIm] = useState({ slug: '', force: false })
  const [saved, setSaved] = useState({ provider: 'auto', verifierProvider: 'auto' }); const [dirty, setDirty] = useState(false)
  useEffect(() => { if (st.data) { setSaved({ provider: st.data.provider, verifierProvider: st.data.verifierProvider }); setDirty(false) } }, [st.data])
  const run = async (workflow: string, inputs: Json) => { const r = await api('run_workflow', { workflow, inputs }); say(r.ok ? r.data.message : r.data.error, !r.ok) }
  const save = async () => { const r = await api('agent_settings_save', saved); say(r.ok ? r.data.message : r.data.error, !r.ok); if (r.ok) st.reload() }
  const inp = 'border border-accent/30 px-3 py-2 w-full text-sm bg-white'
  const keys = st.data?.keys as Record<string, boolean> | null | undefined
  const label = (k: string) => (PROVIDERS.find(p => p[0] === k) || [k, k])[1]
  const effective = saved.provider === 'auto' ? 'the cheapest provider that has a key' : label(saved.provider)
  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-serif text-xl mb-1">Which AI do the agents use?</h2>
        <p className="text-sm text-ink-mid mb-4">This default applies to the scheduled runs (Sunday and Wednesday) and to manual runs unless you pick another provider below. It is saved in the repository and takes effect on the next run.</p>
        {st.err && <p className="text-red-700 text-sm">{st.err}</p>}
        <div className="grid md:grid-cols-2 gap-4 mb-3">
          <label className="text-sm">Research and writing (Scout and Enricher)
            <select className={inp + ' mt-1'} value={saved.provider} onChange={e => { setSaved({ ...saved, provider: e.target.value }); setDirty(true) }}>{PROVIDERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-sm">Fact-checking (Verifier)
            <select className={inp + ' mt-1'} value={saved.verifierProvider} onChange={e => { setSaved({ ...saved, verifierProvider: e.target.value }); setDirty(true) }}>{VERIFIERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed" disabled={!dirty} onClick={save}>Save default</button>
          <span className="text-xs text-ink-mid">Writers use {effective}.</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center text-xs">
          {keys ? (['xai', 'openai', 'anthropic'] as const).map(k => <span key={k}>{badge(`${label(k).split(' ')[0]} key ${keys[k] ? 'set' : 'missing'}`, keys[k] ? 'ok' : 'bad')}</span>)
            : <span className="text-ink-mid">Key status is unknown to this page. Add <em>Secrets: Read</em> to the admin token to show it, or check GitHub → Settings → Secrets.</span>}
        </div>
        {st.data?.lastRun && <p className="text-xs text-ink-mid mt-3">Last run: {st.data.lastRun}</p>}
        <p className="text-xs text-ink-mid mt-2">A provider with no key fails immediately with a clear message, before any money is spent.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="font-serif text-xl mb-1">Run the content agents now</h2>
        <p className="text-sm text-ink-mid mb-4">Scout, Enricher and Verifier draft new guides, then fetch licensed photos. Output arrives as a pull request. Each run costs real money; the budget is a hard cap.</p>
        <label className="text-sm block mb-1" htmlFor="cmd">What to run</label>
        <select id="cmd" className={inp + ' mb-3'} value={f.command} onChange={e => setF({ ...f, command: e.target.value })}>{['pipeline', 'scout', 'enrich', 'verify'].map(c => <option key={c}>{c}</option>)}</select>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="text-sm block mb-1" htmlFor="max">Max entries (1–10)</label><input id="max" className={inp} value={f.max} onChange={e => setF({ ...f, max: e.target.value })} /></div>
          <div><label className="text-sm block mb-1" htmlFor="bud">Budget cap, USD (1–20)</label><input id="bud" className={inp} value={f.budget} onChange={e => setF({ ...f, budget: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="text-sm block mb-1" htmlFor="rp">AI for this run (writing)</label><select id="rp" className={inp} value={f.provider} onChange={e => setF({ ...f, provider: e.target.value })}><option value="saved">Saved default</option>{PROVIDERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label className="text-sm block mb-1" htmlFor="rv">AI for this run (checking)</label><select id="rv" className={inp} value={f.verifier} onChange={e => setF({ ...f, verifier: e.target.value })}><option value="saved">Saved default</option>{VERIFIERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        </div>
        {f.command === 'verify' && <><label className="text-sm block mb-1" htmlFor="sl">Slugs to verify (comma-separated, blank = all drafts)</label><input id="sl" className={inp + ' mb-3'} value={f.slugs} onChange={e => setF({ ...f, slugs: e.target.value })} /></>}
        <button className="btn-primary text-xs" onClick={() => run('content-agents', f)}>Start agents</button>
      </div>
      <div className="space-y-6">
        <div className="card">
          <h2 className="font-serif text-xl mb-1">Find licensed images</h2>
          <p className="text-sm text-ink-mid mb-4">Searches Wikimedia Commons for open-licence photos and opens a pull request. Check each photo before merging. The agents run does this automatically for new drafts.</p>
          <label className="text-sm block mb-1" htmlFor="is">Entry slug (blank = all entries with fewer than 2 images)</label>
          <input id="is" className={inp + ' mb-3'} value={im.slug} onChange={e => setIm({ ...im, slug: e.target.value })} />
          <label className="text-sm flex gap-2 mb-3"><input type="checkbox" checked={im.force} onChange={e => setIm({ ...im, force: e.target.checked })} /> Replace existing images</label>
          <button className="btn-primary text-xs" onClick={() => run('fetch-images', im)}>Find images</button>
        </div>
        <div className="card">
          <h2 className="font-serif text-xl mb-1">Update the events calendar</h2>
          <p className="text-sm text-ink-mid mb-4">Finds events for this week, this month and the year ahead, with dates read from the pages it retrieved. It also runs by itself every Sunday at 01:00 IST. The result arrives as a batch under <strong>Review agent work</strong>.</p>
          <button className="btn-primary text-xs" onClick={() => run('events', {})}>Update events now</button>
        </div>
        <div className="card">
          <h2 className="font-serif text-xl mb-1">Check official links</h2>
          <p className="text-sm text-ink-mid mb-4">Tests the official KTDC, Kerala Tourism and railway links used in guides.</p>
          <button className="btn-outline text-xs" onClick={() => run('link-check', {})}>Run link check</button>
        </div>
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
