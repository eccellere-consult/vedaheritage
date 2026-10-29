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
const blobs = {}; const tree = Object.entries(files).map(([p, v]) => { const t = JSON.stringify(v); const s = sha(t); blobs[s] = t; return { path: p, type: 'blob', sha: s } })

const gh = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const u = new URL(req.url, 'http://x'); const p = u.pathname.replace('/repos/o/r', ''); const j = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)) }
    const b = body ? JSON.parse(body) : {}
    if (req.headers.authorization !== 'Bearer tok') { res.statusCode = 401; return j({ message: 'bad token' }) }
    if (p === '/git/trees/main') return j({ sha: 'treesha', tree })
    let m
    if ((m = p.match(/^\/git\/blobs\/(\w+)$/))) return j({ content: Buffer.from(blobs[m[1]] || '{}').toString('base64') })
    if ((m = p.match(/^\/contents\/(.+)$/))) {
      if (req.method === 'PUT') { puts.push({ path: m[1], ...b, text: Buffer.from(b.content, 'base64').toString() }); return j({ ok: 1 }) }
      const v = files[m[1]]; if (!v) { res.statusCode = 404; return j({ message: 'Not Found' }) }
      const t = JSON.stringify(v); return j({ sha: sha(t), content: Buffer.from(t).toString('base64') })
    }
    if (p === '/pulls') return j(Object.values(prs))
    if ((m = p.match(/^\/pulls\/(\d+)\/merge$/))) { merged.push(+m[1]); return j({ merged: true }) }
    if ((m = p.match(/^\/pulls\/(\d+)$/))) return j(prs[m[1]] || (res.statusCode = 404, { message: 'nf' }))
    if ((m = p.match(/^\/commits\/(\w)\w*\/check-runs$/))) return j({ check_runs: [{ status: 'completed', conclusion: conc[m[1]] }] })
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
fs.writeFileSync(path.join(tmp, 'vh-config.php'), `<?php return ['github_token'=>'tok','repo'=>'o/r','github_api'=>'http://127.0.0.1:${ghPort}','admin_password_hash'=>'${pwHash}','data_dir'=>'${tmp}/data','insecure_cookies'=>true,'site_url'=>'http://127.0.0.1:1'];`)
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
  const pl = await call('prs'); ok(pl.d.prs.map(p => p.checks).join() === 'passed,failed,needs_approval', 'PR list reports check state')
  ok((await call('merge_pr', { method: 'POST', body: { number: 2 } })).s === 422 && (await call('merge_pr', { method: 'POST', body: { number: 3 } })).s === 422 && !merged.length, 'red and unapproved PRs cannot be merged')
  ok((await call('merge_pr', { method: 'POST', body: { number: 1 } })).s === 200 && merged[0] === 1, 'green PR merges')
  const st = await call('stories'); ok(st.d.stories.length === 1, 'story list excludes PRs')
  await call('story_decision', { method: 'POST', body: { number: 5, decision: 'approve' } }); ok(labels[0]?.[1]?.[0] === 'approved', 'story approval adds the approved label')
  ok((await call('run_workflow', { method: 'POST', body: { workflow: 'content-agents', inputs: { command: 'rm -rf', max: '3' } } })).s === 400, 'workflow input is validated (command)')
  ok((await call('run_workflow', { method: 'POST', body: { workflow: 'content-agents', inputs: { command: 'scout', budget: '99' } } })).s === 400, 'workflow input is validated (budget cap)')
  const run = await call('run_workflow', { method: 'POST', body: { workflow: 'content-agents', inputs: { command: 'scout', max: '2', budget: '5' } } })
  ok(run.s === 200 && dispatches[0]?.b.ref === 'main' && dispatches[0].b.inputs.command === 'scout', 'agents run is dispatched on main')
  const act = await call('activity'); ok(act.d.events.some(e => e.e === 'set-status') && act.d.events.some(e => e.e === 'login-failed'), 'audit log records actions and failed logins')
  await call('logout', { method: 'POST' }); ok((await call('overview')).s === 401, 'logout ends the session')
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
