// Client-safe listing options (no fs). Keep in sync with MARKET_CATEGORIES in public/api/lib/common.php.
export const LISTING_CATEGORIES = {
  'lamps-brassware': 'Lamps & brassware',
  textiles: 'Textiles & handloom',
  'furniture-woodwork': 'Furniture & woodwork',
  'art-crafts': 'Art & crafts',
  'musical-instruments': 'Musical instruments',
  'books-prints': 'Books & prints',
  'other-traditional': 'Other traditional items',
} as const
export type ListingCategory = keyof typeof LISTING_CATEGORIES
export const LISTING_CONDITIONS = { new: 'New / handmade', used: 'Used' } as const

