// Validates src/content/** — run in CI for every PR (agent-authored or human).
// Usage: node scripts/validate-content.mjs
import fs from 'fs'
import path from 'path'

const PUBLIC = path.join(process.cwd(), 'public')
const fileExists = src => src && src.startsWith('/') && fs.existsSync(path.join(PUBLIC, src))

const ROOT = path.join(process.cwd(), 'src', 'content')
const CATEGORIES = ['temples', 'places', 'beaches', 'backwaters', 'heritage', 'ayurveda', 'vedic', 'healing', 'plants', 'cultivation', 'music', 'dance', 'astrology', 'weddings', 'medical', 'food', 'muthassi']
const STATEWIDE = new Set(['heritage', 'vedic', 'healing', 'plants', 'cultivation', 'music', 'dance', 'astrology', 'weddings', 'medical', 'food', 'muthassi'])
const STATUSES = ['draft', 'approved']
const STORY_TYPES = ['Experience', 'Folklore I heard', 'Travel tip', 'Family recipe', 'Muthassi story']
const CONTACT_KINDS = ['tourism-office', 'temple-office', 'transport-enquiry', 'emergency', 'hospital', 'police', 'other']
const PHONE_RE = /^(\+?\d[\d\s().-]{5,18}\d)$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
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
    if (STATEWIDE.has(cat)) {
      if (tr && (!isArr(tr.byTrain) || !isArr(tr.byBus))) fail(rel, 'travel, if present, needs byTrain[] and byBus[]')
      const hr = d.heritage
      const okPlaces = arr => Array.isArray(arr) && arr.length >= 1 && arr.every(p => isStr(p.name) && isStr(p.district) && isStr(p.note) && (!p.url || /^https:\/\//.test(p.url)))
      if (cat !== 'heritage' && !hr) { /* optional for traditions */ } else if (!hr || !okPlaces(hr.whereToSee) || !okPlaces(hr.whereToBuy) || !okPlaces(hr.experiences) || !isArr(hr.buyingTips)) fail(rel, 'heritage {whereToSee[], whereToBuy[], experiences[] (each name, district, note), buyingTips[]} required')
    } else if (!tr || !isArr(tr.byTrain) || !isArr(tr.byBus)) fail(rel, 'travel {byTrain[], byBus[]} required (byWater, byAir optional)')
    if (d.officialLinks && d.officialLinks.some(l => !isStr(l.label) || !/^https:\/\//.test(l.url || ''))) fail(rel, 'officialLinks must be [{label, url (https)}]')
    if (d.eat !== undefined) {
      const ea = d.eat
      if (cat !== 'food') fail(rel, 'eat (where to eat) is only for the food category')
      if (!ea || !isArr(ea.tips, 2)) fail(rel, 'eat needs tips[≥2]')
      for (const pl of (ea && ea.places) || []) if (!isStr(pl.name) || !isStr(pl.district) || !isStr(pl.note) || (pl.url && !/^https:\/\//.test(pl.url))) fail(rel, 'eat.places: each needs name, district, note (url, if given, https)')
      if (ea && ea.places !== undefined && !Array.isArray(ea.places)) fail(rel, 'eat.places must be an array')
    }
    if (d.recipe !== undefined) {
      const r = d.recipe
      if (!r || !isArr(r.ingredients, 3) || !isArr(r.method, 3)) fail(rel, 'recipe needs ingredients[≥3] and method[≥3] (non-empty strings)')
      if (r && r.tips !== undefined && !isArr(r.tips, 0)) fail(rel, 'recipe.tips must be an array of strings')
      if (r && ['servings', 'time'].some(k => r[k] !== undefined && !isStr(r[k]))) fail(rel, 'recipe.servings and recipe.time must be text')
      if (cat !== 'food') fail(rel, 'recipe is only for the food category')
    }
    for (const c of d.contacts || []) {
      if (!isStr(c.label) || !CONTACT_KINDS.includes(c.kind)) fail(rel, `contacts: each needs a label and kind (${CONTACT_KINDS})`)
      if (!c.phone && !c.email && !c.website) fail(rel, `contacts "${c.label}": needs a phone, email or website`)
      if (c.phone && !PHONE_RE.test(c.phone)) fail(rel, `contacts "${c.label}": phone looks wrong (${c.phone})`)
      if (c.email && !EMAIL_RE.test(c.email)) fail(rel, `contacts "${c.label}": email looks wrong`)
      if (c.website && !/^https:\/\/[^\s]+$/.test(c.website)) fail(rel, `contacts "${c.label}": website must be https`)
      if (!/^https:\/\//.test(c.sourceUrl || '')) fail(rel, `contacts "${c.label}": needs the official sourceUrl (https) it was taken from`)
      if (!isIsoDate(c.verifiedOn)) fail(rel, `contacts "${c.label}": verifiedOn must be an ISO date`)
    }
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

const REGIONS = ['South', 'Central', 'North']
const districtNames = new Set()
for (const { rel, name, data: d } of load('districts')) {
  if (d.slug !== name) fail(rel, `slug "${d.slug}" must match filename "${name}"`)
  districtNames.add(d.name)
  if (!STATUSES.includes(d.status)) fail(rel, `status must be one of ${STATUSES}`)
  for (const f of ['name', 'headquarters', 'tagline']) if (!isStr(d[f])) fail(rel, `missing ${f}`)
  if (!REGIONS.includes(d.region)) fail(rel, `region must be one of ${REGIONS}`)
  if (!isStr(d.summary) || d.summary.length < 50 || d.summary.length > 200) fail(rel, 'summary must be 50–200 chars')
  if (!d.history || !isStr(d.history.overview) || !Array.isArray(d.history.timeline) || d.history.timeline.length < 2) fail(rel, 'history {overview, timeline[≥2]} required')
  if (!isArr(d.unique, 3) || !isArr(d.lookFor, 3) || !isArr(d.highlights, 3) || !isArr(d.festivals)) fail(rel, 'unique[≥3], lookFor[≥3], highlights[≥3], festivals[] required')
  if (!d.bestTime || !isStr(d.bestTime.season) || !isStr(d.bestTime.why) || !isStr(d.bestTime.avoid)) fail(rel, 'bestTime {season, why, avoid} required')
  if (!Array.isArray(d.sources) || d.sources.some(s => !/^https:\/\//.test(s.url || ''))) fail(rel, 'sources must be [{label, url (https)}]')
  if (d.status === 'approved' && d.sources.length < 2) fail(rel, 'approved needs ≥ 2 sources')
  if (!isIsoDate(d.lastVerified)) fail(rel, 'lastVerified must be an ISO date')
}
for (const { rel, data: k } of load('kerala')) {
  if (!isStr(k.title) || !isStr(k.summary) || !isArr(k.intro) || !isArr(k.essentials)) fail(rel, 'title, summary, intro[], essentials[] required')
  if (!Array.isArray(k.history) || k.history.length < 4 || !Array.isArray(k.regions) || !Array.isArray(k.seasons) || k.seasons.length < 3) fail(rel, 'history[≥4], regions[], seasons[≥3] required')
  if (!Array.isArray(k.sources) || k.sources.length < 1) fail(rel, 'sources required')
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

const LISTING_CATS = ['lamps-brassware', 'textiles', 'furniture-woodwork', 'art-crafts', 'musical-instruments', 'books-prints', 'other-traditional']
const LISTING_STATUSES = ['approved', 'sold', 'removed']
let listingCount = 0
for (const { rel, name, data: l } of load('listings')) {
  listingCount++
  if (l.id !== name) fail(rel, `id "${l.id}" must match filename "${name}"`)
  if (!/^\d{8}-[0-9a-f]{8}$/.test(l.id || '')) fail(rel, 'id must look like 20261029-1a2b3c4d')
  if (!LISTING_STATUSES.includes(l.status)) fail(rel, `status must be one of ${LISTING_STATUSES}`)
  if (!LISTING_CATS.includes(l.category)) fail(rel, `category must be one of ${LISTING_CATS}`)
  if (!['new', 'used'].includes(l.condition)) fail(rel, 'condition must be new or used')
  if (!Number.isInteger(l.priceInr) || l.priceInr < 1 || l.priceInr > 500000) fail(rel, 'priceInr must be a whole number from 1 to 500000')
  if (!isStr(l.title) || l.title.length < 5 || l.title.length > 90) fail(rel, 'title must be 5–90 chars')
  if (!isStr(l.description) || l.description.length < 40 || l.description.length > 1500) fail(rel, 'description must be 40–1500 chars')
  for (const f of ['district', 'sellerFirstName']) if (!isStr(l[f])) fail(rel, `missing ${f}`)
  if (!isIsoDate(l.listedOn) || !isIsoDate(l.expiresOn) || l.expiresOn < l.listedOn) fail(rel, 'listedOn and expiresOn must be ISO dates, expiry after listing')
  if (!Array.isArray(l.photos) || l.photos.length < 1 || l.photos.length > 3) fail(rel, 'photos must be 1–3')
  for (const ph of l.photos || []) {
    if (!isStr(ph.alt)) fail(rel, 'photo needs alt text')
    if (!fileExists(ph.src)) fail(rel, `photo file not found in public/: ${ph.src}`)
  }
  // Privacy guard: seller contact details must never reach the public repo. Scan free-text fields only
  // (ids, dates and photo filenames contain long digit runs that are not phone numbers).
  const text = [l.title, l.description, l.district, l.sellerFirstName, ...(l.photos || []).map(ph => ph.alt)].filter(Boolean).join(' ')
  if ('contactEmail' in l || 'contactPhone' in l || /[\w.+-]+@[\w-]+\.[\w.]+|(?<!\d)\+?\d[\d\s-]{8,}\d/.test(text)) fail(rel, 'listing appears to contain an email address, phone number or contact field; remove it')
}

// ---- Service-provider directory (see docs/DIRECTORY_MODEL.md) -------------------------------
const P_TYPES = { guide: [true, true], transport: [false, true], stay: [true, true], wellness: [true, false], crafts: [false, true], food: [false, true], learning: [false, true], 'travel-desk': [true, true] } // [needs credential, may be sponsored]
const P_DISTRICTS = ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod']
const AD_FLAGS = [/\b(best|no\.? ?1|number one|#1|top[- ]rated|finest|greatest|unbeatable|world[- ]class|leading)\b/i, /\b(cheapest|lowest price|guaranteed?|100 ?%|risk[- ]free|money[- ]back)\b/i, /\b(cure[sd]?|treats?|heals?|remed(y|ies)|therapeutic|diseases?|diabetes|cancer|arthritis|infertility)\b/i, /\b(miracle|secret|magic|spell|black magic|vashikaran)\b/i, /\b(click here|limited offer|hurry|act now)\b/i]
const SPONSOR_MAX_DAYS = 90, SPONSOR_MAX_PER_DISTRICT_TYPE = 3
const LINKISH = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|net|org|co|io|me|ly)\b/i
const PRIVATE_KEYS = ['contactPerson', 'contactPersonPhone', 'credentialNumber', 'tokenHash', 'emailVerified']
const providers = []
for (const { rel, name, data: p } of load('providers')) {
  providers.push({ rel, p })
  if (p.id !== name || !/^\d{8}-[0-9a-f]{8}$/.test(p.id || '')) fail(rel, `id must look like 20261029-1a2b3c4d and match the filename`)
  if (!['approved', 'suspended', 'removed'].includes(p.status)) fail(rel, 'status must be approved, suspended or removed')
  if (!P_TYPES[p.type]) fail(rel, `type must be one of ${Object.keys(P_TYPES)}`)
  if (!isStr(p.name) || p.name.length < 3 || p.name.length > 80) fail(rel, 'name must be 3–80 chars')
  if (!Array.isArray(p.districts) || p.districts.length < 1 || p.districts.length > 3 || p.districts.some(d => !P_DISTRICTS.includes(d))) fail(rel, 'districts must be 1–3 valid Kerala districts')
  if (!isStr(p.summary) || p.summary.length < 40 || p.summary.length > 200) fail(rel, 'summary must be 40–200 chars')
  if (LINKISH.test(p.summary || '') || LINKISH.test(p.name || '')) fail(rel, 'no web links in name or summary')
  if ([AD_FLAGS[2], AD_FLAGS[3]].some(re => re.test(`${p.name} ${p.summary}`))) fail(rel, 'summary contains a health, miracle or occult claim')
  if (!PHONE_RE.test(p.phone || '')) fail(rel, 'phone looks wrong')
  if (!EMAIL_RE.test(p.email || '')) fail(rel, 'email looks wrong')
  if (p.website && !/^https:\/\/[^\s]+$/.test(p.website)) fail(rel, 'website must be https')
  if (P_TYPES[p.type]?.[0] && !isStr(p.credentialLabel)) fail(rel, 'this type needs a credentialLabel (registration or licence type)')
  if (!isIsoDate(p.verifiedOn) || !isIsoDate(p.reverifyBy) || p.reverifyBy <= p.verifiedOn) fail(rel, 'verifiedOn and reverifyBy must be ISO dates, reverifyBy later')
  for (const k of PRIVATE_KEYS) if (k in p) fail(rel, `private field "${k}" must never be committed`)
  const sp = p.sponsored
  if (sp) {
    if (!P_TYPES[p.type]?.[1]) fail(rel, 'this type of service may not be sponsored')
    if (!isStr(sp.headline) || sp.headline.length < 5 || sp.headline.length > 60) fail(rel, 'sponsored.headline must be 5–60 chars')
    if (!isStr(sp.line) || sp.line.length < 15 || sp.line.length > 140) fail(rel, 'sponsored.line must be 15–140 chars')
    if (LINKISH.test(`${sp.headline} ${sp.line}`)) fail(rel, 'no web links in sponsored text')
    if (AD_FLAGS.some(re => re.test(`${sp.headline} ${sp.line}`))) fail(rel, 'sponsored text has a claim that is not allowed (ranking, price, guarantee, health, miracle, pressure)')
    if (!isIsoDate(sp.from) || !isIsoDate(sp.until) || sp.until < sp.from) fail(rel, 'sponsored.from/until must be ISO dates in order')
    else {
      if ((Date.parse(sp.until) - Date.parse(sp.from)) / 86400000 > SPONSOR_MAX_DAYS) fail(rel, `a sponsorship may run at most ${SPONSOR_MAX_DAYS} days`)
      if (sp.until > p.reverifyBy) fail(rel, 'sponsorship may not run past reverifyBy')
    }
    if (p.status !== 'approved') fail(rel, 'only approved providers can carry a sponsorship')
  }
}
// Cap: at most N concurrently sponsored providers of one type in one district.
for (const d of P_DISTRICTS) for (const t of Object.keys(P_TYPES)) {
  const sp = providers.filter(({ p }) => p.sponsored && p.status === 'approved' && p.type === t && p.districts?.includes(d))
  for (const { p } of sp) {
    const n = sp.filter(({ p: o }) => o.sponsored.from <= p.sponsored.from && o.sponsored.until >= p.sponsored.from).length
    if (n > SPONSOR_MAX_PER_DISTRICT_TYPE) { fail(`providers/${p.id}.json`, `more than ${SPONSOR_MAX_PER_DISTRICT_TYPE} concurrently sponsored ${t} providers in ${d}`); break }
  }
}
// Duplicates among live listings.
const seen = new Map()
for (const { rel, p } of providers) {
  if (p.status === 'removed') continue
  for (const key of [`email:${String(p.email).toLowerCase()}`, `phone:${String(p.phone).replace(/\D/g, '')}`]) { if (seen.has(key)) fail(rel, `duplicate of ${seen.get(key)} (${key})`); else seen.set(key, rel) }
}

if (errors.length) {
  console.error(`\n✖ ${errors.length} content problem(s):\n` + errors.map(e => '  - ' + e).join('\n'))
  process.exit(1)
}
console.log(`✔ content valid (${slugs.size} entries, ${districtNames.size} districts, ${listingCount} listings, ${providers.length} providers)`)
