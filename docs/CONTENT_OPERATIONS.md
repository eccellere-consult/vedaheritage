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

## SEO built in
Per-page title, 50–200 char meta description (the entry `summary`), canonical URL, Open Graph/Twitter tags,
JSON-LD (TouristAttraction/HinduTemple/Beach, Article, BreadcrumbList, ItemList), `sitemap.xml`, `robots.txt`,
`lastVerified` as `dateModified`, clean URLs `/discover/<category>/<slug>/`.
Submit `https://www.vedaheritage.co.in/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## One-time setup for visitor stories (Hostinger)
1. Create a GitHub fine-grained token for this repo only: **Issues: Read and write**.
2. Create `/domains/vedaheritage.co.in/vh-config.php` (outside `public_html`):
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

## Next: the agent fleet (Phase 1–2)
Scout → Enricher → Verifier → PR (labelled `content`) on a schedule via GitHub Actions; Freshness sweeper weekly.
