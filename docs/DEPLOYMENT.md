# Deployment and recovery (GitHub → Hostinger)

**How it works:** push to `main` → GitHub Actions builds the static site (`out/`) → uploads it by FTP to `server-dir` → `scripts/verify-deploy.sh`
checks that the live site serves the same commit (`/version.txt`) and that `/`, `/discover/`, `/sitemap.xml` return 200.
Every run also keeps the built site as a downloadable **`site-build` artifact** (14 days).

## If every page shows Hostinger's "This Page Does Not Exist" (404)
That page is Hostinger's default. It means the domain's **document root has no `index.html`**. Work through this in hPanel (≈5 minutes):

1. **Find the real document root.** hPanel → Websites → *Manage* next to vedaheritage.co.in → **Files → File Manager**.
   - If this domain is the plan's **primary** domain, its root is usually `public_html/` at the top.
   - If it was added as an extra website, it is `domains/vedaheritage.co.in/public_html/`.
2. **See where the deploy put the site.** Look for `version.txt` (it contains the commit ID) and `index.html` in each of those two folders.
   - Files are in `domains/vedaheritage.co.in/public_html/` but the real root is `public_html/` → set the repo variable **`FTP_SERVER_DIR`** to `/public_html/`
     (GitHub → Settings → Secrets and variables → Actions → **Variables**), then **Actions → Deploy to Hostinger → Run workflow**.
   - Your FTP user is limited to the document root itself (you see `index.html` straight after login) → set `FTP_SERVER_DIR` to `/`.
3. **Check hPanel → Advanced → Git.** If a Git deployment is set up with install path `public_html`, it can replace the folder's contents with raw repository files (no `index.html`).
   Remove that entry (the Actions deploy replaces it), empty the folder if it holds repository files, then re-run the deploy.
4. **Check the www name.** Open `https://vedaheritage.co.in` and `https://www.vedaheritage.co.in`. If only one works, add the missing DNS/alias in hPanel,
   or set the repo variable **`SITE_URL`** to the host that works.

## Get the site back immediately (manual upload)
Open the failed or latest run in Actions → **Artifacts → `site-build`**, download, unzip, and upload the **contents** of the folder
into the document root with File Manager. Include the hidden `.htaccess`.

## Reading a failed "Verify the live site" step
The step prints the HTTP status of `/` and `/version.txt` for the www and non-www hosts, plus hints for each pattern.
