// Publishes agent drafts that pass every gate, when agents/settings.json has "autoPublish": true.
// Run after the photo step. Anything that fails stays a draft and is listed in the report.
// Usage: node scripts/auto-publish.mjs   (prints one line per entry; exit 0 always unless the validator rejects the result)
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { decide, publish, readPolicy } from '../agents/lib/autopublish.mjs'
import { CATEGORIES, existingEntries, readJson, today, writeJson } from '../agents/lib/util.mjs'

const policy = readPolicy(readJson('agents/settings.json', {}))
if (!policy.enabled) { console.log('auto-publish: off'); process.exit(0) }

const fileExists = src => fs.existsSync(path.join('public', src))
const published = [], kept = []
for (const e of existingEntries()) {
  const { _file, ...entry } = e
  if (entry.status !== 'draft') continue
  const evidence = readJson(path.join('agents', 'evidence', `${entry.slug}.json`), null)
  const d = decide(entry, evidence, policy, { fileExists })
  if (d.ok) { writeJson(_file, publish(entry, today())); published.push({ entry, file: _file }) }
  else kept.push({ entry, reasons: d.reasons })
}

// Safety net: the repository validator has the last word. Revert any entry it rejects.
for (let round = 0; round < 3 && published.length; round++) {
  const r = spawnSync('node', ['scripts/validate-content.mjs'], { encoding: 'utf8' })
  if (r.status === 0) break
  const bad = published.filter(p => r.stderr.includes(`${p.entry.category}/${p.entry.slug}.json`))
  if (!bad.length) break
  for (const b of bad) { writeJson(b.file, b.entry); published.splice(published.indexOf(b), 1); kept.push({ entry: b.entry, reasons: ['validator rejected it'] }) }
}

for (const p of published) console.log(`published ${p.entry.category}/${p.entry.slug}`)
for (const k of kept) console.log(`kept as draft ${k.entry.category}/${k.entry.slug}: ${k.reasons.join('; ')}`)
fs.mkdirSync('agents/reports', { recursive: true })
const lines = ['', '### Published automatically', '', published.length ? published.map(p => `- **${p.entry.name}** (${p.entry.category}, ${p.entry.district}). Review it on the site; edit, unpublish or delete if anything is wrong.`).join('\n') : '- none', '']
if (kept.length) lines.push('### Kept as drafts', '', ...kept.map(k => `- ${k.entry.name}: ${k.reasons.join('; ')}`), '')
fs.appendFileSync('agents/reports/latest.md', lines.join('\n') + '\n')
