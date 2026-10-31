// Openverse (https://openverse.org) as a second source of openly licensed photos, used when Wikimedia Commons has none.
// Guardrails: allowed licences only, a named creator, no mature content, a relevance check against the entry's name,
// the content-safety screen, a size/shape floor, and EXIF/GPS removal before the file is saved.
import { safetyHits } from './safety.mjs'

export const API = 'https://api.openverse.org/v1/images/'
const ALLOWED = new Set(['by', 'by-sa', 'cc0', 'pdm'])           // no NC, no ND
const BAD_TITLE = /logo|map|diagram|stamp|flag|coat of arms|\bicon\b|poster|scan|painting|screenshot|\bsvg\b|\bart\b|illustration|clipart|drawing|sketch/i
const GENERIC = new Set(['temple', 'sree', 'sri', 'shri', 'kerala', 'beach', 'the', 'of', 'and', 'in', 'at', 'devi', 'swamy', 'swami', 'bhagavathy', 'mahadeva', 'church', 'mosque', 'lake', 'river', 'fort', 'palace', 'museum', 'festival', 'india', 'near', 'district'])

const plain = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = s => plain(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean)

/** True when the photo's own text (title, tags, description) clearly names the entry. */
export function relevant(entry, text) {
  const hay = ' ' + words(text).join(' ') + ' '
  const distinctive = [...new Set(words(entry.name).filter(w => w.length >= 4 && !GENERIC.has(w)))]
  if (!distinctive.length) return hay.includes(' ' + words(entry.name).join(' ') + ' ')
  const hits = distinctive.filter(w => hay.includes(w)).length
  return hits >= Math.ceil(distinctive.length / 2)
}

const licenceName = r => r.license === 'cc0' ? 'CC0 1.0' : r.license === 'pdm' ? 'Public Domain Mark 1.0'
  : `${r.license === 'by' ? 'CC BY' : 'CC BY-SA'}${r.license_version ? ` ${r.license_version}` : ''}`

/** Pure: choose photos from an Openverse `results` array for an entry. Exported for tests. */
export function pickOpenverse(results, entry, want = 2) {
  const seen = new Set(), out = []
  for (const r of results || []) {
    if (out.length >= want) break
    const text = [r.title, ...(r.tags || []).map(t => t.name), r.description].filter(Boolean).join(' ')
    const creditNeeded = !['cc0', 'pdm'].includes(r.license)
    if (r.mature || !ALLOWED.has(r.license) || !r.url || !/^https:\/\//.test(r.url) || !/^https:\/\//.test(r.foreign_landing_url || '')) continue
    if (creditNeeded && !String(r.creator || '').trim()) continue
    if (!/^(jpe?g)$/i.test(r.filetype || (r.url.match(/\.(jpe?g)(\?|$)/i) || [])[1] || '')) continue
    if (!(r.width >= 1200 && r.height >= 700 && r.width >= r.height * 1.1)) continue
    if (BAD_TITLE.test(text) || !relevant(entry, text)) continue
    if (safetyHits({ text, creator: r.creator, landing: r.foreign_landing_url }).length) continue
    if (seen.has(r.url)) continue
    seen.add(r.url)
    out.push({
      url: r.url, sourceUrl: r.foreign_landing_url, license: licenceName(r), licenseUrl: r.license_url || undefined,
      credit: (String(r.creator || '').trim() || 'Unknown (public domain)') + (r.source ? ` via ${r.source}` : ''),
      alt: String(r.title || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    })
  }
  return out
}

/** Removes EXIF, XMP, IPTC and comments (where GPS and camera data live) from a JPEG. Throws if it is not a JPEG. */
export function stripJpegMetadata(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG')
  const parts = [buf.subarray(0, 2)]
  let i = 2
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) throw new Error('corrupt JPEG')
    const m = buf[i + 1]
    if (m === 0xff) { i++; continue }
    if (m === 0xda) { parts.push(buf.subarray(i)); return Buffer.concat(parts) }   // start of scan: the picture data follows
    const len = buf.readUInt16BE(i + 2), end = i + 2 + len
    if (len < 2 || end > buf.length) throw new Error('corrupt JPEG')
    const drop = m === 0xe1 || m === 0xed || m === 0xfe || (m >= 0xe3 && m <= 0xef)   // APP1 Exif/XMP, APP13 IPTC, comments, other APPn (APP2 colour profile stays)
    if (!drop) parts.push(buf.subarray(i, end))
    i = end
  }
  throw new Error('corrupt JPEG')
}

export async function searchOpenverse(query, { fetchImpl = fetch, ua, token } = {}) {
  const u = new URL(API)
  Object.entries({ q: query, license_type: 'commercial', mature: 'false', extension: 'jpg', category: 'photograph', page_size: 25 }).forEach(([k, v]) => u.searchParams.set(k, v))
  const r = await fetchImpl(u, { headers: { 'User-Agent': ua, ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  if (!r.ok) throw new Error(`Openverse API ${r.status}`)
  return (await r.json()).results || []
}

/** Optional: OPENVERSE_CLIENT_ID and OPENVERSE_CLIENT_SECRET raise the rate limit. Without them the anonymous limit applies. */
export async function openverseToken(env = process.env, fetchImpl = fetch) {
  if (!env.OPENVERSE_CLIENT_ID || !env.OPENVERSE_CLIENT_SECRET) return null
  const r = await fetchImpl('https://api.openverse.org/v1/auth_tokens/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.OPENVERSE_CLIENT_ID, client_secret: env.OPENVERSE_CLIENT_SECRET }) })
  return r.ok ? (await r.json()).access_token || null : null
}
