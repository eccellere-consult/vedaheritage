// Free stock-photo marketplaces as a third photo source (after Wikimedia Commons and Openverse): Pexels, Pixabay, Unsplash.
// Each needs a free API key (PEXELS_API_KEY, PIXABAY_API_KEY, UNSPLASH_ACCESS_KEY); a provider without a key is skipped.
// Their licences allow free use with no payment; credit is recorded anyway. Google Images is NOT used: its results carry no licence.
// Guardrails match Openverse: relevance to the entry's name, size/shape floor, JPEG only, content-safety screen, metadata stripped.
import { safetyHits } from './safety.mjs'
import { relevant } from './openverse.mjs'

const BAD = /logo|\bmap\b|diagram|stamp|flag|coat of arms|\bicon\b|poster|screenshot|illustration|clipart|drawing|sketch|3d render|vector|\bai generated\b|mockup|template|nude|naked|model posing|bikini/i

const clean = s => String(s || '').replace(/\s+/g, ' ').trim()
const okShape = (w, h) => w >= 1200 && h >= 700 && w >= h * 1.1

/** Pure: turn one provider's search response into candidate photos for an entry. Exported for tests. */
export function pickStock(provider, json, entry, want = 2) {
  const out = [], seen = new Set()
  const add = c => {
    if (out.length >= want || !c.url || !/^https:\/\//.test(c.url) || !/^https:\/\//.test(c.sourceUrl || '') || seen.has(c.url)) return
    if (!okShape(c.width, c.height)) return
    const text = `${c.alt} ${c.tags || ''}`
    if (BAD.test(text) || !relevant(entry, text)) return
    if (safetyHits({ text, user: c.user, page: c.sourceUrl }).length) return
    seen.add(c.url)
    out.push({ url: c.url, sourceUrl: c.sourceUrl, license: c.license, licenseUrl: c.licenseUrl, credit: c.credit, alt: clean(c.alt || c.tags).slice(0, 160), download: c.download })
  }
  if (provider === 'pexels') for (const p of json?.photos || []) add({ url: p.src?.large2x || p.src?.large, width: p.width, height: p.height, alt: p.alt, user: p.photographer, sourceUrl: p.url, license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/', credit: `${clean(p.photographer) || 'Unknown'} via Pexels` })
  if (provider === 'pixabay') for (const p of json?.hits || []) add({ url: p.largeImageURL, width: p.imageWidth, height: p.imageHeight, alt: '', tags: p.tags, user: p.user, sourceUrl: p.pageURL, license: 'Pixabay Content License', licenseUrl: 'https://pixabay.com/service/license-summary/', credit: `${clean(p.user) || 'Unknown'} via Pixabay` })
  if (provider === 'unsplash') for (const p of json?.results || []) add({ url: p.urls?.raw ? `${p.urls.raw}${p.urls.raw.includes('?') ? '&' : '?'}w=1600&q=80&fm=jpg` : null, width: p.width, height: p.height, alt: p.alt_description || p.description, tags: (p.tags || []).map(t => t.title).join(' '), user: p.user?.name, sourceUrl: p.links?.html, license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', credit: `${clean(p.user?.name) || 'Unknown'} via Unsplash`, download: p.links?.download_location })
  return out
}

export const stockProviders = (env = process.env) => [
  env.PEXELS_API_KEY && 'pexels', env.PIXABAY_API_KEY && 'pixabay', env.UNSPLASH_ACCESS_KEY && 'unsplash',
].filter(Boolean)

export async function searchStock(provider, query, { env = process.env, fetchImpl = fetch, ua } = {}) {
  const q = encodeURIComponent(query)
  const url = {
    pexels: `https://api.pexels.com/v1/search?query=${q}&per_page=20&orientation=landscape`,
    pixabay: `https://pixabay.com/api/?key=${encodeURIComponent(env.PIXABAY_API_KEY || '')}&q=${q}&image_type=photo&orientation=horizontal&safesearch=true&min_width=1200&per_page=20`,
    unsplash: `https://api.unsplash.com/search/photos?query=${q}&orientation=landscape&per_page=20&content_filter=high`,
  }[provider]
  const headers = { 'User-Agent': ua || 'VedaHeritageContentBot/1.0', ...(provider === 'pexels' ? { Authorization: env.PEXELS_API_KEY } : {}), ...(provider === 'unsplash' ? { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` } : {}) }
  const r = await fetchImpl(url, { headers })
  if (!r.ok) throw new Error(`${provider} API ${r.status}`)
  return r.json()
}

/** Unsplash asks API users to ping the download location when a photo is used. Best effort. */
export async function reportUnsplashUse(pick, { env = process.env, fetchImpl = fetch } = {}) {
  if (!pick.download || !env.UNSPLASH_ACCESS_KEY) return
  try { await fetchImpl(pick.download, { headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` } }) } catch { /* not fatal */ }
}
