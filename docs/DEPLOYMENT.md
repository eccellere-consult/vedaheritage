# Deployment and recovery (GitHub → hPanel Git → Hostinger)

**Flow:** push to `main` → GitHub Actions (`deploy.yml`) builds the static site → publishes **only the built files** to the `deploy` branch →
hPanel's Git pulls `deploy` into the domain's folder (triggered by a GitHub webhook) → the workflow checks that the live site serves the same commit (`/version.txt`).
The source code never reaches the web server. Every run also keeps the built site as a downloadable **`site-build` artifact** (14 days).

## One-time setup
1. **Merge this change to `main`.** The first run creates the `deploy` branch. Check Actions → *Build and publish site* ran (the verify step will fail until steps 2–4 are done; that is expected).
2. **Clear the folder.** hPanel → Websites → *Manage* → Files → File Manager → `domains/vedaheritage.co.in/public_html/` (tick *Show hidden files*): delete everything inside,
   including `.git`, `.ftp-deploy-sync-state.json` and any raw repository files. Hostinger's Git needs an empty install folder.
3. **Remove any old Git entry.** hPanel → Advanced → **Git**: delete earlier entries for this domain (for example one pointing at `main`).
4. **Create the Git deployment.** Advanced → Git → *Create a new repository*:
   - Repository: `git@github.com:eccellere-consult/vedaheritage.git` (SSH, because the repo is private).
   - Branch: **`deploy`**.
   - Install path: the domain's web folder (leave blank or enter `public_html`, whichever hPanel shows for this website).
   - Copy the **SSH key** hPanel shows → GitHub repo → Settings → **Deploy keys** → *Add deploy key* (read-only is enough).
   - Click **Deploy** once to pull the first build.
5. **Turn on auto-deploy.** hPanel shows an *Auto deployment* **webhook URL**. GitHub repo → Settings → **Webhooks** → *Add webhook*:
   Payload URL = that URL, Content type = `application/json`, event = **Just the push event**. Every push (including the workflow's push to `deploy`) now triggers a pull.
6. **Check:** open `https://www.vedaheritage.co.in/version.txt` (it shows the commit ID) and the home page.

## Day to day
Merge to `main` → wait about 3–6 minutes → live. The workflow turns red if Hostinger did not pull the new build; its log prints what the live site returns.

## If every page shows Hostinger's "This Page Does Not Exist" (404)
The web folder has no `index.html`. Check in this order:
- **File Manager:** does the folder contain `index.html`, `_next`, `version.txt`? If it holds repository files (`package.json`, `src/`), the Git entry is pointing at `main` instead of **`deploy`**: edit it to `deploy`, empty the folder, and click *Deploy*.
- **Branch exists?** GitHub → branches → `deploy`. If missing, run Actions → *Build and publish site* → Run workflow.
- **Webhook:** GitHub → Settings → Webhooks → *Recent deliveries* should show green ticks. If not, copy the URL again from hPanel.
- **www:** open `https://vedaheritage.co.in` and `https://www.vedaheritage.co.in`. If only one works, add the missing DNS/alias, or set repo variable `SITE_URL` to the working host.
- **Get the site back immediately:** Actions → latest run → **Artifacts → `site-build`**: download, unzip, upload the *contents* (including hidden `.htaccess`) to the folder with File Manager.

## FTP fallback
`deploy-ftp.yml` (manual only) uploads by FTP. Use it only if hPanel Git is unavailable, and never while Git deployment is active on the same folder.
Secrets: `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`; optional variable `FTP_SERVER_DIR`.

## Security note
hPanel Git keeps a `.git` folder in the web root. `public/.htaccess` returns 404 for any `/.git…` path, and the `deploy` branch contains only built, public files.
