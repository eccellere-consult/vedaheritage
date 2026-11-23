// Reports each AI call the agents make to the Eccellere AI Control Tower (aiops.eccellere.co.in).
//
// Safe by default: with AIOPS_ENDPOINT or AIOPS_KEY unset this does nothing at all (no network, no error, no log line).
// It never throws, never waits for the answer, and never changes what an agent returns.
// Privacy: only provider, model, token counts, time, status and a task code are sent. Never prompts, answers or names,
// and never a cost (the Control Tower works that out).
import { createControlTower } from './aiops-client.mjs'

export const APP_CODE = 'veda_heritage'
export const MODULE_CODE = 'content_agents'

let cached = { endpoint: '', apiKey: '', fetch: null, tower: null }

// Built from the environment on each use, so a missing setting simply means "off".
function tower() {
  const endpoint = process.env.AIOPS_ENDPOINT, apiKey = process.env.AIOPS_KEY
  if (!endpoint || !apiKey) return null
  if (cached.endpoint !== endpoint || cached.apiKey !== apiKey || cached.fetch !== globalThis.fetch) {
    cached = { endpoint, apiKey, fetch: globalThis.fetch, tower: createControlTower({ endpoint, apiKey, appCode: APP_CODE, timeoutMs: 2000 }) }
  }
  return cached.tower
}

/** A stable task code from the agent's label ("fill", "refresh", "enrich"...): letters, digits, dot, dash, underscore only. */
export const capabilityFor = label => `agent_${String(label || 'unknown').toLowerCase().replace(/[^a-z0-9._-]+/g, '_').slice(0, 40)}`

/**
 * Report one AI call. Fire and forget: returns nothing, throws nothing.
 * `usage` is exactly what the provider returned (see the integration guide on cached tokens).
 */
export function reportAI(info) {
  try {
    const { label, provider, model, usage, startedAt, status = 'success', estimated = false, errorCode } = info
    const t = tower()
    if (!t) return
    const num = v => (Number.isFinite(v) ? v : undefined)
    const cached = provider === 'anthropic'
      ? usage?.cache_read_input_tokens
      : usage?.input_tokens_details?.cached_tokens ?? usage?.prompt_tokens_details?.cached_tokens
    t.recordAIRequest({
      capabilityCode: capabilityFor(label), moduleCode: MODULE_CODE,
      provider, model: model || undefined,
      inputTokens: num(usage?.input_tokens ?? usage?.prompt_tokens),
      outputTokens: num(usage?.output_tokens ?? usage?.completion_tokens),
      cachedTokens: num(cached),
      tokenUsageEstimated: estimated,
      latencyMs: startedAt ? Date.now() - startedAt : undefined,
      retryCount: 0, // the provider SDKs retry inside the call and do not say how often
      status,
      errorCode: status === 'success' ? undefined : String(errorCode || 'error').slice(0, 60),
    }).catch(() => {})
  } catch { /* telemetry must never break an agent */ }
}
