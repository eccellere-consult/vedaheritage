// Content-safety guard for anything that can go live without a human approving it first.
// Deliberately blunt: a match never deletes anything, it only keeps the item as a draft for a person to read.
// Covers adult/sexual content, child exploitation, and clearly illegal or harmful material.
const TERMS = [
  // adult / sexual
  'porn', 'pornograph', 'xxx', 'nude', 'nudity', 'naked', 'erotic', 'sexually explicit', 'sex tourism', 'sex worker', 'escort service', 'escorts', 'call girl', 'brothel', 'prostitut', 'strip club', 'striptease', 'adult entertainment', 'hookup', 'fetish', 'nsfw', 'onlyfans', 'sexual services',
  // child exploitation
  'child abuse', 'child sexual', 'csam', 'paedophil', 'pedophil', 'child porn', 'underage sex', 'minor sex', 'child marriage tourism', 'child trafficking', 'child labour tourism',
  // illegal / harmful
  'human trafficking', 'sex trafficking', 'drug dealer', 'buy drugs', 'buy cocaine', 'buy heroin', 'buy cannabis', 'buy weed', 'where to buy ganja', 'illegal drugs', 'smuggl', 'bomb making', 'make a bomb', 'buy weapons', 'illegal weapons', 'terrorist recruit', 'hate speech', 'illegal betting', 'black market', 'forged documents', 'fake passport', 'money laundering',
]
const RE = new RegExp(`(?<![a-z])(${TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i')
const BAD_HOST = /(porn|xxx|sex|escort|nude|adult|erotic|onlyfans|camgirl|hookup)/i
const BAD_TLD = /\.(xxx|adult|porn|sex|sexy)$/i

const strings = (v, out = []) => {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach(x => strings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out))
  return out
}

/** @returns {string[]} short descriptions of everything that matched (empty = clean) */
export function safetyHits(value) {
  const hits = []
  for (const s of strings(value)) {
    if (/^https?:\/\//i.test(s)) {
      try { const h = new URL(s).hostname; if (BAD_TLD.test(h) || BAD_HOST.test(h)) hits.push(`link to ${h}`) } catch { /* not a URL */ }
      continue
    }
    const m = RE.exec(s)
    if (m) hits.push(`"${m[1].toLowerCase()}" in "${s.replace(/\s+/g, ' ').slice(0, 60)}"`)
  }
  return [...new Set(hits)].slice(0, 5)
}
