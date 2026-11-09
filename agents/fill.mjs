// FILL — the simple content route. One grounded web-search call per page, loose JSON in, a lite entry out.
// Speed and recency first: no scout, no verifier, no strict schema. Guardrails kept: the admin stop switch,
// the content-safety screen, health topics stay drafts, and the site build still has to pass before anything ships.
import fs from 'fs'
import { Stopped, assertRunning } from './lib/control.mjs'
import { BudgetExceeded, readSettings } from './lib/llm.mjs'
import { safetyHits } from './lib/safety.mjs'
import { CATEGORIES, QUEUE, entryFile, existingEntries, normName, prompt, readJson, slugify, today, writeJson } from './lib/util.mjs'

export const TOPICS = 'agents/registers/topics.json'
const EXCLUDE = ['medical', 'healing']
const str = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const strs = (v, n = 12, max = 1200) => (Array.isArray(v) ? v.map(x => str(x, max)).filter(Boolean).slice(0, n) : [])
const httpsUrl = u => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u.trim())
const monthOk = d => typeof d === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(d) && !Number.isNaN(Date.parse(d)) && Date.parse(d) < Date.now() + 40 * 864e5
const host = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return 'source' } }

const withTimeout = (p, ms, what) => {
  let timer
  return Promise.race([p, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${what} timed out`)), ms) })]).finally(() => clearTimeout(timer))
}

/** Pull the first JSON object out of model text (tolerates code fences and chatter). */
export function parseJson(text) {
  const s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('the model did not return JSON')
  return JSON.parse(s.slice(a, b + 1))
}

const cleanLatest = (arr, urls) => (Array.isArray(arr) ? arr : [])
  .map(x => ({ date: str(x?.date, 10), text: str(x?.text, 400), ...(httpsUrl(x?.url) ? { url: x.url.trim() } : {}) }))
  .filter(x => monthOk(x.date) && x.text.length >= 15).sort((p, q) => q.date.localeCompare(p.date)).slice(0, 6)
  .map(x => (x.url && urls.size && !urls.has(x.url) ? { date: x.date, text: x.text } : x))

function sourcesFrom(data, urls) {
  const out = [], seen = new Set()
  for (const s of Array.isArray(data.sources) ? data.sources : []) if (httpsUrl(s?.url) && !seen.has(s.url)) { seen.add(s.url); out.push({ label: str(s.label, 80) || host(s.url), url: s.url.trim() }) }
  for (const u of urls) if (out.length < 6 && httpsUrl(u) && !seen.has(u)) { seen.add(u); out.push({ label: host(u), url: u }) }
  return out.slice(0, 8)
}

/** Loose model JSON -> lite entry. Throws only when there is nothing worth publishing. */
export function toLite(data, topic, urls = new Set(), settings = {}) {
  const name = str(data.name, 120) || topic.name
  const description = strs(data.description, 6)
  const sections = (Array.isArray(data.sections) ? data.sections : []).map(s => ({ heading: str(s?.heading, 100), body: strs(s?.body, 4) })).filter(s => s.heading && s.body.length).slice(0, 6)
  if (!description.length && !sections.length) throw new Error('the model returned no content')
  const sources = sourcesFrom(data, urls)
  if (!sources.length) throw new Error('no web sources were found')
  let summary = str(data.summary, 400) || (description[0] || '').slice(0, 200)
  if (summary.length > 200) summary = (summary.slice(0, 200).replace(/\s+\S*$/, '').replace(/[,;:\s]+$/, '')) + '…'
  if (summary.length < 30) summary = `${name}: ${str(data.tagline, 150) || 'a guide to this part of Kerala'}.`.slice(0, 200)
  const highlights = strs(data.highlights, 6, 300)
  const tags = strs(data.tags, 6, 40).map(t => t.toLowerCase())
  const c = data.coordinates
  const slug = slugify(topic.name)
  const e = {
    slug, category: topic.category, name, district: str(data.district, 60) || topic.district || 'Kerala', format: 'lite',
    tagline: str(data.tagline, 140) || summary.slice(0, 100), summary,
    description: description.length ? description : [summary], highlights: highlights.length >= 2 ? highlights : [...highlights, ...sections.map(s => s.heading)].slice(0, 6),
    sections, latest: cleanLatest(data.latest, urls),
    ...(str(data.bestTime) || str(data.howToReach) ? { visitorInfo: { bestTime: str(data.bestTime, 400) || 'Confirm before you travel.', howToReach: str(data.howToReach, 600) || 'Check current routes before you travel.', etiquette: strs(data.tips, 5, 400) } } : {}),
    ...(c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) + Math.abs(c.lng) > 0 && c.lat > 7 && c.lat < 13 && c.lng > 74 && c.lng < 78.5 ? { coordinates: { lat: c.lat, lng: c.lng } } : {}),
    images: [], imageStatus: 'needed', tags: tags.length >= 2 ? tags : [...tags, 'kerala', topic.category].slice(0, 6), sources,
    updated: today(), lastVerified: today(), status: 'draft',
  }
  const unsafe = safetyHits(e)
  const goLive = settings.autoPublish === true && !(settings.autoPublishExclude || EXCLUDE).includes(topic.category) && !unsafe.length
  if (goLive) Object.assign(e, { status: 'approved', autoPublished: today(), reviewed: false })
  return { entry: e, unsafe }
}

const askJson = async (llm, system, user, ctx, ms, search = 6) => {
  for (let attempt = 0; ; attempt++) {
    const r = await withTimeout(llm.research({ system, user, effort: 'low', search, fetch: 3, maxTurns: 3, label: ctx.label, ctx }), ms, ctx.name || ctx.label)
    try { return { data: parseJson(r.text), urls: r.urls } } catch (e) { if (attempt >= 1) throw e }
  }
}

const checkStop = async job => { try { await assertRunning(job); return null } catch (e) { if (e instanceof Stopped) return e.message; throw e } }

/** Pool: run `worker` over `items` with `n` in flight; stops taking new items when `halt()` is true. */
async function pool(items, n, worker, halt) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length && !halt()) await worker(items[i++]) }))
}

export async function fill(llm, { minutes = 150, max = 40, concurrency = 4, topicIds = null, now = () => Date.now(), discoverBelow = 15 } = {}) {
  const deadline = now() + minutes * 60_000, settings = readSettings()
  const reg = readJson(TOPICS, { version: 1, topics: [] })
  const stats = { attempted: 0, created: 0, exists: 0, failed: 0, discovered: 0, stopped: null, timeUp: false, leftover: 0, lines: [], needsFactCheck: 0 }
  const have = new Set([...existingEntries().map(e => normName(e.name)), ...readJson(QUEUE, []).map(c => normName(c.name))])

  // Autonomous: when the register is nearly empty, ask the model what Kerala readers want right now.
  if (!topicIds && reg.topics.filter(t => t.status === 'todo').length < discoverBelow) {
    try {
      const { data } = await askJson(llm, prompt('discover'), `Today is ${today()}. Allowed categories: ${CATEGORIES.join(', ')}.\nGive 40 topics.\nAlready covered or queued (skip): ${[...have].slice(0, 400).join(', ')}`, { label: 'discover', name: 'discover' }, 8 * 60_000, 8)
      const known = new Set([...have, ...reg.topics.map(t => normName(t.name))])
      for (const t of Array.isArray(data.topics) ? data.topics : []) {
        const name = str(t?.name, 120), category = CATEGORIES.includes(t?.category) ? t.category : null
        if (!name || !category || known.has(normName(name))) continue
        known.add(normName(name)); stats.discovered++
        reg.topics.push({ id: slugify(name), name, category, district: str(t.district, 60) || 'Kerala', priority: 2, status: 'todo', slug: null, lastRun: null, lastResult: null, editorial: null, nextReview: null, imageStatus: null, note: str(t.note, 160) })
      }
      writeJson(TOPICS, reg)
    } catch (e) { stats.lines.push(`- ⚠️ finding new topics failed: ${e.message.slice(0, 120)}`) }
  }

  const todo = reg.topics.filter(t => (topicIds ? topicIds.includes(t.id) : t.status === 'todo')).sort((a, b) => a.priority - b.priority).slice(0, max)
  await pool(todo, concurrency, async t => {
    if (now() >= deadline) { stats.timeUp = true; return }
    const msg = await checkStop('sprint'); if (msg) { stats.stopped = msg; return }
    const slug = slugify(t.name)
    if (have.has(normName(t.name)) || fs.existsSync(entryFile(t.category, slug))) {
      Object.assign(t, { status: 'exists', lastRun: today(), lastResult: 'a page already exists, left untouched' }); stats.exists++; return
    }
    have.add(normName(t.name)); stats.attempted++
    try {
      const { data, urls } = await askJson(llm, prompt('fill'), `Topic: ${t.name}\nCategory: ${t.category}\nDistrict: ${t.district}\n${t.note ? `Angle: ${t.note}\n` : ''}Today is ${today()}. Write the page now.`, { label: 'fill', name: t.name, district: t.district }, 6 * 60_000)
      const { entry, unsafe } = toLite(data, t, urls, settings)
      const stop = await checkStop('sprint'); if (stop) { stats.stopped = stop; have.delete(normName(t.name)); return }
      writeJson(entryFile(t.category, slug), entry)
      Object.assign(t, { status: 'done', slug, lastRun: today(), lastResult: entry.status === 'approved' ? 'live' : unsafe.length ? 'draft (safety screen)' : 'draft', editorial: 'ready', nextReview: new Date(now() + 14 * 864e5).toISOString().slice(0, 10) })
      stats.created++
      stats.lines.push(`- ✅ **${t.name}** → ${entry.status === 'approved' ? 'live' : 'draft'}${unsafe.length ? ` (safety screen: ${unsafe.join('; ')})` : ''}`)
    } catch (e) {
      have.delete(normName(t.name))
      if (e instanceof BudgetExceeded) { stats.stopped = e.message; return }
      Object.assign(t, { status: 'failed', lastRun: today(), lastResult: e.message.slice(0, 160) }); stats.failed++
      stats.lines.push(`- ⚠️ **${t.name}**: ${t.lastResult}`)
    }
    writeJson(TOPICS, reg)
  }, () => !!stats.stopped || now() >= deadline)
  writeJson(TOPICS, reg)
  stats.leftover = reg.topics.filter(t => t.status === 'todo').length
  stats.minutes = Math.round((now() - (deadline - minutes * 60_000)) / 600) / 100
  return stats
}

/** Recency: ask what is new for the stalest pages and add it as dated "latest" items. */
export async function refresh(llm, { max = 15, minutes = 60, concurrency = 4, staleDays = 10, now = () => Date.now() } = {}) {
  const deadline = now() + minutes * 60_000
  const stats = { refreshed: 0, withNews: 0, failed: 0, stopped: null, lines: [] }
  const cutoff = new Date(now() - staleDays * 864e5).toISOString().slice(0, 10)
  const todo = existingEntries().filter(e => e.status === 'approved' && (e.updated || e.lastVerified) < cutoff)
    .sort((a, b) => String(a.updated || a.lastVerified).localeCompare(String(b.updated || b.lastVerified))).slice(0, max)
  await pool(todo, concurrency, async e => {
    if (now() >= deadline) return
    const msg = await checkStop('sprint'); if (msg) { stats.stopped = msg; return }
    try {
      const { data, urls } = await askJson(llm, prompt('refresh'), `Topic: ${e.name} (${e.category}, ${e.district}). Today is ${today()}.`, { label: 'refresh', name: e.name }, 5 * 60_000, 4)
      const fresh = cleanLatest(data.latest, urls), keep = (e.latest || []).filter(o => !fresh.some(f => f.text === o.text))
      const latest = [...fresh, ...keep].sort((p, q) => q.date.localeCompare(p.date)).slice(0, 6)
      const stop = await checkStop('sprint'); if (stop) { stats.stopped = stop; return }
      const { _file, ...entry } = e
      writeJson(_file, { ...entry, latest, updated: today() })
      stats.refreshed++; if (fresh.length) { stats.withNews++; stats.lines.push(`- 🆕 **${e.name}**: ${fresh.length} new item(s)`) }
    } catch (err) { stats.failed++; stats.lines.push(`- ⚠️ ${e.name}: ${err.message.slice(0, 100)}`) }
  }, () => !!stats.stopped || now() >= deadline)
  return stats
}
