// COVERAGE: where is the site thin, and which topics should the fill route write next?
// Target (agents/settings.json "coverage"): perCategory pages per category (default 30) and perDistrictMin pages per district
// in each category (default 2) WHERE THE DISTRICT HAS SOMETHING REAL. The planner never invents a topic to fill a cell: a district
// with nothing real is recorded as "none" and not asked again.
import fs from 'fs'
import { readSettings } from './lib/llm.mjs'
import { CATEGORIES, existingEntries, normName, prompt, readJson, slugify, today, writeJson } from './lib/util.mjs'

export const DISTRICTS = ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod']
export const COVERAGE_FILE = 'agents/registers/coverage.json'
export const NONE_FILE = 'agents/registers/coverage-none.json'
const TOPICS = 'agents/registers/topics.json'

export const CATEGORY_ABOUT = {
  temples: 'Hindu temples, shrines and kavus: architecture, rituals, legends, festivals',
  places: 'Tourist places: hill stations, heritage towns, forts, palaces, waterfalls, sanctuaries, museums',
  beaches: 'Beaches and coastal spots, their seasons and local stories',
  backwaters: 'Backwaters, lakes, rivers, canals and boat experiences',
  heritage: 'Traditional objects and architecture: vilakku, nalukettu, kettuvallam and similar, with where to see and buy',
  ayurveda: 'Ayurveda: therapies, seasonal practice, traditional centres and families',
  vedic: 'Vedic chanting, mantras, rituals and the Namboodiri scholarly traditions',
  healing: 'Traditional healing: vaidyam families, marma, kalari chikitsa, folk remedies',
  plants: 'Ayurvedic and sacred plants of Kerala',
  cultivation: 'Traditional farming and cultivation: spices, paddy systems, plantations',
  music: 'Kerala music and instruments: temple percussion, sopana sangeetham, folk music',
  dance: 'Dance and performing arts: Kathakali, Mohiniyattam, Theyyam, Koodiyattam, folk forms',
  astrology: 'Jyotisha and astrology traditions and centres',
  weddings: 'Wedding customs and life-cycle rituals across communities',
  medical: 'Medical and wellness tourism: accredited centres and what to know',
  food: 'Dishes, sadya, regional cuisines and where to eat them',
  muthassi: 'Muthassi stories: grandmother tales, folklore, family traditions',
  crafts: 'Local handicrafts: coir, aranmula kannadi, bell metal, woodcraft and more',
  artisans: 'Artisans and craft communities and where to meet them',
  wear: 'Traditional wear: kasavu, mundu, handloom clusters, jewellery',
}

const split = d => DISTRICTS.filter(x => String(d || '').includes(x))

/** Pure: counts per category and district from a list of entries ({category, district}). */
export function matrix(entries) {
  const m = {}
  for (const c of CATEGORIES) m[c] = { total: 0, districts: Object.fromEntries(DISTRICTS.map(d => [d, 0])), statewide: 0 }
  for (const e of entries) {
    const row = m[e.category]; if (!row) continue
    row.total++; const ds = split(e.district); if (!ds.length) row.statewide++; for (const d of ds) row.districts[d]++
  }
  return m
}

/** Pure: per category, how many pages are still needed and which districts are below the minimum (and not marked none). */
export function gaps(m, { perCategory = 30, perDistrictMin = 2 } = {}, none = {}) {
  return CATEGORIES.map(c => {
    const row = m[c], skip = new Set(none[c] || [])
    const thin = DISTRICTS.filter(d => row.districts[d] < perDistrictMin && !skip.has(d)).map(d => ({ district: d, have: row.districts[d], need: perDistrictMin - row.districts[d] }))
    return { category: c, total: row.total, need: Math.max(0, perCategory - row.total), thin }
  }).sort((a, b) => b.need - a.need || b.thin.length - a.thin.length)
}

export function writeCoverage(settings = readSettings()) {
  const cfg = { perCategory: 30, perDistrictMin: 2, ...(settings.coverage || {}) }
  const m = matrix(existingEntries()), none = readJson(NONE_FILE, {}), g = gaps(m, cfg, none)
  const out = { updated: today(), perCategory: cfg.perCategory, perDistrictMin: cfg.perDistrictMin, pagesTotal: Object.values(m).reduce((a, r) => a + r.total, 0), pagesNeeded: g.reduce((a, x) => a + x.need, 0),
    categories: Object.fromEntries(CATEGORIES.map(c => [c, { ...m[c], need: g.find(x => x.category === c).need, none: none[c] || [] }])) }
  writeJson(COVERAGE_FILE, out); return out
}

/**
 * Asks the model for specific topics for the thinnest categories and adds them to the topic register (deduplicated).
 * One call per category, so the cost is small and predictable. Returns {added, none, categories, lines}.
 */
export async function planCoverage(llm, { maxCategories = 5, perCall = 12, assert = async () => {} } = {}) {
  const settings = readSettings(), cfg = { enabled: true, perCategory: 30, perDistrictMin: 2, ...(settings.coverage || {}) }
  const entries = existingEntries(), none = readJson(NONE_FILE, {}), reg = readJson(TOPICS, { version: 1, topics: [] })
  const g = gaps(matrix(entries), cfg, none).filter(x => x.need > 0)
  const queued = new Set(reg.topics.filter(t => ['todo', 'done', 'exists'].includes(t.status)).map(t => normName(t.name)))
  const known = new Set([...entries.map(e => normName(e.name)), ...queued])
  const res = { added: 0, categories: [], lines: [] }
  const pending = cat => reg.topics.filter(t => t.status === 'todo' && t.category === cat).length
  for (const x of g.slice(0, maxCategories)) {
    await assert()
    const stillNeeded = x.need - pending(x.category); if (stillNeeded <= 0) continue
    const want = Math.min(perCall + x.thin.length, Math.max(6, stillNeeded))
    const existing = entries.filter(e => e.category === x.category).map(e => e.name).concat(reg.topics.filter(t => t.category === x.category && t.status === 'todo').map(t => t.name))
    let data
    try {
      const r = await llm.research({ system: prompt('coverage'), effort: 'low', search: 6, fetch: 3, maxTurns: 3, label: 'coverage', ctx: { name: x.category },
        user: `CATEGORY: ${x.category}: ${CATEGORY_ABOUT[x.category]}\nToday is ${today()}. Propose up to ${want} topics.\nDistricts that still need pages: ${x.thin.map(t => `${t.district} (has ${t.have})`).join(', ') || 'none; just add the best missing topics anywhere in Kerala'}.\nAlready covered or queued (skip): ${existing.slice(0, 250).join('; ')}` })
      const s = String(r.text), a = s.indexOf('{'), b = s.lastIndexOf('}'); data = JSON.parse(s.slice(a, b + 1))
    } catch (e) { res.lines.push(`- ⚠️ ${x.category}: planning failed (${String(e.message).slice(0, 100)})`); continue }
    let n = 0
    for (const t of Array.isArray(data.topics) ? data.topics : []) {
      const name = String(t?.name || '').trim().slice(0, 120); if (!name || known.has(normName(name))) continue
      const d = DISTRICTS.includes(t.district) ? t.district : 'Kerala'
      known.add(normName(name)); n++
      reg.topics.push({ id: slugify(name), name, category: x.category, district: d, priority: 1, status: 'todo', slug: null, lastRun: null, lastResult: null, editorial: null, nextReview: null, imageStatus: null, note: String(t.note || '').slice(0, 160) })
    }
    const nn = (Array.isArray(data.none) ? data.none : []).filter(d => DISTRICTS.includes(d)); if (nn.length) none[x.category] = [...new Set([...(none[x.category] || []), ...nn])]
    res.added += n; res.categories.push(x.category); res.lines.push(`- ${x.category}: +${n} topic(s) planned (${x.total} pages now, ${x.need} short of ${cfg.perCategory})${nn.length ? `; nothing real in ${nn.join(', ')}` : ''}`)
  }
  writeJson(TOPICS, reg); writeJson(NONE_FILE, none); writeCoverage(settings)
  return res
}
