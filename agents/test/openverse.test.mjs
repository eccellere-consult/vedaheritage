// Offline tests for the Openverse photo guardrails.
import assert from 'assert/strict'
import { pickOpenverse, relevant, searchOpenverse, stripJpegMetadata } from '../lib/openverse.mjs'

const entry = { name: 'Aranmula Parthasarathy Temple', district: 'Pathanamthitta' }
const r = (extra = {}) => ({
  url: 'https://live.staticflickr.com/1/a.jpg', foreign_landing_url: 'https://www.flickr.com/photos/x/1', title: 'Aranmula Parthasarathy Temple at dawn',
  creator: 'Asha K', license: 'by', license_version: '4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/', source: 'flickr',
  filetype: 'jpg', width: 3000, height: 2000, mature: false, tags: [{ name: 'aranmula' }, { name: 'kerala' }], ...extra,
})

assert.equal(pickOpenverse([r()], entry).length, 1, 'a good, relevant, licensed photo is accepted')
const good = pickOpenverse([r()], entry)[0]
assert.deepEqual([good.license, good.credit, good.sourceUrl], ['CC BY 4.0', 'Asha K via flickr', 'https://www.flickr.com/photos/x/1'])
assert.equal(pickOpenverse([r({ license: 'cc0', creator: null })], entry)[0].license, 'CC0 1.0', 'CC0 needs no named creator')

// every guardrail on its own
for (const [why, bad] of Object.entries({
  'non-commercial licence': r({ license: 'by-nc' }), 'no-derivatives licence': r({ license: 'by-nd' }), 'mature flag': r({ mature: true }),
  'creator missing on a BY photo': r({ creator: '' }), 'not https': r({ url: 'http://x.example/a.jpg' }), 'not a jpeg': r({ filetype: 'png', url: 'https://x.example/a.png' }),
  'too small': r({ width: 800, height: 600 }), 'unknown size': r({ width: null, height: null }), 'portrait': r({ width: 1500, height: 2400 }),
  'a painting': r({ title: 'Aranmula Parthasarathy Temple painting' }), 'about something else': r({ title: 'Sunset over a beach', tags: [{ name: 'sea' }] }),
  'unsafe text': r({ title: 'Aranmula Parthasarathy Temple escort service' }), 'adult-site landing page': r({ foreign_landing_url: 'https://hot-porn.example/p/1' }),
})) assert.equal(pickOpenverse([bad], entry).length, 0, `rejects: ${why}`)

assert.equal(pickOpenverse([r(), r()], entry).length, 1, 'duplicates are dropped')
assert.equal(pickOpenverse([r({ url: 'https://a.example/1.jpg' }), r({ url: 'https://a.example/2.jpg' }), r({ url: 'https://a.example/3.jpg' })], entry, 2).length, 2, 'never more than asked for')

// relevance
assert.ok(relevant({ name: 'Varkala Beach' }, 'Papanasam coast at Varkala'), 'the distinctive word is enough')
assert.ok(!relevant({ name: 'Varkala Beach' }, 'Kovalam beach at sunset'), 'a different place is refused')
assert.ok(relevant({ name: 'Sree Padmanabhaswamy Temple' }, 'Padmanabhaswamy temple gopuram'))
assert.ok(!relevant({ name: 'Kerala Temple' }, 'a temple in Tamil Nadu'), 'generic words alone never match')

// metadata is removed from the picture file (GPS lives in APP1/Exif)
const seg = (m, body) => Buffer.concat([Buffer.from([0xff, m, (body.length + 2) >> 8, (body.length + 2) & 255]), body])
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')), seg(0xe1, Buffer.from('Exif\0\0GPSLatitude=9.3')), seg(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>')), seg(0xed, Buffer.from('Photoshop 3.0\0IPTC')), seg(0xfe, Buffer.from('shot by someone')), seg(0xdb, Buffer.alloc(65, 1)), Buffer.from([0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0x12, 0x34, 0xff, 0xd9])])
const clean = stripJpegMetadata(jpg)
assert.ok(!clean.includes('GPSLatitude') && !clean.includes('xmpmeta') && !clean.includes('IPTC') && !clean.includes('shot by'), 'EXIF, XMP, IPTC and comments are gone')
assert.ok(clean.includes('JFIF') && clean.subarray(-2).equals(Buffer.from([0xff, 0xd9])) && clean.includes(Buffer.from([0x12, 0x34])), 'the picture itself is untouched')
assert.throws(() => stripJpegMetadata(Buffer.from('not a jpeg at all')), /not a JPEG/)
assert.throws(() => stripJpegMetadata(jpg.subarray(0, 30)), /corrupt/)

// the search asks Openverse only for commercial-use, non-mature photographs
let asked
await searchOpenverse('Aranmula Kerala', { ua: 'ua', fetchImpl: async u => { asked = new URL(u); return { ok: true, json: async () => ({ results: [r()] }) } } })
assert.deepEqual([asked.searchParams.get('license_type'), asked.searchParams.get('mature'), asked.searchParams.get('category')], ['commercial', 'false', 'photograph'])
await assert.rejects(searchOpenverse('x', { fetchImpl: async () => ({ ok: false, status: 429 }) }), /429/)
console.log('✔ openverse guardrails passed')
