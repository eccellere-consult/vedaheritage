// Offline test of the coverage planner (mock LLM, scratch copy of the repo).
import assert from 'assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { DISTRICTS, gaps, matrix } from '../coverage.mjs'

// pure rules
const m = matrix([{ category: 'temples', district: 'Kollam' }, { category: 'temples', district: 'Kollam / Alappuzha' }, { category: 'temples', district: 'Kerala' }, { category: 'beaches', district: 'Kannur' }])
assert.deepEqual([m.temples.total, m.temples.districts.Kollam, m.temples.districts.Alappuzha, m.temples.statewide], [3, 2, 1, 1], 'a two-district entry counts in both; a state-wide entry counts only in the total')
const g = gaps(m, { perCategory: 30, perDistrictMin: 2 }, { temples: ['Idukki'] })
const t = g.find(x => x.category === 'temples')
assert.equal(t.need, 27); assert.ok(!t.thin.some(x => x.district === 'Idukki'), 'a district marked "none" is not asked for again'); assert.ok(t.thin.some(x => x.district === 'Alappuzha' && x.need === 1))
assert.equal(g[0].need >= g[g.length - 1].need, true, 'categories are ordered by how far they are from the target'); assert.equal(DISTRICTS.length, 14)

// planner end to end
const repo = process.cwd(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-'))
for (const d of ['agents', 'scripts', 'src/content', 'public']) fs.cpSync(path.join(repo, d), path.join(tmp, d), { recursive: true })
fs.rmSync(path.join(tmp, 'agents/queue'), { recursive: true, force: true })
fs.symlinkSync(path.join(repo, 'node_modules'), path.join(tmp, 'node_modules')); fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
fs.writeFileSync(path.join(tmp, 'agents/registers/topics.json'), JSON.stringify({ version: 1, topics: [] })); fs.rmSync(path.join(tmp, 'agents/registers/coverage-none.json'), { force: true })
fs.writeFileSync(path.join(tmp, 'agents/settings.json'), JSON.stringify({ autoPublish: true, coverage: { enabled: true, perCategory: 30, perDistrictMin: 2 } }))
fs.writeFileSync(path.join(tmp, 'control.json'), JSON.stringify({ state: 'running' }))
const run = args => spawnSync('node', ['agents/run.mjs', ...args, '--mock'], { cwd: tmp, encoding: 'utf8', env: { ...process.env, CONTROL_FILE: path.join(tmp, 'control.json') } })
const j = f => JSON.parse(fs.readFileSync(path.join(tmp, f), 'utf8'))
let r = run(['coverage', '--max-categories', '2']); assert.equal(r.status, 0, r.stderr || r.stdout)
const reg = j('agents/registers/topics.json').topics, cov = j('agents/registers/coverage.json')
assert.ok(reg.length >= 4 && reg.every(x => x.status === 'todo'), 'planned topics are queued')
assert.ok(!reg.some(x => x.name === 'Padmanabhaswamy Temple'), 'a topic that already has a page is skipped')
assert.ok(reg.some(x => /Three$/.test(x.name) && x.district === 'Kerala'), 'an unknown district becomes Kerala')
assert.equal(new Set(reg.map(x => x.category)).size, 2, 'only the requested number of categories is planned')
assert.ok(Object.values(j('agents/registers/coverage-none.json')).every(a => a.includes('Idukki') && !a.includes('Atlantis')), 'districts with nothing real are remembered, unknown names are dropped')
assert.ok(cov.pagesNeeded > 400 && cov.categories.temples.total >= 1, 'the coverage matrix is written for the admin')
r = run(['coverage', '--max-categories', '2']); const again = j('agents/registers/topics.json').topics
assert.ok(again.length >= reg.length && new Set(again.map(x => x.id)).size === again.length && reg.every(x => again.some(y => y.id === x.id)), 'planning again rotates to other categories and never duplicates or drops a queued topic')

// fill uses the plan when the queue is short
fs.writeFileSync(path.join(tmp, 'agents/registers/topics.json'), JSON.stringify({ version: 1, topics: [] }))
r = run(['fill', '--minutes', '5', '--max', '3']); assert.equal(r.status, 0, r.stderr || r.stdout)
const after = j('agents/registers/topics.json').topics
assert.ok(after.some(x => x.status === 'done') && after.some(x => x.status === 'todo'), 'fill plans from coverage, writes pages, and leaves the rest queued')
fs.rmSync(tmp, { recursive: true, force: true })
console.log('coverage test: ok')
