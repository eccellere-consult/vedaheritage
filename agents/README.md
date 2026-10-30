# Content agents — Scout → Enricher → Verifier

Three cooperating agents keep Discover Kerala growing and accurate. They only ever write **drafts**.
A human (you, twice a week) sets `status: "approved"` and merges. Nothing is published automatically.

```
Scout ──► queue (agents/queue/candidates.json)
            │  highest priority first
            ▼
        Enricher ──► draft entry (src/content/…) + claims list
            │
            ▼
        Verifier ──► per-claim check, sensitivity & folklore review, score
            │         needs_edit? → Enricher revises once with the feedback → Verifier again
            ▼
   Pull request (agents/reports/latest.md = PR body) ──► your review ──► merge
```

## The agents
| Agent | File | Prompt | Job |
|---|---|---|---|
| Scout | `scout.mjs` | `prompts/scout.md` | Web-searches for places/traditions not yet covered; confirms they exist; ranks by priority; de-duplicates against content and the queue. |
| Enricher | `enricher.mjs` | `prompts/enricher.md` | Researches one candidate and writes the full entry (history, folklore, spiritual, travel, etiquette, sources) plus 8–15 key claims, each tied to a source URL. |
| Verifier | `verifier.mjs` | `prompts/verifier.md` | Did not write the entry. Fetches each claim's source itself, rules supported / partial / contradicted / unverifiable, reviews folklore framing and religious sensitivity, scores 0–100. Can also re-verify existing hand-written entries. |

Tune behaviour by editing the prompts. No code change is needed.

## Safeguards enforced in code (not left to the model)
- **Sources must be real.** Any source, official link or claim URL the model did not actually retrieve during research is dropped. Entries need ≥ 2 retrieved sources.
- **Verifier can only tighten.** A "ready for review" verdict is downgraded to "needs edit" if there is a contradicted claim, an unverifiable sensitive claim (dress code, entry rule, safety, money), a blocker issue, an unchecked claim, a score below 80, or fewer than 2 sources.
- **Schema validation.** Every draft must pass `scripts/validate-content.mjs`; invalid drafts are revised once, then discarded. Rejected entries are deleted and logged in the queue.
- **Drafts only.** Agents never set `status: "approved"` and never add images (use the *Fetch licensed images* workflow).
- **Hard budget.** `--budget` / `AGENT_MAX_USD` (default $10) stops the run; the report says so.
- **Independent verification.** Set `VERIFIER_PROVIDER` / `VERIFIER_MODEL` to verify with a different model, ideally a different vendor, than the one that wrote the entry.

## Which AI provider is used by default
**You only need one API key.** The agents pick the cheapest provider that has a key, in this order: **xAI (Grok) → OpenAI → Anthropic**.
The default model for each is listed in `agents/models.json` (edit it there when a provider renames a model; names and prices change, so check each provider's pricing page).
If you add a second key, the Verifier automatically uses a *different* provider from the writer, which makes the fact-check more independent.
To choose a provider, use the **toggle in the admin page** (Run agents tab): a saved default for the scheduled runs, plus an override for a single manual run. The choice is saved in `agents/settings.json` (`provider` for the Scout and Enricher, `verifierProvider` for the Verifier; each is `auto`, `xai`, `openai` or `anthropic`).

Order of precedence for the Scout and Enricher: `<ROLE>_PROVIDER` variable > this run's choice or the `AGENT_PROVIDER` variable > saved default in `agents/settings.json` > automatic. For the Verifier: `VERIFIER_PROVIDER` > its saved choice > automatic, which picks a *different* vendor from the writer when a second key exists, so the fact-checker is not the model marking its own work. A chosen provider with no API key fails immediately with a clear message, before any money is spent.
Cost caution: cheaper models make more mistakes. The Verifier and your approval catch them; judge cost per *approved* entry.

## Choosing providers and models (Anthropic, OpenAI, xAI/Grok)
Each agent can run on a different provider. Set per role, or set `AGENT_PROVIDER` / `AGENT_MODEL` for all:

| Variable | Meaning |
|---|---|
| `SCOUT_PROVIDER`, `SCOUT_MODEL` | provider: `anthropic` (default), `openai`, `xai` |
| `ENRICHER_PROVIDER`, `ENRICHER_MODEL` | model: defaults come from `agents/models.json` |
| `VERIFIER_PROVIDER`, `VERIFIER_MODEL` | if unset, auto-detected (a different vendor from the writer when two keys exist) |
| `OPENAI_API_KEY`, `XAI_API_KEY`, `ANTHROPIC_API_KEY` | keys for the providers you use |
| `OPENAI_PRICE_IN_PER_M`, `OPENAI_PRICE_OUT_PER_M` (same for `XAI_`) | USD per million tokens, used by the spend cap. If unset, a deliberately high estimate ($5 in / $15 out) is used so the cap trips early. |
| `AGENT_BASE_URL` | optional endpoint override for any OpenAI-compatible server that supports the Responses API, web search and JSON-schema output |
| `AGENT_REASONING_EFFORT` | optional, for OpenAI/xAI reasoning models only (`low`/`medium`/`high`) |

OpenAI and xAI run through the OpenAI SDK and the Responses API with the provider's built-in web search. All safeguards above are enforced in code and apply to every provider; only URLs that the provider reports as sources or citations count as "retrieved".

**Recommended mix (cost vs. trust):**
- **Scout** can use a cheap model: its output is only a list of ideas that the Enricher must research again.
- **Enricher** needs a capable model with solid web search; weak models invent more.
- **Verifier** should be a *different vendor* from the Enricher (for example Enricher on Anthropic, Verifier on xAI or OpenAI, or the reverse). Independent models rarely repeat the same mistake. Keep the Verifier at least as strong as the Enricher.

**About "free":** none of these APIs has a dependable free tier for this kind of use. xAI has at times offered monthly credits for organisations that opt into data sharing, and some providers offer limited free allowances, but terms change and I cannot verify them from here. Check each provider's pricing and data terms page. Everything the agents send is public information about places, so data sharing is low-risk here, but do not send private data. Cheaper models mean more "needs edit" and "reject" results from the Verifier and more review work for you; judge cost per *approved entry*, not per call.

**Not yet verified live:** the OpenAI and xAI adapters are tested against a fake local Responses API only (request shapes, citation harvesting, budget cap, routing). xAI's web search and structured-output support, and how well either provider's search opens specific pages for claim checking, need a first live run. Start with `verify` on one slug and read the report.

## Food and muthassi stories
The `food` category adds two optional blocks to an entry: `recipe` (ingredients, method and tips, written in the agent's own words) and `eat` (where to eat it: tips on what to look for and ask for, plus named places only when a retrieved page confirms they exist). The `muthassi` category carries the retold tale in `folklore.story` and says that versions differ. The validator enforces the shape; the agent gates and prompts enforce the sourcing.

## Photos
After each run the workflow fetches open-licence photos from Wikimedia Commons for drafts that have none (`scripts/fetch-commons-images.mjs --drafts`) and includes them in the pull request, so drafts arrive publishable once a human has checked the photos. If no suitable photo is found the entry stays unpublishable until one is added.

## Running
```bash
npm run agents:test                          # offline self-test, mocked model, no key needed
export ANTHROPIC_API_KEY=sk-ant-...
node agents/run.mjs scout --max 8            # add candidates to the queue
node agents/run.mjs enrich --max 3           # draft + verify the top 3 queued
node agents/run.mjs pipeline --max 3         # scout, then enrich
node agents/run.mjs verify --drafts          # re-verify all draft entries (also the 10 hand-written seeds)
node agents/run.mjs verify --slug varkala-beach,munnar
```
Output: draft JSON in `src/content/…`, `agents/evidence/<slug>.json` (claims, verdicts, consulted URLs), and `agents/reports/latest.md`.

## Scheduled run (GitHub Actions)
`.github/workflows/content-agents.yml` runs Sunday and Wednesday 19:30 UTC (01:00 IST Monday and Thursday) and opens one PR.
Setup once:
1. Repo **Settings → Secrets and variables → Actions → New repository secret**: `ANTHROPIC_API_KEY` (and `OPENAI_API_KEY` / `XAI_API_KEY` if you use them).
2. **Settings → Actions → General → Workflow permissions:** read and write, and tick *Allow GitHub Actions to create and approve pull requests*.
3. Optional variables: `AGENT_MAX_USD`, `CONTENT_BASE_BRANCH`, and the per-role provider/model variables above.
4. Test with **Actions → Content agents → Run workflow** (try `verify` first to check the 10 seed drafts).

## Reviewing an agent PR (about 10 minutes per entry)
1. Read the PR body: score, claim counts, gate reasons, issues, folklore and sensitivity notes.
2. 🟡 *Needs human edit* entries: fix the listed items or delete the file.
3. Open `agents/evidence/<slug>.json` for any claim you doubt and click its source.
4. Run the **Fetch licensed images** workflow for approved entries that need photos.
5. Set `status` to `approved`, merge.

## Cost and limits
Model spend per entry is typically a few dollars at `claude-opus-5-5` rates, dominated by research turns; the report prints an estimate (web-search tool fees are not included).
Agents cannot reach sites that block bots, and some government pages are images or PDFs. Those claims come back "unverifiable" and are held for human checking. Refused requests are logged and skipped. Server-side refusal fallbacks are not enabled.
