# Content fill (simple route)

**Goal:** fill the site fast and keep it current. Recency and speed beat verification.

**How it works**
1. `agents/fill.mjs` takes topics from `agents/registers/topics.json` (status `todo`). When fewer than 15 remain, it asks the model what Kerala readers want right now and adds them. No human list needed.
2. One web-search call per topic returns loose JSON. `toLite()` turns it into a `format: "lite"` page: summary, paragraphs, highlights, 3 to 5 sections, dated `latest` items ("What's new"), tips, tags, sources. Nothing is rejected for thin detail.
3. `refresh` re-checks the stalest live pages (10+ days) and adds dated news to `latest`.
4. `scripts/ship.sh` drops any new page the validator rejects, builds the site, pushes to `main` and starts the deploy.

**Runs:** daily at 02:20 UTC (`.github/workflows/sprint.yml`), or press Start sprint in the admin. Defaults: 90 minutes, 40 pages, 10 USD cap.

**Guardrails kept:** admin stop switch (`agents/control.json`), content-safety screen (`agents/lib/safety.mjs`), `medical` and `healing` stay drafts, the site build must pass. Pages are labelled "not yet independently checked"; the owner bar on each page edits or deletes.

**Not done:** photos (run Find images separately; pages show a placeholder until then), AI fact-checking, version history.
