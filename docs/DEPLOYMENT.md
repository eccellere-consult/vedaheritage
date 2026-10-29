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
- The old FTP secrets (`FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`) are no longer used and can be deleted from GitHub > Settings > Secrets and variables > Actions.
