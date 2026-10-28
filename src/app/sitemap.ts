import type { MetadataRoute } from 'next'
import { CATEGORY_KEYS, SITE_URL, entryPath, getDistricts, getEntries } from '@/lib/content'

export const dynamic = 'force-static'

const STATIC = ['/', '/stay/', '/ayurveda/', '/gallery/', '/blog/', '/events/', '/location/', '/contact/', '/discover/', '/stories/', '/travel/', '/kerala/']

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC.map(p => ({ url: `${SITE_URL}${p}`, changeFrequency: 'weekly' as const, priority: p === '/' ? 1 : 0.7 })),
    ...CATEGORY_KEYS.map(k => ({ url: `${SITE_URL}/discover/${k}/`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...getDistricts().map(d => ({ url: `${SITE_URL}/kerala/${d.slug}/`, lastModified: d.lastVerified, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...getEntries().map(e => ({ url: `${SITE_URL}${entryPath(e)}`, lastModified: e.lastVerified, changeFrequency: 'monthly' as const, priority: 0.9 })),
  ]
}
