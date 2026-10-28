// Thin wrapper around the Anthropic SDK used by all three agents.
//  - research(): tool-using turn(s) with web search / fetch; records every URL actually retrieved
//  - extract():  structured output validated against a Zod schema
//  - hard USD budget so a scheduled run can never overspend
//  - mock mode (--mock) returns deterministic fixtures so the pipeline can be tested offline
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

const PRICE = { in: 4 / 1e6, out: 20 / 1e6, cacheRead: 0.2 / 1e6, cacheWrite: 5 / 1e6 } // claude-opus-5-5, USD/token

export class BudgetExceeded extends Error {}
export class ModelRefused extends Error {}

export function createLLM({ mock = false, model, maxUsd = Number(process.env.AGENT_MAX_USD || 10) } = {}) {
  const state = { usd: 0, inputTokens: 0, outputTokens: 0, calls: 0 }
  const consulted = new Set()
  const MODEL = model || process.env.AGENT_MODEL || 'claude-opus-5-5'

  if (mock) return createMock(state, consulted)

  const client = new Anthropic() // ANTHROPIC_API_KEY, or an `ant auth login` profile

  function meter(usage) {
    state.calls++
    state.inputTokens += usage.input_tokens || 0
    state.outputTokens += usage.output_tokens || 0
    state.usd +=
      (usage.input_tokens || 0) * PRICE.in + (usage.output_tokens || 0) * PRICE.out +
      (usage.cache_read_input_tokens || 0) * PRICE.cacheRead + (usage.cache_creation_input_tokens || 0) * PRICE.cacheWrite
    if (state.usd > maxUsd) throw new BudgetExceeded(`Budget of $${maxUsd} exceeded (spent ~$${state.usd.toFixed(2)})`)
  }

  function harvestUrls(content, into) {
    for (const b of content) {
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach(r => r.url && into.add(r.url))
      if (b.type === 'web_fetch_tool_result' && b.content?.url) into.add(b.content.url)
      if (b.type === 'text' && Array.isArray(b.citations)) b.citations.forEach(c => c.url && into.add(c.url))
    }
  }

  const tools = ({ search = 8, fetch = 8, allowedDomains } = {}) => [
    { type: 'web_search_20260209', name: 'web_search', max_uses: search },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: fetch, ...(allowedDomains ? { allowed_domains: allowedDomains } : {}) },
  ]

  async function research({ system, user, effort = 'medium', search = 8, fetch = 8, maxTurns = 6 }) {
    const urls = new Set()
    const messages = [{ role: 'user', content: user }]
    let text = ''
    for (let turn = 0; turn < maxTurns; turn++) {
      const res = await client.messages.stream({
        model: MODEL, max_tokens: 32000, system,
        output_config: { effort }, tools: tools({ search, fetch }), messages,
      }).finalMessage()
      meter(res.usage)
      harvestUrls(res.content, urls)
      if (res.stop_reason === 'refusal') throw new ModelRefused(res.stop_details?.category || 'refusal')
      text = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
      if (res.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: res.content }) // server-tool turn paused: send it back to continue
    }
    urls.forEach(u => consulted.add(u))
    return { text, urls }
  }

  async function extract({ system, user, schema, effort = 'medium', maxTokens = 32000 }) {
    // Streamed (large max_tokens would otherwise hit the SDK's non-streaming guard); JSON validated with Zod.
    const res = await client.messages.stream({
      model: MODEL, max_tokens: maxTokens, system, output_config: { effort, format: zodOutputFormat(schema) },
      messages: [{ role: 'user', content: user }],
    }).finalMessage()
    meter(res.usage)
    if (res.stop_reason === 'refusal') throw new ModelRefused(res.stop_details?.category || 'refusal')
    if (res.stop_reason === 'max_tokens') throw new Error('Structured output truncated (max_tokens)')
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const parsed = schema.safeParse(JSON.parse(text))
    if (!parsed.success) throw new Error(`Structured output failed schema validation: ${parsed.error.message.slice(0, 300)}`)
    return parsed.data
  }

  return { research, extract, state, consulted, model: MODEL, mock: false }
}

// ---------------------------------------------------------------- mock -----
function createMock(state, consulted) {
  const U = 'https://example.org/'
  return {
    mock: true, model: 'mock', state, consulted,
    async research({ label = '', ctx = {} }) {
      const urls = new Set([`${U}a-${label}`, `${U}b-${label}`])
      urls.forEach(u => consulted.add(u)); state.calls++
      return { text: `notes for ${ctx.name || label}`, urls }
    },
    async extract({ label, ctx = {} }) {
      state.calls++
      if (label === 'scout') {
        return { candidates: [
          { name: 'Mock Temple One', category: 'temples', district: 'Kollam', reason: 'test', priority: 1, sourceUrls: [`${U}a-scout`] },
          { name: 'Padmanabhaswamy Temple', category: 'temples', district: 'Thiruvananthapuram', reason: 'duplicate of existing', priority: 1, sourceUrls: [`${U}a-scout`] },
          { name: 'BAD Mock Temple', category: 'temples', district: 'Kollam', reason: 'verifier should reject', priority: 2, sourceUrls: [`${U}a-scout`] },
          { name: 'Unsourced Mock Place', category: 'places', district: 'Kollam', reason: 'no sources', priority: 3, sourceUrls: ['https://not-consulted.example/y'] },
        ] }
      }
      if (label === 'enrich') {
        const a = ctx.urls?.[0] || `${U}a`, b = ctx.urls?.[1] || `${U}b`
        return {
          name: ctx.name, malayalamName: null, district: ctx.district,
          tagline: `A test guide to ${ctx.name}`,
          summary: `${ctx.name} in ${ctx.district}: a mock-generated test entry used to exercise the agent pipeline end to end.`,
          description: ['Mock paragraph one.', 'Mock paragraph two.'],
          history: { significance: 'Mock significance.', timeline: [{ period: '1900', event: 'A' }, { period: '1950', event: 'B' }, { period: '2000', event: 'C' }], keyFacts: ['Fact one.', 'Fact two.'] },
          folklore: { title: 'A mock legend', story: ['Once upon a time.'], note: 'Retold from tradition.' },
          spiritual: { summary: 'Calm.', experiences: [{ title: 'Quiet', text: 'Sit.' }], bestFor: 'Everyone', mindfulTips: ['Be still.'] },
          highlights: ['One', 'Two', 'Three'],
          visitorInfo: { bestTime: 'Winter', howToReach: 'By road', etiquette: ['Dress modestly.'], duration: null },
          travel: { byTrain: ['Nearest station X'], byBus: ['KSRTC Y'], byWater: null, byAir: null },
          officialLinks: null, coordinates: null, tags: ['mock', 'test'],
          sources: [{ label: 'A', url: a }, { label: 'B', url: b }, { label: 'Hallucinated', url: 'https://not-consulted.example/x' }],
          claims: [{ claim: 'Founded in 1900', field: 'history.timeline', sourceUrl: a, sensitive: false }, { claim: 'Dress modestly', field: 'visitorInfo.etiquette', sourceUrl: b, sensitive: true }],
        }
      }
      if (label === 'verify') {
        const bad = /BAD/.test(ctx.name || '')
        return {
          results: (ctx.claims || []).map((c, i) => ({ claim: c.claim, verdict: bad && i === 0 ? 'contradicted' : 'supported', sourceUrl: c.sourceUrl || null, evidence: 'mock', fix: null })),
          issues: [], folkloreAssessment: 'ok', sensitivityAssessment: 'ok', score: bad ? 40 : 90,
          recommendation: bad ? 'reject' : 'ready_for_review',
        }
      }
      throw new Error(`mock: unknown label ${label}`)
    },
  }
}
