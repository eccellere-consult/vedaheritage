// Validates src/content/** — run in CI for every PR (agent-authored or human).
// Usage: node scripts/validate-content.mjs
import fs from 'fs'
import path from 'path'

const PUBLIC = path.join(process.cwd(), 'public')
const fileExists = src => src && src.startsWith('/') && fs.existsSync(path.join(PUBLIC, src))

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
    const h = d.history
    if (!h || !isStr(h.significance) || !Array.isArray(h.timeline) || h.timeline.length < 3 || h.timeline.some(t => !isStr(t.period) || !isStr(t.event)) || !isArr(h.keyFacts, 2)) fail(rel, 'history {significance, timeline[≥3 {period,event}], keyFacts[≥2]} required')
    const sp = d.spiritual
    if (!sp || !isStr(sp.summary) || !Array.isArray(sp.experiences) || sp.experiences.length < 1 || sp.experiences.some(x => !isStr(x.title) || !isStr(x.text)) || !isStr(sp.bestFor) || !isArr(sp.mindfulTips)) fail(rel, 'spiritual {summary, experiences[≥1], bestFor, mindfulTips[]} required')
    const tr = d.travel
    if (!tr || !isArr(tr.byTrain) || !isArr(tr.byBus)) fail(rel, 'travel {byTrain[], byBus[]} required (byWater, byAir optional)')
    if (d.officialLinks && d.officialLinks.some(l => !isStr(l.label) || !/^https:\/\//.test(l.url || ''))) fail(rel, 'officialLinks must be [{label, url (https)}]')
    if (!Array.isArray(d.images) || d.images.length > 2) fail(rel, 'images must be an array of at most 2')
    for (const im of d.images || []) {
      for (const f of ['src', 'alt', 'credit', 'license', 'sourceUrl']) if (!isStr(im[f])) fail(rel, `image missing ${f}`)
      if (isStr(im.src) && !fileExists(im.src)) fail(rel, `image file not found in public/: ${im.src}`)
    }
    if (d.status === 'approved' && (d.images || []).length < 1) fail(rel, 'approved entries need ≥ 1 licensed, credited image')
    if (!isArr(d.highlights, 3)) fail(rel, 'need at least 3 highlights')
    const v = d.visitorInfo
    if (!v || !isStr(v.bestTime) || !isStr(v.howToReach) || !isArr(v.etiquette)) fail(rel, 'visitorInfo {bestTime, howToReach, etiquette[]} required')
    if (!isArr(d.tags, 2)) fail(rel, 'need at least 2 tags')
    if (!isIsoDate(d.lastVerified)) fail(rel, 'lastVerified must be an ISO date')
    if (d.coordinates && (typeof d.coordinates.lat !== 'number' || typeof d.coordinates.lng !== 'number')) fail(rel, 'coordinates must be numeric lat/lng')
    if (!Array.isArray(d.sources) || d.sources.some(s => !isStr(s.label) || !/^https:\/\//.test(s.url || ''))) fail(rel, 'sources must be [{label, url (https)}]')
    if (d.status === 'approved' && (!Array.isArray(d.sources) || d.sources.length < 2)) fail(rel, 'approved entries need ≥ 2 sources')
  }
}

for (const { rel, name, data: s } of load('stories')) {
  if (s.id !== name) fail(rel, `id "${s.id}" must match filename "${name}"`)
  if (!STATUSES.includes(s.status)) fail(rel, `status must be one of ${STATUSES}`)
  if (!STORY_TYPES.includes(s.type)) fail(rel, `type must be one of ${STORY_TYPES}`)
  for (const f of ['title', 'body', 'author']) if (!isStr(s[f])) fail(rel, `missing ${f}`)
  if (!isIsoDate(s.date)) fail(rel, 'date must be ISO')
  for (const ph of s.photos || []) {
    if (!isStr(ph.alt) || !isStr(ph.credit)) fail(rel, 'photo needs alt and credit')
    if (!fileExists(ph.src)) fail(rel, `photo file not found in public/: ${ph.src}`)
  }
  if ((s.photos || []).length > 2) fail(rel, 'max 2 photos per story')
  if ((s.body || '').length > 4000) fail(rel, 'body over 4000 chars')
  if (s.entrySlug && !slugs.has(`${s.entryCategory}/${s.entrySlug}`)) fail(rel, 'entrySlug does not match any entry')
}

if (errors.length) {
  console.error(`\n✖ ${errors.length} content problem(s):\n` + errors.map(e => '  - ' + e).join('\n'))
  process.exit(1)
}
console.log(`✔ content valid (${slugs.size} entries)`)
