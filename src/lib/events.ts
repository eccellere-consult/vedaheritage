import fs from 'fs'
import path from 'path'

export interface CalendarEvent {
  id: string; name: string; type: string; start: string; end: string
  place: string; district: string; summary: string
  certainty: 'confirmed' | 'expected'
  sources: { label: string; url: string }[]
  lastChecked: string
}

export function getCalendar(): { updated: string | null; events: CalendarEvent[] } {
  try {
    const f = path.join(process.cwd(), 'src', 'content', 'events', 'calendar.json')
    const c = JSON.parse(fs.readFileSync(f, 'utf8'))
    return { updated: c.updated || null, events: Array.isArray(c.events) ? c.events : [] }
  } catch { return { updated: null, events: [] } }
}

const day = (d: Date) => d.toISOString().slice(0, 10)
const plus = (d: Date, n: number) => new Date(d.getTime() + n * 864e5)

/** Splits upcoming events by planning horizon, relative to the build date (the site rebuilds every week). */
export function planningWindows(now = new Date()) {
  const all = getCalendar().events
  const today = day(now), week = day(plus(now, 7))
  const monthEnd = day(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)))
  const yearEnd = day(plus(now, 365))
  const live = all.filter(e => e.end >= today)
  const inWeek = live.filter(e => e.start <= week)
  const inMonth = live.filter(e => e.start > week && e.start <= monthEnd)
  const inYear = live.filter(e => e.start > monthEnd && e.start <= yearEnd)
  return { week: inWeek, month: inMonth, year: inYear, built: today }
}

export const formatRange = (e: { start: string; end: string }) => {
  const f = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return e.start === e.end ? f(e.start) : `${f(e.start)} to ${f(e.end)}`
}
