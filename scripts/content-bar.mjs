// Quality bar for quick (lite) pages. Never blocks and never deletes: it only FLAGS weak pages so the owner can look at them.
// Writes agents/registers/quality.json (read by the admin). Usage: node scripts/content-bar.mjs
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const PLACEHOLDER = /\b(TBD|TODO|XXX|lorem ipsum|N\/A|\[citation needed\]|as an ai|insert (?:name|date)|coming soon)\b/i
const host = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Pure. Returns a list of plain-words flags for one lite entry; empty = fine. */
export function checkEntry(e) {
  const flags = [], paras = [...(e.description || []), ...(e.sections || []).flatMap(s => s.body || [])]
  const text = [e.name, e.tagline, e.summary, ...paras, ...(e.highlights || []), ...(e.latest || []).map(l => l.text)].join(' ')
  if (PLACEHOLDER.test(text)) flags.push('contains placeholder wording')
  const seen = new Set(); let dup = false
  for (const p of paras.map(norm).filter(p => p.length > 40)) { if (seen.has(p)) dup = true; seen.add(p) }
  if (dup) flags.push('repeats a paragraph')
  if (new Set((e.sources || []).map(s => host(s.url)).filter(Boolean)).size < 2) flags.push('rests on a single website')
  if (paras.join(' ').split(/\s+/).length < 120) flags.push('very short')
  if ((e.sections || []).length < 2) flags.push('fewer than 2 sections')
  if (norm(e.summary) === norm(e.tagline)) flags.push('summary repeats the tagline')
  if (new Set((e.sections || []).map(s => norm(s.heading))).size < (e.sections || []).length) flags.push('duplicate section headings')
  return flags
}

export function run(root = 'src/content', out = 'agents/registers/quality.json') {
  const flagged = []; let checked = 0
  for (const cat of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    const dir = path.join(root, cat); if (!fs.statSync(dir).isDirectory()) continue
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
      let e; try { e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { continue }
      if (e.format !== 'lite') continue
      checked++; const flags = checkEntry(e)
      if (flags.length) flagged.push({ category: e.category, slug: e.slug, name: e.name, flags })
    }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify({ checked, flaggedCount: flagged.length, generated: new Date().toISOString().slice(0, 10), flagged }, null, 2) + '\n')
  return { checked, flagged }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const r = run(); console.log(`content bar: ${r.checked} lite page(s) checked, ${r.flagged.length} flagged`) }
