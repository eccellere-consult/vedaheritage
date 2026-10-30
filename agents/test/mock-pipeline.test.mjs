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

// Official contacts: only the one taken from a retrieved page with well-formed details survives
assert.equal(entry.contacts?.length, 1, 'only the retrieved, well-formed contact is kept')
assert.equal(entry.contacts[0].label, 'Mock temple office')
assert.ok(entry.contacts[0].verifiedOn && entry.contacts[0].sourceUrl.startsWith('https://example.org/'), 'contact carries source and date')

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

// A recipe is kept only for food entries and only when it has enough steps
import { toEntryFile } from '../lib/schemas.mjs'
const base = { name: 'Test', malayalamName: null, district: 'Kerala', tagline: 't', summary: 's', description: ['d'], history: { significance: 'x', timeline: [], keyFacts: [] }, folklore: { title: 't', story: ['s'], note: null }, spiritual: { summary: 's', experiences: [], bestFor: 'b', mindfulTips: [] }, highlights: [], visitorInfo: { bestTime: 'b', howToReach: 'h', etiquette: [], duration: null }, travel: null, heritage: null, officialLinks: null, coordinates: null, tags: [], sources: [] }
const eat = { places: [{ name: 'Confirmed Oottupura', district: 'Alappuzha', kind: 'oottupura', note: 'Traditional meals on a banana leaf.', url: null }], tips: ['Look for an oottupura.', 'Ask for kanji and payar.'] }
const rec = { servings: '4', time: '30 minutes', ingredients: ['a', 'b', 'c'], method: ['1', '2', '3'], tips: null }
assert.ok(toEntryFile({ ...base, recipe: rec }, { category: 'food', slug: 't', date: '2026-01-01', sources: [] }).recipe, 'food entry keeps a complete recipe')
assert.equal(toEntryFile({ ...base, recipe: rec }, { category: 'temples', slug: 't', date: '2026-01-01', sources: [] }).recipe, undefined, 'a non-food entry never carries a recipe')
assert.equal(toEntryFile({ ...base, recipe: null, eat }, { category: 'food', slug: 't', date: '2026-01-01', sources: [] }).eat.places[0].name, 'Confirmed Oottupura', 'food entry keeps where-to-eat with its places')
assert.equal(toEntryFile({ ...base, recipe: null, eat }, { category: 'temples', slug: 't', date: '2026-01-01', sources: [] }).eat, undefined, 'a non-food entry never carries where-to-eat')
assert.equal(toEntryFile({ ...base, recipe: null, eat: { places: [], tips: ['only one'] } }, { category: 'food', slug: 't', date: '2026-01-01', sources: [] }).eat, undefined, 'where-to-eat needs at least two tips')
assert.equal(toEntryFile({ ...base, recipe: { ...rec, method: ['1'] } }, { category: 'food', slug: 't', date: '2026-01-01', sources: [] }).recipe, undefined, 'an incomplete recipe is dropped')

console.log('✔ agent pipeline (mock) passed')

// Events agent: only dated, sourced, upcoming events are kept; a rerun updates in place
r = run('events')
assert.equal(r.status, 0, r.stderr || r.stdout)
const calPath = path.join(tmp, 'src/content/events/calendar.json')
let cal = JSON.parse(fs.readFileSync(calPath, 'utf8'))
assert.deepEqual(cal.events.map(e => e.name).sort(), ['Mock Boat Race', 'Mock Temple Utsavam'], 'unsourced, past and bad-date events are dropped')
assert.ok(cal.events.every(e => e.sources.every(s => s.url.startsWith('https://example.org/'))), 'only retrieved sources survive')
assert.equal(cal.events.find(e => e.name === 'Mock Temple Utsavam').certainty, 'expected')
r = run('events')
cal = JSON.parse(fs.readFileSync(calPath, 'utf8'))
assert.equal(cal.events.length, 2, 'a second run does not duplicate events')
assert.equal(spawnSync('node', ['scripts/validate-content.mjs'], { cwd: tmp, encoding: 'utf8' }).status, 0, 'calendar passes the validator')

fs.rmSync(tmp, { recursive: true, force: true })
