// ENRICHER — researches one candidate and drafts a full guide entry plus an evidence list.
import { EntryOut, toEntryFile } from './lib/schemas.mjs'
import { prompt, slugify, today } from './lib/util.mjs'

export async function enrich(llm, cand, { feedback = null, previous = null } = {}) {
  const system = prompt('enricher')
  const brief = [
    `Write the guide entry for: ${cand.name}`,
    `Category: ${cand.category}. District: ${cand.district}.`,
    cand.reason ? `Why it matters: ${cand.reason}` : '',
    cand.sourceUrls?.length ? `Starting sources (already seen by the scout): ${cand.sourceUrls.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  const revise = feedback && previous
    ? `\n\n## REVISION REQUIRED\nYour previous draft had problems. Re-check the affected facts, fix them, and keep everything else.\n\nPrevious draft:\n${JSON.stringify(previous, null, 1)}\n\nProblems to fix:\n${feedback}`
    : ''

  const { text, urls } = await llm.research({
    system, effort: 'high', search: feedback ? 6 : 10, fetch: feedback ? 6 : 10, label: 'enrich', ctx: { name: cand.name },
    user: `${brief}${revise}\n\nResearch thoroughly. Finish with detailed notes: each fact with the URL it came from.`,
  })
  const allowed = new Set([...urls, ...(cand.sourceUrls || [])])

  const out = await llm.extract({
    label: 'enrich', system, effort: 'high', maxTokens: 32000,
    ctx: { name: cand.name, district: cand.district, urls: [...urls] },
    user: `${brief}${revise}\n\n## Research notes\n${text}\n\n## URLs actually retrieved (sources, officialLinks and claim URLs must come from this list)\n${[...allowed].join('\n')}\n\nWrite the complete entry.`,
    schema: EntryOut,
  })

  const warnings = []
  const sources = out.sources.filter(s => allowed.has(s.url))
  if (sources.length < out.sources.length) warnings.push(`${out.sources.length - sources.length} source(s) dropped: URL was not actually retrieved`)
  if (out.officialLinks) out.officialLinks = out.officialLinks.filter(l => allowed.has(l.url))
  const claims = out.claims.filter(c => allowed.has(c.sourceUrl))
  if (claims.length < out.claims.length) warnings.push(`${out.claims.length - claims.length} claim(s) dropped: source URL not retrieved`)
  if (sources.length < 2) warnings.push('fewer than 2 retrieved sources')

  const slug = slugify(cand.name)
  const entry = toEntryFile(out, { category: cand.category, slug, date: today(), sources })
  return { entry, claims, warnings, consulted: [...allowed] }
}
