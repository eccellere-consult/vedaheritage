// Navigation groups shared by Nav (client) and the home page (server).
// Keep free of fs imports: Nav is a client component. Labels mirror CATEGORIES in content.ts.
export interface NavGroup { label: string; blurb: string; items: { href: string; label: string }[] }

const d = (k: string, label: string) => ({ href: `/discover/${k}`, label })

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Places', blurb: 'Temples, beaches, backwaters and heritage towns', items: [d('temples', 'Temples'), d('places', 'Tourist Places'), d('beaches', 'Beaches'), d('backwaters', 'Backwaters')] },
  { label: 'Vedic & Wisdom', blurb: 'Mantras, astrology and life rituals', items: [d('vedic', 'Vedic Heritage & Mantras'), d('astrology', 'Astrology & Jyotisha'), d('weddings', 'Weddings & Life Rituals')] },
  { label: 'Healing & Wellness', blurb: 'Ayurveda, traditional healing, plants and medical tourism', items: [d('ayurveda', 'Ayurveda'), d('healing', 'Traditional Healing'), d('plants', 'Ayurvedic Plants'), d('cultivation', 'Cultivation & Farming'), d('medical', 'Medical & Wellness Tourism')] },
  { label: 'Food, Arts & Folk', blurb: 'Kerala food and recipes, grandmothers\' tales, music, dance and handicrafts, artisans, traditional wear and objects', items: [d('food', 'Kerala Food & Recipes'), d('muthassi', 'Muthassi Stories'), d('music', 'Music & Instruments'), d('dance', 'Dance & Performing Arts'), d('heritage', 'Heritage Items & Crafts'), d('crafts', 'Handicrafts & Craft Villages'), d('artisans', 'Artisans & Communities'), d('wear', 'Traditional Wear')] },
]

/** Trip-planning links; shown in the menu only (not on the home topic grid). */
export const NAV_PLAN: NavGroup = {
  label: 'Plan your trip', blurb: 'Districts, festivals, travel and stories',
  items: [{ href: '/kerala', label: 'Kerala & 14 districts' }, { href: '/events', label: 'Festivals & events' }, { href: '/travel', label: 'Travel planner' }, { href: '/services', label: 'Local services directory' }, { href: '/stories', label: 'Traveller stories' }],
}

export const NAV_LINKS = [
  { href: '/marketplace', label: 'Marketplace' },
]
