import { z } from 'zod'
import { CATEGORIES } from './util.mjs'

const Category = z.enum(CATEGORIES)
const Source = z.object({ label: z.string(), url: z.string() })

// ---- Scout ---------------------------------------------------------------
export const ScoutOut = z.object({
  candidates: z.array(z.object({
    name: z.string(),
    category: Category,
    district: z.string(),
    reason: z.string(),             // why a Kerala visitor or citizen would want this guide
    priority: z.number(),           // 1 = high, 3 = low
    sourceUrls: z.array(z.string()), // URLs actually seen during research
  })),
})

// ---- Enricher ------------------------------------------------------------
export const EntryOut = z.object({
  name: z.string(),
  malayalamName: z.string().nullable(),
  district: z.string(),
  tagline: z.string(),
  summary: z.string(),
  description: z.array(z.string()),
  history: z.object({
    significance: z.string(),
    timeline: z.array(z.object({ period: z.string(), event: z.string() })),
    keyFacts: z.array(z.string()),
  }),
  folklore: z.object({ title: z.string(), story: z.array(z.string()), note: z.string().nullable() }),
  spiritual: z.object({
    summary: z.string(),
    experiences: z.array(z.object({ title: z.string(), text: z.string() })),
    bestFor: z.string(),
    mindfulTips: z.array(z.string()),
  }),
  highlights: z.array(z.string()),
  visitorInfo: z.object({
    bestTime: z.string(), howToReach: z.string(), etiquette: z.array(z.string()), duration: z.string().nullable(),
  }),
  travel: z.object({
    byTrain: z.array(z.string()), byBus: z.array(z.string()),
    byWater: z.array(z.string()).nullable(), byAir: z.array(z.string()).nullable(),
  }),
  officialLinks: z.array(Source).nullable(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  tags: z.array(z.string()),
  sources: z.array(Source),
  // Every date, number, rule, timing or attribution that a visitor could rely on,
  // each tied to the URL it came from. The Verifier re-checks these independently.
  claims: z.array(z.object({
    claim: z.string(),
    field: z.string(),       // e.g. "history.timeline", "visitorInfo.etiquette"
    sourceUrl: z.string(),
    sensitive: z.boolean(),  // religious rule, safety, money, timing
  })),
})

// ---- Verifier ------------------------------------------------------------
export const VerifyOut = z.object({
  results: z.array(z.object({
    claim: z.string(),
    verdict: z.enum(['supported', 'partly_supported', 'contradicted', 'unverifiable']),
    sourceUrl: z.string().nullable(), // page that decided the verdict
    evidence: z.string(),    // short quote or paraphrase from the source page
    fix: z.string().nullable(),
  })),
  issues: z.array(z.object({
    severity: z.enum(['blocker', 'major', 'minor']),
    field: z.string(),
    problem: z.string(),
    suggestion: z.string(),
  })),
  folkloreAssessment: z.string(),
  sensitivityAssessment: z.string(),
  score: z.number(),         // 0-100
  recommendation: z.enum(['ready_for_review', 'needs_edit', 'reject']),
})

// Convert Enricher output to the on-disk entry (drops nulls, adds fixed fields).
export function toEntryFile(out, { category, slug, date, sources }) {
  const e = {
    slug, category, name: out.name,
    ...(out.malayalamName ? { malayalamName: out.malayalamName } : {}),
    district: out.district, tagline: out.tagline, summary: out.summary,
    description: out.description, history: out.history,
    folklore: { title: out.folklore.title, story: out.folklore.story, ...(out.folklore.note ? { note: out.folklore.note } : {}) },
    spiritual: out.spiritual, highlights: out.highlights,
    visitorInfo: { bestTime: out.visitorInfo.bestTime, howToReach: out.visitorInfo.howToReach, etiquette: out.visitorInfo.etiquette, ...(out.visitorInfo.duration ? { duration: out.visitorInfo.duration } : {}) },
    travel: { byTrain: out.travel.byTrain, byBus: out.travel.byBus, ...(out.travel.byWater?.length ? { byWater: out.travel.byWater } : {}), ...(out.travel.byAir?.length ? { byAir: out.travel.byAir } : {}) },
    ...(out.officialLinks?.length ? { officialLinks: out.officialLinks } : {}),
    ...(out.coordinates ? { coordinates: out.coordinates } : {}),
    images: [], tags: out.tags, sources,
    status: 'draft', lastVerified: date,
  }
  return e
}
