// EVENTS — keeps src/content/events/calendar.json current: this week, this month, the next 12 months.
import { EventsOut } from './lib/schemas.mjs'
import { prompt, readJson, slugify, today, writeJson } from './lib/util.mjs'

export const CALENDAR = 'src/content/events/calendar.json'
const ISO = /^\d{4}-\d{2}-\d{2}$/
const validDate = s => ISO.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
const HORIZON_DAYS = 400, KEEP_PAST_DAYS = 0

export async function events(llm, { now = today() } = {}) {
  const cal = readJson(CALENDAR, { updated: null, events: [] })
  const known = cal.events.filter(e => e.end >= addDays(now, -KEEP_PAST_DAYS))
  const user = [
    `Today is ${now}. Find Kerala events from ${now} to ${addDays(now, HORIZON_DAYS)}.`,
    `Cover: this week (to ${addDays(now, 7)}), the rest of this month, and the next 12 months.`,
    `Events already in the calendar (check and correct their dates, do not duplicate them):\n${known.map(e => `- ${e.name} (${e.start} to ${e.end}, ${e.place})`).join('\n') || '- none'}`,
  ].join('\n\n')
  const system = prompt('events')
  const { text, urls } = await llm.research({ system, user, effort: 'medium', search: 14, fetch: 8, label: 'events' })
  const out = await llm.extract({
    label: 'events', system, effort: 'medium',
    user: `${user}\n\n## Research notes\n${text}\n\n## URLs actually retrieved (sourceUrls must come from this list)\n${[...urls].join('\n')}\n\nReturn the events.`,
    schema: EventsOut,
  })

  const last = addDays(now, HORIZON_DAYS), dropped = [], found = []
  for (const c of out.events) {
    const sources = [...new Set(c.sourceUrls.filter(u => urls.has(u) && /^https:\/\//.test(u)))].map(u => ({ label: new URL(u).hostname.replace(/^www\./, ''), url: u }))
    const summary = c.summary.trim()
    if (!validDate(c.start) || !validDate(c.end)) dropped.push([c.name, 'bad date'])
    else if (c.end < c.start) dropped.push([c.name, 'ends before it starts'])
    else if (c.end < now) dropped.push([c.name, 'already over'])
    else if (c.start > last) dropped.push([c.name, 'too far ahead'])
    else if (!sources.length) dropped.push([c.name, 'no retrieved source'])
    else if (summary.length < 30 || summary.length > 400) dropped.push([c.name, 'summary length'])
    else found.push({ id: `${slugify(c.name)}-${c.start}`, name: c.name.trim(), type: c.type, start: c.start, end: c.end, place: c.place.trim(), district: c.district.trim(), summary, certainty: c.certainty, sources, lastChecked: now })
  }

  // A found event replaces an existing one with the same name (dates may have moved or been confirmed).
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const byName = new Map(known.map(e => [norm(e.name), e]))
  const added = [], changed = []
  for (const f of found) {
    const old = byName.get(norm(f.name))
    if (!old) added.push(f)
    else if (old.start !== f.start || old.end !== f.end || old.certainty !== f.certainty) changed.push({ from: old, to: f })
    byName.set(norm(f.name), f)
  }
  const all = [...byName.values()].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name))
  const removed = cal.events.filter(e => e.end < now)
  writeJson(CALENDAR, { updated: now, events: all })
  return { added, changed, removed, dropped, total: all.length }
}
