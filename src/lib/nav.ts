// Navigation groups shared by Nav (client) and the home page (server).
// Keep free of fs imports: Nav is a client component. Labels mirror CATEGORIES in content.ts.
export interface NavGroup { label: string; blurb: string; items: { href: string; label: string }[] }

const d = (k: string, label: string) => ({ href: `/discover/${k}`, label })

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Places', blurb: 'Temples, beaches, backwaters and heritage towns', items: [d('temples', 'Temples'), d('places', 'Tourist Places'), d('beaches', 'Beaches'), d('backwaters', 'Backwaters')] },
  { label: 'Vedic & Wisdom', blurb: 'Mantras, astrology and life rituals', items: [d('vedic', 'Vedic Heritage & Mantras'), d('astrology', 'Astrology & Jyotisha'), d('weddings', 'Weddings & Life Rituals')] },
  { label: 'Healing & Wellness', blurb: 'Ayurveda, traditional healing, plants and medical tourism', items: [d('ayurveda', 'Ayurveda'), d('healing', 'Traditional Healing'), d('plants', 'Ayurvedic Plants'), d('cultivation', 'Cultivation & Farming'), d('medical', 'Medical & Wellness Tourism')] },
  { label: 'Arts & Crafts', blurb: 'Music, dance and traditional objects', items: [d('music', 'Music & Instruments'), d('dance', 'Dance & Performing Arts'), d('heritage', 'Heritage Items & Crafts')] },
]

export const NAV_LINKS = [
  { href: '/kerala', label: 'Districts' },
  { href: '/events', label: 'Festivals' },
  { href: '/stories', label: 'Stories' },
  { href: '/travel', label: 'Travel' },
]
