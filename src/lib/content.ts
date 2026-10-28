import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════════
// DISCOVER KERALA — CONTENT LAYER
// Entries live as JSON in src/content/<category>/<slug>.json
// Stories live as JSON in src/content/stories/<id>.json
// Only status "approved" is published to production. Drafts are shown
// when NEXT_PUBLIC_SHOW_DRAFTS=1 (local dev + preview builds).
// ═══════════════════════════════════════════════════════════════════

export const CATEGORIES = {
  temples: {
    label: 'Temples',
    singular: 'Temple',
    blurb: "Kerala's temples — architecture, living rituals, legends and the etiquette that keeps a visit respectful.",
    seoTitle: 'Kerala Temples: History, Legends, Rituals & Visiting Guide',
    schemaType: 'HinduTemple',
  },
  places: {
    label: 'Tourist Places',
    singular: 'Place',
    blurb: 'Hill stations, heritage towns, forts and palaces — the places that define a journey through Kerala.',
    seoTitle: 'Best Places to Visit in Kerala: Heritage, Hills & Towns',
    schemaType: 'TouristAttraction',
  },
  beaches: {
    label: 'Beaches',
    singular: 'Beach',
    blurb: "From cliff-top Varkala to the historic shore of Kappad — Kerala's coastline, its stories and its seasons.",
    seoTitle: 'Kerala Beaches: Best Beaches, Seasons & Local Legends',
    schemaType: 'Beach',
  },
  backwaters: {
    label: 'Backwaters',
    singular: 'Backwater',
    blurb: "The lakes, canals and lagoons that make Kerala unlike anywhere else — houseboats, village life and boat-race lore.",
    seoTitle: 'Kerala Backwaters: Alleppey, Ashtamudi & Where to Go',
    schemaType: 'TouristAttraction',
  },
  ayurveda: {
    label: 'Ayurveda',
    singular: 'Ayurveda',
    blurb: "Kerala's living Ayurvedic tradition — therapies, seasonal rejuvenation and the families who preserved the craft.",
    seoTitle: 'Ayurveda in Kerala: Panchakarma, Seasons & Authentic Practice',
    schemaType: 'TouristAttraction',
  },
} as const

export type CategoryKey = keyof typeof CATEGORIES
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[]

export type ContentStatus = 'draft' | 'approved'

export interface Source { label: string; url: string }

export interface EntryImage {
  src: string                  // /images/discover/<slug>-1.jpg
  alt: string
  credit: string               // photographer / author
  license: string              // e.g. "CC BY-SA 4.0"
  licenseUrl?: string
  sourceUrl: string            // page the image came from
}

export interface Entry {
  slug: string
  category: CategoryKey
  name: string
  malayalamName?: string
  district: string
  tagline: string
  summary: string              // 50–200 chars — used as meta description
  description: string[]        // paragraphs
  history: {
    significance: string
    timeline: { period: string; event: string }[]
    keyFacts: string[]
  }
  folklore: { title: string; story: string[]; note?: string }
  spiritual: {
    summary: string
    experiences: { title: string; text: string }[]
    bestFor: string
    mindfulTips: string[]
  }
  highlights: string[]
  visitorInfo: {
    bestTime: string
    howToReach: string
    etiquette: string[]
    duration?: string
  }
  travel: {
    byTrain: string[]
    byBus: string[]
    byWater?: string[]
    byAir?: string[]
  }
  officialLinks?: Source[]
  coordinates?: { lat: number; lng: number }
  images: EntryImage[]         // 1–2 licensed, credited photos (required before approval)
  tags: string[]
  sources: Source[]
  status: ContentStatus
  lastVerified: string         // ISO date
}

export interface Story {
  id: string
  type: 'Experience' | 'Folklore I heard' | 'Travel tip'
  title: string
  body: string
  author: string
  origin?: string
  entryCategory?: CategoryKey
  entrySlug?: string
  photos?: { src: string; alt: string; credit: string }[]
  date: string                 // ISO date
  status: ContentStatus
}

const ROOT = path.join(process.cwd(), 'src', 'content')
const SHOW_DRAFTS = process.env.NEXT_PUBLIC_SHOW_DRAFTS === '1'

function readDir<T>(dir: string): T[] {
  const full = path.join(ROOT, dir)
  if (!fs.existsSync(full)) return []
  return fs
    .readdirSync(full)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(full, f), 'utf8')) as T)
}

const visible = <T extends { status: ContentStatus }>(items: T[]) =>
  items.filter(i => SHOW_DRAFTS || i.status === 'approved')

export function getEntries(category?: CategoryKey): Entry[] {
  const keys = category ? [category] : CATEGORY_KEYS
  return visible(keys.flatMap(k => readDir<Entry>(k))).sort((a, b) => a.name.localeCompare(b.name))
}

export function getEntry(category: CategoryKey, slug: string): Entry | undefined {
  return getEntries(category).find(e => e.slug === slug)
}

export function getStories(entry?: { category: CategoryKey; slug: string }): Story[] {
  const all = visible(readDir<Story>('stories')).sort((a, b) => b.date.localeCompare(a.date))
  return entry ? all.filter(s => s.entryCategory === entry.category && s.entrySlug === entry.slug) : all
}

export const SITE_URL = 'https://www.vedaheritage.co.in'
export const entryPath = (e: Pick<Entry, 'category' | 'slug'>) => `/discover/${e.category}/${e.slug}/`
