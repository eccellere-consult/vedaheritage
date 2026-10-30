import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════════
// MARKETPLACE — moderated classifieds. Public listing JSON lives in
// src/content/listings/<id>.json and never contains seller contact
// details (those stay private on the server). Keep the category keys
// in sync with MARKET_CATEGORIES in public/api/lib/common.php.
// ═══════════════════════════════════════════════════════════════════

import { LISTING_CATEGORIES, LISTING_CONDITIONS, type ListingCategory } from './listing-options'
export { LISTING_CATEGORIES, LISTING_CONDITIONS }
export type { ListingCategory }

export interface Listing {
  id: string
  title: string
  category: ListingCategory
  condition: keyof typeof LISTING_CONDITIONS
  priceInr: number
  description: string
  district: string
  sellerFirstName: string
  photos: { src: string; alt: string }[]
  listedOn: string
  expiresOn: string
  status: 'approved' | 'sold' | 'removed'
}

const DIR = path.join(process.cwd(), 'src', 'content', 'listings')

/** Approved and sold listings that have not expired (checked at build time). */
export function getListings(): Listing[] {
  if (!fs.existsSync(DIR)) return []
  const today = new Date().toISOString().slice(0, 10)
  return fs.readdirSync(DIR).filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Listing)
    .filter(l => (l.status === 'approved' || l.status === 'sold') && l.expiresOn >= today)
    .sort((a, b) => b.listedOn.localeCompare(a.listedOn))
}

export const getListing = (id: string) => getListings().find(l => l.id === id)
export const rupees = (n: number) => '₹' + n.toLocaleString('en-IN')
export const listingPath = (id: string) => `/marketplace/${id}/`
