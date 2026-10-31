// Offline tests for the automatic-publishing gates and the content-safety guard.
import assert from 'assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { decide, publish, readPolicy } from '../lib/autopublish.mjs'
import { safetyHits } from '../lib/safety.mjs'

const on = readPolicy({ autoPublish: true })
const entry = (extra = {}) => ({
  slug: 'x', category: 'temples', name: 'X', district: 'Kollam', status: 'draft',
  summary: 'A summary that is comfortably longer than fifty characters for the meta description.',
  folklore: { title: 't', story: ['s'] }, history: { significance: 'x' }, spiritual: { summary: 's' }, visitorInfo: { bestTime: 'b' },
  images: [{ src: '/images/discover/x-1.jpg', alt: 'a', credit: 'c', license: 'CC BY', sourceUrl: 'https://commons.wikimedia.org/x' }],
  sources: [{ label: 'a', url: 'https://a.example/' }, { label: 'b', url: 'https://b.example/' }], ...extra,
})
const ready = { verification: { recommendation: 'ready_for_review', gateReasons: [], results: [{ verdict: 'supported' }] } }

assert.ok(decide(entry(), ready, on).ok, 'a complete, fact-checked entry may go live')
assert.ok(!decide(entry(), ready, readPolicy({})).ok, 'off by default')
assert.ok(!decide(entry(), ready, readPolicy({ autoPublish: false })).ok, 'toggle off keeps everything a draft')
assert.ok(!decide(entry({ category: 'medical' }), ready, on).ok, 'health topics always wait for a human')
assert.ok(!decide(entry({ category: 'healing' }), ready, on).ok)
assert.ok(!decide(entry({ images: [] }), ready, on).ok, 'no photo, no publishing')
assert.ok(!decide(entry({ sources: [{ label: 'a', url: 'https://a.example/' }] }), ready, on).ok, 'two sources needed')
assert.ok(!decide(entry(), null, on).ok, 'no fact-check, no publishing')
assert.ok(!decide(entry(), { verification: { recommendation: 'needs_edit', gateReasons: ['score 70'], results: [] } }, on).ok, 'fact-checker flags block it')
assert.ok(!decide(entry(), { verification: { recommendation: 'ready_for_review', gateReasons: [], results: [{ verdict: 'contradicted' }] } }, on).ok, 'a contradicted claim blocks it')
assert.ok(!decide(entry(), ready, on, { fileExists: () => false }).ok, 'a missing photo file blocks it')

// content safety: adult, child exploitation, illegal material, adult-site links
for (const bad of ['An escort service near the beach', 'Nude shows at night', 'Child abuse material', 'How to buy cocaine in Kochi', 'human trafficking route']) assert.ok(safetyHits({ summary: bad }).length, `should flag: ${bad}`)
assert.ok(safetyHits({ sources: [{ url: 'https://hot-porn-site.example/a' }] }).length, 'adult-site link is flagged')
assert.ok(safetyHits({ sources: [{ url: 'https://site.xxx/a' }] }).length, 'adult TLD is flagged')
for (const ok of ['Kathakali costume and makeup', 'A calm backwater walk near Kollam', 'Classical temple sculpture at Aranmula', 'Sadya served on a banana leaf']) assert.equal(safetyHits({ summary: ok }).length, 0, `should be clean: ${ok}`)
assert.ok(!decide(entry({ summary: 'An escort service near the beach, listed here for visitors.' }), ready, on).ok, 'unsafe text keeps an entry a draft')
assert.ok(decide(entry({ summary: 'An escort service near the beach, listed here for visitors.' }), ready, on).reasons.some(r => /content-safety/.test(r)))

const p = publish(entry(), '2026-11-01')
assert.deepEqual([p.status, p.autoPublished, p.reviewed, p.lastVerified], ['approved', '2026-11-01', false, '2026-11-01'])

// the script end to end, in a scratch copy
const repo = process.cwd(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'autopub-'))
for (const d of ['agents', 'scripts', 'src/content', 'public']) fs.cpSync(path.join(repo, d), path.join(tmp, d), { recursive: true })
fs.symlinkSync(path.join(repo, 'node_modules'), path.join(tmp, 'node_modules')); fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
const w = (f, o) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), JSON.stringify(o, null, 2)) }
fs.writeFileSync(path.join(tmp, 'public/images/discover/x-1.jpg'), 'img')
const full = (slug, extra = {}) => ({ ...entry({ slug, ...extra }), name: slug, malayalamName: null, tagline: 't', description: ['d'], highlights: ['a', 'b', 'c'], tags: ['a', 'b'], travel: { byTrain: ['Station X'], byBus: ['KSRTC Y'], byWater: null, byAir: null }, lastVerified: '2026-01-01',
  history: { significance: 'x', timeline: [{ period: '1', event: 'a' }, { period: '2', event: 'b' }, { period: '3', event: 'c' }], keyFacts: ['k', 'l'] }, spiritual: { summary: 's', experiences: [{ title: 't', text: 'x' }], bestFor: 'b', mindfulTips: ['m'] }, visitorInfo: { bestTime: 'b', howToReach: 'h', etiquette: ['e'] },
  images: [{ src: '/images/discover/x-1.jpg', alt: 'a', credit: 'c', license: 'CC BY', sourceUrl: 'https://commons.wikimedia.org/x' }] })
w('src/content/temples/zz-good.json', full('zz-good')); w('agents/evidence/zz-good.json', ready)
w('src/content/temples/zz-unsafe.json', full('zz-unsafe', { summary: 'Escort service and nude shows are advertised to every visitor here.' })); w('agents/evidence/zz-unsafe.json', ready)
w('src/content/medical/zz-med.json', full('zz-med', { category: 'medical' })); w('agents/evidence/zz-med.json', ready)
const run = () => spawnSync('node', ['scripts/auto-publish.mjs'], { cwd: tmp, encoding: 'utf8' })
w('agents/settings.json', { autoPublish: false })
assert.match(run().stdout, /auto-publish: off/); assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'src/content/temples/zz-good.json'))).status, 'draft', 'toggle off publishes nothing')
w('agents/settings.json', { autoPublish: true })
const out = run().stdout
const get = f => JSON.parse(fs.readFileSync(path.join(tmp, f), 'utf8'))
assert.equal(get('src/content/temples/zz-good.json').status, 'approved'); assert.equal(get('src/content/temples/zz-good.json').reviewed, false)
assert.equal(get('src/content/temples/zz-unsafe.json').status, 'draft', 'unsafe content stays a draft'); assert.match(out, /kept as draft temples\/zz-unsafe: content-safety/)
assert.equal(get('src/content/medical/zz-med.json').status, 'draft', 'health topics stay drafts')
assert.equal(spawnSync('node', ['scripts/validate-content.mjs'], { cwd: tmp, encoding: 'utf8' }).status, 0, 'result passes the validator')
fs.rmSync(tmp, { recursive: true, force: true })
console.log('✔ auto-publish gates and content-safety guard passed')
