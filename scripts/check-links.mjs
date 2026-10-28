// Checks every official link and entry source URL. Exit 1 if any are dead.
// 403/429 are reported as warnings (many government sites block bots).
import fs from 'fs'
import path from 'path'

const UA = 'Mozilla/5.0 (compatible; VedaHeritageLinkCheck/1.0)'
const urls = new Map()
const add = (u, where) => u && urls.set(u, [...(urls.get(u) || []), where])

for (const m of fs.readFileSync('src/data/official-links.ts', 'utf8').matchAll(/url: '(https:[^']+)'/g)) add(m[1], 'official-links.ts')
for (const cat of ['temples', 'places', 'beaches', 'backwaters', 'ayurveda']) {
  const dir = path.join('src', 'content', cat)
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
    const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    for (const s of [...(e.sources || []), ...(e.officialLinks || [])]) add(s.url, `${cat}/${f}`)
  }
}

async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })
      if (r.status < 400) return { ok: true, status: r.status }
      if (method === 'GET' || ![403, 405, 501].includes(r.status)) return { ok: [403, 429].includes(r.status) ? 'warn' : false, status: r.status }
    } catch (err) { if (method === 'GET') return { ok: false, status: String(err.cause?.code || err.message) } }
  }
}

let bad = 0
for (const [url, where] of urls) {
  const r = await check(url)
  const tag = r.ok === true ? 'OK  ' : r.ok === 'warn' ? 'WARN' : 'FAIL'
  console.log(`${tag} ${r.status} ${url}  (${[...new Set(where)].join(', ')})`)
  if (r.ok === false) bad++
}
if (bad) { console.error(`\n${bad} broken link(s)`); process.exit(1) }
console.log(`\nAll ${urls.size} links reachable`)
