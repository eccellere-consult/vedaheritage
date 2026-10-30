import { z } from 'zod'
import { CATEGORIES } from './util.mjs'

const Category = z.enum(CATEGORIES)
const Source = z.object({ label: z.string(), url: z.string() })
const PlaceOut = z.object({ name: z.string(), district: z.string(), kind: z.string().nullable(), note: z.string(), url: z.string().nullable() })

// An official contact for a place, taken from a page that was actually retrieved.
const ContactOut = z.object({
  label: z.string(),
  kind: z.enum(['tourism-office', 'temple-office', 'transport-enquiry', 'emergency', 'hospital', 'police', 'other']),
  phone: z.string().nullable(), email: z.string().nullable(), website: z.string().nullable(), address: z.string().nullable(),
  sourceUrl: z.string(),
})

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
  // Required for places with a fixed location; null for statewide heritage items.
  travel: z.object({
    byTrain: z.array(z.string()), byBus: z.array(z.string()),
    byWater: z.array(z.string()).nullable(), byAir: z.array(z.string()).nullable(),
  }).nullable(),
  // Required (non-null) when category is "heritage": where to see it, where to buy, experience centres/homes.
  heritage: z.object({
    localName: z.string().nullable(), materials: z.string().nullable(),
    whereToSee: z.array(PlaceOut), whereToBuy: z.array(PlaceOut), experiences: z.array(PlaceOut),
    buyingTips: z.array(z.string()),
  }).nullable(),
  officialLinks: z.array(Source).nullable(),
  // Food only: where to eat it. Named places only if confirmed from a retrieved page; otherwise places is empty and the tips say what to look for.
  eat: z.object({ places: z.array(PlaceOut), tips: z.array(z.string()) }).nullable(),
  // Dishes only (category "food"): a traditional recipe in your OWN words. Null for everything else.
  recipe: z.object({
    servings: z.string().nullable(), time: z.string().nullable(),
    ingredients: z.array(z.string()), method: z.array(z.string()), tips: z.array(z.string()).nullable(),
  }).nullable(),
  // Official contacts only (temple administration, tourism department, transport enquiries, emergency). Never private businesses.
  contacts: z.array(ContactOut).nullable(),
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

const cleanPlace = p => ({ name: p.name, district: p.district, ...(p.kind ? { kind: p.kind } : {}), note: p.note, ...(p.url ? { url: p.url } : {}) })

// Convert Enricher output to the on-disk entry (drops nulls, adds fixed fields).
export function toEntryFile(out, { category, slug, date, sources, contacts = [] }) {
  const e = {
    slug, category, name: out.name,
    ...(out.malayalamName ? { malayalamName: out.malayalamName } : {}),
    district: out.district, tagline: out.tagline, summary: out.summary,
    description: out.description, history: out.history,
    folklore: { title: out.folklore.title, story: out.folklore.story, ...(out.folklore.note ? { note: out.folklore.note } : {}) },
    spiritual: out.spiritual, highlights: out.highlights,
    visitorInfo: { bestTime: out.visitorInfo.bestTime, howToReach: out.visitorInfo.howToReach, etiquette: out.visitorInfo.etiquette, ...(out.visitorInfo.duration ? { duration: out.visitorInfo.duration } : {}) },
    ...(out.travel ? { travel: { byTrain: out.travel.byTrain, byBus: out.travel.byBus, ...(out.travel.byWater?.length ? { byWater: out.travel.byWater } : {}), ...(out.travel.byAir?.length ? { byAir: out.travel.byAir } : {}) } } : {}),
    ...(out.heritage ? { heritage: {
      ...(out.heritage.localName ? { localName: out.heritage.localName } : {}), ...(out.heritage.materials ? { materials: out.heritage.materials } : {}),
      whereToSee: out.heritage.whereToSee.map(cleanPlace), whereToBuy: out.heritage.whereToBuy.map(cleanPlace), experiences: out.heritage.experiences.map(cleanPlace),
      buyingTips: out.heritage.buyingTips } } : {}),
    ...(out.eat && category === 'food' && out.eat.tips.length >= 2 ? { eat: { places: out.eat.places.map(cleanPlace), tips: out.eat.tips } } : {}),
    ...(out.recipe && category === 'food' && out.recipe.ingredients.length >= 3 && out.recipe.method.length >= 3 ? { recipe: {
      ...(out.recipe.servings ? { servings: out.recipe.servings } : {}), ...(out.recipe.time ? { time: out.recipe.time } : {}),
      ingredients: out.recipe.ingredients, method: out.recipe.method, ...(out.recipe.tips?.length ? { tips: out.recipe.tips } : {}) } } : {}),
    ...(out.officialLinks?.length ? { officialLinks: out.officialLinks } : {}),
    ...(contacts.length ? { contacts: contacts.map(c => ({ label: c.label, kind: c.kind, ...(c.phone ? { phone: c.phone } : {}), ...(c.email ? { email: c.email } : {}), ...(c.website ? { website: c.website } : {}), ...(c.address ? { address: c.address } : {}), sourceUrl: c.sourceUrl, verifiedOn: date })) } : {}),
    ...(out.coordinates ? { coordinates: out.coordinates } : {}),
    images: [], tags: out.tags, sources,
    status: 'draft', lastVerified: date,
  }
  return e
}

// ---- Events --------------------------------------------------------------
export const EVENT_TYPES = ['Festival', 'Temple festival', 'Cultural', 'Arts & performance', 'Boat race', 'Wellness', 'Fair & market', 'Other']
export const EventsOut = z.object({
  events: z.array(z.object({
    name: z.string(),
    type: z.enum(EVENT_TYPES),
    start: z.string(),               // ISO date YYYY-MM-DD
    end: z.string(),                 // ISO date, same as start for a one-day event
    place: z.string(),               // venue or town
    district: z.string(),            // a Kerala district, or "Kerala" for state-wide
    summary: z.string(),             // 1-2 plain sentences: what it is and why a visitor would go
    certainty: z.enum(['confirmed', 'expected']), // confirmed = dates published by an official page; expected = usual dates, not yet announced
    sourceUrls: z.array(z.string()), // URLs actually seen during research
  })),
})
