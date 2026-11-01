# Admin page: setup and daily use

The admin lives at **https://www.vedaheritage.co.in/admin/** (not linked anywhere, not indexed). One person logs in with a password. It works on the live site only (it needs Hostinger's PHP), not in `npm run dev`.

## What it does

| Tab | What you do | What happens behind the scenes |
|---|---|---|
| Overview | See drafts, published guides, open pull requests, stories waiting, live site version, last deploys | Reads GitHub and `version.txt` |
| Drafts | **Approve & publish** a guide, or unpublish one. **Find images** for a guide with none | Commits `status: "approved"` to `main`; the site rebuilds and goes live in a few minutes |
| Marketplace | Review seller submissions (photos, text, private contact, risk flags), **Approve & publish** or **Reject**; see buyer enquiries next to the seller's contact and **Mark introduced**; **Mark sold** or **Remove** | Listing JSON and photos are committed to `main` in one commit; contact details stay on the server (see `docs/MARKETPLACE.md`) |
| Directory | Verify provider applications (automatic checks plus the checks you tick), publish, **sponsor** within the caps, re-verify, suspend or remove, and close visitor reports | Public listing JSON (no private data) is committed to `main`; see `docs/DIRECTORY_MODEL.md` |
| Pull requests | **Merge** agent PRs (new drafts, images, stories) once checks are green | Refuses if checks are red, not yet approved on GitHub, or the PR has a conflict |
| Stories | **Approve** or reject visitor stories | Approve adds the `approved` label, which opens the story PR; merge it under Pull requests |
| Run agents | **Choose which AI the agents use** (xAI, OpenAI, Anthropic or automatic; a saved default plus a per-run override), start the content agents, image search, link check | Saves `agents/settings.json`; starts the GitHub workflow; results arrive as a pull request with photos already fetched |
| Activity | See what was done and failed logins | Audit log stored outside the web folder |

### Why a draft cannot be published
The admin enforces the same rules as the validator. A guide needs at least **1 licensed, credited image**, **2 sources**, a summary of 50 to 200 characters, and folklore, history, spiritual and visitor sections. If the verifier flagged the guide (score under 80), the admin asks you to confirm. It never publishes silently.

### Typical flow (one batch, one deploy)
1. **Run agents** → wait about 15 to 20 minutes → one batch (pull request) appears. Photos are already in it.
2. **Review agent work** → open the batch. Each page shows its photos, summary, sources and the fact-checker's verdict in plain words. Open **Read more** for history, tradition and meaning.
3. Tick the pages you accept (ready pages are pre-ticked; flagged pages are not). Missing a photo? **Upload your own photo**: pick the picture, type the credit and a description; it is attached to that page inside the batch.
4. Press **Publish N & finish batch**. The admin publishes the ticked pages, waits for the safety checks, merges and the site updates once. Unticked pages stay drafts.

The weekly **events calendar** update (Sundays 01:00 IST, or **Run agents > Update events now**) arrives as a batch too. It shows each new event with its dates, place and source links; check the links, then press **Merge events calendar**.

Per-page tools remain under **Drafts** (unpublish, find images, upload your own photo) for pages already on `main`.

### Two modes: review first, or publish automatically
**Run agents > How does agent work reach the site?** switches between them at any time; the change applies from the next run.

| | Review first | Publish automatically |
|---|---|---|
| What the agents do | Open one batch (pull request) of drafts | Publish what passes every gate straight to the site |
| Your job | Tick and publish under **Review agent work** | Read the live pages; use the **owner bar** to edit, mark reviewed, unpublish or delete |

Automatic publishing only covers an entry when ALL of these hold: the fact-checker says ready with no flags and no contradicted claim; at least one credited photo whose file exists; two or more retrieved sources; a valid summary and all sections; the category is not `medical` or `healing`; and the **content-safety check** finds nothing (adult or sexual content, child exploitation, illegal or harmful material, adult-site links). Anything else stays a draft and is listed in the run report. Before the site is updated the build is tested; if it fails, the run opens a pull request instead.

Published-by-agent pages show visitors "Editor review pending" until you edit them or press **Mark reviewed**. Events follow the same switch.

**Owner bar:** log in at `/admin/`, then open any guide on the live site. A bar at the bottom shows **Edit**, **Mark reviewed**, **Unpublish**, **Delete** and **Admin**. On the Events page each event has **Remove event**. The Overview tile "Auto-published, to review" counts pages you have not reviewed. Edits and deletes rebuild the site in a few minutes. A deleted page is not re-added by the agents.

### Where photos come from
Wikimedia Commons first, then Openverse (Creative Commons photos, including Flickr) when Commons has none. Only commercial-use licences with a named creator are accepted, and the credit appears under the photo. The photo's text must name the place, and GPS and camera data are removed. A page still needs at least one credited photo before it can go live automatically. You can always add your own with **Upload your own photo**.

### Your own photos
The browser shrinks the picture to 1600 px and re-encodes it as JPEG, and the server re-encodes it again, so GPS and camera data are removed. The credit you type is shown under the photo, with the licence "Own photo, used with the photographer's permission". Only upload pictures you took or may publish.

## One-time setup (about 15 minutes)

**Step 1. Create a GitHub token for the admin.**
GitHub → your profile picture → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
- Resource owner: `eccellere-consult`. Repository access: **Only select repositories** → `vedaheritage`.
- Repository permissions: **Contents** Read and write · **Pull requests** Read and write · **Issues** Read and write · **Actions** Read and write · (Metadata is automatic). Optional: **Secrets** Read-only, so the Run agents tab can show which AI keys are set (it never reads their values).
- Expiration: choose 90 days and put the renewal date in your calendar. Copy the token (starts `github_pat_`); GitHub shows it once.

**Step 2. Create your password code.**
Open `https://www.vedaheritage.co.in/admin/`. It shows "Admin setup". Type a passphrase of **14 or more characters** (four or more random words is ideal). Click **Make my code** and copy the long line starting `$2y$`. Nothing is stored.

**Step 3. Add both to `vh-config.php`.**
Hostinger hPanel → File Manager → open `domains/vedaheritage.co.in/` (the folder **above** `public_html`, not inside it). Edit `vh-config.php`, or create it if it does not exist. The whole file must look like this (keep the first and last lines, the single quotes and the commas):

```php
<?php return [
  'repo'                => 'eccellere-consult/vedaheritage',
  'admin_github_token'  => 'github_pat_PASTE_TOKEN_HERE',
  'admin_password_hash' => 'PASTE_THE_$2y$_CODE_HERE',
];
```
**If your host blocks PHP from reading above `public_html`** (the setup page then says so, and `…/api/admin/index.php?a=status` shows `"openBasedirCoversDir":false`), put the same file here instead: `public_html/api/private/vh-config.php`. That folder arrives with the site and is closed to every web request by its own `.htaccess`, so visitors cannot open anything in it. Private submissions (marketplace and directory) are then stored in `public_html/api/private/data/` the same way. Never put the file anywhere else inside `public_html`. Deploys do not delete files you add to that folder, but keep a copy of your settings somewhere safe.

If the file already has lines for story intake (`github_token`, `notify_email`), keep them and add yours before the final `];`. Save.

**Step 4. Log in** at `/admin/`. If you see "Incorrect password", re-copy the code (Step 2) without spaces.

## If the setup page appears again after a deploy
A deploy replaces the website files. Files that are not part of the site can be removed by Hostinger when it pulls a new build, and that includes `public_html/api/private/vh-config.php`. The site now ships a `.gitignore` that asks Git to leave that file and the `data/` folder next to it alone, which protects them if Hostinger only cleans tracked files. If the setup page still reappears after a merge, the file was removed: recreate it (keep the five lines in your password manager), then use the outside-the-web-folder location below if the setup page reports that PHP can read it. The status page (`…/api/admin/index.php?a=status`) now lists any file whose name starts with "vh" and spells out hidden characters, so a look-alike name such as a non-breaking hyphen is visible.

## If you see "Admin unavailable"
Open `https://www.vedaheritage.co.in/api/admin/index.php?a=status` in a new tab. You should see one line starting with `{"configError"` or `{"authed"`.
- **Page not found (404):** the latest deploy has not reached Hostinger. Check GitHub → Actions for a green "Build and publish site", then hPanel → Git for a green deploy.
- **Forbidden (403) on `/admin/` but the line above works:** the site's `.htaccess` is out of date (it must say `DirectoryIndex index.html index.php`). Deploy the latest version, or edit `public_html/.htaccess` in File Manager and change that one line.
- **Blank page or "error 500":** a typing mistake in `vh-config.php` (a missing quote or comma), or PHP older than 7.4. Compare the file with the example in Step 3 and check hPanel → Advanced → PHP Configuration.
- **The setup page says "The server cannot find vh-config.php":** it now also says why. It can report that the file sits inside `public_html` (wrong, move it up) or one folder too high, that it has a look-alike name such as `vh-config.php.txt`, that the folder does not exist, that PHP is blocked from reading the folder (`open_basedir` or permissions; fix under hPanel → Advanced → PHP Configuration, or ask Hostinger support), or that PHP is older than 7.4. The same facts are in `…/api/admin/index.php?a=status` under `config.diag` (yes/no values only; no file contents or full paths).
- **`"configured":false` and a `configError` number:** `vh-config.php` has a typing mistake near that line.
- **`"configured":false` with no error:** the three lines in Step 3 are missing or in the wrong file (it must be in the folder above `public_html`).

## Security notes
- **Password only** was chosen. Use a long unique passphrase and a password manager. Adding an authenticator-app code later is a small change if you want it.
- Login is rate-limited (5 failures per 15 minutes per address, 25 overall) and every action is logged.
- Sessions end after 30 minutes idle or 8 hours. Cookies are HTTPS-only, `HttpOnly`, `SameSite=Strict`; writes need a per-session token.
- The GitHub token is the real key. It sits outside `public_html`, scoped to this repository only. Rotate it if you lose a device. To lock out the admin instantly, delete `admin_password_hash` from `vh-config.php`.
- Optional: restrict to your own IP with `'allowed_ips' => ['203.0.113.7']` (only if your address is fixed).
- Direct edits on `main` bypass pull-request review by design (you are the reviewer). Branch protection that requires reviews would block "Approve & publish"; leave it off, or exempt the token's owner.

## Tests
`npm run admin:test` starts PHP against a mock GitHub and checks login, lockout, CSRF, publish rules, merge rules, story and workflow handling. It runs in CI (the `Checks` job).
