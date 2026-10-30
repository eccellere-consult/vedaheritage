// Orchestrator.  node agents/run.mjs <scout|enrich|verify|pipeline|events> [options]
//   --mock            use deterministic fixtures (no API key, no network)
//   --max N           scout: max new candidates (default 8); enrich: max entries (default 3)
//   --slug a,b        verify: only these slugs        --drafts   verify: all draft entries
//   --budget USD      hard spend cap for this run (default $10, env AGENT_MAX_USD)
import fs from 'fs'
import { spawnSync } from 'child_process'
import { llmForRole, newBudget, BudgetExceeded, ModelRefused } from './lib/llm.mjs'
import { QUEUE, entryFile, evidenceFile, existingEntries, readJson, today, writeJson } from './lib/util.mjs'
import { scout } from './scout.mjs'
import { enrich } from './enricher.mjs'
import { verify, summarizeFixes } from './verifier.mjs'
import { events } from './events.mjs'

const args = process.argv.slice(2)
const cmd = args[0]
const flag = n => args.includes(`--${n}`)
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d)

const report = []   // markdown lines for the PR body
const add = (...l) => report.push(...l)

function validateSlug(cat, slug) {
  const r = spawnSync('node', ['scripts/validate-content.mjs'], { encoding: 'utf8' })
  if (r.status === 0) return []
  return r.stderr.split('\n').filter(l => l.includes(`${cat}/${slug}.json`)).map(l => l.replace(/^\s*- [^:]+:\s*/, ''))
}

async function runEnrich(llm, vllm, max) {
  const queue = readJson(QUEUE, [])
  const todo = queue.filter(c => c.status === 'new').sort((a, b) => a.priority - b.priority).slice(0, max)
  add(`### Enriched entries (${todo.length})`, '')
  for (const cand of todo) {
    console.log(`\n▶ ${cand.name}`)
    let feedback = null, previous = null, result = null, ver = null, attempt = 0, invalid = []
    try {
      for (; attempt < 2; attempt++) {
        result = await enrich(llm, cand, { feedback, previous })
        writeJson(entryFile(cand.category, result.entry.slug), result.entry)
        invalid = validateSlug(cand.category, result.entry.slug)
        if (invalid.length) { feedback = `Validator errors:\n${invalid.map(e => `- ${e}`).join('\n')}`; previous = result.entry; console.log('  ✖ validator:', invalid.join('; ')); continue }
        ver = await verify(vllm, result.entry, result.claims)
        console.log(`  ${ver.recommendation} (score ${ver.score})`)
        if (ver.recommendation !== 'needs_edit') break
        feedback = summarizeFixes(ver) + (ver.gateReasons.length ? `\nGate: ${ver.gateReasons.join('; ')}` : '')
        previous = result.entry
      }
    } catch (err) {
      if (err instanceof BudgetExceeded) { add(`- ⛔ ${cand.name}: ${err.message}`); throw err }
      const why = err instanceof ModelRefused ? `model declined (${err.message})` : err.message
      cand.status = 'failed'; cand.note = why
      add(`- ⚠️ **${cand.name}** failed: ${why}`)
      continue
    }
    const slug = result.entry.slug
    if (invalid.length) {                                  // never leave an invalid file behind
      fs.rmSync(entryFile(cand.category, slug), { force: true })
      cand.status = 'failed'; cand.note = `validator: ${invalid.join('; ')}`
      add(`- ⚠️ **${cand.name}** discarded: ${cand.note}`); continue
    }
    if (ver.recommendation === 'reject') {
      fs.rmSync(entryFile(cand.category, slug), { force: true })
      cand.status = 'rejected'; cand.note = ver.gateReasons.join('; ') || 'verifier rejected'
      add(`- ❌ **${cand.name}** rejected by verifier: ${cand.note}`)
    } else {
      cand.status = 'drafted'; cand.slug = slug
      writeJson(evidenceFile(slug), { date: today(), model: llm.model, candidate: cand, warnings: result.warnings, consulted: result.consulted, claims: result.claims, verification: ver, attempts: attempt + 1 })
      const c = ver.results
      const flag = ver.recommendation === 'ready_for_review' ? '✅ ready for review' : '🟡 NEEDS HUMAN EDIT'
      add(`- ${flag} — **${result.entry.name}** (\`${cand.category}/${slug}\`, ${result.entry.district}) · score ${ver.score} · claims: ${c.filter(r => r.verdict === 'supported').length} supported, ${c.filter(r => r.verdict === 'partly_supported').length} partial, ${c.filter(r => r.verdict === 'contradicted').length} contradicted, ${c.filter(r => r.verdict === 'unverifiable').length} unverifiable`)
      if (result.warnings.length) add(`  - warnings: ${result.warnings.join('; ')}`)
      if (ver.gateReasons.length) add(`  - gates: ${ver.gateReasons.join('; ')}`)
      for (const i of ver.issues.filter(i => i.severity !== 'minor')) add(`  - [${i.severity}] ${i.field}: ${i.problem}`)
      add(`  - folklore: ${ver.folkloreAssessment}`, `  - sensitivity: ${ver.sensitivityAssessment}`)
    }
    writeJson(QUEUE, queue)
  }
  writeJson(QUEUE, queue)
}

async function runVerify(llm) {
  const slugs = (opt('slug', '') || '').split(',').filter(Boolean)
  const entries = existingEntries().filter(e => slugs.length ? slugs.includes(e.slug) : flag('drafts') ? e.status === 'draft' : false)
  if (!entries.length) { console.log('Nothing to verify (use --slug a,b or --drafts).'); return }
  add(`### Re-verification (${entries.length})`, '')
  for (const e of entries) {
    const { _file, ...entry } = e
    const evidence = readJson(evidenceFile(entry.slug), null)
    console.log(`\n▶ verifying ${entry.name}`)
    const v = await verify(llm, entry, evidence?.claims || [])
    writeJson(evidenceFile(entry.slug), { ...(evidence || {}), date: today(), model: llm.model, reverified: true, verification: v })
    const bad = v.results.filter(r => r.verdict !== 'supported')
    add(`- ${v.recommendation === 'ready_for_review' ? '✅' : '🟡'} **${entry.name}** · score ${v.score} · ${v.recommendation}${v.gateReasons.length ? ` (${v.gateReasons.join('; ')})` : ''}`)
    for (const r of bad) add(`  - ${r.verdict}: "${r.claim}"${r.fix ? ` → ${r.fix}` : ''}`)
    for (const i of v.issues.filter(i => i.severity !== 'minor')) add(`  - [${i.severity}] ${i.field}: ${i.problem}`)
  }
}

async function main() {
  if (!['scout', 'enrich', 'verify', 'pipeline', 'events'].includes(cmd)) {
    console.error('usage: node agents/run.mjs <scout|enrich|verify|pipeline|events> [--mock] [--max N] [--slug a,b] [--drafts] [--budget USD]')
    process.exit(2)
  }
  // Each role can use a different provider/model: SCOUT_*, ENRICHER_*, VERIFIER_* (or AGENT_*).
  // Using a different vendor for the Verifier gives the most independent second opinion.
  const budget = newBudget(Number(opt('budget', process.env.AGENT_MAX_USD || 10)))
  const mock = flag('mock')
  const scoutLLM = llmForRole('scout', { mock, budget })
  const llm = llmForRole('enricher', { mock, budget })
  const vllm = llmForRole('verifier', { mock, budget })
  const t0 = Date.now()
  add(`## Discover Kerala content agents — ${today()}`, '', `Drafts only. Nothing here is published until a human sets \`status: "approved"\` and merges.`, '')
  try {
    if (cmd === 'scout' || cmd === 'pipeline') {
      const r = await scout(scoutLLM, { max: Number(opt('max', 8)) })
      add(`### Scout: ${r.added.length} new candidate(s)`, '', ...r.added.map(c => `- P${c.priority} **${c.name}** (${c.category}, ${c.district}) — ${c.reason}`), ...(r.dropped.length ? ['', `Dropped: ${r.dropped.map(([n, w]) => `${n} (${w})`).join('; ')}`] : []), '')
      console.log(`scout: +${r.added.length}, dropped ${r.dropped.length}`)
    }
    if (cmd === 'enrich' || cmd === 'pipeline') {
      await runEnrich(llm, vllm, Number(opt('max', 3)))
    }
    if (cmd === 'verify') await runVerify(vllm)
    if (cmd === 'events') {
      const r = await events(scoutLLM)
      const line = e => `**${e.name}** · ${e.start === e.end ? e.start : `${e.start} to ${e.end}`} · ${e.place}, ${e.district} · ${e.certainty === 'confirmed' ? 'dates published' : 'usual dates, confirm before travelling'} · ${e.sources.map(s => s.url).join(' ')}`
      add(`### Events calendar: ${r.total} upcoming event(s)`, '', `Dates come from pages the agent retrieved. Check each link before merging.`, '')
      if (r.added.length) add(`**New (${r.added.length})**`, ...r.added.map(e => `- ${line(e)}`), '')
      if (r.changed.length) add(`**Dates changed (${r.changed.length})**`, ...r.changed.map(c => `- ${c.to.name}: ${c.from.start} to ${c.from.end} → ${c.to.start} to ${c.to.end}`), '')
      if (r.removed.length) add(`**Removed because they are over (${r.removed.length})**`, ...r.removed.map(e => `- ${e.name} (${e.end})`), '')
      if (r.dropped.length) add(`Dropped: ${r.dropped.map(([n, w]) => `${n} (${w})`).join('; ')}`, '')
      console.log(`events: +${r.added.length}, changed ${r.changed.length}, removed ${r.removed.length}, dropped ${r.dropped.length}`)
    }
  } catch (err) {
    if (err instanceof BudgetExceeded) add('', `⛔ Stopped early: ${err.message}`)
    else { console.error(err); add('', `⛔ Run failed: ${err.message}`); process.exitCode = 1 }
  }
  add('', `_Run: ${((Date.now() - t0) / 60000).toFixed(1)} min · ~$${budget.usd.toFixed(2)} model spend (estimate; excludes web-search tool fees${[scoutLLM, llm, vllm].some(l => l.state?.estimated) ? '; the provider did not report token usage, so this is a rough text-size estimate' : ''}) · scout ${scoutLLM.provider}/${scoutLLM.model} · enricher ${llm.provider}/${llm.model} · verifier ${vllm.provider}/${vllm.model}_`)
  fs.mkdirSync('agents/reports', { recursive: true })
  fs.writeFileSync('agents/reports/latest.md', report.join('\n') + '\n')
  console.log('\n' + report.join('\n'))
}

main()
