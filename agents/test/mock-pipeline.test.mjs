// Offline end-to-end test of the agent plumbing using the mock LLM.
// Copies the repo's content/scripts into a temp dir so nothing real is touched.
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import assert from 'assert/strict'

const repo = process.cwd()
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-test-'))
for (const d of ['agents', 'scripts', 'src/content', 'public']) fs.cpSync(path.join(repo, d), path.join(tmp, d), { recursive: true })
fs.rmSync(path.join(tmp, 'agents/queue'), { recursive: true, force: true })
fs.rmSync(path.join(tmp, 'agents/evidence'), { recursive: true, force: true })
fs.symlinkSync(path.join(repo, 'node_modules'), path.join(tmp, 'node_modules'))
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')

const run = (...a) => spawnSync('node', ['agents/run.mjs', ...a, '--mock'], { cwd: tmp, encoding: 'utf8' })
const before = fs.readdirSync(path.join(tmp, 'src/content/temples')).length

let r = run('pipeline', '--max', '5')
assert.equal(r.status, 0, r.stderr || r.stdout)
const queue = JSON.parse(fs.readFileSync(path.join(tmp, 'agents/queue/candidates.json'), 'utf8'))
const byName = n => queue.find(c => c.name === n)

// Scout: duplicate of an existing entry and the unsourced candidate are dropped
assert.ok(byName('Mock Temple One'))
assert.equal(byName('Padmanabhaswamy Temple'), undefined, 'duplicate must be dropped')
assert.equal(byName('Unsourced Mock Place'), undefined, 'candidate with no retrieved source must be dropped')

// Enricher + Verifier: good entry drafted, bad one rejected and cleaned up
assert.equal(byName('Mock Temple One').status, 'drafted')
assert.equal(byName('BAD Mock Temple').status, 'rejected')
const file = path.join(tmp, 'src/content/temples/mock-temple-one.json')
assert.ok(fs.existsSync(file))
assert.ok(!fs.existsSync(path.join(tmp, 'src/content/temples/bad-mock-temple.json')))
assert.equal(fs.readdirSync(path.join(tmp, 'src/content/temples')).length, before + 1)

// Hallucinated (never retrieved) source URL is stripped
const entry = JSON.parse(fs.readFileSync(file, 'utf8'))
assert.equal(entry.status, 'draft')
assert.ok(entry.sources.every(s => s.url.startsWith('https://example.org/')), 'unretrieved source must be dropped')
assert.equal(entry.sources.length, 2)

// Evidence + report written, and the whole content set still validates
assert.ok(fs.existsSync(path.join(tmp, 'agents/evidence/mock-temple-one.json')))
assert.match(fs.readFileSync(path.join(tmp, 'agents/reports/latest.md'), 'utf8'), /ready for review/)
const v = spawnSync('node', ['scripts/validate-content.mjs'], { cwd: tmp, encoding: 'utf8' })
assert.equal(v.status, 0, v.stderr)

// Re-verify an existing hand-written draft (no evidence file) via the derive-claims path
r = run('verify', '--slug', 'varkala-beach')
assert.equal(r.status, 0, r.stderr || r.stdout)

// Second run does not re-add or re-enrich anything
r = run('pipeline')
assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'agents/queue/candidates.json'), 'utf8')).filter(c => c.name === 'Mock Temple One').length, 1)

fs.rmSync(tmp, { recursive: true, force: true })
console.log('✔ agent pipeline (mock) passed')
