import fs from 'fs'
import path from 'path'
import { PROVIDER_TYPES, type ProviderType } from './provider-options'

// ═══════════════════════════════════════════════════════════════════
// SERVICE-PROVIDER DIRECTORY — public listing JSON in src/content/providers/<id>.json.
// Only verified, in-date providers are shown. Private details (the contact
// person, credential number) never reach this repository.
// Sponsored slots are text-only, labelled, time-boxed and capped; see
// docs/DIRECTORY_MODEL.md. Rules are enforced by the admin API and again
// by scripts/validate-content.mjs.
// ═══════════════════════════════════════════════════════════════════

export const MAX_SPONSORED_PER_PAGE = 2
export const SPONSOR_MAX_PER_DISTRICT_TYPE = 3

export interface Sponsorship { from: string; until: string; headline: string; line: string }
export interface Provider {
  id: string
  name: string
  type: ProviderType
  districts: string[]
  summary: string
  phone: string
  email: string
  website?: string
  address?: string
  credentialLabel?: string
  verifiedOn: string
  reverifyBy: string
  status: 'approved' | 'suspended' | 'removed'
  sponsored?: Sponsorship
}

const DIR = path.join(process.cwd(), 'src', 'content', 'providers')
const todayISO = () => new Date().toISOString().slice(0, 10)

/** Approved providers whose verification is still in date (checked at build time; weekly rebuild keeps this fresh). */
export function getProviders(): Provider[] {
  if (!fs.existsSync(DIR)) return []
  const today = todayISO()
  return fs.readdirSync(DIR).filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Provider)
    .filter(p => p.status === 'approved' && p.reverifyBy >= today)
    .sort((a, b) => a.name.localeCompare(b.name))   // neutral order: payment never changes organic ranking
}

export const sponsorActive = (p: Provider, today = todayISO()) => !!p.sponsored && p.sponsored.from <= today && p.sponsored.until >= today

const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const weekKey = () => { const d = new Date(); const start = Date.UTC(d.getUTCFullYear(), 0, 1); return `${d.getUTCFullYear()}-${Math.floor((d.getTime() - start) / 604800000)}` }

/** Active sponsors for a district, rotated weekly so every sponsor gets a turn when slots are full. */
export function sponsoredFor(district: string, providers = getProviders(), max = MAX_SPONSORED_PER_PAGE): Provider[] {
  const week = weekKey()
  return providers.filter(p => sponsorActive(p) && p.districts.includes(district))
    .sort((a, b) => hash(week + a.id) - hash(week + b.id)).slice(0, max)
}

export const organicFor = (district: string, providers = getProviders()) => providers.filter(p => p.districts.includes(district))
export { PROVIDER_TYPES }
