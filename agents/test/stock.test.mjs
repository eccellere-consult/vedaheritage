// Offline tests for the free stock-photo sources (Pexels, Pixabay, Unsplash) and their guardrails.
import assert from 'assert/strict'
import { pickStock, searchStock, stockProviders } from '../lib/stock.mjs'

const entry = { name: 'Varkala Beach', district: 'Thiruvananthapuram' }
const px = (x = {}) => ({ photos: [{ width: 4000, height: 2600, alt: 'Cliff and sea at Varkala Beach in Kerala', photographer: 'Meera N', url: 'https://www.pexels.com/photo/1/', src: { large2x: 'https://images.pexels.com/1.jpeg' }, ...x }] })
assert.deepEqual(pickStock('pexels', px(), entry).map(p => [p.license, p.credit]), [['Pexels License', 'Meera N via Pexels']])
const pb = { hits: [{ imageWidth: 3000, imageHeight: 2000, tags: 'varkala, beach, kerala', user: 'ravi', pageURL: 'https://pixabay.com/photos/1/', largeImageURL: 'https://pixabay.com/get/1.jpg' }] }
assert.equal(pickStock('pixabay', pb, entry)[0].credit, 'ravi via Pixabay')
const us = { results: [{ width: 5000, height: 3000, alt_description: 'Varkala Beach cliff', description: null, user: { name: 'Dev P' }, links: { html: 'https://unsplash.com/photos/1', download_location: 'https://api.unsplash.com/photos/1/download' }, urls: { raw: 'https://images.unsplash.com/photo-1?ixid=x' }, tags: [] }] }
const u = pickStock('unsplash', us, entry)[0]; assert.ok(u.url.includes('w=1600') && u.download && u.license === 'Unsplash License')

for (const [why, bad] of Object.entries({
  'wrong place': px({ alt: 'Alpine lake at sunrise' }), 'too small': px({ width: 800, height: 500 }), 'portrait': px({ width: 1500, height: 3000 }),
  'an illustration': px({ alt: 'Varkala Beach illustration vector' }), 'unsafe text': px({ alt: 'Varkala Beach escort service' }),
  'not https': px({ src: { large2x: 'http://x.example/a.jpg' } }), 'page not https': px({ url: 'http://x.example/p' }),
})) assert.equal(pickStock('pexels', bad, entry).length, 0, `rejects: ${why}`)
assert.equal(pickStock('pexels', { photos: [...px().photos, ...px().photos] }, entry).length, 1, 'duplicates are dropped')

assert.deepEqual(stockProviders({}), [], 'no keys, no calls')
assert.deepEqual(stockProviders({ PEXELS_API_KEY: 'x', UNSPLASH_ACCESS_KEY: 'y' }), ['pexels', 'unsplash'])
let seen; await searchStock('pexels', 'Varkala Beach Kerala', { env: { PEXELS_API_KEY: 'k' }, fetchImpl: async (url, o) => { seen = [String(url), o.headers.Authorization]; return { ok: true, json: async () => ({}) } } })
assert.ok(seen[0].startsWith('https://api.pexels.com/v1/search?query=Varkala%20Beach%20Kerala') && seen[1] === 'k')
await assert.rejects(searchStock('pixabay', 'x', { env: { PIXABAY_API_KEY: 'k' }, fetchImpl: async () => ({ ok: false, status: 429 }) }), /429/)
console.log('✔ stock photo guardrails passed')
