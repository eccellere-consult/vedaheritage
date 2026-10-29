import fs from 'fs'
import path from 'path'

export const ROOT = process.cwd()
export const CATEGORIES = ['temples', 'places', 'beaches', 'backwaters', 'heritage', 'ayurveda', 'vedic', 'healing', 'plants', 'cultivation', 'music', 'dance', 'astrology', 'weddings']
export const today = () => new Date().toISOString().slice(0, 10)

export const slugify = s =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

export const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback)
export const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
}
export const readText = p => fs.readFileSync(p, 'utf8')
export const prompt = name => readText(path.join(ROOT, 'agents', 'prompts', `${name}.md`))

export function existingEntries() {
  const out = []
  for (const cat of CATEGORIES) {
    const dir = path.join(ROOT, 'src', 'content', cat)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
      const e = readJson(path.join(dir, f))
      out.push({ ...e, _file: path.join(dir, f) })
    }
  }
  return out
}

export const entryFile = (cat, slug) => path.join(ROOT, 'src', 'content', cat, `${slug}.json`)
export const evidenceFile = slug => path.join(ROOT, 'agents', 'evidence', `${slug}.json`)
export const QUEUE = path.join(ROOT, 'agents', 'queue', 'candidates.json')

export function log(...a) { console.log(...a) }

// Normalise for fuzzy duplicate detection: "Sree Padmanabhaswamy Temple" ~ "Padmanabhaswamy Temple"
export const normName = s => slugify(s).replace(/-?(sree|sri|shri|temple|beach|lake|the)-?/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
