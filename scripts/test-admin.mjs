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
  'src/content/temples/owned.json': good('owned', { autoPublished: '2026-10-30', reviewed: false, status: 'approved', images: [{ src: '/images/discover/owned-1.jpg', alt: 'a', credit: 'c', license: 'CC BY', sourceUrl: 'https://commons.wikimedia.org/x' }] }),
  'agents/evidence/owned.json': { verification: { score: 90, recommendation: 'ready_for_review', gateReasons: [], results: [], issues: [] } },
  'src/content/events/calendar.json': { updated: '2026-10-30', events: [{ id: 'e1', name: 'One' }, { id: 'e2', name: 'Two' }] },
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
// Mock Razorpay: records every call so the tests can check what we sent (amounts, holds, reversals).
const rzCalls = []; let rzSeq = 0
const rz = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const b = body ? JSON.parse(body) : {}; const j = (o, c = 200) => { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)) }
    rzCalls.push({ method: req.method, path: req.url, b, auth: req.headers.authorization }); let m
    if (req.method === 'POST' && req.url === '/v1/orders') return j({ id: 'order_T' + (++rzSeq), amount: b.amount })
    if ((m = req.url.match(/^\/v1\/payments\/([^/]+)\/transfers$/))) return j({ items: [{ id: 'trf_T' + (++rzSeq) }] })
    if ((m = req.url.match(/^\/v1\/transfers\/([^/]+)$/)) && req.method === 'PATCH') return j({ id: m[1], on_hold: 0 })
    if ((m = req.url.match(/^\/v1\/payments\/([^/]+)\/refund$/))) return j({ id: 'rfnd_T' + (++rzSeq) })
    j({ error: 'unmocked' }, 404)
  })
}).listen(0)
const rzPort = rz.address().port

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-admin-'))
const pwHash = spawnSync('php', ['-r', 'echo password_hash("correct horse battery staple", PASSWORD_DEFAULT);']).stdout.toString()
fs.writeFileSync(path.join(tmp, 'vh-config.php'), `<?php return ['github_token'=>'tok','repo'=>'o/r','github_api'=>'http://127.0.0.1:${ghPort}','admin_password_hash'=>'${pwHash}','data_dir'=>'${tmp}/data','insecure_cookies'=>true,'site_url'=>'http://127.0.0.1:18911','insecure_checks'=>true,'rate_scale'=>10,'mail_outbox'=>'${tmp}/outbox.jsonl','razorpay_key_id'=>'rzp_test_key','razorpay_key_secret'=>'sekret','razorpay_webhook_secret'=>'whsec','notify_email'=>'owner@example.com','razorpay_api'=>'http://127.0.0.1:${rzPort}'];`)
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
  const own = (await call('drafts')).d.entries.find(e => e.slug === 'owned')
  ok(own?.autoPublished === '2026-10-30' && own.reviewed === false, 'drafts list reports auto-published and not yet reviewed')
  ok((await call('overview')).d.toReview === 1, 'overview counts auto-published entries awaiting review')
  const edited = { ...JSON.parse(JSON.stringify(files['src/content/temples/owned.json'])), summary: 'An edited summary that is comfortably longer than fifty characters in total.' }
  const es = await call('entry_save', { method: 'POST', body: { category: 'temples', slug: 'owned', entry: edited } })
  const ec = commits[commits.length - 1]; const ej = JSON.parse(ec.tree[0].content)
  ok(es.s === 200 && ej.summary.startsWith('An edited') && ej.reviewed === true && ej.status === 'approved', 'owner edit saves, keeps it published and marks it reviewed')
  ok((await call('entry_save', { method: 'POST', body: { category: 'temples', slug: 'owned', entry: { ...edited, summary: 'short' } } })).s === 422, 'an edit that breaks the publishing rules is refused')
  ok((await call('entry_save', { method: 'POST', body: { category: 'temples', slug: 'owned', entry: { ...edited, slug: 'other' } } })).s === 422, 'slug cannot be changed by an edit')
  const rv2 = await call('entry_reviewed', { method: 'POST', body: { category: 'temples', slug: 'owned' } })
  ok(rv2.s === 200 && JSON.parse(commits[commits.length - 1].tree[0].content).reviewed === true, 'mark reviewed')
  const dl = await call('entry_delete', { method: 'POST', body: { category: 'temples', slug: 'owned' } })
  const dc = commits[commits.length - 1]; const dpaths = dc.tree.map(t => t.path)
  ok(dl.s === 200 && dc.tree.every(t => t.sha === null) && dpaths.includes('src/content/temples/owned.json') && dpaths.includes('agents/evidence/owned.json') && dpaths.includes('public/images/discover/owned-1.jpg'), 'delete removes the entry, its evidence and its own photos in ONE commit')
  ok((await call('entry_delete', { method: 'POST', body: { category: 'temples', slug: 'nope' } })).s === 404, 'deleting a missing entry is a 404')
  const ed = await call('event_delete', { method: 'POST', body: { id: 'e1' } })
  ok(ed.s === 200 && JSON.parse(commits[commits.length - 1].tree[0].content).events.map(x => x.id).join() === 'e2' && (await call('event_delete', { method: 'POST', body: { id: 'zz' } })).s === 404, 'owner can remove one event')
  const svT = await call('agent_settings_save', { method: 'POST', body: { autoPublish: true } })
  const setj = JSON.parse(commits[commits.length - 1].tree[0].content)
  ok(svT.s === 200 && setj.autoPublish === true && setj.autoPublishExclude.join() === 'medical,healing' && setj.provider === 'auto', 'the publish-automatically toggle is saved and keeps the other settings')
  const svF = await call('agent_settings_save', { method: 'POST', body: { autoPublish: false, provider: 'openai' } })
  ok(svF.s === 200 && JSON.parse(commits[commits.length - 1].tree[0].content).autoPublish === false && JSON.parse(commits[commits.length - 1].tree[0].content).provider === 'openai', 'and switched back off'); delete files['agents/settings.json']
  // ---------------------------------------------------------------- stop switch, topic register
  const cg = await call('control_get'); ok(cg.s === 200 && cg.d.control.state === 'running' && cg.d.runs.length === 4, 'control panel reports running state and the four agent jobs')
  const lastC = () => JSON.parse(commits[commits.length - 1].tree[0].content)
  ok((await call('control_set', { method: 'POST', body: { action: 'pause', reason: 'testing' } })).s === 200 && lastC().state === 'paused' && lastC().reason === 'testing', 'pause all is saved to agents/control.json')
  const gate1 = await call('run_workflow', { method: 'POST', body: { workflow: 'sprint', inputs: {} } })
  ok(gate1.s === 409 && /paused/.test(gate1.d.error), 'a paused state blocks every manual agent start in the backend')
  ok((await call('control_set', { method: 'POST', body: { action: 'resume' } })).s === 200 && lastC().state === 'running', 'resume')
  const nd = dispatches.length
  ok((await call('run_workflow', { method: 'POST', body: { workflow: 'sprint', inputs: { minutes: '150', max: '40', budget: '20' } } })).s === 200 && dispatches.length === nd + 1 && dispatches.at(-1).p.endsWith('/sprint.yml/dispatches') && dispatches.at(-1).b.inputs.minutes === '150', 'a sprint can be started when running')
  ok((await call('run_workflow', { method: 'POST', body: { workflow: 'sprint', inputs: { minutes: '5' } } })).s === 400, 'sprint inputs are validated')
  const kl = await call('control_set', { method: 'POST', body: { action: 'kill', reason: 'emergency' } })
  ok(kl.s === 200 && lastC().state === 'killed' && /Kill switch on/.test(kl.d.message), 'kill switch is saved')
  ok((await call('run_workflow', { method: 'POST', body: { workflow: 'events', inputs: {} } })).s === 409 && (await call('control_set', { method: 'POST', body: { action: 'resume' } })).s === 409, 'while killed nothing starts and a plain resume is refused')
  ok((await call('control_set', { method: 'POST', body: { action: 'reset' } })).s === 400 && (await call('control_set', { method: 'POST', body: { action: 'reset', confirm: true } })).s === 200 && lastC().state === 'running', 'reset needs explicit confirmation')
  ok((await call('control_set', { method: 'POST', body: { action: 'job', job: 'sprint', enabled: false } })).s === 200 && lastC().agents.sprint === false && (await call('run_workflow', { method: 'POST', body: { workflow: 'sprint', inputs: {} } })).s === 409, 'a single job can be switched off')
  await call('control_set', { method: 'POST', body: { action: 'job', job: 'sprint', enabled: true } })
  ok((await call('control_set', { method: 'POST', body: { action: 'job', job: '../x', enabled: true } })).s === 400, 'unknown jobs are refused')
  ok((await call('topic_add', { method: 'POST', body: { name: 'Test Topic One', category: 'temples', district: 'Kollam', priority: 1 } })).s === 200 && lastC().topics[0].id === 'test-topic-one' && lastC().topics[0].status === 'todo', 'a topic can be added to the register')
  ok((await call('topic_add', { method: 'POST', body: { name: 'Test Topic One', category: 'temples' } })).s === 409 && (await call('topic_add', { method: 'POST', body: { name: 'Bad', category: 'nope' } })).s === 400, 'duplicates and bad categories are refused')
  ok((await call('topic_set', { method: 'POST', body: { id: 'test-topic-one', status: 'skipped' } })).s === 200 && lastC().topics[0].status === 'skipped' && (await call('control_get')).d.counts.skipped === 1, 'a topic can be skipped and the dashboard counts it')
  delete files['agents/control.json']; delete files['agents/registers/topics.json']
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
  const cvs = await call('agent_settings_save', { method: 'POST', body: { coverage: { perCategory: 40, perDistrictMin: 3, enabled: false } } }); const cvj = JSON.parse(commits[commits.length - 1].tree[0].content)
  ok(cvs.s === 200 && cvj.coverage.perCategory === 40 && cvj.coverage.perDistrictMin === 3 && cvj.coverage.enabled === false && cvj.provider === 'openai', 'the coverage targets are saved without disturbing other settings')
  ok((await call('agent_settings_save', { method: 'POST', body: { coverage: { perCategory: 500 } } })).s === 400 && (await call('agent_settings_save', { method: 'POST', body: { coverage: { perDistrictMin: 'x' } } })).s === 400, 'out-of-range coverage targets are refused')
  ok((await call('coverage_get')).s === 200, 'the coverage table endpoint answers (empty until the first run)')
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
  // ---------------------------------------------------------------- bookings module (locked by default)
  {
  const stay = await addProvider({ type: 'stay', businessName: 'Backwater Homestay', credentialKind: 'Kerala Tourism homestay registration', credentialNumber: 'KT-H-1' })
  const cab = await addProvider({ type: 'transport', businessName: 'Kollam Auto Union', credentialKind: '', credentialNumber: '' }, { phone: true })
  const bs0 = await (await fetch('http://127.0.0.1:18911/api/booking-status.php')).json()
  ok(bs0.open === false && bs0.partners.length === 0, 'bookings: locked by default, no partners are exposed')
  const trav = (o = {}) => ({ providerId: stay.id, name: 'Meera', contactPhone: '+91 98470 12345', contactEmail: 'meera@example.com', checkIn: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10), checkOut: new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10), people: '2', message: 'Day 1: Alappuzha Backwaters. Day 2: Varkala Beach.', consent: '1', ...o })
  ok((await pp('submit-booking', trav())).s === 403, 'bookings: a request is refused while the module is locked')
  const bo = await call('bk_overview'); const cap = id => bo.d.caps.find(c => c.id === id)
  ok(bo.d.caps.length === 5 && bo.d.caps.every(c => c.open === false) && cap('enquiries').missing.length === 5, 'bookings: every capability starts locked with its missing items listed')
  const on0 = await call('bk_cap_set', { method: 'POST', body: { cap: 'enquiries', enabled: true } })
  ok(on0.s === 422 && on0.d.blockers.length === 5, 'bookings: cannot switch on without the approvals recorded')
  const fullEnq = { cap: 'enquiries', checklist: { terms: true, grievance: true, agreements: true, retention: true }, evidence: { grievanceOfficer: 'Asha, stay@example.com' } }
  ok((await call('bk_cap_save', { method: 'POST', body: fullEnq })).d.missing.length === 0, 'bookings: recording the approvals clears the missing list')
  ok((await call('bk_cap_set', { method: 'POST', body: { cap: 'enquiries', enabled: true } })).s === 200, 'bookings: enquiries can be switched on once every item is recorded')
  ok((await pp('submit-booking', trav())).s === 404, 'bookings: a provider without a signed agreement cannot take requests')
  ok((await call('bk_partner_set', { method: 'POST', body: { id: stay.id, partner: true } })).s === 422, 'bookings: a partner needs the agreement date and the registration check')
  ok((await call('bk_partner_set', { method: 'POST', body: { id: stay.id, partner: true, agreementOn: '2026-11-01', registrationChecked: true } })).s === 200, 'bookings: a partner is switched on with agreement date and registration check')
  ok((await call('bk_partner_set', { method: 'POST', body: { id: cab.id, partner: true, agreementOn: '2026-11-01', registrationChecked: true, feeMode: 'percent', feeValue: 0.5 } })).s === 200, 'bookings: a transport partner can have its own fee')
  const bs1 = await (await fetch('http://127.0.0.1:18911/api/booking-status.php')).json()
  ok(bs1.open === true && bs1.partners.length === 2 && !JSON.stringify(bs1).includes('@example.com') && !JSON.stringify(bs1).includes('98470'), 'bookings: open, partners listed, no private contact details exposed')
  ok((await pp('submit-booking', trav({ consent: '' }))).s === 422 && (await pp('submit-booking', trav({ message: 'see www.x.com' }))).s === 422 && (await pp('submit-booking', trav({ checkIn: '2020-01-01', checkOut: '2020-01-02' }))).s === 422 && (await pp('submit-booking', trav({ people: '99' }))).s === 422, 'bookings: consent, links, past dates and party size are validated')
  const rq = await pp('submit-booking', trav()); const ref1 = rq.d.ref
  ok(rq.s === 200 && /^VH-\d{4}-[A-Z2-9]{4}$/.test(ref1) && outbox().some(m => m.to === 'meera@example.com' && m.body.includes(ref1)), 'bookings: a request gets a booking reference and the traveller is emailed it')
  const list1 = (await call('bk_overview')).d.bookings; const b1 = list1.find(b => b.ref === ref1)
  const sent = await call('bk_send', { method: 'POST', body: { id: b1.id } })
  ok(sent.s === 200 && outbox().some(m => m.to === stay.f.email.toLowerCase() && m.body.includes(ref1) && m.body.includes('meera@example.com')), 'bookings: the admin sends the request to the partner with the reference')
  const done0 = await call('bk_status', { method: 'POST', body: { id: b1.id, status: 'completed', valueInr: 10000 } })
  const after0 = JSON.parse(fs.readFileSync(path.join(tmp, `data/bookings/items/${b1.id}.json`), 'utf8'))
  ok(done0.s === 200 && after0.commissionInr === null && after0.contactEmail === '' && after0.contactPhone === '' && after0.message === '' && after0.ref === ref1, 'bookings: completing a booking with commission locked records no commission and deletes the traveller details')
  ok((await call('bk_settlement')).s === 403, 'bookings: settlement is locked until commission is switched on')
  ok((await call('bk_cap_set', { method: 'POST', body: { cap: 'payments', enabled: true } })).s === 422 && (await call('bk_cap_set', { method: 'POST', body: { cap: 'rides', enabled: true } })).s === 422, 'bookings: payments and rides cannot be switched on before their approvals are recorded')
  const payAll = await call('bk_cap_save', { method: 'POST', body: { cap: 'payments', checklist: { aggregator: true, ca: true, refunds: true, legal: true }, evidence: { aggregatorName: 'Razorpay MID123' } } })
  ok(payAll.d.missing.length === 1 && /Commission/.test(payAll.d.missing[0]) && (await call('bk_cap_set', { method: 'POST', body: { cap: 'payments', enabled: true } })).s === 422, 'bookings: payments stay locked until commission is on, even when every approval is recorded')
  const comBad = await call('bk_cap_save', { method: 'POST', body: { cap: 'commission', checklist: { gst: true, invoicing: true, agreement: true }, evidence: { gstin: 'not a gstin' } } })
  ok(comBad.d.missing.some(m => /format/.test(m)), 'bookings: a malformed GSTIN is not accepted')
  await call('bk_cap_save', { method: 'POST', body: { cap: 'commission', checklist: { gst: true, invoicing: true, agreement: true }, evidence: { gstin: '32ABCDE1234F1Z5' } } })
  ok((await call('bk_cap_set', { method: 'POST', body: { cap: 'commission', enabled: true } })).s === 200, 'bookings: commission switches on with a valid GSTIN')
  const rq2 = await pp('submit-booking', trav({ providerId: cab.id, contactEmail: 'ravi@example.com' })); const b2 = (await call('bk_overview')).d.bookings.find(b => b.ref === rq2.d.ref)
  ok((await call('bk_status', { method: 'POST', body: { id: b2.id, status: 'completed' } })).s === 422, 'bookings: with commission on, completing needs the booking value')
  const d2 = await call('bk_status', { method: 'POST', body: { id: b2.id, status: 'completed', valueInr: 20000 } })
  ok(d2.s === 200 && d2.d.commissionInr === 100, 'bookings: commission is computed in code from the value and the partner rate (0.5% of 20000 = 100)')
  const rq3 = await pp('submit-booking', trav({ providerId: cab.id, contactEmail: 'k@example.com' })); const b3 = (await call('bk_overview')).d.bookings.find(b => b.ref === rq3.d.ref)
  await call('bk_status', { method: 'POST', body: { id: b3.id, status: 'completed', valueInr: 5000 } })
  const mon = new Date().toISOString().slice(0, 7); const st = await call('bk_settlement', { q: '&month=' + mon }); const row = st.d.rows.find(r => r.providerId === cab.id)
  ok(row && row.bookings === 2 && row.valueInr === 25000 && row.commissionInr === 125 && row.gstInr === 22.5 && row.totalDueInr === 147.5 && st.d.csv.includes('147.5'), 'bookings: the monthly sheet adds value, commission, GST at 18% and total due, with a CSV')
  ok((await call('bk_settle', { method: 'POST', body: { providerId: cab.id, month: mon, reference: 'INV-001' } })).d.message.startsWith('2 booking'), 'bookings: a month can be marked settled with an invoice reference')
  ok((await call('bk_settlement', { q: '&month=' + mon })).d.rows.find(r => r.providerId === cab.id).settled === true, 'bookings: the sheet shows it settled')
  await call('bk_cap_save', { method: 'POST', body: { cap: 'enquiries', checklist: { terms: true, grievance: false, agreements: true, retention: true }, evidence: { grievanceOfficer: 'Asha' } } })
  ok((await pp('submit-booking', trav())).s === 403, 'bookings: removing an approval switches the capability off again')
  ok((await call('bk_status', { method: 'POST', body: { id: b1.id, status: 'bogus' } })).s === 400 && (await call('bk_settings', { method: 'POST', body: { feeMode: 'percent', feeValue: 50, gstRate: 18 } })).s === 400 && (await call('bk_settings', { method: 'POST', body: { feeMode: 'flat', feeValue: 99999, gstRate: 18 } })).s === 400 && (await call('bk_settings', { method: 'POST', body: { feeMode: 'weekly', feeValue: 1, gstRate: 18 } })).s === 400, 'bookings: bad status and bad fees are rejected')
  // flat fee: default flat Rs 50 per booking, with and without a known booking value
  ok((await call('bk_settings', { method: 'POST', body: { feeMode: 'flat', feeValue: 50, gstRate: 18 } })).s === 200, 'bookings: the default fee can be a flat amount')
  await call('bk_cap_save', { method: 'POST', body: fullEnq }); await call('bk_cap_set', { method: 'POST', body: { cap: 'enquiries', enabled: true } })
  const rq4 = await pp('submit-booking', trav({ contactEmail: 'f@example.com' })); const b4 = (await call('bk_overview')).d.bookings.find(b => b.ref === rq4.d.ref)
  const d4 = await call('bk_status', { method: 'POST', body: { id: b4.id, status: 'completed' } })
  ok(d4.s === 200 && d4.d.commissionInr === 50, 'bookings: a flat fee needs no booking value (Rs 50)')
  const rq5 = await pp('submit-booking', trav({ contactEmail: 'g@example.com' })); const b5 = (await call('bk_overview')).d.bookings.find(b => b.ref === rq5.d.ref)
  ok((await call('bk_status', { method: 'POST', body: { id: b5.id, status: 'completed', valueInr: 30 } })).d.commissionInr === 30, 'bookings: a flat fee never exceeds the booking value')
  }


  // ---------------------------------------------------------------- stays, rides and Razorpay payments
  {
    const fullEnq = { cap: 'enquiries', checklist: { terms: true, grievance: true, agreements: true, retention: true }, evidence: { grievanceOfficer: 'Asha, stay@example.com' } }
    const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest('hex')
    const trk = async (url) => (await fetch('http://127.0.0.1:18911/api/' + url)).json()
    const jp = async (ep, body) => { const r = await fetch('http://127.0.0.1:18911/api/' + ep, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { s: r.status, d: await r.json().catch(() => ({})) } }
    const stay2 = await addProvider({ type: 'stay', businessName: 'Lake View Villa', credentialKind: 'Kerala Tourism homestay registration', credentialNumber: 'KT-H-2' })
    const cab2 = await addProvider({ type: 'transport', businessName: 'Kollam Cabs A', credentialKind: '', credentialNumber: '' }, { phone: true })
    const cab3 = await addProvider({ type: 'transport', businessName: 'Kollam Cabs B', credentialKind: '', credentialNumber: '' }, { phone: true })
    const ag = { partner: true, agreementOn: '2026-11-01', registrationChecked: true }
    for (const x of [stay2, cab2, cab3]) await call('bk_partner_set', { method: 'POST', body: { id: x.id, ...ag } })
    // open every capability: the approvals are recorded (the owner's statement), then the switches
    await call('bk_cap_save', { method: 'POST', body: fullEnq }); await call('bk_cap_set', { method: 'POST', body: { cap: 'enquiries', enabled: true } })
    await call('bk_cap_save', { method: 'POST', body: { cap: 'commission', checklist: { gst: true, invoicing: true, agreement: true }, evidence: { gstin: '32ABCDE1234F1Z5' } } }); await call('bk_cap_set', { method: 'POST', body: { cap: 'commission', enabled: true } })
    await call('bk_cap_save', { method: 'POST', body: { cap: 'stays', checklist: { registration: true, pricing: true, policy: true }, evidence: { stayPolicyNote: 'terms page' } } })
    await call('bk_cap_save', { method: 'POST', body: { cap: 'rides', checklist: { licence: true, drivers: true, fares: true }, evidence: { aggregatorLicence: 'LIC-1 State RTO' } } })
    await call('bk_cap_save', { method: 'POST', body: { cap: 'payments', checklist: { aggregator: true, ca: true, refunds: true, legal: true }, evidence: { aggregatorName: 'Razorpay MID9' } } })
    ok((await call('bk_cap_set', { method: 'POST', body: { cap: 'stays', enabled: true } })).s === 200 && (await call('bk_cap_set', { method: 'POST', body: { cap: 'rides', enabled: true } })).s === 200, 'commerce: stays and rides switch on once their approvals are recorded')
    ok((await call('bk_cap_set', { method: 'POST', body: { cap: 'payments', enabled: true } })).s === 200, 'commerce: payments switch on when the keys are in vh-config.php, enquiries and commission are on, and approvals are recorded')
    ok((await call('bk_settings', { method: 'POST', body: { feeMode: 'percent', feeValue: 2, gstRate: 18, tcsPercent: 1, tdsPercent: 0.1, rideRates: { car: { baseInr: 50, perKmInr: 14, minInr: 150, nightPct: 20 } } } })).s === 200, 'commerce: fee, GST, TCS, TDS and the ride rate card are saved')
    ok((await call('bk_inventory_set', { method: 'POST', body: { id: stay2.id, razorpayAccountId: 'bad' } })).s === 400, 'commerce: a malformed Razorpay account ID is rejected')
    const invOk = await call('bk_inventory_set', { method: 'POST', body: { id: stay2.id, razorpayAccountId: 'acc_TestAccount01', rooms: [{ id: 'deluxe', name: 'Deluxe', capacity: 2, count: 1, rateInr: 3000 }], blocked: { deluxe: ['2099-01-05'] } } })
    await call('bk_inventory_set', { method: 'POST', body: { id: cab2.id, razorpayAccountId: 'acc_CabAccount0A', vehicles: ['car'] } }); await call('bk_inventory_set', { method: 'POST', body: { id: cab3.id, razorpayAccountId: 'acc_CabAccount0B', vehicles: ['car'] } })
    ok(invOk.s === 200, 'commerce: rooms, rates, blocked dates and account IDs are saved for a partner')
    const st = await trk('booking-status.php')
    ok(st.caps.stays && st.caps.rides && st.caps.payments && st.stays.some(x => x.rooms?.[0]?.rateInr === 3000) && st.rides.points.length > 10 && st.rides.vehicles.length === 1 && !JSON.stringify(st).includes('acc_') && !JSON.stringify(st).includes('@example.com'), 'commerce: the public status shows rooms, ride points and vehicles but no account IDs or contacts')

    // ---- stay with online payment
    const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
    const sb = (o = {}) => ({ providerId: stay2.id, roomId: 'deluxe', checkIn: day(20), checkOut: day(22), guests: '2', name: 'Anil', contactEmail: 'anil@example.com', contactPhone: '+91 98470 22222', consent: '1', message: '', ...o })
    ok((await pp('submit-booking', {}).catch(() => ({ s: 0 }))).s !== 500, 'commerce: (smoke) public endpoints respond')
    ok((await pp('stay-book', sb({ guests: '3' }))).s === 409 && (await pp('stay-book', sb({ checkIn: '2099-01-04', checkOut: '2099-01-06' }))).s === 409 && (await pp('stay-book', sb({ roomId: 'nope' }))).s === 409 && (await pp('stay-book', sb({ consent: '' }))).s === 422, 'commerce: stay rejects too many guests, blocked dates, an unknown room and missing consent')
    const s1 = await pp('stay-book', sb()); const ref = s1.d.ref
    ok(s1.s === 200 && s1.d.mode === 'online' && s1.d.amountInr === 6000 && s1.d.nights === 2 && s1.d.payToken && s1.d.holdMinutes === 30, 'commerce: a stay is priced from the room rate (2 nights x 3000 = 6000) and held for payment')
    ok((await pp('stay-book', sb({ name: 'Other', contactEmail: 'other@example.com' }))).s === 409, 'commerce: the held room cannot be booked by a second traveller')
    ok((await jp('pay-create.php', { ref, token: 'wrong', amount: 1 })).s === 404, 'commerce: a wrong payment token is refused')
    const pc = await jp('pay-create.php', { ref, token: s1.d.payToken, amount: 1 })
    ok(pc.s === 200 && pc.d.amountPaise === 600000 && pc.d.keyId === 'rzp_test_key' && !JSON.stringify(pc.d).includes('sekret') && rzCalls.find(c => c.path === '/v1/orders' && c.b.amount === 600000 && c.auth?.startsWith('Basic ')), 'commerce: the order amount comes from our record (600000 paise), not from the browser')
    ok((await jp('pay-create.php', { ref, token: s1.d.payToken })).d.orderId === pc.d.orderId && rzCalls.filter(c => c.path === '/v1/orders').length === 1, 'commerce: asking again returns the same order, no duplicate')
    ok((await jp('pay-verify.php', { ref, token: s1.d.payToken, razorpay_order_id: pc.d.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'f'.repeat(64) })).s === 400 && !rzCalls.some(c => c.path.includes('/transfers')), 'commerce: a bad payment signature does not mark anything paid')
    const pv = await jp('pay-verify.php', { ref, token: s1.d.payToken, razorpay_order_id: pc.d.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: hmac('sekret', pc.d.orderId + '|pay_1') })
    const tr = rzCalls.find(c => c.path === '/v1/payments/pay_1/transfers')
    ok(pv.s === 200 && pv.d.paid && pv.d.status === 'confirmed', 'commerce: a valid signature marks the stay paid and confirmed')
    ok(tr && tr.b.transfers[0].account === 'acc_TestAccount01' && tr.b.transfers[0].on_hold === 1 && tr.b.transfers[0].amount === 579240, 'commerce: the partner share is a HELD transfer: 6000 - fee 120 - GST 21.60 - TCS 60 - TDS 6 = 5792.40')
    const wh = (ev, id) => fetch('http://127.0.0.1:18911/api/razorpay-webhook.php', { method: 'POST', headers: { 'x-razorpay-signature': hmac('whsec', JSON.stringify(ev)), ...(id ? { 'x-razorpay-event-id': id } : {}) }, body: JSON.stringify(ev) })
    const evCap = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: pc.d.orderId, amount: 600000, notes: { ref } } } } }
    ok((await fetch('http://127.0.0.1:18911/api/razorpay-webhook.php', { method: 'POST', headers: { 'x-razorpay-signature': 'bad' }, body: JSON.stringify(evCap) })).status === 400, 'commerce: a webhook with a bad signature is refused')
    await wh(evCap, 'evt_1'); const dup = await (await wh(evCap, 'evt_1')).json()
    ok(dup.duplicate === true && rzCalls.filter(c => c.path.includes('/transfers')).length === 1, 'commerce: a replayed webhook does nothing (one transfer only)')
    // webhook alone can confirm a payment the browser never reported
    const s2 = await pp('stay-book', sb({ checkIn: day(30), checkOut: day(31), contactEmail: 'w@example.com' })); const pc2 = await jp('pay-create.php', { ref: s2.d.ref, token: s2.d.payToken })
    await wh({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_2', order_id: pc2.d.orderId, amount: 1, notes: { ref: s2.d.ref } } } } }, 'evt_2')
    ok((await jp('pay-create.php', { ref: s2.d.ref, token: s2.d.payToken })).d.paid !== true, 'commerce: a webhook with the wrong amount is ignored')
    await wh({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_2', order_id: pc2.d.orderId, amount: 300000, notes: { ref: s2.d.ref } } } } }, 'evt_3')
    ok((await jp('pay-create.php', { ref: s2.d.ref, token: s2.d.payToken })).d.paid === true, 'commerce: the webhook alone confirms a payment when the tab was closed')
    const all = (await call('bk_overview')).d.bookings; const bk1 = all.find(b => b.ref === ref)
    ok(bk1.payment.status === 'paid' && bk1.feeInr === 120 && bk1.gstInr === 21.6 && bk1.partnerShareInr === 5792.4 && bk1.payTokenHash === undefined, 'commerce: the admin sees the money split, never the token')
    // refunds and payout release
    const r1 = await call('bk_pay_action', { method: 'POST', body: { id: bk1.id, action: 'refund', amountInr: 1000 } }); const rf = rzCalls.find(c => c.path === '/v1/payments/pay_1/refund')
    ok(r1.s === 200 && rf.b.amount === 100000 && rf.b.reverse_all === 1, 'commerce: a part refund is sent with the partner transfer reversed')
    ok((await call('bk_pay_action', { method: 'POST', body: { id: bk1.id, action: 'refund', amountInr: 99999 } })).s === 422, 'commerce: a refund above what is left is refused')
    ok((await call('bk_pay_action', { method: 'POST', body: { id: bk1.id, action: 'refund' } })).s === 200 && (await call('bk_overview')).d.bookings.find(b => b.ref === ref).status === 'cancelled', 'commerce: refunding the rest cancels the booking')
    const bk2 = (await call('bk_overview')).d.bookings.find(b => b.ref === s2.d.ref)
    ok((await call('bk_pay_action', { method: 'POST', body: { id: bk2.id, action: 'release' } })).s === 200 && rzCalls.some(c => c.method === 'PATCH' && c.b.on_hold === 0), 'commerce: the held payout is released on request')
    // fee is a flat fee for this partner? keep default; completed online booking keeps its fee
    const done = await call('bk_status', { method: 'POST', body: { id: bk2.id, status: 'completed' } })
    ok(done.s === 200, 'commerce: an online-paid booking completes without re-entering a value')

    // ---- rides
    const q = await trk('ride-quote.php?pickup=karunagappally&drop=trv-airport&vehicle=car&when=' + encodeURIComponent(new Date(Date.now() + 2 * 864e5).toISOString().replace(/T\d\d/, 'T06')))
    ok(q.ok && q.km > 70 && q.km < 130 && q.partners === 2 && Math.abs(q.fareInr - Math.max(150, 50 + q.km * 14)) < 0.02, `commerce: fare estimate from the rate card and distance (${q.km} km, Rs ${q.fareInr}, 2 partners)`)
    const night = await trk('ride-quote.php?pickup=karunagappally&drop=trv-airport&vehicle=car&when=' + encodeURIComponent('2099-01-01T23:30:00+05:30'))
    ok(Math.abs(night.fareInr - q.fareInr * 1.2) < 0.05 || night.fareInr > q.fareInr, 'commerce: the night surcharge applies from 10pm to 5am')
    const nL = await trk('ride-quote.php?pickup=karunagappally&drop=trv-airport&vehicle=car&when=2099-01-01T23:30'), dL = await trk('ride-quote.php?pickup=karunagappally&drop=trv-airport&vehicle=car&when=2099-01-01T12:00')
    ok(Math.abs(nL.fareInr - dL.fareInr * 1.2) < 0.05, 'commerce: a pickup time typed without a time zone is read as India time (23:30 gets the night surcharge, 12:00 does not)')
    const when = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 16)
    const rb = (o = {}) => ({ pickup: 'karunagappally', drop: 'trv-airport', vehicle: 'car', when, guests: '2', name: 'Divya', contactEmail: 'divya@example.com', contactPhone: '+91 98470 33333', consent: '1', ...o })
    ok((await pp('ride-book', rb({ guests: '9' }))).s === 422 && (await pp('ride-book', rb({ pickup: 'amritapuri', drop: 'amritapuri' }))).s === 422 && (await pp('ride-book', rb({ when: '2020-01-01T10:00' }))).s === 422 && (await pp('ride-book', rb({ vehicle: 'suv' }))).s === 422, 'commerce: ride rejects too many passengers, same point, a past time and an unpriced vehicle')
    const rd = await pp('ride-book', rb()); const rref = rd.d.ref
    ok(rd.s === 200 && rd.d.mode === 'online' && rd.d.amountInr > 100 && rd.d.payToken, 'commerce: a ride is priced and waits for payment before any driver is asked')
    ok(!outbox().some(m => /Ride request/.test(m.subject) && m.body.includes(rref)), 'commerce: no driver is contacted before payment')
    const rpc = await jp('pay-create.php', { ref: rref, token: rd.d.payToken })
    await jp('pay-verify.php', { ref: rref, token: rd.d.payToken, razorpay_order_id: rpc.d.orderId, razorpay_payment_id: 'pay_r1', razorpay_signature: hmac('sekret', rpc.d.orderId + '|pay_r1') })
    const reqMails = outbox().filter(m => /Ride request/.test(m.subject) && m.body.includes(rref))
    ok(reqMails.length === 2, 'commerce: after payment the ride goes to both partners that run a car in Kollam')
    const link = m => m.body.match(/#id=([\d]{8}-[0-9a-f]{8})&p=([\d]{8}-[0-9a-f]{8})&t=([0-9a-f]{48})/)
    const mA = reqMails.find(m => m.to === cab2.f.email.toLowerCase()), mB = reqMails.find(m => m.to === cab3.f.email.toLowerCase()); const LA = link(mA), LB = link(mB)
    const view = await trk(`ride-claim.php?id=${LA[1]}&p=${LA[2]}&t=${LA[3]}`)
    ok(view.ride.pickup.includes('Karunagappally') && view.ride.online === true && (await trk(`ride-claim.php?id=${LA[1]}&p=${LA[2]}&t=bad`)).ok === false, 'commerce: the driver link shows the ride; a wrong token shows nothing')
    ok((await jp('ride-claim.php', { id: LA[1], p: LA[2], t: LA[3], driverName: 'Raju' })).s === 422, 'commerce: claiming needs driver name, phone and vehicle number')
    const cl = await jp('ride-claim.php', { id: LA[1], p: LA[2], t: LA[3], driverName: 'Raju', driverPhone: '+91 98470 44444', vehicleNo: 'KL 02 AB 1234' })
    ok(cl.s === 200 && (await jp('ride-claim.php', { id: LB[1], p: LB[2], t: LB[3], driverName: 'Sunil', driverPhone: '+91 98470 55555', vehicleNo: 'KL 02 CD 5678' })).s === 409, 'commerce: the first driver gets the ride and the second is told it is taken')
    const code = outbox().filter(m => m.to === 'divya@example.com' && /driver/i.test(m.subject)).pop()?.body.match(/Trip code: (\d{4})/)?.[1]
    const stt = await trk(`ride-status.php?ref=${rref}&t=${rd.d.payToken}`)
    ok(code && stt.status === 'assigned' && stt.driver.name === 'Raju' && stt.tripCode === code && rzCalls.some(c => c.path === '/v1/payments/pay_r1/transfers' && c.b.transfers[0].account === 'acc_CabAccount0A'), 'commerce: the traveller gets driver details and a trip code, and the payout transfer goes to the claiming partner')
    ok((await trk(`ride-status.php?ref=${rref}&t=wrong`)).ok === false, 'commerce: ride status needs the private token')
    ok((await jp('ride-trip.php', { id: LA[1], p: LA[2], t: LA[3], action: 'start', otp: '0000' })).s === 422 && (await jp('ride-trip.php', { id: LA[1], p: LA[2], t: LA[3], action: 'complete' })).s === 422, 'commerce: a wrong trip code cannot start the trip, and a trip cannot complete before it starts')
    ok((await jp('ride-trip.php', { id: LB[1], p: LB[2], t: LB[3], action: 'start', otp: code })).s === 404, 'commerce: only the driver who accepted can run the trip')
    ok((await jp('ride-trip.php', { id: LA[1], p: LA[2], t: LA[3], action: 'start', otp: code })).s === 200, 'commerce: the trip starts with the right trip code')
    const rel0 = rzCalls.filter(c => c.method === 'PATCH').length; const fin = await jp('ride-trip.php', { id: LA[1], p: LA[2], t: LA[3], action: 'complete' })
    const rbk = (await call('bk_overview')).d.bookings.find(b => b.ref === rref)
    ok(fin.s === 200 && rzCalls.filter(c => c.method === 'PATCH').length === rel0 + 1 && rbk.status === 'completed' && rbk.contactEmail === '' && rbk.payment.payoutHeld === false, 'commerce: completing the trip releases the held payout and deletes the traveller details')

    // ---- pay on site when payments are off
    ok((await call('bk_cap_set', { method: 'POST', body: { cap: 'payments', enabled: false } })).s === 200, 'commerce: payments can be switched off')
    const ro = await pp('ride-book', rb({ contactEmail: 'onsite@example.com' }))
    ok(ro.d.mode === 'onsite' && ro.d.partnersTold === 2 && outbox().filter(m => /Ride request/.test(m.subject) && m.body.includes(ro.d.ref)).length === 2, 'commerce: with payments off, a ride goes straight to drivers and is paid to the driver')
    const so = await pp('stay-book', sb({ checkIn: day(40), checkOut: day(41), contactEmail: 'so@example.com' }))
    ok(so.d.mode === 'onsite' && !so.d.payToken, 'commerce: with payments off, a stay becomes a request paid on site')
    ok((await jp('pay-create.php', { ref, token: s1.d.payToken })).s === 403 && (await call('bk_pay_action', { method: 'POST', body: { id: bk1.id, action: 'refund' } })).s === 403, 'commerce: payment endpoints and refunds are locked when payments are off')
  }


  // ---------------------------------------------------------------- test mode: everything open for testing, nothing real
  {
    const trk = async url => (await fetch('http://127.0.0.1:18911/api/' + url)).json()
    fs.rmSync(path.join(tmp, 'data/bookings/config.json'), { force: true })   // back to the locked default
    const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
    const s0 = await trk('booking-status.php')
    ok(!s0.testMode && Object.values(s0.caps).every(v => v === false), 'test mode: everything is locked before test mode is switched on')
    const on = await call('bk_testmode', { method: 'POST', body: { enabled: true } })
    const s1 = await trk('booking-status.php')
    ok(on.s === 200 && s1.testMode === true && s1.caps.enquiries && s1.caps.stays && s1.caps.rides && s1.caps.payments, 'test mode: one switch opens enquiries, stays, rides and payments (test keys present) with no approvals recorded')
    const stayT = await addProvider({ type: 'stay', businessName: 'Test Homestay', credentialKind: 'Kerala Tourism homestay registration', credentialNumber: 'KT-H-9' })
    ok((await call('bk_partner_set', { method: 'POST', body: { id: stayT.id, partner: true } })).s === 200, 'test mode: a partner can be switched on without an agreement or registration check')
    await call('bk_inventory_set', { method: 'POST', body: { id: stayT.id, razorpayAccountId: 'acc_TestStay00001', rooms: [{ id: 'r1', name: 'Room', capacity: 2, count: 1, rateInr: 2000 }] } })
    const mailsBefore = outbox().length
    const bkT = await pp('stay-book', { providerId: stayT.id, roomId: 'r1', checkIn: day(50), checkOut: day(51), guests: '2', name: 'Tester', contactEmail: 'traveller-t@example.com', contactPhone: '+91 98470 66666', consent: '1' })
    const rowT = (await call('bk_overview')).d.bookings.find(b => b.ref === bkT.d.ref)
    ok(bkT.s === 200 && bkT.d.mode === 'online' && rowT.test === true, 'test mode: a booking works end to end and is flagged TEST')
    const newMails = outbox().slice(mailsBefore)
    ok(!newMails.some(m => m.to === 'traveller-t@example.com' || m.to === stayT.f.email.toLowerCase()), 'test mode: no email is sent to the traveller or the partner')
    ok(newMails.every(m => m.to === 'owner@example.com'), 'test mode: every message goes to the owner only')
    await call('bk_status', { method: 'POST', body: { id: rowT.id, status: 'cancelled' } })
    const sendT = await pp('submit-booking', { providerId: stayT.id, name: 'T', contactEmail: 't2@example.com', checkIn: day(60), checkOut: day(61), people: '2', consent: '1', message: 'test' })
    const rowS = (await call('bk_overview')).d.bookings.find(b => b.ref === sendT.d.ref); const m0 = outbox().length
    await call('bk_send', { method: 'POST', body: { id: rowS.id } })
    const sentMail = outbox().slice(m0)
    ok(sentMail.length === 1 && sentMail[0].to === 'owner@example.com' && /^\[TEST\] to /.test(sentMail[0].subject) && sentMail[0].body.startsWith('TEST MODE'), 'test mode: "send to partner" is redirected to the owner and clearly marked')
    // live keys never take money in test mode
    const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-live-')); fs.mkdirSync(path.join(cfgDir, 'data/bookings'), { recursive: true }); fs.writeFileSync(path.join(cfgDir, 'data/bookings/config.json'), JSON.stringify({ testMode: true }))
    fs.writeFileSync(path.join(cfgDir, 'vh-config.php'), `<?php return ['data_dir'=>'${cfgDir}/data','razorpay_key_id'=>'rzp_live_abc','razorpay_key_secret'=>'x','razorpay_webhook_secret'=>'y'];`)
    const live = spawnSync('php', ['-r', 'define("VH_LIB",1); require "public/api/lib/commerce.php"; echo json_encode([bk_open("payments"), bk_open("stays"), bk_open("rides")]);'], { encoding: 'utf8', env: { ...process.env, VH_CONFIG: path.join(cfgDir, 'vh-config.php') } })
    ok(live.stdout.trim() === '[false,true,true]', 'test mode: with LIVE Razorpay keys, payments stay closed (stays and rides still open for testing)')
    fs.rmSync(cfgDir, { recursive: true, force: true })
    // ---- partner portal: emailed sign-in link, then rides, bookings, rooms
    {
      const hm = (k, d) => crypto.createHmac('sha256', k).update(d).digest('hex')
      const J = async (url, body, token) => { const r = await fetch('http://127.0.0.1:18911/api/' + url, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { 'x-partner-token': token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, d: await r.json().catch(() => ({})) } }
      await call('bk_test_partner', { method: 'POST', body: { name: 'Portal Stay', type: 'stay', district: 'Kollam' } }); await call('bk_test_partner', { method: 'POST', body: { name: 'Portal Cab', type: 'transport', district: 'Kollam' } })
      const pv = (await call('bk_overview')).d.partners; const pStay = pv.find(x => x.name === 'Portal Stay (TEST)'), pCab = pv.find(x => x.name === 'Portal Cab (TEST)')
      ok(/^owner\+test[0-9a-f]{4}@example\.com$/.test(pStay.email) && pStay.email !== pCab.email, 'portal: each test partner gets its own sign-in address')
      await call('bk_inventory_set', { method: 'POST', body: { id: pStay.id, rooms: [{ id: 'room1', name: 'Room', capacity: 2, count: 1, rateInr: 1500 }] } }); await call('bk_inventory_set', { method: 'POST', body: { id: pCab.id, vehicles: ['car'] } })
      const outs = outbox().length
      const lg0 = await J('partner.php?a=login', { email: 'nobody@example.com' }); const lgS = await J('partner.php?a=login', { email: pStay.email })
      ok(lg0.s === 200 && lgS.s === 200 && JSON.stringify(lg0.d) === JSON.stringify(lgS.d), 'portal: asking for a link answers the same for partners and strangers')
      const mails = outbox().slice(outs); const lm = mails.find(m => /sign-in link/.test(m.subject)); const lt = lm?.body.match(/#t=([0-9a-f]{48})/)?.[1]
      ok(mails.length === 1 && lm.to === 'owner@example.com' && lm.subject.includes(pStay.email) && lt, 'portal: the sign-in link is emailed (to the owner in test mode, naming the partner)')
      ok((await J('partner.php?a=session', { token: 'f'.repeat(48) })).s === 401, 'portal: a wrong sign-in link is refused')
      const se = await J('partner.php?a=session', { token: lt }); const S = se.d.session
      ok(se.s === 200 && S && (await J('partner.php?a=session', { token: lt })).s === 401, 'portal: a sign-in link works once')
      ok((await J('partner.php?a=me')).s === 401 && (await J('partner.php?a=me', null, 'bad')).s === 401, 'portal: no session, no access')
      const me = await J('partner.php?a=me', null, S)
      ok(me.d.partner.name === 'Portal Stay (TEST)' && me.d.inventory.rooms.length === 1 && me.d.payoutAccountSet === false, 'portal: a partner sees its own details')
      const inv = await J('partner.php?a=inventory_save', { rooms: [{ id: 'room1', name: 'Room', capacity: 3, count: 2, rateInr: 1800 }], blocked: { room1: ['2099-02-01'] }, razorpayAccountId: 'acc_Hacked000001' }, S)
      const me2 = await J('partner.php?a=me', null, S)
      ok(inv.s === 200 && me2.d.inventory.rooms[0].rateInr === 1800 && me2.d.inventory.blocked.room1[0] === '2099-02-01' && me2.d.payoutAccountSet === false, 'portal: a partner edits its own rooms, rates and blocked dates but cannot set its payout account')
      ok((await J('partner.php?a=inventory_save', { rooms: [{ id: 'r', name: 'X', capacity: 2, count: 1, rateInr: 0 }] }, S)).s === 400, 'portal: invalid rooms are refused')
      // an enquiry the admin sent: the partner confirms it
      const enq = await pp('submit-booking', { providerId: pStay.id, name: 'Guest', contactEmail: 'guest-p@example.com', checkIn: new Date(Date.now() + 80 * 864e5).toISOString().slice(0, 10), checkOut: new Date(Date.now() + 81 * 864e5).toISOString().slice(0, 10), people: '2', consent: '1', message: 'hi' })
      const enqRow = (await call('bk_overview')).d.bookings.find(b => b.ref === enq.d.ref); await call('bk_send', { method: 'POST', body: { id: enqRow.id } })
      const ov = await J('partner.php?a=overview', null, S); const seen = ov.d.bookings.find(b => b.ref === enq.d.ref)
      ok(seen && seen.name === 'Guest' && seen.status === 'sent', 'portal: the partner sees the requests sent to it, with the traveller to contact')
      ok((await J('partner.php?a=respond', { id: enqRow.id, decision: 'confirm' }, S)).s === 200 && (await call('bk_overview')).d.bookings.find(b => b.id === enqRow.id).status === 'confirmed', 'portal: the partner confirms a request')
      // a ride: pay, then the cab partner claims it from the portal and runs the trip
      const when = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 16)
      const rbk = await pp('ride-book', { pickup: 'karunagappally', drop: 'trv-airport', vehicle: 'car', when, guests: '2', name: 'Rider', contactEmail: 'rider-p@example.com', consent: '1' })
      const rpc = await J('pay-create.php', { ref: rbk.d.ref, token: rbk.d.payToken })
      await J('pay-verify.php', { ref: rbk.d.ref, token: rbk.d.payToken, razorpay_order_id: rpc.d.orderId, razorpay_payment_id: 'pay_portal1', razorpay_signature: hm('sekret', rpc.d.orderId + '|pay_portal1') })
      const o1 = outbox().length; await J('partner.php?a=login', { email: pCab.email }); const ct = outbox().slice(o1).find(m => /sign-in/.test(m.subject)).body.match(/#t=([0-9a-f]{48})/)[1]
      const CS = (await J('partner.php?a=session', { token: ct })).d.session
      const cov = await J('partner.php?a=overview', null, CS); const openR = cov.d.openRides.find(r => r.ref === rbk.d.ref)
      ok(openR && openR.pickup.includes('Karunagappally') && !(await J('partner.php?a=overview', null, S)).d.openRides.length, 'portal: an open ride shows to the cab partner that can take it, and not to the stay partner')
      ok((await J('partner.php?a=claim', { id: openR.id, driverName: 'Raju' }, CS)).s === 422, 'portal: claiming needs driver details')
      ok((await J('partner.php?a=claim', { id: openR.id, driverName: 'Raju', driverPhone: '+91 98470 77777', vehicleNo: 'KL 02 ZZ 9999' }, S)).s === 404, 'portal: a partner that was not asked cannot claim the ride')
      const clm = await J('partner.php?a=claim', { id: openR.id, driverName: 'Raju', driverPhone: '+91 98470 77777', vehicleNo: 'KL 02 ZZ 9999' }, CS)
      ok(clm.s === 200 && (await J('partner.php?a=claim', { id: openR.id, driverName: 'Raju', driverPhone: '+91 98470 77777', vehicleNo: 'KL 02 ZZ 9999' }, CS)).s === 409, 'portal: the partner claims the ride once')
      const code = (await (await fetch(`http://127.0.0.1:18911/api/ride-status.php?ref=${rbk.d.ref}&t=${rbk.d.payToken}`)).json()).tripCode
      ok((await J('partner.php?a=trip', { id: openR.id, action: 'start', otp: '0000' }, CS)).s === 422 && (await J('partner.php?a=trip', { id: openR.id, action: 'start', otp: code }, CS)).s === 200 && (await J('partner.php?a=trip', { id: openR.id, action: 'complete' }, CS)).s === 200, 'portal: the trip starts with the traveller code and completes, releasing the payout')
      const fin = (await J('partner.php?a=overview', null, CS)).d.rides.find(r => r.ref === rbk.d.ref)
      ok(fin.status === 'completed' && fin.paid === true && fin.partnerShareInr > 0 && fin.payoutHeld === false, 'portal: the partner sees the finished ride and its payout')
      ok((await J('partner.php?a=logout', {}, CS)).s === 200 && (await J('partner.php?a=me', null, CS)).s === 401, 'portal: signing out ends the session')
    }
    const tpA = await call('bk_test_partner', { method: 'POST', body: { name: 'Quick Stay', type: 'stay', district: 'Kollam' } })
    const ovT = (await call('bk_overview')).d; const tPartner = ovT.partners.find(p => p.test)
    ok(tpA.s === 200 && tPartner && tPartner.live === true && tPartner.name.includes('(TEST)'), 'test mode: a test partner can be added in one step and is live for testing')
    ok((await call('bk_test_partner', { method: 'POST', body: { name: 'X', type: 'guide', district: 'Kollam' } })).s === 400, 'test mode: only stay or transport test partners can be added')
    const off = await call('bk_testmode', { method: 'POST', body: { enabled: false } }); const s2 = await trk('booking-status.php')
    ok((await call('bk_test_partner', { method: 'POST', body: { name: 'Late', type: 'stay', district: 'Kollam' } })).s === 403 && (await call('bk_overview')).d.partners.find(p => p.test)?.live === false, 'test mode: test partners cannot be added, and are not live, once test mode is off')
    ok(off.s === 200 && !s2.testMode && Object.values(s2.caps).every(v => v === false), 'test mode: switching it off locks everything again')
    ok((await pp('stay-book', { providerId: stayT.id, roomId: 'r1', checkIn: day(70), checkOut: day(71), guests: '2', name: 'X', contactEmail: 'x@example.com', consent: '1' })).s === 403, 'test mode: with test mode off, booking is refused again')
  }

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
} finally { php.kill(); gh.close(); rz.close(); fs.rmSync(tmp, { recursive: true, force: true }) }
if (fails) { console.error(`\n✖ ${fails} admin test(s) failed`); process.exit(1) }
console.log('\n✔ admin API tests passed')
