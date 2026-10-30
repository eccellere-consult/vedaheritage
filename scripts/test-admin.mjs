// End-to-end test of public/api/admin against a mock GitHub API. Needs `php` (CLI) on PATH.
// Usage: node scripts/test-admin.mjs   (skips with exit 0 if php is missing)
import http from 'http'
import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

if (spawnSync('php', ['-v']).status !== 0) { console.log('– php not found, admin test skipped'); process.exit(0) }

const sha = s => crypto.createHash('sha1').update(s).digest('hex')
const good = (slug, extra = {}) => ({
  slug, category: 'temples', name: slug, district: 'Kollam', status: 'draft',
  summary: 'A summary that is comfortably longer than fifty characters for the meta description.',
  folklore: { title: 't', story: ['s'] }, history: { significance: 'x', timeline: [], keyFacts: [] }, spiritual: { summary: 's' }, visitorInfo: { bestTime: 'b' },
  images: [{ src: '/images/discover/a.jpg', alt: 'a', credit: 'c', license: 'CC BY', sourceUrl: 'https://commons.wikimedia.org/x' }],
  sources: [{ label: 'a', url: 'https://a.example/' }, { label: 'b', url: 'https://b.example/' }], ...extra,
})
const files = {
  'src/content/temples/ready.json': good('ready'),
  'src/content/temples/noimage.json': good('noimage', { images: [] }),
  'src/content/temples/gated.json': good('gated'),
  'agents/evidence/gated.json': { verification: { score: 70, recommendation: 'needs_edit', gateReasons: ['score 70 < 80'], results: [], issues: [] } },
}
const puts = [], labels = [], dispatches = []; let merged = []
const prs = { 1: { number: 1, title: 'green', state: 'open', draft: false, mergeable: true, head: { sha: 'g'.repeat(40), ref: 'agents/x' }, user: { login: 'bot' }, html_url: 'u', changed_files: 1, updated_at: 'now' },
              2: { number: 2, title: 'red', state: 'open', draft: false, mergeable: true, head: { sha: 'r'.repeat(40), ref: 'agents/y' }, user: { login: 'bot' }, html_url: 'u', changed_files: 1, updated_at: 'now' },
              3: { number: 3, title: 'needs approval', state: 'open', draft: false, mergeable: true, head: { sha: 'n'.repeat(40), ref: 'agents/z' }, user: { login: 'bot' }, html_url: 'u', changed_files: 1, updated_at: 'now' } }
const conc = { g: 'success', r: 'failure', n: 'action_required' }
const blobs = {}; const treeNow = () => Object.entries(files).map(([p, v]) => { const t = JSON.stringify(v); const s = sha(t); blobs[s] = t; return { path: p, type: 'blob', sha: s } })

const publishFine = e => e.images.length > 0 && e.images.every(i => i.src && i.alt && i.credit && i.license && i.sourceUrl)
const refsRead = [], refsPatched = []; let m0
const commits = []; let lastTree = []; const blobB64 = {}
const gh = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const u = new URL(req.url, 'http://x'); const p = u.pathname.replace('/repos/o/r', ''); const j = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)) }
    const b = body ? JSON.parse(body) : {}
    if (u.pathname === '/site') { res.setHeader('content-type', 'text/html'); return res.end('<html>ok</html>') }
    if (req.headers.authorization !== 'Bearer tok') { res.statusCode = 401; return j({ message: 'bad token' }) }
    if (p === '/git/trees/main') return j({ sha: 'treesha', tree: treeNow() })
    if (p === '/site') { res.setHeader('content-type', 'text/html'); return res.end('<html>ok</html>') }
    if ((m0 = p.match(/^\/git\/ref\/heads\/(.+)$/))) { refsRead.push(m0[1]); return j({ object: { sha: 'headsha' } }) }
    if (p === '/git/commits/headsha') return j({ tree: { sha: 'basetree' } })
    if (p === '/git/blobs' && req.method === 'POST') { const s = sha(b.content); blobB64[s] = b.content; return j({ sha: s }) }
    if (p === '/git/trees' && req.method === 'POST') { lastTree = b.tree; return j({ sha: 'newtree' }) }
    if (p === '/git/commits' && req.method === 'POST') { commits.push({ message: b.message, tree: lastTree, blobs: Object.fromEntries(lastTree.filter(t => t.sha).map(t => [t.path, blobB64[t.sha]])) }); for (const t of lastTree) if (t.content && t.path.endsWith('.json')) files[t.path] = JSON.parse(t.content); return j({ sha: 'newcommit' }) }
    if ((m0 = p.match(/^\/git\/refs\/heads\/(.+)$/)) && req.method === 'PATCH') { refsPatched.push(m0[1]); return j({}) }
    let m
    if ((m = p.match(/^\/git\/blobs\/(\w+)$/))) return j({ content: Buffer.from(blobs[m[1]] || '{}').toString('base64') })
    if ((m = p.match(/^\/contents\/(.+)$/))) {
      if (req.method === 'PUT') { puts.push({ path: m[1], ...b, text: Buffer.from(b.content, 'base64').toString() }); return j({ ok: 1 }) }
      const v = files[m[1]]; if (!v) { res.statusCode = 404; return j({ message: 'Not Found' }) }
      const t = JSON.stringify(v); return j({ sha: sha(t), content: Buffer.from(t).toString('base64') })
    }
    if (p === '/pulls') return j(Object.values(prs))
    if ((m = p.match(/^\/pulls\/(\d+)\/files$/))) return j(m[1] === '1' ? [{ filename: 'src/content/temples/ready.json', status: 'added' }, { filename: 'src/content/temples/noimage.json', status: 'added' }, { filename: 'src/content/temples/gated.json', status: 'modified' }, { filename: 'public/images/discover/a.jpg', status: 'added' }, { filename: 'agents/queue/x.json', status: 'added' }] : [])
    if ((m = p.match(/^\/pulls\/(\d+)\/merge$/))) { merged.push(+m[1]); return j({ merged: true }) }
    if ((m = p.match(/^\/pulls\/(\d+)$/))) return j(prs[m[1]] || (res.statusCode = 404, { message: 'nf' }))
    if ((m = p.match(/^\/commits\/(\w)\w*\/check-runs$/))) return j({ check_runs: [{ status: 'completed', conclusion: conc[m[1]] }] })
    if (p === '/actions/secrets') return j({ secrets: [{ name: 'XAI_API_KEY' }, { name: 'OPENAI_API_KEY' }] })
    if (p === '/commits/main') return j({ sha: 'abcdef1234567', commit: { message: 'head' } })
    if (p === '/issues') return j([{ number: 5, title: 'Story', body: '<script>x</script>', labels: [{ name: 'story-submission' }], created_at: 'now', html_url: 'u' }, { number: 6, title: 'pr', pull_request: { url: 'x' }, labels: [{ name: 'story-submission' }] }])
    if ((m = p.match(/^\/issues\/(\d+)\/labels$/))) { labels.push([+m[1], b.labels]); return j([]) }
    if ((m = p.match(/^\/issues\/(\d+)$/))) return j({ number: 5, labels: [{ name: 'story-submission' }], ...(req.method === 'PATCH' ? { closed: b } : {}) })
    if (p.match(/\/actions\/workflows\/.+\/dispatches$/)) { dispatches.push({ p, b }); res.statusCode = 204; return res.end() }
    if (p.match(/\/actions\/workflows\/.+\/runs$/)) return j({ workflow_runs: [] })
    res.statusCode = 404; j({ message: 'unmocked ' + p })
  })
}).listen(0)
const ghPort = gh.address().port

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-admin-'))
const pwHash = spawnSync('php', ['-r', 'echo password_hash("correct horse battery staple", PASSWORD_DEFAULT);']).stdout.toString()
fs.writeFileSync(path.join(tmp, 'vh-config.php'), `<?php return ['github_token'=>'tok','repo'=>'o/r','github_api'=>'http://127.0.0.1:${ghPort}','admin_password_hash'=>'${pwHash}','data_dir'=>'${tmp}/data','insecure_cookies'=>true,'site_url'=>'http://127.0.0.1:18911','insecure_checks'=>true,'rate_scale'=>10,'mail_outbox'=>'${tmp}/outbox.jsonl'];`)
const php = spawn('php', ['-S', '127.0.0.1:0'.replace(':0', ':18911'), '-t', process.env.ADMIN_DOCROOT || 'public'], { env: { ...process.env, VH_CONFIG: path.join(tmp, 'vh-config.php') }, stdio: 'ignore' })
await new Promise(r => setTimeout(r, 1200))

let cookie = '', csrf = ''
const call = async (a, { method = 'GET', body, token = true, q = '' } = {}) => {
  const r = await fetch(`http://127.0.0.1:18911/api/admin/?a=${a}${q}`, { method, headers: { 'content-type': 'application/json', cookie, ...(token && csrf ? { 'x-csrf-token': csrf } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]
  return { s: r.status, d: await r.json().catch(() => ({})) }
}
let fails = 0
const ok = (cond, name) => { console.log((cond ? '✔ ' : '✖ ') + name); if (!cond) fails++ }

try {
  ok((await call('overview')).s === 401, 'unauthenticated request is rejected')
  ok((await call('login', { method: 'POST', body: { password: 'wrong' } })).s === 401, 'wrong password is rejected')
  const l = await call('login', { method: 'POST', body: { password: 'correct horse battery staple' } }); csrf = l.d.csrf
  ok(l.s === 200 && csrf, 'correct password logs in')
  ok((await call('set_status', { method: 'POST', token: false, body: { category: 'temples', slug: 'ready', status: 'approved' } })).s === 403, 'write without CSRF token is rejected')
  const ov = await call('overview'); ok(ov.d.drafts === 3 && ov.d.openPrs === 3 && ov.d.stories === 1, 'overview counts (3 drafts, 3 PRs, 1 story; PR-issues ignored)')
  const dr = await call('drafts'); const row = n => dr.d.entries.find(e => e.slug === n)
  ok(row('ready').blockers.length === 0 && row('noimage').blockers.some(b => /image/.test(b)), 'drafts list shows publish blockers')
  const noimg = await call('set_status', { method: 'POST', body: { category: 'temples', slug: 'noimage', status: 'approved' } })
  ok(noimg.s === 422 && noimg.d.blockers.length, 'publish blocked without image'); ok(puts.length === 0, '…and nothing was written')
  const gated = await call('set_status', { method: 'POST', body: { category: 'temples', slug: 'gated', status: 'approved' } })
  ok(gated.s === 409 && gated.d.needsOverride, 'verifier-flagged entry needs explicit override')
  const pub = await call('set_status', { method: 'POST', body: { category: 'temples', slug: 'ready', status: 'approved' } })
  const saved = puts[0] && JSON.parse(puts[0].text)
  ok(pub.s === 200 && saved?.status === 'approved' && puts[0].branch === 'main' && /^\d{4}-\d\d-\d\d$/.test(saved.lastVerified), 'ready entry is published (commit to main, status approved)')
  const over = await call('set_status', { method: 'POST', body: { category: 'temples', slug: 'gated', status: 'approved', override: true } })
  ok(over.s === 200 && puts.length === 2, 'override publishes a flagged entry')
  ok((await call('set_status', { method: 'POST', body: { category: '../x', slug: 'ready', status: 'approved' } })).s === 400, 'path traversal in category is rejected')
  ok((await call('set_status', { method: 'POST', body: { category: 'temples', slug: 'Ready/../x', status: 'approved' } })).s === 400, 'bad slug is rejected')
  const rl = await call('review_list'); ok(rl.d.prs.length === 3, 'review lists agent pull requests')
  const rv = await call('review_pr&number=1'); const byS = Object.fromEntries((rv.d.cards || []).map(c => [c.slug, c]))
  ok(rv.d.cards?.length === 3 && rv.d.photoFiles === 1 && rv.d.checks === 'passed', 'review shows every page in the batch with photo count and check state')
  ok(byS.ready.blockers.length === 0 && byS.noimage.blockers.length > 0 && byS.gated.verifier?.ready === false && byS.ready.images[0].url.includes('/public/images/discover/a.jpg'), 'review cards carry readiness, blockers, verifier verdict and photo')
  const HEAD = 'g'.repeat(40)
  ok((await call('review_apply', { method: 'POST', body: { number: 1, head: 'x'.repeat(40), publish: [] } })).s === 409, 'review refuses a stale view of the batch')
  ok((await call('review_apply', { method: 'POST', body: { number: 1, head: HEAD, publish: [{ category: 'temples', slug: 'noimage' }] } })).s === 422 && !commits.length, 'review refuses an entry with blockers')
  const rg = await call('review_apply', { method: 'POST', body: { number: 1, head: HEAD, publish: [{ category: 'temples', slug: 'gated' }] } })
  ok(rg.s === 409 && rg.d.needsOverride && !commits.length, 'review needs an override for a flagged entry')
  const ra = await call('review_apply', { method: 'POST', body: { number: 1, head: HEAD, publish: [{ category: 'temples', slug: 'ready' }, { category: 'temples', slug: 'gated' }], override: ['gated'] } })
  const last = commits[commits.length - 1]
  ok(ra.s === 200 && ra.d.published === 2 && refsRead.includes('agents/x') && refsPatched.includes('agents/x') && last.tree.length === 2 && last.tree.every(t => JSON.parse(t.content).status === 'approved'), 'review publishes the chosen pages in ONE commit on the agent branch')
  ok(files['src/content/temples/noimage.json'].status === 'draft', 'unticked pages stay drafts')
  const ownJpg = spawnSync('php', ['-r', '$i=imagecreatetruecolor(800,600);ob_start();imagejpeg($i);echo base64_encode(ob_get_clean());']).stdout.toString()
  const up = body => call('photo_upload', { method: 'POST', body: { category: 'temples', slug: 'noimage', credit: 'Photo: Asha', alt: 'The temple pond at dusk', image: ownJpg, ...body } })
  const c0 = commits.length; const u1 = await up({})
  const uc = commits[commits.length - 1]; const ue = JSON.parse(uc.tree.find(t => t.path.endsWith('.json')).content)
  ok(u1.s === 200 && commits.length === c0 + 1 && uc.tree.some(t => t.path === 'public/images/discover/noimage-own-1.jpg') && ue.images[0].credit === 'Photo: Asha' && ue.images[0].src === '/images/discover/noimage-own-1.jpg' && publishFine(ue), 'own photo is attached in ONE commit with credit, and the entry then has no image blocker')
  ok((await up({ image: Buffer.from('not a jpeg').toString('base64') })).s === 422 && (await up({ credit: '' })).s === 400 && (await up({ slug: '../x' })).s === 400, 'upload rejects non-JPEG, missing credit and bad slugs')
  const u2 = await call('photo_upload', { method: 'POST', body: { category: 'temples', slug: 'gated', number: 1, credit: 'Photo: Asha', alt: 'Gate of the temple', image: ownJpg } })
  ok(u2.s === 200 && refsPatched.at(-1) === 'agents/x', 'a photo can be attached inside an agent batch (commit goes to its branch)')
  const evw = await call('run_workflow', { method: 'POST', body: { workflow: 'events', inputs: { provider: 'openai' } } })
  ok(evw.s === 200 && dispatches.at(-1)?.p.endsWith('/events.yml/dispatches') && dispatches.at(-1).b.inputs.provider === 'openai' && (await call('run_workflow', { method: 'POST', body: { workflow: 'events', inputs: { provider: 'x;rm' } } })).s === 400, 'the events agent can be started from the admin (provider checked)')
  ok(Array.isArray((await call('review_pr&number=1')).d.events), 'review reports calendar changes')
  const pl = await call('prs'); ok(pl.d.prs.map(p => p.checks).join() === 'passed,failed,needs_approval', 'PR list reports check state')
  ok((await call('merge_pr', { method: 'POST', body: { number: 2 } })).s === 422 && (await call('merge_pr', { method: 'POST', body: { number: 3 } })).s === 422 && !merged.length, 'red and unapproved PRs cannot be merged')
  ok((await call('merge_pr', { method: 'POST', body: { number: 1 } })).s === 200 && merged[0] === 1, 'green PR merges')
  const st = await call('stories'); ok(st.d.stories.length === 1, 'story list excludes PRs')
  await call('story_decision', { method: 'POST', body: { number: 5, decision: 'approve' } }); ok(labels[0]?.[1]?.[0] === 'approved', 'story approval adds the approved label')
  ok((await call('run_workflow', { method: 'POST', body: { workflow: 'content-agents', inputs: { command: 'rm -rf', max: '3' } } })).s === 400, 'workflow input is validated (command)')
  ok((await call('run_workflow', { method: 'POST', body: { workflow: 'content-agents', inputs: { command: 'scout', budget: '99' } } })).s === 400, 'workflow input is validated (budget cap)')
  const run = await call('run_workflow', { method: 'POST', body: { workflow: 'content-agents', inputs: { command: 'scout', max: '2', budget: '5' } } })
  ok(run.s === 200 && dispatches.find(d => d.p.includes('content-agents'))?.b.ref === 'main' && dispatches.find(d => d.p.includes('content-agents')).b.inputs.command === 'scout', 'agents run is dispatched on main')
  const act = await call('activity'); ok(act.d.events.some(e => e.e === 'set-status') && act.d.events.some(e => e.e === 'login-failed'), 'audit log records actions and failed logins')
  await call('logout', { method: 'POST' }); ok((await call('overview')).s === 401, 'logout ends the session')

  // ---------------------------------------------------------------- marketplace
  const jpg = Buffer.from(spawnSync('php', ['-r', '$i=imagecreatetruecolor(40,30);ob_start();imagejpeg($i);echo base64_encode(ob_get_clean());']).stdout.toString(), 'base64')
  const pubPost = async (ep, fields, nPhotos = 0) => {
    const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, v)
    for (let i = 0; i < nPhotos; i++) fd.append('photos[]', new Blob([jpg], { type: 'image/jpeg' }), `p${i}.jpg`)
    const r = await fetch(`http://127.0.0.1:18911/api/${ep}.php`, { method: 'POST', body: fd }); return { s: r.status, d: await r.json().catch(() => ({})) }
  }
  const base = { title: 'Bell metal nilavilakku', category: 'lamps-brassware', condition: 'used', price: '4500', district: 'Kollam', sellerName: 'Asha', contactEmail: 'asha@example.com', contactPhone: '+91 99999 11111', description: 'Handcrafted bell metal lamp, about 40 cm tall, in daily use for ten years. Pickup only.', declare: '1', consent: '1' }
  ok((await pubPost('submit-listing', { ...base }, 0)).s === 422, 'listing without a photo is rejected')
  ok((await pubPost('submit-listing', { ...base, description: base.description + ' see www.shop.com' }, 1)).s === 422, 'listing with a web link is rejected')
  ok((await pubPost('submit-listing', { ...base, declare: '' }, 1)).s === 422, 'listing without the seller declaration is rejected')
  ok((await pubPost('submit-listing', { ...base, price: '12.5' }, 1)).s === 422, 'non-integer price is rejected')
  ok((await pubPost('submit-listing', { ...base, website: 'bot' }, 1)).d.ok === true && !(await call('market')).d?.pending?.length, 'honeypot is accepted silently and stores nothing')
  ok((await pubPost('submit-listing', { ...base }, 2)).s === 200, 'valid listing is accepted (A)')
  ok((await pubPost('submit-listing', { ...base, title: 'Carved ivory elephant', description: 'Old ivory elephant figurine, antique, genuine, about 20 cm tall, kept in a cabinet.' }, 1)).s === 200, 'second listing accepted (B, risky wording)')
  ok((await pubPost('submit-listing', { ...base, title: 'Spare lamp stand' }, 1)).s === 200, 'third listing accepted (C)')
  ok((await pubPost('submit-listing', { ...base, title: 'Fourth try' }, 1)).s === 429, 'fourth submission within the hour is rate-limited')
  cookie = ''; csrf = ''; ok((await call('market')).s === 401, 'marketplace admin data needs login')
  const l2 = await call('login', { method: 'POST', body: { password: 'correct horse battery staple' } }); csrf = l2.d.csrf
  const mk = await call('market'); const byTitle = t => mk.d.pending.find(x => x.title === t)
  const A = byTitle('Bell metal nilavilakku'), B = byTitle('Carved ivory elephant'), C = byTitle('Spare lamp stand')
  ok(mk.d.pending.length === 3 && A.blockers.length === 0 && B.flags.length >= 2 && A.contactEmail === 'asha@example.com', 'admin sees pending listings with seller contact, blockers and risk flags')
  const ph = await fetch(`http://127.0.0.1:18911/api/admin/?a=market_photo&id=${A.id}&n=1`, { headers: { cookie } })
  ok(ph.status === 200 && ph.headers.get('content-type') === 'image/jpeg', 'admin can view a private photo')
  ok((await fetch(`http://127.0.0.1:18911/api/admin/?a=market_photo&id=${A.id}&n=1`)).status === 401, 'private photo is not public')
  const base0 = commits.length
  const b1 = await call('market_decide', { method: 'POST', body: { id: B.id, decision: 'approve' } })
  ok(b1.s === 409 && b1.d.needsOverride && commits.length === base0, 'risky listing needs an explicit override and nothing is committed')
  const a1 = await call('market_decide', { method: 'POST', body: { id: A.id, decision: 'approve' } })
  const cA = commits[commits.length - 1]; const pubJson = cA && JSON.parse(cA.tree.find(t => t.path.endsWith('.json')).content)
  ok(a1.s === 200 && cA.tree.length === 3 && Object.keys(cA.blobs).every(k => k.startsWith('public/images/marketplace/')) && cA.tree.some(t => t.path === `src/content/listings/${A.id}.json`), 'approval publishes the listing and its 2 photos in ONE commit')
  ok(pubJson.status === 'approved' && pubJson.sellerFirstName === 'Asha' && !JSON.stringify(cA).includes('asha@example.com') && !JSON.stringify(cA).includes('99999') && pubJson.expiresOn > pubJson.listedOn, 'published listing contains no seller contact details and has an expiry')
  ok((await call('market_decide', { method: 'POST', body: { id: B.id, decision: 'approve', override: true } })).s === 200, 'override publishes the risky listing')
  const rej = await call('market_decide', { method: 'POST', body: { id: C.id, decision: 'reject' } })
  const mk2 = await call('market'); ok(rej.s === 200 && !mk2.d.pending.length && mk2.d.live.length === 2 && !fs.readdirSync(path.join(tmp, 'data/market/photos')).some(f => f.startsWith(C.id)), 'rejection deletes the photos and contact details')
  ok(JSON.parse(fs.readFileSync(path.join(tmp, `data/market/submissions/${C.id}.json`), 'utf8')).contactEmail === undefined, '…and the stored record keeps no contact data')
  ok((await call('market_decide', { method: 'POST', body: { id: A.id, decision: 'approve' } })).s === 404, 'a listing cannot be approved twice')
  const enq = { listingId: A.id, name: 'Ravi', message: 'Is this still available? I can collect on Sunday.', contactPhone: '9876543210', consent: '1' }
  ok((await pubPost('submit-enquiry', { ...enq, listingId: C.id })).s === 404, 'enquiry about a rejected listing is refused')
  ok((await pubPost('submit-enquiry', { ...enq, listingId: 'nope' })).s === 404, 'enquiry about an unknown listing is refused')
  ok((await pubPost('submit-enquiry', { ...enq, message: 'see http://x.example/y now' })).s === 422, 'enquiry with a link is rejected')
  ok((await pubPost('submit-enquiry', { ...enq })).s === 200, 'buyer enquiry about a live listing is accepted')
  const mk3 = await call('market'); const E = mk3.d.enquiries[0]
  ok(mk3.d.enquiries.length === 1 && E.seller.email === 'asha@example.com' && E.contactPhone === '9876543210', 'admin sees the enquiry together with the seller contact for the introduction')
  await call('market_enquiry_done', { method: 'POST', body: { id: E.id } }); ok(!(await call('market')).d.enquiries.length, 'introduced enquiries leave the queue')
  ok(JSON.parse(fs.readFileSync(path.join(tmp, `data/market/enquiries/${E.id}.json`), 'utf8')).contactPhone === '', '…and the buyer contact details are wiped')
  const sold = await call('market_status', { method: 'POST', body: { id: A.id, status: 'sold' } })
  ok(sold.s === 200 && JSON.parse(commits[commits.length - 1].tree[0].content).status === 'sold', 'marking sold commits the new status')
  const rm = await call('market_status', { method: 'POST', body: { id: A.id, status: 'removed' } })
  ok(rm.s === 200 && JSON.parse(fs.readFileSync(path.join(tmp, `data/market/submissions/${A.id}.json`), 'utf8')).contactEmail === '', 'removing a listing wipes the seller contact')
  ok((await call('market_status', { method: 'POST', body: { id: A.id, status: 'deleted' } })).s === 400, 'status values are validated')

  // ---------------------------------------------------------------- service-provider directory
  const outbox = () => fs.existsSync(path.join(tmp, 'outbox.jsonl')) ? fs.readFileSync(path.join(tmp, 'outbox.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []
  const pp = async (ep, fields) => {
    const fd = new FormData(); for (const [k, v] of Object.entries(fields)) for (const x of [].concat(v)) fd.append(k, x)
    const r = await fetch(`http://127.0.0.1:18911/api/${ep}.php`, { method: 'POST', body: fd }); return { s: r.status, d: await r.json().catch(() => ({})) }
  }
  let seq = 0
  const prov = (o = {}) => { seq++; return { businessName: `Kollam Backwater Walks ${seq}`, type: 'guide', 'districts[]': ['Kollam'], summary: 'Guided walks through Kollam backwater villages and temples, run by a registered local guide.', phone: `+91 98470 1000${seq}`, email: `walks${seq}@example.com`, address: 'Near the boat jetty', credentialKind: 'Kerala Tourism approved guide', credentialNumber: `KT-${seq}`, contactPerson: 'Biju', contactPersonPhone: '', siteUrl: '', declare: '1', consent: '1', terms: '1', ...o } }
  const sub = async o => { const f = prov(o); const r = await pp('submit-provider', f); return { r, f } }
  const linkFor = email => outbox().filter(m => m.to === email).pop()?.body.match(/api\/verify-provider\.php\?id=([\d]{8}-[0-9a-f]{8})&t=([0-9a-f]{48})/)
  const addProvider = async (o = {}, checks = { phone: true, credential: true }) => {
    const { r, f } = await sub(o); if (r.s !== 200) throw new Error('submit failed ' + JSON.stringify(r))
    const m = linkFor(f.email.toLowerCase()); await fetch(`http://127.0.0.1:18911/api/verify-provider.php?id=${m[1]}&t=${m[2]}`)
    const a = await call('prov_decide', { method: 'POST', body: { id: m[1], decision: 'approve', checks, override: true } })
    if (a.s !== 200) throw new Error('approve failed ' + JSON.stringify(a.d)); return { id: m[1], f }
  }
  ok((await sub({ terms: '' })).r.s === 422, 'application without all confirmations is rejected')
  ok((await sub({ siteUrl: 'https://bit.ly/abc' })).r.s === 422, 'link-shortener website is rejected')
  ok((await sub({ summary: 'Walks with a guide, see www.walks.com for prices and a lot more details here.' })).r.s === 422, 'web link in the summary is rejected')
  ok((await sub({ credentialKind: '', credentialNumber: '' })).r.s === 422, 'a guide without a registration is rejected')
  ok((await sub({ 'districts[]': ['Narnia'] })).r.s === 422 && (await sub({ 'districts[]': ['Kollam', 'Idukki', 'Kannur', 'Wayanad'] })).r.s === 422, 'unknown district and more than 3 districts are rejected')
  ok((await sub({ phone: '12' })).r.s === 422 && (await sub({ email: 'nope' })).r.s === 422, 'bad phone and bad email are rejected')
  const A0 = await sub({ siteUrl: `http://127.0.0.1:${ghPort}/site`, email: 'asha-guide@example.com' }); const Am = linkFor('asha-guide@example.com')
  ok(A0.r.s === 200 && Am && outbox().some(m => m.to === 'asha-guide@example.com' && /confirm/i.test(m.subject)), 'valid application is accepted and a confirmation email is sent')
  const dup = await pp('submit-provider', { ...A0.f, businessName: 'Another name' }); ok(dup.s === 422, 'the same email/phone cannot apply twice')
  const q1 = (await call('prov')).d.queue.find(x => x.id === Am[1])
  ok(q1 && q1.emailVerified === false && q1.site?.ok === true && /^KT-\d+$/.test(q1.credentialNumber) && q1.contactPerson === 'Biju', 'admin queue shows the application, private details and a passing website check')
  const noChecks = await call('prov_decide', { method: 'POST', body: { id: Am[1], decision: 'approve' } })
  ok(noChecks.s === 422 && noChecks.d.blockers.length >= 3 && !commits.some(c => /directory listing/.test(c.message)), 'publishing is blocked until email, phone and credential are verified')
  ok((await fetch(`http://127.0.0.1:18911/api/verify-provider.php?id=${Am[1]}&t=${'0'.repeat(48)}`)).status === 400, 'a wrong verification token is refused')
  const vr = await fetch(`http://127.0.0.1:18911/api/verify-provider.php?id=${Am[1]}&t=${Am[2]}`); ok(vr.status === 200 && /confirmed/.test(await vr.text()), 'the emailed link confirms the email')
  ok((await call('prov')).d.queue.find(x => x.id === Am[1]).emailVerified === true, '…and the admin sees it verified')
  const partial = await call('prov_decide', { method: 'POST', body: { id: Am[1], decision: 'approve', checks: { phone: true } } })
  ok(partial.s === 422 && partial.d.blockers.some(b => /credential/i.test(b)), 'a regulated type still needs the credential check')
  const okA = await call('prov_decide', { method: 'POST', body: { id: Am[1], decision: 'approve', checks: { phone: true, credential: true } } })
  const cmA = commits[commits.length - 1]; const pj = JSON.parse(cmA.tree[0].content); const days = (Date.parse(pj.reverifyBy) - Date.parse(pj.verifiedOn)) / 86400000
  ok(okA.s === 200 && cmA.tree[0].path === `src/content/providers/${Am[1]}.json` && days === 365 && pj.credentialLabel === 'Kerala Tourism approved guide', 'verified provider is published with a 12-month verification window')
  ok(!JSON.stringify(cmA).includes('KT-') && !JSON.stringify(cmA).includes('Biju') && !('credentialNumber' in pj) && !('contactPerson' in pj), 'the published listing contains no private details')
  const W = await addProvider({ type: 'wellness', credentialKind: 'Kerala Tourism classified Ayurveda centre' })
  const G2 = await addProvider(), G3 = await addProvider(), G4 = await addProvider()
  const sp = (id, o = {}) => call('prov_sponsor', { method: 'POST', body: { id, headline: 'Backwater walks', line: 'Morning village walks with a local guide.', from: new Date().toISOString().slice(0, 10), until: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), ...o } })
  ok((await sp(W.id)).s === 422, 'a wellness centre cannot be sponsored (health advertising)')
  ok((await sp(Am[1], { headline: 'Best guide in Kollam' })).s === 422, 'ranking claims are refused in adverts')
  ok((await sp(Am[1], { line: 'Book now at www.walks.com today' })).s === 422, 'web links are refused in adverts')
  ok((await sp(Am[1], { until: new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 10) })).s === 422, 'a sponsorship cannot exceed 90 days')
  ok((await sp(Am[1], { line: 'We cure back pain with guided walks.' })).s === 422, 'health claims are refused in adverts')
  ok((await sp(Am[1])).s === 200 && JSON.parse(commits[commits.length - 1].tree[0].content).sponsored.headline === 'Backwater walks', 'a valid sponsorship is saved on the listing')
  ok((await sp(G2.id)).s === 200 && (await sp(G3.id)).s === 200, 'three sponsored slots can be filled in one district and type')
  const capped = await sp(G4.id); ok(capped.s === 422 && /slots/.test(JSON.stringify(capped.d)), 'a fourth concurrent sponsor in the same district and type is refused')
  const later = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10), later2 = new Date(Date.now() + 70 * 864e5).toISOString().slice(0, 10)
  ok((await sp(G4.id, { from: later, until: later2 })).s === 200, '…but the same slot is available for later dates')
  // everything the admin published must pass the real build validator
  const vtmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-validate-')); fs.mkdirSync(path.join(vtmp, 'src/content/providers'), { recursive: true })
  for (const [fp, v] of Object.entries(files)) if (fp.startsWith('src/content/providers/')) fs.writeFileSync(path.join(vtmp, fp), JSON.stringify(v.website ? { ...v, website: 'https://walks.example.com/' } : v)) // test-only: the local http site stands in for https
  const val = spawnSync('node', [path.resolve('scripts/validate-content.mjs')], { cwd: vtmp, encoding: 'utf8' }); fs.rmSync(vtmp, { recursive: true, force: true })
  ok(val.status === 0 && /5 providers/.test(val.stdout), 'all published directory files pass the build validator (' + (val.stdout || val.stderr).trim().split('\n').pop() + ')')
  ok((await pp('submit-report', { providerId: Am[1], reason: 'wrong-contact', details: 'The phone number is not answered.', contactEmail: 'visitor@example.com' })).s === 200 && (await pp('submit-report', { providerId: 'nope', reason: 'closed', details: 'It has closed down.' })).s === 404, 'a visitor can report a listing; unknown listings are refused')
  const rep = (await call('prov')).d.reports; ok(rep.length === 1 && rep[0].providerName.startsWith('Kollam Backwater Walks'), 'the report appears in the admin queue')
  await call('prov_report_done', { method: 'POST', body: { id: rep[0].id } }); ok(!(await call('prov')).d.reports.length && JSON.parse(fs.readFileSync(path.join(tmp, `data/market/reports/${rep[0].id}.json`), 'utf8')).contactEmail === '', 'closing a report deletes the reporter\'s details')
  ok((await call('prov_status', { method: 'POST', body: { id: Am[1], status: 'reverified' } })).s === 422, 're-verification needs an explicit confirmation')
  ok((await call('prov_status', { method: 'POST', body: { id: Am[1], status: 'reverified', confirmed: true } })).s === 200, 'a provider can be re-verified for another 12 months')
  const susp = await call('prov_status', { method: 'POST', body: { id: Am[1], status: 'suspended' } }); const sj = JSON.parse(commits[commits.length - 1].tree[0].content)
  ok(susp.s === 200 && sj.status === 'suspended' && !sj.sponsored, 'suspending hides the listing and ends its sponsorship')
  await call('prov_status', { method: 'POST', body: { id: Am[1], status: 'removed' } })
  const rmd = JSON.parse(fs.readFileSync(path.join(tmp, `data/market/providers/${Am[1]}.json`), 'utf8')); ok(rmd.status === 'removed' && rmd.contactPerson === '' && rmd.credentialNumber === '' && rmd.email === '', 'removing a provider deletes the private details')

  // ---------------------------------------------------------------- which AI the agents use
  const as0 = await call('agent_settings')
  ok(as0.s === 200 && as0.d.provider === 'auto' && as0.d.verifierProvider === 'auto' && as0.d.keys?.xai === true && as0.d.keys?.anthropic === false, 'agent settings default to automatic and show which provider keys exist')
  ok((await call('agent_settings_save', { method: 'POST', body: { provider: 'gemini', verifierProvider: 'auto' } })).s === 400, 'an unknown AI provider is refused')
  ok((await call('agent_settings_save', { method: 'POST', token: false, body: { provider: 'openai', verifierProvider: 'auto' } })).s === 403, 'saving the AI choice needs the session token')
  const sv = await call('agent_settings_save', { method: 'POST', body: { provider: 'openai', verifierProvider: 'xai' } })
  const svc = commits[commits.length - 1]; const svj = JSON.parse(svc.tree[0].content)
  ok(sv.s === 200 && svc.tree.length === 1 && svc.tree[0].path === 'agents/settings.json' && svj.provider === 'openai' && svj.verifierProvider === 'xai', 'the chosen AI is saved to agents/settings.json on main')
  const as1 = await call('agent_settings'); ok(as1.d.provider === 'openai' && as1.d.verifierProvider === 'xai', '…and read back')
  const runP = await call('run_workflow', { method: 'POST', body: { workflow: 'content-agents', inputs: { command: 'scout', max: '2', budget: '5', provider: 'anthropic', verifier: 'auto' } } })
  ok(runP.s === 200 && dispatches[dispatches.length - 1].b.inputs.provider === 'anthropic' && dispatches[dispatches.length - 1].b.inputs.verifier === 'auto', "a run can use a different AI for that run only")
  ok((await call('run_workflow', { method: 'POST', body: { workflow: 'content-agents', inputs: { command: 'scout', provider: 'llama' } } })).s === 400, 'an unknown AI provider is refused for a run')
  const runD = await call('run_workflow', { method: 'POST', body: { workflow: 'content-agents', inputs: { command: 'scout' } } })
  ok(runD.s === 200 && dispatches[dispatches.length - 1].b.inputs.provider === 'saved', 'a run with no choice uses the saved default')

  // ---------------------------------------------------------------- deployment guards (Apache cannot run here, so check the files)
  ok(/^DirectoryIndex\s+.*index\.php/m.test(fs.readFileSync('public/.htaccess', 'utf8')), 'public/.htaccess lets a folder URL serve index.php (the admin API lives in a folder)')
  ok(/const API = '\/api\/admin\/index\.php'/.test(fs.readFileSync('src/components/admin/AdminApp.tsx', 'utf8')), 'the admin page calls the API by its explicit file name, not a folder URL')
  const direct = await fetch('http://127.0.0.1:18911/api/admin/index.php?a=status'); const dj = await direct.json(); ok(direct.status === 200 && dj.configured === true && dj.missing.length === 0, 'the status endpoint answers at its explicit file name')
  fs.writeFileSync(path.join(tmp, 'broken-config.php'), "<?php return [\n  'repo' => 'a/b'\n  'admin_password_hash' => 'x',\n];\n")
  const brk = spawnSync('php', ['-r', '$_GET["a"]="status"; $_SERVER["REQUEST_METHOD"]="GET"; require "public/api/admin/index.php";'], { env: { ...process.env, VH_CONFIG: path.join(tmp, 'broken-config.php') }, encoding: 'utf8' })
  let brkJson = {}; try { brkJson = JSON.parse(brk.stdout) } catch {}
  const nf = spawnSync('php', ['-r', '$_GET["a"]="status"; $_SERVER["REQUEST_METHOD"]="GET"; require "public/api/admin/index.php";'], { env: { ...process.env, VH_CONFIG: '/nowhere/domains/example.org/vh-config.php' }, encoding: 'utf8' })
  let nfJson = {}; try { nfJson = JSON.parse(nf.stdout) } catch {}
  ok(nfJson.config?.found === false && nfJson.config.looked[0] === 'domains/example.org/vh-config.php' && nfJson.missing?.length === 3, 'a missing vh-config.php is reported with where the server looked (shortened, no account names)')
  ok(dj.config?.found === true, 'a present vh-config.php is reported as found')
  ok(brkJson.configured === false && Number(brkJson.configError) > 0 && brkJson.missing?.length === 3, 'a typing mistake in vh-config.php gives a clear status (line number and the names of missing settings, no secrets) instead of crashing')

  // ---------------------------------------------------------------- "why is vh-config.php not found" diagnostics
  const probe = (cfgPath, ini = []) => { const env = { ...process.env }; if (cfgPath) env.VH_CONFIG = cfgPath; else delete env.VH_CONFIG; const r = spawnSync('php', [...ini.flatMap(i => ['-d', i]), '-r', '$_GET["a"]="status"; $_SERVER["REQUEST_METHOD"]="GET"; require "public/api/admin/index.php";'], { env, encoding: 'utf8' }); try { return JSON.parse(r.stdout) } catch { return { raw: r.stdout, err: r.stderr } } }
  const dg = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-diag-')); fs.mkdirSync(path.join(dg, 'site'))
  const emptyDir = probe(path.join(dg, 'site', 'vh-config.php')).config?.diag
  ok(emptyDir?.dirExists === true && emptyDir.dirReadable === true && emptyDir.similarFile === null && emptyDir.fileInWebFolder === false && emptyDir.phpOk === true, 'diagnostic: an empty, readable folder is reported as such (create the file there)')
  fs.writeFileSync(path.join(dg, 'site', 'vh-config.php.txt'), 'x')
  ok(probe(path.join(dg, 'site', 'vh-config.php')).config?.diag?.similarFile === 'vh-config.php.txt', 'diagnostic: a look-alike name such as vh-config.php.txt is spotted')
  fs.writeFileSync(path.join(dg, 'vh-config.php'), 'x')
  ok(probe(path.join(dg, 'site', 'vh-config.php')).config?.diag?.fileOneLevelTooHigh === true, 'diagnostic: a file one folder too high is spotted')
  const gone = probe(path.join(dg, 'nothere', 'vh-config.php')).config?.diag
  ok(gone?.dirExists === false && gone.dirReadable === false && gone.openBasedirSet === false, 'diagnostic: a missing folder is reported as missing, not as blocked')
  const blocked = probe(path.join(dg, 'site', 'vh-config.php'), ['open_basedir=' + process.cwd()]).config?.diag
  ok(blocked?.openBasedirSet === true && blocked.openBasedirCoversDir === false && blocked.dirReadable === false, 'diagnostic: a folder PHP is blocked from reading (open_basedir) is reported as blocked')
  const web = path.resolve('public/vh-config.php'); fs.writeFileSync(web, '<?php return [];')
  try { ok(probe(path.join(dg, 'site', 'vh-config.php')).config?.diag?.fileInWebFolder === true, 'diagnostic: a file inside the web folder is spotted (and never loaded)') } finally { fs.rmSync(web, { force: true }) }
  const none = JSON.stringify(probe(path.join(dg, 'site', 'vh-config.php')))
  ok(!none.includes(dg) && !none.includes(os.tmpdir()), 'diagnostics never reveal absolute paths')
  fs.rmSync(dg, { recursive: true, force: true })

  // ---------------------------------------------------------------- hosts that block PHP above the web folder (open_basedir)
  const priv = path.resolve('public/api/private')
  ok(/Require all denied/.test(fs.readFileSync(path.join(priv, '.htaccess'), 'utf8')) && /Deny from all/.test(fs.readFileSync(path.join(priv, '.htaccess'), 'utf8')), 'the protected folder public/api/private denies every web request (Apache 2.4 and 2.2 syntax)')
  const webDir = path.resolve('public')
  try {
    fs.writeFileSync(path.join(priv, 'vh-config.php'), `<?php return ['repo' => 'o/r', 'admin_github_token' => 'tok', 'admin_password_hash' => 'h'];`)
    const inPriv = probe(null, ['open_basedir=' + webDir])
    ok(inPriv.configured === true && inPriv.missing?.length === 0 && inPriv.config?.found === true, 'with PHP confined to the web folder, vh-config.php is found in the protected folder api/private')
  } finally { fs.rmSync(path.join(priv, 'vh-config.php'), { force: true }) }
  const dd = spawnSync('php', ['-d', 'open_basedir=' + webDir, '-r', 'define("VH_LIB",1); require "public/api/lib/common.php"; echo vh_data_dir();'], { encoding: 'utf8', env: { ...process.env, VH_CONFIG: '' } })
  try { ok(dd.stdout.trim() === path.join(webDir, 'api/private/data'), 'with PHP confined to the web folder, private data goes to the protected folder, not a temporary one (' + dd.stdout.trim().replace(webDir, '…/public') + ')') } finally { fs.rmSync(path.join(priv, 'data'), { recursive: true, force: true }) }
  const dd2 = spawnSync('php', ['-r', 'define("VH_LIB",1); require "public/api/lib/common.php"; echo vh_data_dir();'], { encoding: 'utf8', env: { ...process.env, VH_CONFIG: '' } })
  try { ok(dd2.stdout.trim() === path.resolve('vh-data') && !fs.existsSync(path.join(priv, 'data')), 'without restrictions, private data stays beside the web folder (vh-data)') } finally { fs.rmSync(path.resolve('vh-data'), { recursive: true, force: true }) }

  // ---------------------------------------------------------------- hidden characters in the file name
  const dh = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-hidden-')); fs.mkdirSync(path.join(dh, 'site'))
  fs.writeFileSync(path.join(dh, 'site', 'vh‑config.php'), 'x')          // non-breaking hyphen: looks identical in File Manager
  fs.writeFileSync(path.join(dh, 'site', 'other.txt'), 'x')
  const hid = probe(path.join(dh, 'site', 'vh-config.php')).config?.diag
  ok(hid?.vhNames?.includes('vh\\u{2011}config.php') && hid.entryCount === 2 && hid.similarFile === null, 'diagnostic: a file name with a hidden look-alike hyphen is spelled out so it can be recognised')
  fs.rmSync(dh, { recursive: true, force: true })
  ok(/api\/private\/vh-config\.php/.test(fs.readFileSync('public/.gitignore', 'utf8')) && /api\/private\/data\//.test(fs.readFileSync('public/.gitignore', 'utf8')), 'the published .gitignore protects the server settings and private data from being cleaned by Git')
  if (!process.env.ADMIN_HOLD) {
    cookie = ''; csrf = ''
    let last; for (let i = 0; i < 5; i++) last = await call('login', { method: 'POST', body: { password: 'bad' + i } })
    const locked = await call('login', { method: 'POST', body: { password: 'correct horse battery staple' } })
    ok(locked.s === 429, 'login locks out after repeated failures (even with the right password)')
  }
  if (process.env.ADMIN_HOLD) { console.log('holding on http://127.0.0.1:18911 (Ctrl-C to stop)'); await new Promise(() => {}) }
} finally { php.kill(); gh.close(); fs.rmSync(tmp, { recursive: true, force: true }) }
if (fails) { console.error(`\n✖ ${fails} admin test(s) failed`); process.exit(1) }
console.log('\n✔ admin API tests passed')
