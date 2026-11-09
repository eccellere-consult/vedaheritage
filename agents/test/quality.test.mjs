// Offline tests for the lite-page quality bar and for rule drift between the PHP admin and the JS validator.
import assert from 'assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { checkEntry } from '../../scripts/content-bar.mjs'

const para = 'Kerala has a long tradition of temple arts, and this page explains how the practice is taught, performed and kept alive by families today. '
const good = () => ({
  slug: 'qa-page', category: 'places', name: 'QA Page', district: 'Kollam', format: 'lite', status: 'approved', tagline: 'A quick guide to QA Page',
  summary: 'QA Page is a test page used to check the quality bar and the admin rules together.', description: [para.repeat(3)], highlights: ['One', 'Two', 'Three'],
  sections: [{ heading: 'Background', body: [para.repeat(2)] }, { heading: 'Visit', body: [para.replace('Kerala', 'The region').repeat(2)] }], tags: ['kerala', 'qa'],
  sources: [{ label: 'A', url: 'https://a.example.org/x' }, { label: 'B', url: 'https://b.example.org/y' }], images: [], imageStatus: 'needed', updated: '2026-11-09', lastVerified: '2026-11-09',
})
assert.deepEqual(checkEntry(good()), [], 'a healthy page has no flags')
const flag = (mut, re) => { const e = good(); mut(e); assert.match(checkEntry(e).join('; '), re) }
flag(e => { e.description = ['TBD']; e.sections = [] }, /placeholder/)
flag(e => { e.sections[1].body = e.sections[0].body }, /repeats a paragraph/)
flag(e => { e.sources[1].url = 'https://a.example.org/z' }, /single website/)
flag(e => { e.description = ['Short.']; e.sections = e.sections.map(s => ({ ...s, body: ['Tiny.'] })) }, /very short/)
flag(e => { e.sections = [e.sections[0]] }, /fewer than 2 sections/)
flag(e => { e.summary = e.tagline }, /summary repeats the tagline/)

// Drift: the PHP publish check (lib.php) and the JS validator must agree on lite pages.
if (spawnSync('php', ['-v']).status !== 0) { console.log('– php not found, drift test skipped'); process.exit(0) }
const lib = fs.readFileSync('public/api/admin/lib.php', 'utf8')
const m = lib.match(/function publish_blockers\(array \$e\): array \{[\s\S]*?\n\}\n/); assert.ok(m, 'publish_blockers found in lib.php')
const phpSays = e => JSON.parse(spawnSync('php', ['-r', `${m[0]} echo json_encode(publish_blockers(json_decode(file_get_contents("php://stdin"), true)));`], { input: JSON.stringify({ ...e, status: 'draft' }), encoding: 'utf8' }).stdout).length === 0
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-'))
fs.cpSync('scripts', path.join(tmp, 'scripts'), { recursive: true }); fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}')
fs.mkdirSync(path.join(tmp, 'public'), { recursive: true })
const jsSays = e => { fs.rmSync(path.join(tmp, 'src'), { recursive: true, force: true }); fs.mkdirSync(path.join(tmp, 'src/content/places'), { recursive: true }); fs.writeFileSync(path.join(tmp, 'src/content/places/qa-page.json'), JSON.stringify({ ...e, status: 'approved' })); return spawnSync('node', ['scripts/validate-content.mjs'], { cwd: tmp, encoding: 'utf8' }).status === 0 }
const cases = {
  'healthy page': e => e, 'one source only': e => { e.sources = [e.sources[0]]; return e }, 'no sources': e => { e.sources = []; return e },
  'summary too short': e => { e.summary = 'Too short.'; return e }, 'summary too long': e => { e.summary = 'x'.repeat(260); return e },
  'no description': e => { e.description = []; return e }, 'http source': e => { e.sources = [{ label: 'A', url: 'http://a.example.org' }]; return e },
}
for (const [why, mut] of Object.entries(cases)) assert.equal(phpSays(mut(good())), jsSays(mut(good())), `PHP and JS agree: ${why}`)
fs.rmSync(tmp, { recursive: true, force: true })
console.log('✔ quality bar and rule-drift tests passed')
