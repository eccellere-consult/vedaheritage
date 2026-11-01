// SPRINT — fast first-level coverage. One research pass and one drafting call per topic, deterministic checks,
// save, next topic. No scout, no verifier chain. Honours the admin stop switch before every topic and every write.
import fs from 'fs'
import { spawnSync } from 'child_process'
import { enrich } from './enricher.mjs'
import { Stopped, assertRunning } from './lib/control.mjs'
import { safetyHits } from './lib/safety.mjs'
import { QUEUE, entryFile, existingEntries, normName, readJson, slugify, today, writeJson } from './lib/util.mjs'

export const TOPICS = 'agents/registers/topics.json'
export const SOURCES = 'agents/registers/sources.json'
const withTimeout = (p, ms, what) => {
  let timer
  return Promise.race([p, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${what} timed out`)), ms) })]).finally(() => clearTimeout(timer))
}

function validationProblems(cat, slug) {
  const r = spawnSync('node', ['scripts/validate-content.mjs'], { encoding: 'utf8' })
  return r.status === 0 ? [] : r.stderr.split('\n').filter(l => l.includes(`${cat}/${slug}.json`)).map(l => l.replace(/^\s*- [^:]+:\s*/, ''))
}

export async function sprint(llm, { minutes = 150, max = 200, perTopicMinutes = 8, topicIds = null, now = () => Date.now() } = {}) {
  const t0 = now(), deadline = t0 + minutes * 60_000
  const reg = readJson(TOPICS, { version: 1, topics: [] })
  const src = readJson(SOURCES, { version: 1, sources: [] })
  const have = new Set([...existingEntries().map(e => normName(e.name)), ...readJson(QUEUE, []).map(c => normName(c.name))])
  const stats = { attempted: 0, created: 0, exists: 0, failed: 0, needsFactCheck: 0, needsImage: 0, stopped: null, timeUp: false, leftover: 0, lines: [] }
  const todo = reg.topics.filter(t => (topicIds ? topicIds.includes(t.id) : t.status === 'todo')).sort((a, b) => a.priority - b.priority)

  for (const t of todo) {
    if (stats.attempted >= max) break
    if (now() >= deadline) { stats.timeUp = true; break }
    try { await assertRunning('sprint') } catch (e) { if (e instanceof Stopped) { stats.stopped = e.message; break } throw e }

    const slug = slugify(t.name)
    if (have.has(normName(t.name)) || fs.existsSync(entryFile(t.category, slug))) {
      t.status = 'exists'; t.lastRun = today(); t.lastResult = 'a page already exists, left untouched'; stats.exists++
      stats.lines.push(`- ↷ **${t.name}**: already has a page, left untouched`); writeJson(TOPICS, reg); continue
    }
    stats.attempted++
    console.log(`\n▶ ${t.name} (${t.category})`)
    let result = null, problems = []
    try {
      const cand = { name: t.name, category: t.category, district: t.district, reason: t.note || '' }
      result = await withTimeout(enrich(llm, cand, { quick: true }), perTopicMinutes * 60_000, t.name)
      await assertRunning('sprint')
      writeJson(entryFile(t.category, slug), result.entry)
      problems = validationProblems(t.category, slug)
      if (problems.length) {                                   // one targeted correction, never a loop
        const fixed = await withTimeout(enrich(llm, cand, { quick: true, feedback: `Validator errors:\n${problems.map(p => `- ${p}`).join('\n')}`, previous: result.entry }), perTopicMinutes * 60_000, t.name)
        await assertRunning('sprint')
        result = fixed; writeJson(entryFile(t.category, slug), result.entry)
        problems = validationProblems(t.category, slug)
      }
    } catch (e) {
      if (e instanceof Stopped) { fs.rmSync(entryFile(t.category, slug), { force: true }); stats.stopped = e.message; break }
      fs.rmSync(entryFile(t.category, slug), { force: true })
      t.status = 'failed'; t.lastRun = today(); t.lastResult = e.message.slice(0, 160); stats.failed++
      stats.lines.push(`- ⚠️ **${t.name}**: ${t.lastResult}`); writeJson(TOPICS, reg); continue
    }
    if (problems.length) {
      fs.rmSync(entryFile(t.category, slug), { force: true })
      t.status = 'failed'; t.lastRun = today(); t.lastResult = `did not pass checks: ${problems.join('; ').slice(0, 140)}`; stats.failed++
      stats.lines.push(`- ⚠️ **${t.name}**: ${t.lastResult}`); writeJson(TOPICS, reg); continue
    }

    // Plain editorial status (internal): ready | needs_fact_check. Images are added by the photo step afterwards.
    const unsafe = safetyHits(result.entry)
    const thin = result.warnings.length > 0 || (result.entry.sources || []).length < 2
    const editorial = unsafe.length ? { status: 'draft', note: `content-safety check: ${unsafe.join('; ')}` }
      : thin ? { status: 'needs_fact_check', note: result.warnings.join('; ') || 'limited sources' } : { status: 'ready', note: '' }
    const entry = { ...result.entry, editorial: { flow: 'sprint', ...editorial, checkedOn: today() } }
    writeJson(entryFile(t.category, slug), entry)
    have.add(normName(t.name))

    src.sources = src.sources.filter(s => s.topicId !== t.id)
    for (const s of entry.sources) src.sources.push({ topicId: t.id, title: s.label, publisher: new URL(s.url).hostname.replace(/^www\./, ''), url: s.url, type: 'web', lastChecked: today(), lastAccessOk: today(), available: true })
    Object.assign(t, { status: 'done', slug, lastRun: today(), lastResult: editorial.status, editorial: editorial.status, nextReview: new Date(now() + 7 * 864e5).toISOString().slice(0, 10) })
    stats.created++; if (editorial.status !== 'ready') stats.needsFactCheck++
    stats.lines.push(`- ✅ **${t.name}** → ${editorial.status}${editorial.note ? ` (${editorial.note})` : ''}`)
    await assertRunning('sprint'); writeJson(TOPICS, reg); writeJson(SOURCES, src)
  }
  stats.leftover = reg.topics.filter(t => t.status === 'todo').length
  stats.minutes = Math.round((now() - t0) / 600) / 100
  return stats
}
