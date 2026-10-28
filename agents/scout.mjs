// SCOUT — finds Kerala places/traditions that deserve a guide and are not yet covered.
import { ScoutOut } from './lib/schemas.mjs'
import { CATEGORIES, QUEUE, existingEntries, normName, prompt, readJson, slugify, today, writeJson } from './lib/util.mjs'

export async function scout(llm, { max = 8, watchlist = readJson('agents/watchlist.json', {}) } = {}) {
  const existing = existingEntries()
  const queue = readJson(QUEUE, [])
  const covered = [...existing.map(e => ({ name: e.name, category: e.category, district: e.district })),
                   ...queue.map(c => ({ name: c.name, category: c.category, district: c.district }))]
  const seen = new Set(covered.map(c => normName(c.name)))

  // Coverage gaps help the model balance categories and districts.
  const count = (key, val) => covered.filter(c => c[key] === val).length
  const gaps = CATEGORIES.map(c => `${c}: ${count('category', c)} covered`).join('; ')

  const user = [
    `Find up to ${max} NEW candidates.`,
    `Coverage so far — ${gaps}.`,
    `Priority regions: ${(watchlist.priorityDistricts || []).join(', ') || 'Kollam, Alappuzha, Pathanamthitta'}.`,
    watchlist.themes?.length ? `Themes worth exploring this run: ${watchlist.themes.join('; ')}.` : '',
    watchlist.seedSources?.length ? `Good starting sources: ${watchlist.seedSources.join(', ')}.` : '',
    `ALREADY COVERED (do not return these or near-duplicates):\n${covered.map(c => `- ${c.name} (${c.category}, ${c.district})`).join('\n') || '- none'}`,
  ].filter(Boolean).join('\n\n')

  const system = prompt('scout')
  const { text, urls } = await llm.research({ system, user, effort: 'medium', search: 12, fetch: 6, label: 'scout' })
  const out = await llm.extract({
    label: 'scout', system, effort: 'medium',
    user: `${user}\n\n## Research notes\n${text}\n\n## URLs actually retrieved (sourceUrls must come from this list)\n${[...urls].join('\n')}\n\nReturn the candidates.`,
    schema: ScoutOut,
  })

  const added = [], dropped = []
  for (const c of out.candidates) {
    const key = normName(c.name)
    const sourceUrls = c.sourceUrls.filter(u => urls.has(u))
    if (!CATEGORIES.includes(c.category)) dropped.push([c.name, 'bad category'])
    else if (seen.has(key)) dropped.push([c.name, 'duplicate'])
    else if (!sourceUrls.length) dropped.push([c.name, 'no retrieved source'])
    else {
      seen.add(key)
      added.push({ id: slugify(c.name), name: c.name, category: c.category, district: c.district, reason: c.reason,
        priority: Math.min(3, Math.max(1, Math.round(c.priority))), sourceUrls, status: 'new', foundOn: today() })
    }
  }
  added.sort((a, b) => a.priority - b.priority)
  const kept = added.slice(0, max)
  writeJson(QUEUE, [...queue, ...kept])
  return { added: kept, dropped }
}
