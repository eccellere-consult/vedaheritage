// Backend stop switch for every agent. State lives in agents/control.json on main (written by the admin page).
// Workers call assertRunning() before starting a task and immediately before every write or publish.
// Fail-safe: if the live state cannot be read in CI, the agents stop.
import fs from 'fs'

export class Stopped extends Error {}
export const CONTROL_FILE = 'agents/control.json'
const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function readControl(env = process.env, fetchImpl = fetch) {
  const local = () => { try { return JSON.parse(fs.readFileSync(env.CONTROL_FILE || CONTROL_FILE, 'utf8')) } catch { return { state: 'running' } } }
  if (env.CONTROL_FILE || !env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) return local()
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/${CONTROL_FILE}?ref=main`, {
        headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.raw+json', 'User-Agent': 'vh-agent-guard' },
      })
      if (r.status === 404) return { state: 'running' }
      if (r.ok) return JSON.parse(await r.text())
    } catch { /* retry once */ }
    await sleep(1500)
  }
  return { state: 'paused', reason: 'could not read the control state, stopping to be safe' }
}

/** Throws Stopped unless agents are running and `job` (if given) is not switched off. */
export async function assertRunning(job, deps = {}) {
  const c = await readControl(deps.env, deps.fetchImpl)
  if (c.state && c.state !== 'running') throw new Stopped(`Agents are ${c.state}${c.reason ? ` (${c.reason})` : ''}`)
  if (job && c.agents && c.agents[job] === false) throw new Stopped(`"${job}" is switched off in the admin`)
  return c
}
