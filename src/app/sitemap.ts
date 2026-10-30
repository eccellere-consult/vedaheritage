import type { MetadataRoute } from 'next'
import { getListings, listingPath } from '@/lib/listings'
import { CATEGORY_KEYS, SITE_URL, entryPath, getDistricts, getEntries } from '@/lib/content'

export const dynamic = 'force-static'

const STATIC = ['/', '/stay/', '/blog/', '/events/', '/discover/', '/stories/', '/marketplace/', '/marketplace/sell/', '/marketplace/rules/', '/services/', '/services/join/', '/services/standards/', '/travel/', '/kerala/']

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC.map(p => ({ url: `${SITE_URL}${p}`, changeFrequency: 'weekly' as const, priority: p === '/' ? 1 : 0.7 })),
    ...CATEGORY_KEYS.map(k => ({ url: `${SITE_URL}/discover/${k}/`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...getDistricts().map(d => ({ url: `${SITE_URL}/kerala/${d.slug}/`, lastModified: d.lastVerified, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...getListings().filter(l => l.status === 'approved').map(l => ({ url: `${SITE_URL}${listingPath(l.id)}`, lastModified: l.listedOn, changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...getEntries().map(e => ({ url: `${SITE_URL}${entryPath(e)}`, lastModified: e.lastVerified, changeFrequency: 'monthly' as const, priority: 0.9 })),
  ]
}
