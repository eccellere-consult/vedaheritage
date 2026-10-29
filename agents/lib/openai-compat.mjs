// Adapter for OpenAI and xAI (Grok), both via the OpenAI SDK and the Responses API.
// Same interface as the Anthropic adapter in llm.mjs: research() and extract().
//
//   provider "openai"  -> https://api.openai.com/v1      key: OPENAI_API_KEY
//   provider "xai"     -> https://api.x.ai/v1            key: XAI_API_KEY
//   AGENT_BASE_URL overrides the endpoint (any OpenAI-compatible server that supports
//   the Responses API, web search and JSON-schema output).
//
// Model names are NOT defaulted here: they change often, so set them explicitly
// (OPENAI_MODEL / XAI_MODEL, or per role: SCOUT_MODEL, ENRICHER_MODEL, VERIFIER_MODEL).
import OpenAI from 'openai'
import { z } from 'zod'
import { BudgetExceeded, ModelRefused } from './errors.mjs'

// Conservative (deliberately high) fallback prices in USD per million tokens, so the spend cap
// trips early rather than late. Override with <PROVIDER>_PRICE_IN_PER_M / _OUT_PER_M.
const FALLBACK_PRICE = { in: 5, out: 15 }

export function createOpenAICompat({ provider, model, budget, state }) {
  const isXai = provider === 'xai'
  const apiKey = isXai ? process.env.XAI_API_KEY : process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error(`${isXai ? 'XAI_API_KEY' : 'OPENAI_API_KEY'} is not set (provider "${provider}")`)
  if (!model) throw new Error(`No model set for provider "${provider}". Set ${provider.toUpperCase()}_MODEL (or the per-role *_MODEL variable). Check the provider's current model list; names change.`)

  const baseURL = process.env.AGENT_BASE_URL || (isXai ? 'https://api.x.ai/v1' : undefined)
  const client = new OpenAI({ apiKey, baseURL, timeout: 15 * 60 * 1000 })
  const P = provider.toUpperCase()
  const price = {
    in: Number(process.env[`${P}_PRICE_IN_PER_M`] ?? FALLBACK_PRICE.in) / 1e6,
    out: Number(process.env[`${P}_PRICE_OUT_PER_M`] ?? FALLBACK_PRICE.out) / 1e6,
  }
  const reasoning = process.env.AGENT_REASONING_EFFORT ? { reasoning: { effort: process.env.AGENT_REASONING_EFFORT } } : {}
  const consulted = new Set()

  // If the provider reports no token usage, the spend cap would silently never trigger. In that case
  // estimate conservatively from text size, plus a floor for research calls (they read many web pages
  // that never appear in our text) so the cap still works.
  const RESEARCH_FLOOR_TOKENS = 60000
  function meter(usage, est) {
    let inTok = usage?.input_tokens ?? usage?.prompt_tokens ?? 0
    let outTok = usage?.output_tokens ?? usage?.completion_tokens ?? 0
    if (!inTok && !outTok) {
      inTok = Math.ceil((est?.inChars || 0) / 3.5) + (est?.research ? RESEARCH_FLOOR_TOKENS : 0)
      outTok = Math.ceil((est?.outChars || 0) / 3.5)
      state.estimated = true
    }
    const cost = inTok * price.in + outTok * price.out
    state.calls++; state.inputTokens += inTok; state.outputTokens += outTok; state.usd += cost
    budget.usd += cost
    if (budget.usd > budget.max) throw new BudgetExceeded(`Budget of $${budget.max} exceeded (spent ~$${budget.usd.toFixed(2)})`)
  }

  // Only URLs the provider reports as sources/citations count as "retrieved" — never URLs
  // that merely appear in the model's own prose.
  function harvest(res, into) {
    for (const item of res.output || []) {
      if (item.type === 'web_search_call') (item.action?.sources || []).forEach(s => s.url && into.add(s.url))
      if (item.type === 'message') {
        for (const c of item.content || []) {
          (c.annotations || []).forEach(a => (a.type === 'url_citation' || a.url) && a.url && into.add(a.url))
        }
      }
    }
    if (Array.isArray(res.citations)) res.citations.forEach(u => typeof u === 'string' ? into.add(u) : u?.url && into.add(u.url))
  }

  const refused = res => (res.output || []).some(i => i.type === 'message' && (i.content || []).some(c => c.type === 'refusal'))
  const textOf = res => res.output_text ?? (res.output || []).filter(i => i.type === 'message').flatMap(i => i.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('')

  async function research({ system, user, search = 8, maxTurns }) {
    const urls = new Set()
    const res = await client.responses.create({
      model, instructions: system, input: user, max_output_tokens: 32000,
      tools: [{ type: 'web_search' }],
      ...(isXai ? {} : { include: ['web_search_call.action.sources'] }),
      ...reasoning,
    })
    meter(res.usage, { research: true, inChars: system.length + user.length, outChars: textOf(res).length })
    if (refused(res)) throw new ModelRefused('refusal')
    harvest(res, urls)
    urls.forEach(u => consulted.add(u))
    return { text: textOf(res), urls }
  }

  async function extract({ system, user, schema }) {
    const jsonSchema = z.toJSONSchema(schema)
    delete jsonSchema.$schema
    const res = await client.responses.create({
      model, instructions: system, input: user, max_output_tokens: 32000,
      text: { format: { type: 'json_schema', name: 'result', strict: true, schema: jsonSchema } },
      ...reasoning,
    })
    meter(res.usage, { inChars: system.length + user.length, outChars: textOf(res).length })
    if (refused(res)) throw new ModelRefused('refusal')
    if (res.status === 'incomplete') throw new Error(`Structured output incomplete (${res.incomplete_details?.reason || 'unknown'})`)
    const parsed = schema.safeParse(JSON.parse(textOf(res)))
    if (!parsed.success) throw new Error(`Structured output failed schema validation: ${parsed.error.message.slice(0, 300)}`)
    return parsed.data
  }

  return { research, extract, state, consulted, model, provider, mock: false }
}
