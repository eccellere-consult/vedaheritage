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
- **Independent verification.** Set the repo variable `VERIFIER_MODEL` (for example `claude-fable-5-1`) to verify with a different model than the one that wrote the entry.

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
1. Repo **Settings → Secrets and variables → Actions → New repository secret**: `ANTHROPIC_API_KEY`.
2. **Settings → Actions → General → Workflow permissions:** read and write, and tick *Allow GitHub Actions to create and approve pull requests*.
3. Optional variables: `AGENT_MAX_USD`, `VERIFIER_MODEL`, `CONTENT_BASE_BRANCH`.
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
