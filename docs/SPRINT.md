# Content fill (simple route)

**Goal:** fill the site fast and keep it current. Recency and speed beat verification.

**How it works**
1. `agents/fill.mjs` takes topics from `agents/registers/topics.json` (status `todo`). When fewer than 15 remain, it asks the model what Kerala readers want right now and adds them. No human list needed.
2. One web-search call per topic returns loose JSON. `toLite()` turns it into a `format: "lite"` page: summary, paragraphs, highlights, 3 to 5 sections, dated `latest` items ("What's new"), tips, tags, sources. Nothing is rejected for thin detail.
3. `refresh` re-checks the stalest live pages (10+ days) and adds dated news to `latest`.
4. `scripts/ship.sh` drops any new page the validator rejects, builds the site, pushes to `main` and starts the deploy.

**Runs:** weekly by default. The workflow checks daily and `scripts/fill-plan.mjs` lets it run only every N days. Cap (default 5 USD per run, shared 80/20 between new pages and refresh), pages, minutes and N are editable in the admin (Content sprint > Fill content > Save schedule, stored in `agents/settings.json` `fill`). Start now runs it once on demand.

**Guardrails kept:** admin stop switch (`agents/control.json`), content-safety screen (`agents/lib/safety.mjs`), `medical` and `healing` stay drafts, the site build must pass. Pages are labelled "not yet independently checked"; the owner bar on each page edits or deletes.

**Not done:** photos (run Find images separately; pages show a placeholder until then), AI fact-checking, version history.

**Skill file:** `docs/skills/vedaheritage-content-acceleration.skill.md` (version 2) is the portable description of this system with the learnings. Photos: `fetch-images.yml` runs in parallel and uses Commons, Openverse, Pexels, Pixabay and Unsplash (free keys as GitHub secrets). Quality flags: `scripts/content-bar.mjs`.

## Coverage target (30 guides per category, 2 to 3 per district)
`agents/coverage.mjs` measures guides per category and district (written to `agents/registers/coverage.json`, shown in the admin Fill content card as a table). Each run, when the queue is short, it asks the model for specific, real topics for the thinnest categories (6 per run) and queues them, then the fill route writes them. A district with nothing real for a category (for example a beach in a landlocked district) is recorded in `coverage-none.json` and not asked again: the target is never met by inventing topics. Targets are editable in the admin (Fill content, Coverage). Stand at 145 guides against about 600 for 20 categories; the pace is set by the per-run cap, pages and frequency (see the cost per page the admin shows after a run).
