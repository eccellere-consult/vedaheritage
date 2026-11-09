// Decides whether the fill workflow should run now and with which limits. Limits come from agents/settings.json "fill"
// (editable in the admin). Scheduled runs happen daily but only go ahead when "everyDays" have passed since the last run.
// Manual runs always go ahead and use the numbers typed in the admin when given.
import fs from 'fs'
const rd = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const cfg = { everyDays: 7, budget: 5, max: 40, minutes: 90, ...(rd('agents/settings.json', {}).fill || {}) }
const last = rd('agents/registers/fill-state.json', {}).lastRun
const manual = process.env.EVENT_NAME === 'workflow_dispatch'
const days = last ? (Date.now() - Date.parse(last)) / 864e5 : Infinity
const go = manual || days >= cfg.everyDays - 0.5
const pick = (k, lo, hi) => { const v = Number(process.env['IN_' + k.toUpperCase()]); return manual && Number.isFinite(v) && v >= lo && v <= hi ? v : cfg[k] }
const out = { run: go, minutes: pick('minutes', 10, 180), max: pick('max', 1, 100), budget: Math.min(pick('budget', 1, 40), 40) }
console.log(JSON.stringify({ ...out, lastRun: last || null, everyDays: cfg.everyDays }))
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
