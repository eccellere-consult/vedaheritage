// Client-safe directory options (no fs). Keep in sync with PROVIDER_TYPES / DISTRICTS in public/api/lib/common.php.
export const PROVIDER_TYPES = {
  guide: 'Guides & local experts',
  transport: 'Taxi, auto & transport',
  stay: 'Stays & homestays',
  wellness: 'Ayurveda & wellness centres',
  crafts: 'Crafts & shops',
  food: 'Restaurants & food',
  learning: 'Music, dance & Vedic classes',
  'travel-desk': 'Tour operators & travel desks',
} as const
export type ProviderType = keyof typeof PROVIDER_TYPES

/** Types that need a registration or licence, and types that may not be advertised. */
export const NEEDS_CREDENTIAL: ProviderType[] = ['guide', 'stay', 'wellness', 'travel-desk']
export const NOT_SPONSORABLE: ProviderType[] = ['wellness']

export const DISTRICT_NAMES = ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'] as const

export const REPORT_REASONS = { 'wrong-contact': 'Wrong or outdated contact details', closed: 'Business has closed', 'misleading-ad': 'Misleading advert or claim', overcharging: 'Overcharging', unsafe: 'Safety concern', other: 'Something else' } as const
