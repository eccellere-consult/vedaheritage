// Eccellere AI Control Tower: client (plain-JS copy of sdk/aiops-client.ts from the Control Tower repo).
//
// One file, no dependencies. It never throws and never blocks: every call has a short time limit and any failure
// is swallowed (reported to `onError` if one is given). Telemetry must not be able to break an agent run.
// It holds the app's secret key, so it is only ever used from the agent scripts (GitHub Actions or the owner's laptop),
// never from browser code.
//
// People are identified only by a hash. Never send names, e-mails, phone numbers, prompts or answers.
import { createHash, randomUUID } from 'node:crypto'

export function createControlTower(config) {
  const base = String(config.endpoint || '').replace(/\/+$/, '')
  const enabled = config.enabled !== false && Boolean(config.endpoint && config.apiKey)
  const timeoutMs = config.timeoutMs ?? 2000
  const salt = config.hashSalt ?? config.apiKey
  const doFetch = config.fetch ?? globalThis.fetch

  async function post(path, body) {
    if (!enabled) return false
    try {
      const response = await doFetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-aiops-key': config.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) config.onError?.(new Error(`Control Tower answered ${response.status}`))
      return response.ok
    } catch (error) {
      try { config.onError?.(error) } catch { /* never throw */ }
      return false
    }
  }

  function hashUser(userId) {
    if (userId === undefined || userId === null || userId === '') return undefined
    return createHash('sha256').update(`${salt}:${config.appCode}:${userId}`).digest('hex').slice(0, 32)
  }

  function trackEvent(eventType, capabilityCode, moduleCode, context = {}) {
    return post('/events', {
      event_uuid: randomUUID(),
      app_code: config.appCode,
      module_code: moduleCode,
      capability_code: capabilityCode,
      event_type: eventType,
      user_hash: hashUser(context.userId),
      session_hash: context.sessionId ? hashUser(context.sessionId) : undefined,
      request_uuid: context.requestUuid,
      event_metadata: context.metadata,
      occurred_at: new Date().toISOString(),
    })
  }

  return {
    enabled,
    hashUser,
    trackEvent,
    capabilityStarted: (capabilityCode, moduleCode, context) => trackEvent('capability_started', capabilityCode, moduleCode, context),
    capabilityCompleted: (capabilityCode, moduleCode, context) => trackEvent('capability_completed', capabilityCode, moduleCode, context),

    /** Report one completed AI call. The Control Tower works out the cost; never send one. */
    recordAIRequest(record) {
      return post('/requests', {
        request_uuid: record.requestUuid ?? randomUUID(),
        app_code: config.appCode,
        module_code: record.moduleCode,
        capability_code: record.capabilityCode,
        user_hash: hashUser(record.userId),
        provider: record.provider,
        model: record.model,
        prompt_code: record.promptCode,
        prompt_version: record.promptVersion,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        cached_tokens: record.cachedTokens,
        token_usage_estimated: record.tokenUsageEstimated ?? false,
        latency_ms: record.latencyMs,
        retry_count: record.retryCount ?? 0,
        status: record.status,
        error_code: record.errorCode,
        occurred_at: (record.occurredAt ?? new Date()).toISOString(),
      })
    },
  }
}
