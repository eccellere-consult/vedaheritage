// Offline test of the simple fill route (mock LLM, scratch copy of the repo).
import assert from 'assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const repo = process.cwd()
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fill-'))
for (const d of ['agents', 'scripts', 'src/content', 'public']) fs.cpSync(path.join(repo, d), path.join(tmp, d), { recursive: true })
fs.rmSync(path.join(tmp, 'agents/queue'), { recursive: true, force: true })
fs.symlinkSync(path.join(repo, 'node_modules'), path.join(tmp, 'node_modules')); fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
const topic = (name, category = 'temples') => ({ id: name.toLowerCase().replace(/\W+/g, '-'), name, category, district: 'Kollam', priority: 1, status: 'todo', slug: null, lastRun: null, lastResult: null, editorial: null, nextReview: null, imageStatus: null, note: '' })
const put = (f, v) => fs.writeFileSync(path.join(tmp, f), JSON.stringify(v))
const j = f => JSON.parse(fs.readFileSync(path.join(tmp, f), 'utf8'))
put('agents/registers/topics.json', { version: 1, topics: [topic('Fill Mock Temple'), topic('Fill Mock Healer', 'healing'), topic('BROKEN Mock'), topic('NOSRC Mock'), topic('Padmanabhaswamy Temple')] })
put('agents/settings.json', { autoPublish: true, autoPublishExclude: ['medical', 'healing'] })
const ctl = path.join(tmp, 'control.json'); put('control.json', { state: 'running' })
const run = (args, env = {}) => spawnSync('node', ['agents/run.mjs', ...args, '--mock'], { cwd: tmp, encoding: 'utf8', env: { ...process.env, CONTROL_FILE: ctl, ...env } })

let r = run(['sprint', '--minutes', '5']); assert.equal(r.status, 0, r.stderr || r.stdout)
const reg = j('agents/registers/topics.json'); const by = n => reg.topics.find(t => t.name === n)
assert.equal(by('Fill Mock Temple').status, 'done'); assert.equal(by('BROKEN Mock').status, 'failed'); assert.equal(by('NOSRC Mock').status, 'failed')
assert.equal(by('Padmanabhaswamy Temple').status, 'exists')
const live = j('src/content/temples/fill-mock-temple.json')
assert.deepEqual([live.format, live.status, live.reviewed, live.imageStatus], ['lite', 'approved', false, 'needed'], 'page goes live automatically with an image placeholder')
assert.ok(live.sources.length >= 1 && live.sources.every(s => s.url.startsWith('https://')), 'only https sources are kept')
assert.equal(live.latest.length, 1, 'future-dated updates are dropped'); assert.equal(live.sections.length, 2)
assert.equal(j('src/content/healing/fill-mock-healer.json').status, 'draft', 'health topics stay drafts')
assert.ok(reg.topics.some(t => t.name === 'Mock Discovered Beach' && t.status === 'done'), 'topics are discovered and filled autonomously')
assert.ok(!reg.topics.some(t => /Bad Category|^Padmanabhaswamy Temple$/.test(t.name) && t.status === 'todo' && t.priority === 2), 'bad or duplicate discoveries are skipped')
assert.equal(spawnSync('node', ['scripts/validate-content.mjs'], { cwd: tmp, encoding: 'utf8' }).status, 0, 'lite pages pass the validator')

// recency refresh: stale pages get dated news
const f = path.join(tmp, 'src/content/temples/fill-mock-temple.json'); const e = j('src/content/temples/fill-mock-temple.json'); e.updated = '2026-01-01'; fs.writeFileSync(f, JSON.stringify(e))
r = run(['refresh', '--max', '5']); assert.equal(r.status, 0, r.stderr || r.stdout)
const fresh = j('src/content/temples/fill-mock-temple.json'); assert.ok(fresh.latest[0].text.startsWith('Mock news'), 'newest item first'); assert.notEqual(fresh.updated, '2026-01-01')

// owner edits are safe: refresh changes only latest/updated and never touches an owner-edited page's own words
{ const f2 = path.join(tmp, 'src/content/temples/fill-mock-temple.json'); const e2 = j('src/content/temples/fill-mock-temple.json')
  Object.assign(e2, { updated: '2026-01-01', ownerEdited: '2026-02-02', reviewed: true, reviewedOn: '2026-02-02', summary: 'The owner rewrote this summary by hand so it stays exactly as written.' }); fs.writeFileSync(f2, JSON.stringify(e2))
  assert.equal(run(['refresh', '--max', '5']).status, 0)
  const after = j('src/content/temples/fill-mock-temple.json')
  assert.equal(after.summary, e2.summary); assert.equal(after.ownerEdited, '2026-02-02'); assert.deepEqual(after.sections, e2.sections); assert.deepEqual(after.description, e2.description) }

// stop switch
put('agents/registers/topics.json', { version: 1, topics: [topic('Stopped Mock Temple')] }); put('control.json', { state: 'paused', reason: 'test' })
r = run(['sprint', '--minutes', '5']); assert.ok(!fs.existsSync(path.join(tmp, 'src/content/temples/stopped-mock-temple.json')), 'nothing is written while paused')
fs.rmSync(tmp, { recursive: true, force: true })
console.log('fill test: ok')
