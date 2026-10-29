// Finds up to 2 openly licensed photos per entry on Wikimedia Commons, downloads
// them to public/images/discover/ and records credit + licence in the entry JSON.
// Output is a CANDIDATE set: the entry stays "draft" and a human approves the
// images (right place? authentic? good quality?) in the pull request.
//
// Usage: node scripts/fetch-commons-images.mjs [--only <slug>] [--force]
// Needs network access to commons.wikimedia.org / upload.wikimedia.org.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const UA = 'VedaHeritageContentBot/1.0 (https://www.vedaheritage.co.in; stay@vedaheritage.co.in)'
const API = 'https://commons.wikimedia.org/w/api.php'
const OK_LICENCE = /^(CC0|CC[ -]BY(?![ -](NC|ND))|CC[ -]BY[ -]SA|Public domain|PD)/i
const BAD_TITLE = /logo|map|diagram|stamp|flag|coat of arms|\bicon\b|poster|scan|painting|screenshot|\bsvg\b/i
const strip = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

// Pure: choose images from a Commons API `pages` object. Exported for tests.
export function pickImages(pages, want = 2) {
  const cands = Object.values(pages || {})
    .filter(p => p.imageinfo?.[0])
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map(p => {
      const ii = p.imageinfo[0]
      const m = ii.extmetadata || {}
      return {
        title: p.title,
        width: ii.width, height: ii.height, mime: ii.mime,
        url: ii.thumburl || ii.url,
        sourceUrl: ii.descriptionurl,
        license: strip(m.LicenseShortName?.value),
        licenseUrl: m.LicenseUrl?.value,
        credit: strip(m.Artist?.value) || strip(m.Credit?.value),
        alt: strip(m.ImageDescription?.value).slice(0, 160),
      }
    })
    .filter(c => c.mime === 'image/jpeg' && c.width >= 1200 && c.height >= 700 && c.width >= c.height * 1.1)
    .filter(c => OK_LICENCE.test(c.license) && c.credit && !BAD_TITLE.test(c.title))
  return cands.slice(0, want)
}

async function search(query) {
  const u = new URL(API)
  Object.entries({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: 6, gsrlimit: 25,
    gsrsearch: `${query} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: 1600,
  }).forEach(([k, v]) => u.searchParams.set(k, v))
  const r = await fetch(u, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`Commons API ${r.status}`)
  return (await r.json()).query?.pages || {}
}

async function main() {
  const args = process.argv.slice(2)
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
  const force = args.includes('--force')
  const root = path.join(process.cwd(), 'src', 'content')
  const outDir = path.join(process.cwd(), 'public', 'images', 'discover')
  fs.mkdirSync(outDir, { recursive: true })
  let changed = 0
  for (const cat of ['temples', 'places', 'beaches', 'backwaters', 'ayurveda', 'heritage', 'vedic', 'healing', 'plants', 'cultivation', 'music', 'dance', 'astrology', 'weddings']) {
    const dir = path.join(root, cat)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
      const file = path.join(dir, f)
      const e = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (only && e.slug !== only) continue
      if (!force && (e.images || []).length >= 2) continue
      const query = e.district && e.district !== 'Statewide' ? `${e.name} ${e.district}` : `${e.name} Kerala`
      const picks = pickImages(await search(query), 2 - (force ? 0 : (e.images || []).length))
      if (!picks.length) { console.log(`– ${e.slug}: no suitable licensed image found`); continue }
      const images = force ? [] : [...(e.images || [])]
      for (const c of picks) {
        const n = images.length + 1
        const dest = `/images/discover/${e.slug}-${n}.jpg`
        const res = await fetch(c.url, { headers: { 'User-Agent': UA } })
        if (!res.ok) { console.log(`  ! download failed ${c.url}`); continue }
        fs.writeFileSync(path.join(process.cwd(), 'public', dest), Buffer.from(await res.arrayBuffer()))
        images.push({ src: dest, alt: c.alt || `${e.name}, ${e.district}, Kerala`, credit: c.credit, license: c.license, ...(c.licenseUrl ? { licenseUrl: c.licenseUrl } : {}), sourceUrl: c.sourceUrl })
      }
      e.images = images
      fs.writeFileSync(file, JSON.stringify(e, null, 2) + '\n')
      console.log(`✔ ${e.slug}: ${images.length} image(s)`)
      changed++
    }
  }
  console.log(`done, ${changed} entr${changed === 1 ? 'y' : 'ies'} updated`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(err => { console.error(err); process.exit(1) })
