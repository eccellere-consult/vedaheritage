# Contacts and services directory: operating model

## The answer
Run **three tiers of contact**, each with its own source of truth and its own controls, and fund the moderation with a **small, capped, clearly labelled advertising tier** that can never change the free ranking.

| Tier | What | Who supplies it | Cost to list | Where it shows | Control |
|---|---|---|---|---|---|
| 1. Official contacts | Temple administration, tourism and transport enquiry desks, emergency and hospital numbers for a place | Agents, only from official pages they actually retrieved | Free, never paid | First on every place page | Source URL + date on every contact; verifier and human approve; build fails without a source |
| 2. Verified local services | Guides, stays, taxis and transport, craft shops, restaurants, music/dance/Vedic classes, tour operators, wellness centres | The business applies | Free | After official contacts, alphabetical | Email link, phone call-back, website check, registration check where required, 12-month expiry |
| 3. Sponsored | Text-only placements by verified providers | Provider asks; owner approves | Paid, offline (invoice) | Last block, labelled "Sponsored" | Max 2 per page, max 3 per district per type, max 90 days, honest wording, not for health services |

**Why this is the optimal shape.** The value of a contact is its accuracy, and contacts decay (numbers change, shops close). So the product is *verification and freshness*, not a long list. Official data gives credibility at zero acquisition cost. Free verified listings build supply. A scarce, labelled sponsored tier monetises demand without selling the order of the free list, so visitors keep trusting the page.

## How a provider moves through the system
1. **Apply** (`/services/join/`): public details limited to what visitors need; private details (contact person, registration number) are stored privately.
2. **Automatic checks**: field formats, https website that responds, no link shorteners, no duplicate email, phone or website, risky wording flagged (rankings, price promises, health or occult claims).
3. **Email control**: a one-time link to the business email (7 days).
4. **Human verification** (Admin → Directory): you call the business, and for guides, stays, tour operators and wellness centres you check the registration against the official register. The page records what you ticked; it will not publish without it.
5. **Publish**: public listing JSON (no private data) committed to `main`; **verification lasts 12 months**, after which the listing hides itself until re-verified.
6. **Sponsor (optional)**: the admin refuses wording or dates outside the rules and refuses a slot that is full.
7. **Ongoing**: "Report a problem" on every listing; suspend or remove at any time; weekly rebuild so expired listings and adverts drop off and sponsors rotate.

## Validation matrix
| Field | Rule | Checked by |
|---|---|---|
| Business email | Must be opened from a one-time link; domain compared with the website | Email link, admin queue |
| Business phone | Normalised format; called by you before publishing | Form, admin ticks "I called" |
| Website | https only, responds, no shorteners, flags a redirect to another domain | Form, live check in admin |
| Registration or licence | Required for guide, stay, travel desk, wellness; type shown, number kept private | Admin ticks "checked against the register" |
| Duplicates | Same email, phone or website refused | Form and admin queue |
| Wording | No links, rankings, price guarantees, health or occult claims | Form, admin flags, build validator |
| Official contacts | https source URL actually retrieved; dated; at least a phone, email or website | Agent gate, build validator |
| Private data | Never in the public repo | Build validator |

## Advertising rules (what "regulated" means in practice)
- **Capacity:** 14 districts x 7 sponsorable types x 3 slots = **294 concurrent slots at most**; a visitor never sees more than **2** on a page. Scarcity protects value and trust.
- **Eligibility:** live, in-date verified providers only; wellness centres are **excluded** (health advertising is regulated).
- **Format:** headline (60 characters) and one line (140). No images, banners, pop-ups or links in the text; the listed website is used.
- **Disclosure:** "Sponsored" label; sponsored links carry `rel="sponsored nofollow"`.
- **Fairness:** organic order is alphabetical; sponsors rotate weekly when slots are full.
- **Term:** up to 90 days, never beyond the verification date. Ending, suspending or removing a provider ends its advert.
- **Enforcement:** admin API refuses violations; `npm run validate` fails the build on any violation, so a hand edit cannot bypass the rules.

## Commercial model (you set the numbers)
- Free basic listing for every verified provider (supply and freshness).
- Sponsored slot sold per **district + type + period** (for example 30 or 90 days). Price is yours to set after you test willingness to pay; nothing in the system hard-codes a price.
- Invoice and collect offline (bank transfer or UPI), consistent with the "no payments on the site" stance. Charge GST if registered.
- Avoid pay-per-click and anything that makes ranking pay-to-win.

## KPIs
Coverage (share of place pages with at least 3 verified official contacts) · median days from application to verified (target 5) · share of listings re-verified on time · reports per 100 listings and time to resolve · sponsored fill rate per district and type · renewals.

## Risks and mitigations
| Risk | Mitigation built in |
|---|---|
| Wrong or stale contact hurts a visitor | Source and date on official contacts; 12-month expiry for providers; report link; weekly rebuild |
| Fake or unlicensed operator | Email + phone + register check; duplicates blocked; you can suspend instantly |
| Pay-to-win erodes trust | Alphabetical organic order; labelled, capped, separate sponsored block |
| Misleading or health advertising | Wording rules enforced in code; wellness excluded from ads |
| Personal data leak (public repo) | Private store on the server; validator blocks private fields; data deleted on reject, remove, introduction, close |
| Workload on one person | Automatic pre-checks; twice-weekly review slot; caps keep volume bounded |

## Before you sell the first slot (please read)
Not legal advice. Have a lawyer confirm at least: advertising and misleading-claims rules (the ASCI code and the Consumer Protection Act 2019), health and remedy advertising rules (Drugs and Magic Remedies Act), data protection duties for the contact details you collect (DPDP Act 2023: notice, consent, retention, deletion), your obligations as a platform or intermediary (IT Intermediary Guidelines 2021 and the E-Commerce Rules 2020 where they apply), GST on advertising income, and which registrations Kerala Tourism or other bodies require for guides, homestays and operators (so the "check the register" step uses the right register).

## Where things are
- Public pages: `/services/` (directory), `/services/join/`, `/services/standards/`, `/services/report/`, and a contacts block on every Discover page.
- Admin: **Directory** tab. Intake: `public/api/submit-provider.php`, `verify-provider.php`, `submit-report.php`.
- Data: public `src/content/providers/<id>.json`; private `vh-data/market/providers/` and `reports/` on Hostinger.
- Official contacts: the `contacts` block on each entry (agents fill it; you approve it with the entry).
- Tests: `npm run admin:test` (88 checks) and `npm run agents:test`.

## Roadmap after v1
Provider self-service renewal links · per-place linking for providers (beyond district) · outbound-click reports using a UTM tag so sponsors see results · a reminder email 30 days before verification expires · optional authenticator-app login for the admin.
