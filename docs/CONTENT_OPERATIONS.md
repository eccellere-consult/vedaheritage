# Discover Kerala — Content Operations

## How content flows
```
Agents / editors / visitors  →  draft (JSON or issue)  →  twice-weekly review  →  merge  →  CI deploys  →  live
```
Nothing reaches production without a human merge. Only `status: "approved"` entries are published;
`draft` entries show only in `npm run dev` and `npm run build:preview`.

## Your twice-weekly review (≈30–45 min)
1. **Content PRs** (Mon/Thu): open each PR labelled `content`. Work through the PR checklist, set `status` to `approved`, merge.
2. **Visitor stories**: open issues labelled `story-submission`. Add the `approved` label to publish — a bot opens a PR with the cleaned story; merge it. Close the issue to reject.
3. Spot-check one live page for "Last verified" and sources.

## Adding or editing an entry
- File: `src/content/<category>/<slug>.json` (see any seed file for the schema).
- Every entry needs: a `folklore` block, ≥ 3 highlights, visitor info with etiquette, tags, and sources. Approved entries need ≥ 2 sources.
- Validate: `npm run validate` (also runs in CI on every content PR).
- Preview with drafts: `npm run dev` or `npm run build:preview`.

## Entry anatomy (every guide has all of these)
`history` (significance, timeline, key facts) · `folklore` · `spiritual` (experiences, best for, mindful tips) ·
`visitorInfo` · `travel` (train, KSRTC bus, water, air) · `officialLinks` · `images` (1–2, licensed and credited) · `sources` (≥ 2 to approve).

## Images (authentic and licensed)
- Run **Actions → Fetch licensed images**. It searches Wikimedia Commons, keeps only CC0 / CC BY / CC BY-SA / public-domain
  photos with a named author, saves them to `public/images/discover/`, records credit + licence, and opens a PR.
- In the PR, check each photo: right place, authentic, good quality. Delete any that are not. An entry cannot be set
  to `approved` without at least one credited image (CI enforces this).
- Your own or partner photos: add the file to `public/images/discover/`, add an `images` item with `credit`, `license`
  ("© Veda Heritage, all rights reserved" is fine for your own) and `sourceUrl`.
- Never use images from Google results, social media or news sites without written permission.

## Visitor photos and stories
Visitors can attach up to 2 photos to a story. The server re-encodes them (removes GPS/EXIF), stores them on the private
`community-uploads` branch, and files a GitHub issue. Add the `approved` label → bot opens a PR that copies the photos into
`public/images/community/` and shows them with credit under the story. Merge to publish; close the issue to reject.
Check photos for faces of children, number plates, and anything inappropriate before approving.

## Official links and travel
Shared links live in `src/data/official-links.ts` (Kerala Tourism, KTDC, IRCTC, NTES, KSRTC, State Water Transport,
Travancore Devaswom Board) and are shown on `/travel/` and every entry. Entry-specific bodies go in `officialLinks`.
**Link check** runs every Monday and opens an issue if any link breaks. We link out; we do not scrape or mirror fares or timetables.

## SEO built in
Per-page title, 50–200 char meta description (the entry `summary`), canonical URL, Open Graph/Twitter tags,
JSON-LD (TouristAttraction/HinduTemple/Beach, Article, BreadcrumbList, ItemList), `sitemap.xml`, `robots.txt`,
`lastVerified` as `dateModified`, clean URLs `/discover/<category>/<slug>/`.
Submit `https://www.vedaheritage.co.in/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## One-time setup for visitor stories (Hostinger)
1. Create a GitHub fine-grained token for this repo only.
2. Token permissions: **Issues: write** and **Contents: write** (for the photo quarantine branch). Create the branch once: `git push origin main:community-uploads`.
   Then create `/domains/vedaheritage.co.in/vh-config.php` (outside `public_html`):
   ```php
   <?php return ['github_token' => 'github_pat_xxx', 'repo' => 'eccellere-consult/vedaheritage',
                 'notify_email' => 'stay@vedaheritage.co.in'];
   ```
3. In GitHub, create labels `story-submission` and `approved`.
4. Optional repo variable `CONTENT_BASE_BRANCH` (default `main`).
Safeguards: honeypot field, 5/hour per-IP limit, HTML stripped, links rejected, consent required, first name only published.

## Safety rules for agent-written content
- Two sources or one official source per factual claim; link them.
- Folklore is attributed as "tradition" and notes where versions differ; never presented as settled history.
- Dress codes and entry rules for places of worship get extra review.
- Timings, fees and festival dates must say "confirm before travelling".
- No images without a clear licence.

## The agent fleet
Scout → Enricher → Verifier run twice a week (01:00 IST before your Monday and Thursday review) and open one PR of draft entries with a
scored verification report. See `agents/README.md` for setup (`ANTHROPIC_API_KEY` secret), safeguards and how to review.
Still to build: a freshness sweeper that re-checks old entries (until then, run `verify --slug …` or the workflow's `verify` option).
