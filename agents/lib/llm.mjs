// Thin wrapper around the Anthropic SDK used by all three agents.
//  - research(): tool-using turn(s) with web search / fetch; records every URL actually retrieved
//  - extract():  structured output validated against a Zod schema
//  - hard USD budget so a scheduled run can never overspend
//  - mock mode (--mock) returns deterministic fixtures so the pipeline can be tested offline
import fs from 'fs'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { BudgetExceeded, ModelRefused } from './errors.mjs'
import { createOpenAICompat } from './openai-compat.mjs'

const PRICE = { in: 4 / 1e6, out: 20 / 1e6, cacheRead: 0.2 / 1e6, cacheWrite: 5 / 1e6 } // claude-opus-5-5, USD/token

export { BudgetExceeded, ModelRefused }

export const newBudget = (max = Number(process.env.AGENT_MAX_USD || 10)) => ({ usd: 0, max })

const ROLES = ['scout', 'enricher', 'verifier']

// Provider auto-detection: the first provider in agents/models.json "preference" (cheapest first)
// whose API key is set. Adding just one key is therefore enough.
const KEY_ENV = { xai: 'XAI_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' }
const DEFAULTS = JSON.parse(fs.readFileSync(new URL('../models.json', import.meta.url), 'utf8'))

export const PROVIDERS = ['xai', 'openai', 'anthropic']

// "auto", "saved" and empty all mean "no explicit choice here".
const norm = v => { const x = String(v || '').trim().toLowerCase(); return x && x !== 'auto' && x !== 'saved' ? x : '' }

/** Saved default from agents/settings.json (edited from the admin page). Missing or broken file = all auto. */
export function readSettings() {
  try { return JSON.parse(fs.readFileSync(process.env.AGENT_SETTINGS_FILE || new URL('../settings.json', import.meta.url), 'utf8')) } catch { return {} }
}

const available = () => DEFAULTS.preference.filter(p => process.env[KEY_ENV[p]])

// Resolve the provider for a role ("auto", "saved" and empty all mean "no explicit choice here").
//   Scout and Enricher: <ROLE>_PROVIDER env > AGENT_PROVIDER env (this run's choice or a repository variable)
//                       > saved default (agents/settings.json "provider") > auto (cheapest provider that has a key)
//   Verifier:           VERIFIER_PROVIDER env > saved "verifierProvider" > auto: a DIFFERENT vendor from the writer when a
//                       second key exists, so the fact-checker is not the model marking its own work.
export function resolveProvider(role) {
  const R = role.toUpperCase(), cfg = readSettings()
  const explicit = role === 'verifier'
    ? norm(process.env.VERIFIER_PROVIDER) || norm(cfg.verifierProvider)
    : norm(process.env[`${R}_PROVIDER`]) || norm(process.env.AGENT_PROVIDER) || norm(cfg.provider)
  if (explicit) return explicit
  const have = available()
  if (!have.length) throw new Error('No API key found. Add one of XAI_API_KEY, OPENAI_API_KEY or ANTHROPIC_API_KEY as a GitHub secret (see agents/README.md).')
  if (role === 'verifier') { const writer = resolveProvider('enricher'); return have.find(p => p !== writer) || have[0] }
  return have[0]
}
export const defaultProvider = resolveProvider  // kept for older callers

// Resolve provider + model for an agent role. Model precedence:
//   <ROLE>_MODEL > AGENT_MODEL (only when AGENT_PROVIDER is the provider in use) > agents/models.json
export function llmForRole(role, { mock = false, budget = newBudget() } = {}) {
  if (!ROLES.includes(role)) throw new Error(`unknown role ${role}`)
  if (mock) return createLLM({ mock: true })
  const R = role.toUpperCase()
  const provider = resolveProvider(role)
  if (!PROVIDERS.includes(provider)) throw new Error(`Unknown provider "${provider}" (use xai, openai, anthropic or auto)`)
  if (!process.env[KEY_ENV[provider]]) throw new Error(`${provider} is selected for the ${role} but ${KEY_ENV[provider]} is not set. Add it as a GitHub secret, or choose another provider.`)
  const agentModel = provider === norm(process.env.AGENT_PROVIDER) ? process.env.AGENT_MODEL : undefined
  const model = process.env[`${R}_MODEL`] || agentModel || DEFAULTS.models[provider]
  return createLLM({ mock, provider, model, budget })
}

export function createLLM({ mock = false, provider = 'anthropic', model, budget = newBudget() } = {}) {
  const state = { usd: 0, inputTokens: 0, outputTokens: 0, calls: 0 }
  const consulted = new Set()
  if (mock) return createMock(state, consulted)
  if (!['anthropic', 'openai', 'xai'].includes(provider)) throw new Error(`Unknown provider "${provider}" (use anthropic, openai or xai)`)
  if (provider === 'anthropic' && model && !/^claude/.test(model)) throw new Error(`Model "${model}" is not a Claude model but provider is anthropic. Set ${'<ROLE>'}_PROVIDER.`)
  if (provider !== 'anthropic' && /^claude/.test(model || '')) throw new Error(`Model "${model}" is a Claude model but provider is ${provider}.`)
  if (provider !== 'anthropic') return createOpenAICompat({ provider, model, budget, state })
  const MODEL = model || 'claude-opus-5-5'

  const client = new Anthropic() // ANTHROPIC_API_KEY, or an `ant auth login` profile

  function meter(usage) {
    state.calls++
    state.inputTokens += usage.input_tokens || 0
    state.outputTokens += usage.output_tokens || 0
    const cost =
      (usage.input_tokens || 0) * PRICE.in + (usage.output_tokens || 0) * PRICE.out +
      (usage.cache_read_input_tokens || 0) * PRICE.cacheRead + (usage.cache_creation_input_tokens || 0) * PRICE.cacheWrite
    state.usd += cost
    budget.usd += cost
    if (budget.usd > budget.max) throw new BudgetExceeded(`Budget of $${budget.max} exceeded (spent ~$${budget.usd.toFixed(2)})`)
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

  return { research, extract, state, consulted, model: MODEL, provider: 'anthropic', mock: false }
}

// ---------------------------------------------------------------- mock -----
function createMock(state, consulted) {
  const U = 'https://example.org/'
  return {
    mock: true, model: 'mock', provider: 'mock', state, consulted,
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
          officialLinks: null, heritage: null, coordinates: null, recipe: null, eat: null, tags: ['mock', 'test'],
          contacts: [
            { label: 'Mock temple office', kind: 'temple-office', phone: '+91 479 2300000', email: null, website: null, address: null, sourceUrl: a },
            { label: 'Invented contact', kind: 'other', phone: '+91 99999 00000', email: null, website: null, address: null, sourceUrl: 'https://not-consulted.example/c' },
            { label: 'Malformed contact', kind: 'other', phone: 'call us', email: null, website: null, address: null, sourceUrl: b },
          ],
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
