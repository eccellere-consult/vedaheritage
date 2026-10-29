# Veda Heritage — project context for Claude

**What this is:** vedaheritage.co.in — a Next.js 16 static export (`output: 'export'`) built by GitHub Actions and deployed to Hostinger via hPanel Git (the `deploy` branch holds only built files; the workflow `deploy.yml` publishes it on every merge to `main`).
Two roles in one site: (1) a boutique heritage stay near Amritapuri, Vavvakkavu, Kollam; (2) **Discover Kerala**, a living guide to
Kerala's temples, places, beaches, backwaters, heritage items, Ayurveda, history and 14 districts.
Owner/author: Eccellere (management-consulting audience for plans and reports; Word/PPT deliverables use Eccellere standards).

## Read first
- `docs/SITE_PLAN.md` — vision, scope, roadmap, KPIs, and the slot for the business plan (**business plan not yet in repo — ask the owner to reshare**).
- `docs/CONTENT_OPERATIONS.md` — editorial workflow, twice-weekly review, story/photo moderation, setup.
- `docs/DEPLOYMENT.md` — how deploys work (hPanel Git), one-time setup, and recovery from a 404.
- `agents/README.md` — Scout → Enricher → Verifier agents, safeguards, providers.
- `docs/ADMIN.md` — the admin page: what it does, one-time setup, security notes.

## Standards (keep consistent)
**Design:** tokens live only in `tailwind.config.ts` — `primary` (green `#1D6A3A`), `accent` (teal `#1A6B72`; `accent-light` for text on dark),
`surface`, `ink` (navy `#1B2A4A`). Never hard-code hex in components. Use `PageHero` for page headers, `.btn-primary / .btn-accent / .btn-outline`,
`.card`, `.section-label`, `.section-title`. Headings Cormorant Garamond, body Inter. Palette derives from the Eccellere family
(green + teal on navy); confirm exact eccare.in values with the owner and change them in the Tailwind config only.
**Content:** JSON in `src/content/<category>/<slug>.json`, categories: temples, places, beaches, backwaters, heritage, ayurveda; plus `districts/` and `kerala/overview.json`.
Every entry has history, folklore (framed as tradition, never as fact), spiritual/cultural meaning, visitor etiquette, sources. Validate with `npm run validate`.
Only `status: "approved"` publishes. Agents and Claude write **drafts only**; a human approves.
**Accuracy:** no invented shops, addresses, prices, timings or dates. Cite retrieved sources. Say "confirm before travelling".
**Tone:** friendly, professional, direct; simple present tense; executive-ready; SEO-aware (unique title and 50–200 char description per page).
**Security/privacy:** story and photo submissions are moderated; photos are re-encoded (EXIF stripped); secrets only in GitHub/Hostinger, never in the repo.

## Commands
`npm run dev` (shows drafts) · `npm run build` (approved only) · `npm run build:preview` (drafts) · `npm run validate` · `npm run agents:test`

## Environment notes
Sandboxed sessions may block outbound access to Wikimedia, Kerala Tourism, KTDC, IRCTC, KSRTC and Google Drive. Do not fake results; say what could not be checked.
