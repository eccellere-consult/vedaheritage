// Offline test of the OpenAI / xAI adapter and per-role provider routing against a fake Responses API.
import http from 'http'
import assert from 'assert/strict'
import { z } from 'zod'
import { llmForRole, newBudget, BudgetExceeded } from '../lib/llm.mjs'

// The repository's saved admin choice must not leak into these tests.
process.env.AGENT_SETTINGS_FILE = '/nonexistent/agent-settings.json'

const requests = []
const srv = http.createServer((req, res) => {
  let b = ''
  req.on('data', d => (b += d))
  req.on('end', () => {
    const body = JSON.parse(b || '{}')
    requests.push({ url: req.url, body, auth: req.headers.authorization })
    const wantsJson = !!body.text?.format
    const noUsage = body.model === 'no-usage-model'
    const out = wantsJson
      ? { status: 'completed', output_text: JSON.stringify({ name: 'X', n: 3 }), output: [], usage: { input_tokens: 1000, output_tokens: 500 } }
      : { status: 'completed', output_text: 'notes mention https://prose-only.example/z', usage: { input_tokens: 2000, output_tokens: 1000 },
          output: [
            { type: 'web_search_call', action: { sources: [{ url: 'https://src.example/a' }] } },
            { type: 'message', content: [{ type: 'output_text', text: 'notes', annotations: [{ type: 'url_citation', url: 'https://src.example/b' }] }] },
          ] }
    if (noUsage) delete out.usage
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out))
  })
}).listen(0)
await new Promise(r => srv.on('listening', r))
const base = `http://127.0.0.1:${srv.address().port}/v1`
Object.assign(process.env, { OPENAI_API_KEY: 'k-openai', XAI_API_KEY: 'k-xai', AGENT_BASE_URL: base })

const Schema = z.object({ name: z.string(), n: z.number() })

// --- OpenAI: research harvests only reported sources; extract sends strict JSON schema
process.env.SCOUT_PROVIDER = 'openai'; process.env.SCOUT_MODEL = 'test-model'
const o = llmForRole('scout', { budget: newBudget(5) })
assert.equal(o.provider, 'openai')
const r = await o.research({ system: 'S', user: 'U' })
assert.deepEqual([...r.urls].sort(), ['https://src.example/a', 'https://src.example/b'], 'prose URLs must not count as retrieved')
assert.equal(requests[0].auth, 'Bearer k-openai')
assert.deepEqual(requests[0].body.tools, [{ type: 'web_search' }])
assert.deepEqual(requests[0].body.include, ['web_search_call.action.sources'])
const e = await o.extract({ system: 'S', user: 'U', schema: Schema })
assert.deepEqual(e, { name: 'X', n: 3 })
const fmt = requests[1].body.text.format
assert.equal(fmt.type, 'json_schema'); assert.equal(fmt.strict, true)
assert.equal(fmt.schema.additionalProperties, false); assert.equal(fmt.schema.$schema, undefined)

// --- xAI: own key, no `include` param
process.env.VERIFIER_PROVIDER = 'xai'; process.env.VERIFIER_MODEL = 'grok-test'
const x = llmForRole('verifier', { budget: newBudget(5) })
await x.research({ system: 'S', user: 'U' })
assert.equal(requests.at(-1).auth, 'Bearer k-xai')
assert.equal(requests.at(-1).body.include, undefined)
assert.equal(requests.at(-1).body.model, 'grok-test')

// --- Auto-detect: cheapest provider that has a key (xai > openai > anthropic); Verifier prefers a different vendor
for (const v of ['SCOUT_PROVIDER', 'SCOUT_MODEL', 'ENRICHER_PROVIDER', 'ENRICHER_MODEL', 'VERIFIER_PROVIDER', 'VERIFIER_MODEL', 'AGENT_PROVIDER', 'AGENT_MODEL']) delete process.env[v]
process.env.ANTHROPIC_API_KEY = 'k-anth'
const pick = r => llmForRole(r, { budget: newBudget(5) })
assert.equal(pick('enricher').provider, 'xai')
assert.equal(pick('scout').provider, 'xai')
assert.equal(pick('verifier').provider, 'openai')
assert.equal(pick('enricher').model, 'grok-4-fast')
const savedXai = process.env.XAI_API_KEY; delete process.env.XAI_API_KEY
assert.equal(pick('enricher').provider, 'openai'); assert.equal(pick('verifier').provider, 'anthropic')
const savedOpenai = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY
assert.equal(pick('enricher').provider, 'anthropic'); assert.equal(pick('verifier').provider, 'anthropic')
assert.equal(pick('enricher').model, 'claude-opus-5-5')
const savedAnth = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY
assert.throws(() => pick('enricher'), /No API key found/)
assert.equal(llmForRole('enricher', { mock: true }).mock, true, 'mock mode needs no key')
Object.assign(process.env, { XAI_API_KEY: savedXai, OPENAI_API_KEY: savedOpenai, ANTHROPIC_API_KEY: savedAnth })
// explicit settings still win
process.env.AGENT_PROVIDER = 'openai'; process.env.AGENT_MODEL = 'custom-model'
assert.equal(pick('enricher').provider, 'openai'); assert.equal(pick('enricher').model, 'custom-model')
process.env.VERIFIER_PROVIDER = 'xai'
assert.equal(pick('verifier').provider, 'xai'); assert.equal(pick('verifier').model, 'grok-4-fast')
delete process.env.AGENT_PROVIDER; delete process.env.AGENT_MODEL; delete process.env.VERIFIER_PROVIDER

// --- Guard rails
process.env.SCOUT_PROVIDER = 'openai'
process.env.SCOUT_MODEL = 'claude-opus-5-5'
assert.throws(() => llmForRole('scout'), /Claude model but provider is openai/)
process.env.SCOUT_MODEL = 'test-model'

// --- Shared budget trips across providers (fallback price is deliberately high)
const tiny = newBudget(0.01)
const a = llmForRole('scout', { budget: tiny })
await assert.rejects(() => a.research({ system: 'S', user: 'U' }), BudgetExceeded)

// --- Provider reports no token usage: the cap must still count (estimate), and flag it
process.env.SCOUT_MODEL = 'no-usage-model'
const nu = newBudget(1000)
const noUsage = llmForRole('scout', { budget: nu })
await noUsage.research({ system: 'S', user: 'U' })
assert.ok(nu.usd > 0, 'estimated spend must be > 0 when usage is missing')
assert.equal(noUsage.state.estimated, true)
const tiny2 = newBudget(0.05)
await assert.rejects(() => llmForRole('scout', { budget: tiny2 }).research({ system: 'S', user: 'U' }), BudgetExceeded)

srv.close()
console.log('✔ provider adapters passed')


// --- Provider toggle: precedence of this run's choice, the saved default and auto-detect
import fs from 'fs'
import os from 'os'
import path from 'path'
const settingsFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agent-settings-')), 'settings.json')
process.env.AGENT_SETTINGS_FILE = settingsFile
const setSaved = o => fs.writeFileSync(settingsFile, JSON.stringify(o))
const who = r => llmForRole(r, { budget: newBudget(5) }).provider
for (const v of ['SCOUT_PROVIDER', 'ENRICHER_PROVIDER', 'VERIFIER_PROVIDER', 'AGENT_PROVIDER', 'SCOUT_MODEL', 'ENRICHER_MODEL', 'VERIFIER_MODEL', 'AGENT_MODEL']) delete process.env[v]

setSaved({ provider: 'auto', verifierProvider: 'auto' })
assert.deepEqual([who('scout'), who('enricher'), who('verifier')], ['xai', 'xai', 'openai'], 'auto: cheapest for writers, a different vendor for the verifier')
setSaved({ provider: 'anthropic', verifierProvider: 'auto' })
assert.deepEqual([who('scout'), who('enricher'), who('verifier')], ['anthropic', 'anthropic', 'xai'], 'saved provider for all roles; auto verifier picks a different vendor than the writer')
setSaved({ provider: 'openai', verifierProvider: 'xai' })
assert.deepEqual([who('enricher'), who('verifier')], ['openai', 'xai'], 'saved verifier choice is honoured')
setSaved({ provider: 'openai', verifierProvider: 'auto' })
process.env.AGENT_PROVIDER = 'xai'
assert.deepEqual([who('enricher'), who('verifier')], ['xai', 'openai'], "this run's provider overrides the saved one for the writers; the verifier stays independent")
process.env.VERIFIER_PROVIDER = 'anthropic'
assert.equal(who('verifier'), 'anthropic', "this run's verifier choice wins")
delete process.env.VERIFIER_PROVIDER
process.env.AGENT_PROVIDER = 'saved'
assert.equal(who('enricher'), 'openai', '"saved" means use the saved default')
process.env.AGENT_PROVIDER = 'auto'; setSaved({})
assert.equal(who('enricher'), 'xai', '"auto" falls through to auto-detect')
delete process.env.AGENT_PROVIDER
fs.writeFileSync(settingsFile, 'not json'); assert.equal(who('enricher'), 'xai', 'a broken settings file is ignored')

// A chosen provider without a key fails early with a clear message (not mid-run after spending money)
const savedKey = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY
process.env.AGENT_PROVIDER = 'openai'
assert.throws(() => who('enricher'), /openai is selected .* OPENAI_API_KEY is not set/)
process.env.OPENAI_API_KEY = savedKey; process.env.AGENT_PROVIDER = 'gemini'
assert.throws(() => who('enricher'), /Unknown provider "gemini"/)
delete process.env.AGENT_PROVIDER
