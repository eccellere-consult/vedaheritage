# Veda Heritage — Site Plan

_Status: working draft, updated 2026-10-28. Business-plan inputs pending (see section 10)._

## 1. Purpose and positioning
Make vedaheritage.co.in **the go-to site for Kerala's cultural heritage** for tourists and citizens, anchored by the Veda Heritage stay in Vavvakkavu, Kollam
(5 km from Amritapuri). Content builds trust and traffic; the stay and partner experiences convert it.

## 2. Audiences
| Audience | Needs | Key pages |
|---|---|---|
| International and domestic tourists | Where to go, when, how to get there, what is respectful | Discover, Kerala at a glance, Travel planner |
| Spiritual and Ayurveda seekers | Temples, rituals, seasons, authentic therapies | Temples, Ayurveda, Karkidakam |
| Citizens and diaspora | History, folklore, festivals, heritage objects, where to buy traditional | Heritage items, districts, stories |
| Stay guests | Booking, location, experiences nearby | Stay, Location, Contact |

## 3. Information architecture
`/` · `/stay` (one page: house, garden, photos, location, booking) · `/blog` · `/events` ·
`/discover` (6 categories) · `/discover/<category>/<slug>` · `/kerala` · `/kerala/<district>` · `/travel` · `/stories`

## 4. Content model (see `src/lib/content.ts`)
Entry = history and significance, folklore, spiritual or cultural meaning, highlights, visitor info and etiquette, travel (train, KSRTC, water, air), official links,
images (1–2, licensed, credited), sources. **Heritage items** add where to see, where to buy (co-operatives, emporiums, workshops), experience centres and heritage homes, buying tips.
**Districts** add brief history, what is unique, best time to visit, what to look for, festivals, crafts. **Stories**: moderated visitor notes and photos.

## 5. Content operations and governance
Agents (Scout → Enricher → Verifier) draft; a human approves twice a week (Mon and Thu). Safeguards: retrieved-sources-only, verifier can only tighten, schema validation, spend cap.
Folklore labelled as tradition; religious sensitivity review; images only with licence and credit; link check weekly.

## 6. Design standards
Eccellere family palette: green primary, teal accent, navy ink. One token file, one `PageHero`, shared button and card styles. Accessible contrast, focus states, mobile-first.

## 7. Technology and deployment
Next.js static export · Tailwind · GitHub Actions build → `deploy` branch → Hostinger hPanel Git (auto via webhook) with a post-deploy check · PHP story intake · optional AI providers (Anthropic default; OpenAI, xAI supported).

## 8. Roadmap
| Phase | Status | Scope |
|---|---|---|
| 0 Foundation | Done (PR #1) | Schema, templates, SEO, stories, travel planner, images workflow |
| 1 Seed and agents | Built; first live run pending | Scout, Enricher, Verifier; 10 seed entries verified and approved |
| 2 Heritage and districts | Drafted | Heritage items, Kerala history, 14 districts, design system |
| 3 Reach | Next | Malayalam, newsletter and WhatsApp alerts, itinerary builder, freshness sweeper |
| 4 Differentiate | Later | Verified-data chat guide, partnerships with craft co-operatives, experience centres, heritage homes |

## 9. KPIs (proposed; align to the business plan)
Organic search sessions and impressions · entries approved per month · % entries re-verified within 90 days · stay enquiries from Discover pages ·
story submissions approved · newsletter sign-ups · cost per approved entry.

## 10. Business plan inputs (pending — to be completed when the plan is reshared)
| Item | From business plan |
|---|---|
| Revenue model (stay, experiences, affiliate, sponsorship, products) | _pending_ |
| Targets and timeline (12–36 months) | _pending_ |
| Budget and funding | _pending_ |
| Partners (craft co-operatives, DTPC, temples, homestays) | _pending_ |
| Brand and tone guidance | _pending_ |
| Priority districts and segments | _pending_ |

## 11. Risks
Factual or cultural error (verifier + human gate) · stale information (freshness checks) · image rights (licence rule) · AI cost (budget cap) ·
spam or abuse in stories (moderation) · over-reliance on one hosting path (post-deploy check).

## 12. Open decisions
Exact eccare.in colour values · Malayalam launch timing · monetisation rules and labelling · who approves content and for how many hours per week.

## Phase 2: Vedic and traditional knowledge, community and marketplace

**Answer first:** the knowledge layer ships first (low risk); discussion and the marketplace follow in stages because they carry moderation, legal and payment risk.

### 1. Knowledge layer (built)
Nine new categories sit beside the original six: `vedic` (Vedic heritage and mantras), `healing` (traditional healing), `plants` (Ayurvedic plants), `cultivation`, `music`, `dance`, `astrology`, `weddings`, `medical` (medical and wellness tourism). They are statewide topics: `travel` and the `heritage` place block are optional. Sensitive categories (vedic, healing, plants, astrology, weddings) show a "Please note" box on every page. The same Scout, Enricher, Verifier and human-approval flow applies.

### 2. Discussion (next)
Moderated comments per entry, reusing the story intake (GitHub issue, human approval). No accounts. Rules: no medical advice, no personal data, no predictions presented as fact.

### 3. Marketplace (built: moderated classifieds)
Sellers submit, the owner approves, buyers enquire, the owner introduces them, and the sale happens between them. No payments, stock or shipping on the site. Seller and buyer contact details stay private on the server; only the sanitised listing and photos reach the public repo. See `docs/MARKETPLACE.md`, including the **pre-launch legal checklist** (marketplace and intermediary rules, data protection, restricted items, tax).
- Alternative kept alongside: curated "where to buy" lists (`heritage.whereToBuy`) linking to co-operatives and emporiums.

### 4. Out of scope for now
Matrimonial matching or profiles (sensitive personal data, separate legal review) and paid astrology consultations.
