// Offline test of the content sprint, the stop switch and the publish gates (mock LLM, scratch copy of the repo).
import assert from 'assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const repo = process.cwd()
const mk = () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-'))
  for (const d of ['agents', 'scripts', 'src/content', 'public']) fs.cpSync(path.join(repo, d), path.join(tmp, d), { recursive: true })
  fs.rmSync(path.join(tmp, 'agents/queue'), { recursive: true, force: true }); fs.rmSync(path.join(tmp, 'agents/evidence'), { recursive: true, force: true })
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(tmp, 'node_modules')); fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
  const topic = (name, category = 'temples') => ({ id: name.toLowerCase().replace(/\W+/g, '-'), name, category, district: 'Kollam', priority: 1, status: 'todo', slug: null, lastRun: null, lastResult: null, editorial: null, nextReview: null, imageStatus: null, note: '' })
  fs.writeFileSync(path.join(tmp, 'agents/registers/topics.json'), JSON.stringify({ version: 1, topics: [topic('CLEAN Mock Topic'), topic('Messy Mock Topic'), topic('Padmanabhaswamy Temple')] }))
  fs.writeFileSync(path.join(tmp, 'agents/registers/sources.json'), JSON.stringify({ version: 1, sources: [] }))
  return tmp
}
const sprint = (tmp, env = {}) => spawnSync('node', ['agents/run.mjs', 'sprint', '--mock', '--minutes', '5'], { cwd: tmp, encoding: 'utf8', env: { ...process.env, ...env } })
const j = (tmp, f) => JSON.parse(fs.readFileSync(path.join(tmp, f), 'utf8'))

// 1. a normal sprint
let tmp = mk(); const ctl = path.join(tmp, 'control.json'); fs.writeFileSync(ctl, JSON.stringify({ state: 'running' }))
let r = sprint(tmp, { CONTROL_FILE: ctl }); assert.equal(r.status, 0, r.stderr || r.stdout)
const reg = j(tmp, 'agents/registers/topics.json'); const by = n => reg.topics.find(t => t.name === n)
assert.equal(by('CLEAN Mock Topic').status, 'done'); assert.equal(by('CLEAN Mock Topic').editorial, 'ready')
assert.equal(by('Messy Mock Topic').editorial, 'needs_fact_check', 'thin evidence is labelled, not hidden')
assert.equal(by('Padmanabhaswamy Temple').status, 'exists', 'an existing page is left untouched')
const clean = j(tmp, 'src/content/temples/clean-mock-topic.json')
assert.deepEqual([clean.status, clean.editorial.flow, clean.editorial.status], ['draft', 'sprint', 'ready'])
assert.ok(clean.sources.length >= 2 && clean.sources.every(s => s.url.startsWith('https://example.org/')), 'only retrieved sources are kept')
assert.ok(j(tmp, 'agents/registers/sources.json').sources.some(s => s.topicId === 'clean-mock-topic' && s.lastChecked), 'source register is filled')
assert.match(fs.readFileSync(path.join(tmp, 'agents/reports/latest.md'), 'utf8'), /Content sprint: 2 page\(s\) created/)

// 2. publishing: hybrid/auto publishes only the ready page, with an image placeholder; the labelled page stays a draft
const pub = (settings) => { fs.writeFileSync(path.join(tmp, 'agents/settings.json'), JSON.stringify(settings)); return spawnSync('node', ['scripts/auto-publish.mjs'], { cwd: tmp, encoding: 'utf8' }) }
assert.match(pub({ autoPublish: false }).stdout, /auto-publish: off/); assert.equal(j(tmp, 'src/content/temples/clean-mock-topic.json').status, 'draft')
pub({ autoPublish: true })
const live = j(tmp, 'src/content/temples/clean-mock-topic.json')
assert.deepEqual([live.status, live.imageStatus, live.reviewed], ['approved', 'needed', false], 'ready page goes live with an image placeholder')
assert.equal(j(tmp, 'src/content/temples/messy-mock-topic.json').status, 'draft', 'a page needing a fact check waits')
assert.equal(spawnSync('node', ['scripts/validate-content.mjs'], { cwd: tmp, encoding: 'utf8' }).status, 0, 'the result validates')
fs.rmSync(tmp, { recursive: true, force: true })

// 3. kill switch before the run: nothing is written
tmp = mk(); fs.writeFileSync(path.join(tmp, 'control.json'), JSON.stringify({ state: 'killed', reason: 'test' }))
r = sprint(tmp, { CONTROL_FILE: path.join(tmp, 'control.json') }); assert.equal(r.status, 0, r.stderr)
assert.ok(!fs.existsSync(path.join(tmp, 'src/content/temples/clean-mock-topic.json')), 'killed: no page written')
assert.ok(j(tmp, 'agents/registers/topics.json').topics.every(t => t.status === 'todo'), 'killed: register untouched')
assert.match(fs.readFileSync(path.join(tmp, 'agents/reports/latest.md'), 'utf8'), /Stopped by the admin switch/)
fs.rmSync(tmp, { recursive: true, force: true })

// 4. kill switch flipped during a run: the in-flight topic is not written and no later topic starts
tmp = mk(); const ctl2 = path.join(tmp, 'control.json'); fs.writeFileSync(ctl2, JSON.stringify({ state: 'running' }))
r = sprint(tmp, { CONTROL_FILE: ctl2, MOCK_KILL_AFTER: '1' }); assert.equal(r.status, 0, r.stderr)
const reg4 = j(tmp, 'agents/registers/topics.json')
assert.equal(reg4.topics.find(t => t.name === 'CLEAN Mock Topic').status, 'done', 'work finished before the kill is kept')
assert.equal(reg4.topics.find(t => t.name === 'Messy Mock Topic').status, 'todo', 'the topic in flight is not saved after the kill')
assert.ok(!fs.existsSync(path.join(tmp, 'src/content/temples/messy-mock-topic.json')), 'no file written after the kill')

// 5. a switched-off job and a paused state also stop it
fs.writeFileSync(ctl2, JSON.stringify({ state: 'running', agents: { sprint: false } })); assert.equal(spawnSync('node', ['scripts/agent-guard.mjs', 'sprint'], { cwd: tmp, env: { ...process.env, CONTROL_FILE: ctl2 } }).status, 1)
fs.writeFileSync(ctl2, JSON.stringify({ state: 'paused' })); assert.equal(spawnSync('node', ['scripts/agent-guard.mjs', 'sprint'], { cwd: tmp, env: { ...process.env, CONTROL_FILE: ctl2 } }).status, 1)
fs.writeFileSync(ctl2, JSON.stringify({ state: 'running' })); assert.equal(spawnSync('node', ['scripts/agent-guard.mjs', 'sprint'], { cwd: tmp, env: { ...process.env, CONTROL_FILE: ctl2 } }).status, 0)
fs.rmSync(tmp, { recursive: true, force: true })
console.log('✔ content sprint, stop switch and publish gates passed')
