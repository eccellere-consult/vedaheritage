// Decides whether an agent-drafted entry may go live without a human approving it first.
// The owner reviews on the site afterwards and can edit, unpublish or delete (admin owner bar).
import fs from 'fs'
import path from 'path'
import { safetyHits } from './safety.mjs'

export const DEFAULT_EXCLUDE = ['medical', 'healing']   // health topics always wait for a human
const isoDay = /^\d{4}-\d{2}-\d{2}$/

export function readPolicy(settings = {}) {
  return { enabled: settings.autoPublish === true, exclude: Array.isArray(settings.autoPublishExclude) ? settings.autoPublishExclude : DEFAULT_EXCLUDE }
}

/** @returns {{ok: boolean, reasons: string[]}} */
export function decide(entry, evidence, policy, { fileExists = () => true } = {}) {
  const why = []
  if (!policy.enabled) why.push('automatic publishing is off')
  if (entry.status !== 'draft') why.push('not a draft')
  if (policy.exclude.includes(entry.category)) why.push(`${entry.category} entries always wait for a human`)
  const v = evidence?.verification
  if (!v) why.push('no fact-check recorded')
  else {
    if (v.recommendation !== 'ready_for_review') why.push(`fact-check says ${v.recommendation}`)
    if ((v.gateReasons || []).length) why.push(`fact-check flagged: ${v.gateReasons.join('; ')}`)
    if ((v.results || []).some(r => r.verdict === 'contradicted')) why.push('a claim was contradicted by its source')
  }
  const unsafe = safetyHits({ ...entry, status: undefined })
  if (unsafe.length) why.push(`content-safety check: ${unsafe.join('; ')}`)
  const imgs = Array.isArray(entry.images) ? entry.images : []
  if (!imgs.length) why.push('no photo yet')
  else if (imgs.some(i => !['src', 'alt', 'credit', 'license', 'sourceUrl'].every(f => i?.[f]) || !fileExists(i.src))) why.push('a photo is missing its credit or file')
  const okSrc = (entry.sources || []).filter(s => s?.label && /^https:\/\//.test(s.url || ''))
  if (okSrc.length < 2) why.push('fewer than 2 sources')
  const sum = String(entry.summary || '')
  if (sum.length < 50 || sum.length > 200) why.push('summary length')
  for (const k of ['folklore', 'history', 'spiritual', 'visitorInfo']) if (!entry[k]) why.push(`missing ${k}`)
  return { ok: why.length === 0, reasons: why }
}

export function publish(entry, today) {
  return { ...entry, status: 'approved', lastVerified: today, autoPublished: today, reviewed: false }
}
