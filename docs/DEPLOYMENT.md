# Deployment: how the site goes live

**In one line:** when a change is merged into `main`, GitHub builds the website and puts the finished files on a branch called `deploy`.
Hostinger's **Git** feature copies that branch into your website folder. Nobody has to upload anything by hand.

```
merge to main  ->  GitHub builds the site  ->  branch "deploy"  ->  Hostinger Git pulls it  ->  live
```

## One-time setup on Hostinger (about 10 minutes)
You do this once. Labels in hPanel can differ slightly; the idea is the same.

1. **Delete any old Git entry.** hPanel > Websites > Manage > **Advanced > Git**. Remove existing entries for this domain.
2. **Empty the website folder.** hPanel > **Files > File Manager** > `domains` > `vedaheritage.co.in` > `public_html`.
   Click the gear icon, tick **Show hidden files**, select everything, **Delete**. The folder must be empty.
3. **Connect GitHub.** Advanced > Git > *Create a new repository*:
   - Repository address: `https://github.com/eccellere-consult/vedaheritage.git`
   - Branch: `deploy`
   - Install path: leave **blank**
   Click **Create**, then **Deploy**.
4. **Make it automatic.** In the same Git page copy the **Auto deployment webhook URL**. In GitHub open
   `https://github.com/eccellere-consult/vedaheritage/settings/hooks` > **Add webhook**: paste the URL, Content type `application/json`,
   leave Secret blank, choose **Just the push event**, tick Active, **Add webhook**.
5. **Check.** Open `https://www.vedaheritage.co.in/version.txt`. It shows a long code (the build ID). Open the home page and press Ctrl+F5.

## Keep your private settings across deploys (one-time, about 10 minutes)
The hPanel Git pull replaces the web folder, so any file that is not in Git, such as the admin settings file `vh-config.php`, can disappear on a deploy. The fix is to let GitHub upload the site itself and never touch private files.

1. hPanel > **Files > FTP Accounts** > create an account whose folder is this site's web folder (usually `/public_html`). Note the host name, user name and password.
2. GitHub > repository **Settings > Secrets and variables > Actions > Secrets** > add `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, and `FTP_DIR` (the web folder as the FTP account sees it, e.g. `/public_html`, or `.` if the account starts inside it).
3. **First run is a rehearsal:** under **Variables** add `FTP_DRY_RUN` = `true`, then run **Build and publish site** (Actions > Run workflow). The log lists what would be uploaded or removed. Check it looks right, then delete the variable.
4. hPanel > **Advanced > Git**: remove the auto-deployment entry (otherwise the Git pull still replaces the folder).
5. Create `vh-config.php` once (admin page > setup). From now on deploys leave it alone. Protected paths: `api/private/`, `vh-config.php`, `vh-data/`, `.well-known/`, `cgi-bin/`, `.htpasswds/`, `error_log`.

The step is skipped while the secrets are not set, so nothing changes until you add them. Pages removed from the site (for example a deleted guide) are removed from the server by the same sync.

## Before you merge: wait for green
Every pull request runs a check called **Checks** (content valid, tests pass, site builds). On the PR page, near the bottom, you see either
**"All checks have passed"** (green, safe to merge) or a red cross (click **Details** to see what failed). Don't merge on red.

**Make green compulsory (one-time, 2 minutes):** GitHub > repository **Settings > Branches > Add branch protection rule**
- Branch name pattern: `main`
- Tick **Require status checks to pass before merging**, search for and tick **Checks**
- Click **Create**. The Merge button now stays disabled until the check is green.
(The `Checks` name only appears in that search after it has run once on a pull request.)

## Every day after that
Merge a pull request. Wait 3 to 6 minutes. The site updates by itself.
In GitHub > **Actions** > latest run, a yellow warning "Live site not updated yet" means Hostinger has not pulled yet: click **Deploy** in hPanel > Git.

## If something looks wrong
| What you see | What it means | What to do |
|---|---|---|
| Hostinger page "This Page Does Not Exist" (404) | The website folder has no `index.html` | In File Manager check `public_html` holds `index.html`, `version.txt`, `_next`. If it holds `package.json` or `src`, the Git entry uses the wrong branch: set it to `deploy`, empty the folder, click Deploy. |
| "403 Forbidden" | Folder has files but no `index.html` | Same as above. |
| Old site still showing | Browser or Hostinger cache | Press Ctrl+F5, then click Deploy in hPanel > Git. |
| Yellow warning in GitHub Actions | Hostinger has not pulled yet | Click **Deploy** in hPanel > Git; check the webhook shows a green tick under GitHub > Settings > Webhooks > Recent deliveries. |

## Emergency manual upload (no Git)
GitHub > Actions > latest run > **Artifacts > site-build**: download the zip. In File Manager empty `public_html`, **Upload** the zip, right-click it > **Extract** (into the same folder), delete the zip.

## Notes
- The repository is public. Never store passwords, API keys or the business plan in it. Keys belong in GitHub **Settings > Secrets**.
- `public/.htaccess` hides any `/.git` path from visitors.
- The FTP secrets are used by the optional upload step described above; leave them unset if you rely on hPanel Git alone.
