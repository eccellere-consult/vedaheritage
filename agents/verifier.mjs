// VERIFIER — independently re-checks claims against their sources and assesses sensitivity.
// Runs with a different prompt (and optionally a different model) from the Enricher.
import { VerifyOut } from './lib/schemas.mjs'
import { prompt } from './lib/util.mjs'

export async function verify(llm, entry, claims) {
  const system = prompt('verifier')
  const derive = !claims?.length
  const payload = JSON.stringify(entry, null, 1)
  const claimBlock = derive
    ? 'No claims list was supplied (hand-written entry). First identify the 8-15 most important checkable claims (dates, founders, rules, restrictions, distances, station codes, attributions, and every sensitive item), then verify each using your own searches. Include the page you relied on as sourceUrl.'
    : `Claims to verify:\n${claims.map((c, i) => `${i + 1}. [${c.sensitive ? 'SENSITIVE' : 'normal'}] "${c.claim}" (field: ${c.field}) — cited source: ${c.sourceUrl}`).join('\n')}`

  const { text, urls } = await llm.research({
    system, effort: 'high', search: 6, fetch: Math.min(20, (claims?.length || 12) + 4), maxTurns: 8,
    label: 'verify', ctx: { name: entry.name },
    user: `Entry under review (a guide for ${entry.name}, ${entry.district}):\n${payload}\n\n${claimBlock}\n\nFetch each cited page yourself and record what it actually says. Finish with notes per claim.`,
  })
  const out = await llm.extract({
    label: 'verify', system, effort: 'high',
    ctx: { name: entry.name, claims: claims || [] },
    user: `Entry:\n${payload}\n\n${claimBlock}\n\n## Your verification notes\n${text}\n\nProduce the verification report.`,
    schema: VerifyOut,
  })

  // ---- Deterministic gates: the model's recommendation can only be tightened, never loosened.
  const count = v => out.results.filter(r => r.verdict === v).length
  const sensitive = new Set((claims || []).filter(c => c.sensitive).map(c => c.claim))
  const unverifiedSensitive = out.results.filter(r => r.verdict === 'unverifiable' && sensitive.has(r.claim)).length
  const blockers = out.issues.filter(i => i.severity === 'blocker').length
  const missing = (claims || []).filter(c => !out.results.some(r => r.claim === c.claim)).length
  const gateReasons = []
  if (count('contradicted')) gateReasons.push(`${count('contradicted')} contradicted claim(s)`)
  if (unverifiedSensitive) gateReasons.push(`${unverifiedSensitive} unverifiable sensitive claim(s)`)
  if (blockers) gateReasons.push(`${blockers} blocker issue(s)`)
  if (missing) gateReasons.push(`${missing} claim(s) not checked`)
  if (out.score < 80) gateReasons.push(`score ${out.score} < 80`)
  if ((entry.sources || []).length < 2) gateReasons.push('fewer than 2 sources')
  let recommendation = out.recommendation
  if (recommendation === 'ready_for_review' && gateReasons.length) recommendation = 'needs_edit'
  return { ...out, recommendation, gateReasons, consulted: [...urls] }
}

export const summarizeFixes = v => [
  ...v.results.filter(r => ['contradicted', 'partly_supported', 'unverifiable'].includes(r.verdict)).map(r => `- Claim "${r.claim}" is ${r.verdict}. ${r.fix ? `Fix: ${r.fix}` : r.evidence}`),
  ...v.issues.filter(i => i.severity !== 'minor').map(i => `- [${i.severity}] ${i.field}: ${i.problem} → ${i.suggestion}`),
].join('\n')
