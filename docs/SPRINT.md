# Content sprint (prototype)

Implements the "content acceleration" plan as a **prototype**: fast, cheap, human-correctable first-level coverage in place of the slow Scout > Enricher > Verifier chain.

## What is built
| Plan section | Status | Where |
|---|---|---|
| Pause the old agents | Done | `content-agents.yml` has no schedule and its job is switched off in `agents/control.json`. The code, data and history are kept. Re-enable with the job toggle plus restoring the cron line. |
| Stop switch (pause all, kill, per-job off) | Done, enforced by the backend | `agents/control.json`, `agents/lib/control.mjs`, `scripts/agent-guard.mjs`, admin **Content sprint** |
| One lightweight flow | Done | `agents/sprint.mjs`: one research pass (5 searches, 4 page opens) and one drafting call per topic, one targeted correction at most, then the next topic |
| Topic and source registers | Done | `agents/registers/topics.json` (54 seed topics, editable in the admin), `agents/registers/sources.json` |
| Bounded sprint, saved as it goes | Done | `sprint.yml`: three slices (draft, photos, publish, save), time and spend caps, partial results kept |
| Images or a placeholder | Done | Commons, then Openverse (strict guardrails); otherwise the page goes live without a photo and the owner bar shows "No photo yet" with **Upload your own photo** |
| Same site for admin and visitors, edit in place | Done (earlier work) | Owner bar on every guide: edit, mark reviewed, unpublish, delete, upload photo |
| Plain status labels | Done | `editorial.status`: `ready`, `needs_fact_check`, `draft` (internal, never shown to visitors) |
| Dashboard | Basic | Admin **Content sprint**: state, jobs with last run, progress counts, pages needing photo or fact check, topic register, last report |
| Publishing modes | Two of three | Review first, or publish automatically. The sprint only creates **new** pages, so automatic mode behaves like the plan's "hybrid". |

## Deliberately not built yet (prototype)
Refresh with AI (section or page) with a change preview, version history and restore, soft delete, section reordering, the weekly source recheck and change report, per-job pause with progress details, token/cost per topic. Git already keeps every version of every page, so a bad edit can be undone from the repository history in the meantime.

## How a topic becomes a page
1. Stop-switch check, then skip if a page already exists.
2. Research (3 to 5 results), draft, and only keep sources and claims whose URLs were really retrieved.
3. Validate against the site rules; one targeted correction; otherwise the topic is marked `failed` and nothing is saved.
4. Label: `ready` when two or more retrieved sources and nothing was dropped; `needs_fact_check` when evidence is thin; `draft` when the content-safety screen matches.
5. Save the page as a draft, update both registers.
6. After each slice: photos, then pages labelled `ready` that pass the content-safety screen go live (when publishing automatically); the rest wait. Health topics (`medical`, `healing`) never go live on their own.

## Stop switch
Pause all, Kill switch, Reset, and a per-job on/off. Every agent checks the state before starting, before each topic, immediately before every write, and before publishing. If the state cannot be read in CI, the agents stop. Kill also cancels running jobs. A kill is reset only by an explicit admin action, and queued work does not restart by itself. The limit: GitHub's own token cannot be revoked from here, so the guard stops the agent code and publish step, not the credential. To block the credential too, disable the workflows in GitHub > Actions.

## Run it
Admin > **Content sprint** > Start sprint (default 150 minutes, 40 topics per slice, 20 USD cap). Check progress in the same tab, then open pages on the live site and correct them with the owner bar.
