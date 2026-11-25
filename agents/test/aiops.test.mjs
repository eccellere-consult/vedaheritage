// Offline test of the AI Control Tower hook, against a fake fetch and a fake provider server.
//  - off (no settings): no network at all, no error
//  - on: one report per AI call with exact token fields, a stable task code, and no prompt/answer text
//  - never throws, even when the Control Tower is down or slow
import assert from 'assert/strict'
import http from 'http'
import { z } from 'zod'
import { reportAI, capabilityFor, APP_CODE } from '../lib/aiops.mjs'
import { createControlTower } from '../lib/aiops-client.mjs'
import { llmForRole, newBudget } from '../lib/llm.mjs'

process.env.AGENT_SETTINGS_FILE = '/nonexistent/agent-settings.json'
const realFetch = globalThis.fetch
const calls = []
const tick = () => new Promise(r => setTimeout(r, 30))
// Only the Control Tower address is faked; anything else (the local fake provider) goes through the real fetch.
const fakeFetch = impl => { globalThis.fetch = async (url, init) => { if (!String(url).includes('tower.test')) return realFetch(url, init); calls.push({ url: String(url), init }); return impl(url, init) } }
const tower = () => calls.filter(c => c.url.includes('tower.test'))

// --- 1. Off by default: no settings, no network, no error
delete process.env.AIOPS_ENDPOINT; delete process.env.AIOPS_KEY
fakeFetch(async () => ({ ok: true }))
reportAI({ label: 'fill', provider: 'anthropic', model: 'm', usage: { input_tokens: 1, output_tokens: 1 }, startedAt: Date.now() })
process.env.AIOPS_ENDPOINT = 'https://tower.test/api/v1'
reportAI({ label: 'fill', provider: 'anthropic', model: 'm', usage: { input_tokens: 1, output_tokens: 1 } })   // key still missing
delete process.env.AIOPS_ENDPOINT; process.env.AIOPS_KEY = 'secret-key'
reportAI({ label: 'fill', provider: 'anthropic', model: 'm', usage: { input_tokens: 1, output_tokens: 1 } })   // endpoint still missing
await tick()
assert.equal(calls.length, 0, 'must not touch the network without both settings')

// --- 2. On: exact token fields, never a cost, no text
process.env.AIOPS_ENDPOINT = 'https://tower.test/api/v1/'; process.env.AIOPS_KEY = 'secret-key'
reportAI({ label: 'Fill', provider: 'anthropic', model: 'claude-x', startedAt: Date.now() - 50,
  usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 700, cache_creation_input_tokens: 30 } })
reportAI({ label: 'enrich', provider: 'openai', model: 'gpt-x', usage: { input_tokens: 500, output_tokens: 90, input_tokens_details: { cached_tokens: 300 } } })
reportAI({ label: 'scout', provider: 'xai', model: 'grok-x', usage: { input_tokens: 10, output_tokens: 2 }, estimated: true })
reportAI({ label: 'events', provider: 'openai', model: 'gpt-x', startedAt: Date.now(), status: 'failed', errorCode: 429 })
await tick()
const sent = tower().map(c => ({ url: c.url, key: c.init.headers['x-aiops-key'], body: JSON.parse(c.init.body) }))
assert.equal(sent.length, 4)
for (const s of sent) {
  assert.equal(s.url, 'https://tower.test/api/v1/requests')
  assert.equal(s.key, 'secret-key')
  assert.equal(s.body.app_code, APP_CODE); assert.equal(APP_CODE, 'veda_heritage')
  assert.equal(s.body.module_code, 'content_agents')
  assert.ok(!('cost' in s.body) && !('estimated_cost' in s.body) && !('prompt' in s.body) && !('output' in s.body))
}
assert.deepEqual([sent[0].body.capability_code, sent[0].body.provider, sent[0].body.model], ['agent_fill', 'anthropic', 'claude-x'])
assert.deepEqual([sent[0].body.input_tokens, sent[0].body.output_tokens, sent[0].body.cached_tokens, sent[0].body.status], [1000, 200, 700, 'success'])
assert.ok(sent[0].body.latency_ms >= 0 && sent[0].body.retry_count === 0)
assert.deepEqual([sent[1].body.input_tokens, sent[1].body.output_tokens, sent[1].body.cached_tokens], [500, 90, 300])
assert.equal(sent[2].body.token_usage_estimated, true)
assert.deepEqual([sent[3].body.status, sent[3].body.error_code, sent[3].body.input_tokens], ['failed', '429', undefined])
assert.equal(capabilityFor('a b/c!'), 'agent_a_b_c_'); assert.equal(capabilityFor(undefined), 'agent_unknown')

// --- 3. Never throws: Control Tower down, answering an error, or odd input
calls.length = 0
fakeFetch(async () => { throw new Error('network down') })
assert.doesNotThrow(() => reportAI({ label: 'x', provider: 'anthropic', model: 'm', usage: { input_tokens: 1 } }))
fakeFetch(async () => ({ ok: false, status: 500 }))
assert.doesNotThrow(() => reportAI({ label: 'x', provider: 'openai', model: 'm' }))
assert.doesNotThrow(() => reportAI())
await tick()
const broken = createControlTower({ endpoint: 'https://tower.test', apiKey: 'k', fetch: async () => { throw new Error('boom') }, onError: () => { throw new Error('bad handler') } })
assert.equal(await broken.recordAIRequest({ status: 'success' }), false)

// --- 4. Wired into the real provider adapter: a fake OpenAI-style server; reports go to the fake Control Tower;
//        the agent's own result is unchanged and the report carries no prompt or answer text
globalThis.fetch = realFetch
const srv = http.createServer((req, res) => {
  req.on('data', () => {}); req.on('end', () => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ status: 'completed', output_text: JSON.stringify({ name: 'SECRET-ANSWER', n: 3 }), output: [], usage: { input_tokens: 123, output_tokens: 45, input_tokens_details: { cached_tokens: 20 } } }))
  })
}).listen(0)
await new Promise(r => srv.on('listening', r))
Object.assign(process.env, { OPENAI_API_KEY: 'k-openai', AGENT_BASE_URL: `http://127.0.0.1:${srv.address().port}/v1`, SCOUT_PROVIDER: 'openai', SCOUT_MODEL: 'test-model' })
calls.length = 0
fakeFetch(async () => ({ ok: true }))
const Schema = z.object({ name: z.string(), n: z.number() })
const llm = llmForRole('scout', { budget: newBudget(5) })
const out = await llm.extract({ system: 'SECRET-PROMPT', user: 'SECRET-USER', schema: Schema, label: 'scout' })
assert.deepEqual(out, { name: 'SECRET-ANSWER', n: 3 }, 'agent result must be unchanged')
await tick()
assert.equal(tower().length, 1)
const wired = JSON.parse(tower()[0].init.body)
assert.deepEqual([wired.capability_code, wired.provider, wired.model, wired.input_tokens, wired.output_tokens, wired.cached_tokens, wired.status],
  ['agent_scout', 'openai', 'test-model', 123, 45, 20, 'success'])
assert.ok(!/SECRET/.test(tower()[0].init.body), 'no prompt or answer text may be sent')

// --- 5. Settings off again: the same agent call sends nothing
delete process.env.AIOPS_KEY; calls.length = 0
await llm.extract({ system: 'S', user: 'U', schema: Schema, label: 'scout' })
await tick()
assert.equal(tower().length, 0)

globalThis.fetch = realFetch
srv.close()
console.log('✔ aiops: off without settings, exact token fields, no text sent, never throws')
