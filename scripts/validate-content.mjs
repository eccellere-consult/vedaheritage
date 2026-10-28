// Validates src/content/** — run in CI for every PR (agent-authored or human).
// Usage: node scripts/validate-content.mjs
import fs from 'fs'
import path from 'path'

const ROOT = path.join(process.cwd(), 'src', 'content')
const CATEGORIES = ['temples', 'places', 'beaches', 'backwaters', 'ayurveda']
const STATUSES = ['draft', 'approved']
const STORY_TYPES = ['Experience', 'Folklore I heard', 'Travel tip']
const errors = []
const slugs = new Set()

const fail = (file, msg) => errors.push(`${file}: ${msg}`)
const isStr = v => typeof v === 'string' && v.trim().length > 0
const isArr = (v, min = 1) => Array.isArray(v) && v.length >= min && v.every(isStr)
const isIsoDate = v => isStr(v) && !Number.isNaN(Date.parse(v))

function load(dir) {
  const full = path.join(ROOT, dir)
  if (!fs.existsSync(full)) return []
  return fs.readdirSync(full).filter(f => f.endsWith('.json')).map(f => {
    const rel = `${dir}/${f}`
    try {
      return { rel, name: f.replace(/\.json$/, ''), data: JSON.parse(fs.readFileSync(path.join(full, f), 'utf8')) }
    } catch (e) {
      fail(rel, `invalid JSON (${e.message})`)
      return null
    }
  }).filter(Boolean)
}

for (const cat of CATEGORIES) {
  for (const { rel, name, data: d } of load(cat)) {
    if (d.category !== cat) fail(rel, `category must be "${cat}"`)
    if (d.slug !== name) fail(rel, `slug "${d.slug}" must match filename "${name}"`)
    if (slugs.has(`${cat}/${d.slug}`)) fail(rel, 'duplicate slug')
    slugs.add(`${cat}/${d.slug}`)
    if (!STATUSES.includes(d.status)) fail(rel, `status must be one of ${STATUSES}`)
    for (const f of ['name', 'district', 'tagline']) if (!isStr(d[f])) fail(rel, `missing ${f}`)
    if (!isStr(d.summary) || d.summary.length < 50 || d.summary.length > 200) fail(rel, 'summary must be 50–200 chars (used as meta description)')
    if (!isArr(d.description)) fail(rel, 'description must be a non-empty array of paragraphs')
    if (!d.folklore || !isStr(d.folklore.title) || !isArr(d.folklore.story)) fail(rel, 'folklore {title, story[]} is required on every entry')
    if (!isArr(d.highlights, 3)) fail(rel, 'need at least 3 highlights')
    const v = d.visitorInfo
    if (!v || !isStr(v.bestTime) || !isStr(v.howToReach) || !isArr(v.etiquette)) fail(rel, 'visitorInfo {bestTime, howToReach, etiquette[]} required')
    if (!isArr(d.tags, 2)) fail(rel, 'need at least 2 tags')
    if (!isIsoDate(d.lastVerified)) fail(rel, 'lastVerified must be an ISO date')
    if (d.coordinates && (typeof d.coordinates.lat !== 'number' || typeof d.coordinates.lng !== 'number')) fail(rel, 'coordinates must be numeric lat/lng')
    if (!Array.isArray(d.sources) || d.sources.some(s => !isStr(s.label) || !/^https:\/\//.test(s.url || ''))) fail(rel, 'sources must be [{label, url (https)}]')
    if (d.status === 'approved' && (!Array.isArray(d.sources) || d.sources.length < 2)) fail(rel, 'approved entries need ≥ 2 sources')
    if (d.image && d.image.startsWith('http') && !isStr(d.imageAlt)) fail(rel, 'image requires imageAlt')
  }
}

for (const { rel, name, data: s } of load('stories')) {
  if (s.id !== name) fail(rel, `id "${s.id}" must match filename "${name}"`)
  if (!STATUSES.includes(s.status)) fail(rel, `status must be one of ${STATUSES}`)
  if (!STORY_TYPES.includes(s.type)) fail(rel, `type must be one of ${STORY_TYPES}`)
  for (const f of ['title', 'body', 'author']) if (!isStr(s[f])) fail(rel, `missing ${f}`)
  if (!isIsoDate(s.date)) fail(rel, 'date must be ISO')
  if ((s.body || '').length > 4000) fail(rel, 'body over 4000 chars')
  if (s.entrySlug && !slugs.has(`${s.entryCategory}/${s.entrySlug}`)) fail(rel, 'entrySlug does not match any entry')
}

if (errors.length) {
  console.error(`\n✖ ${errors.length} content problem(s):\n` + errors.map(e => '  - ' + e).join('\n'))
  process.exit(1)
}
console.log(`✔ content valid (${slugs.size} entries)`)
