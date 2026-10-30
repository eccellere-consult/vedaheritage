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

### Typical flow
1. **Run agents** → wait about 15 to 20 minutes → a pull request appears.
2. **Pull requests** → merge it (drafts land on `main`, still hidden).
3. **Drafts** → **Find images** → wait → merge the images PR → check the photos on GitHub first.
4. **Drafts** → read the verifier notes → **Approve & publish**.

## One-time setup (about 15 minutes)

**Step 1. Create a GitHub token for the admin.**
GitHub → your profile picture → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
- Resource owner: `eccellere-consult`. Repository access: **Only select repositories** → `vedaheritage`.
- Repository permissions: **Contents** Read and write · **Pull requests** Read and write · **Issues** Read and write · **Actions** Read and write · (Metadata is automatic). Optional: **Secrets** Read-only, so the Run agents tab can show which AI keys are set (it never reads their values).
- Expiration: choose 90 days and put the renewal date in your calendar. Copy the token (starts `github_pat_`); GitHub shows it once.

**Step 2. Create your password code.**
Open `https://www.vedaheritage.co.in/admin/`. It shows "Admin setup". Type a passphrase of **14 or more characters** (four or more random words is ideal). Click **Make my code** and copy the long line starting `$2y$`. Nothing is stored.

**Step 3. Add both to `vh-config.php`.**
Hostinger hPanel → File Manager → open `domains/vedaheritage.co.in/` (the folder **above** `public_html`). Edit `vh-config.php` (it exists if story intake is set up; otherwise create it). Add these keys inside the `return [ ... ];`:

```php
'admin_github_token'  => 'github_pat_PASTE_TOKEN_HERE',
'repo'                => 'eccellere-consult/vedaheritage',
'admin_password_hash' => 'PASTE_THE_$2y$_CODE_HERE',
```
Keep the single quotes. Save.

**Step 4. Log in** at `/admin/`. If you see "Incorrect password", re-copy the code (Step 2) without spaces.

## Security notes
- **Password only** was chosen. Use a long unique passphrase and a password manager. Adding an authenticator-app code later is a small change if you want it.
- Login is rate-limited (5 failures per 15 minutes per address, 25 overall) and every action is logged.
- Sessions end after 30 minutes idle or 8 hours. Cookies are HTTPS-only, `HttpOnly`, `SameSite=Strict`; writes need a per-session token.
- The GitHub token is the real key. It sits outside `public_html`, scoped to this repository only. Rotate it if you lose a device. To lock out the admin instantly, delete `admin_password_hash` from `vh-config.php`.
- Optional: restrict to your own IP with `'allowed_ips' => ['203.0.113.7']` (only if your address is fixed).
- Direct edits on `main` bypass pull-request review by design (you are the reviewer). Branch protection that requires reviews would block "Approve & publish"; leave it off, or exempt the token's owner.

## Tests
`npm run admin:test` starts PHP against a mock GitHub and checks login, lockout, CSRF, publish rules, merge rules, story and workflow handling. It runs in CI (the `Checks` job).
