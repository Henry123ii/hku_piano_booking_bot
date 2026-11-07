# Publish HKU Piano Companion to GitHub

This file is for the person publishing the repository, not required for ordinary users of the extension.

## Before you publish

- Confirm that the repository contains only the included extension source, **not** your earlier Python booking scripts with personal IDs.
- Never upload `auth.json`, `edge_profile/`, local Chrome/Edge browser profiles, exports, booking logs, or authenticated screenshots. `.gitignore` adds protection when using Git, but does not automatically remove secrets selected through every web-upload method.
- Verify any screenshot uses *fictional/test* details. The bundled `docs/screenshots` files show test data.
- Recheck descriptions against what you have actually tested. Live authenticated HKU compatibility has not been independently verified.
- Decide whether you want to publish publicly or privately. If you want others to reuse the code, choose and add a suitable open-source `LICENSE` file first.

## Option A — GitHub website (simplest)

1. Go to <https://github.com/new> and sign in.
2. Suggested repository name: `hku-piano-companion`.
3. Suggested description: `Unofficial Microsoft Edge extension for preparing and tracking HKU music-room reservations.`
4. Choose **Public** to share it, or **Private** while you are checking it.
5. **Do not add a new README, .gitignore, or license in GitHub's creation form:** this folder already contains README and .gitignore. You can add a license after choosing one.
6. Click **Create repository**.
7. On the empty repository's page, choose **uploading an existing file**. You can also use **Add file > Upload files** if that action is displayed.
8. **Extract** the supplied GitHub-ready ZIP first, then upload the **contents** of the extracted project directory (not the ZIP itself and not an enclosing parent folder). This ensures `README.md` and `manifest.json` sit in the repository root. Drag the folder contents or use the file picker. Check that nested folders `icons`, `docs/screenshots`, and `tests` are included, along with the hidden `.gitignore` file.
9. Review the pending files, enter a commit message like `Initial release of HKU Piano Companion`, and commit them.
10. Refresh the repository root: the README should render underneath the file list. Verify screenshots and links load.

**Tip:** If your browser's upload dialog omits hidden `.gitignore`, create that file directly from the repository **Add file > Create new file** and copy its content from the extracted folder.

## Option B — Git command line

Create an **empty** repository on GitHub first. Then open a terminal in the extracted project folder and run:

```bash
git init
git branch -M main
git add README.md .gitignore SECURITY.md PUBLISH_TO_GITHUB.md INSTALL.txt START_HERE.html TEST_REPORT.md manifest.json app.html app.css app.js shared.js background.js content.js captcha-frame.js response-bridge.js icons docs tests
git diff --cached --stat
git diff --cached --check
git commit -m "Initial release of HKU Piano Companion"
git remote add origin https://github.com/YOUR_USERNAME/hku-piano-companion.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username. This flow requires Git and GitHub authentication, such as Git Credential Manager or GitHub CLI.

Before committing, also review any staged files with `git diff --cached`. Avoid `git add .` until you know no personal files have been copied into this folder.

## Optional: make a versioned download

Once the repository is online, go to **Releases > Draft a new release**. Create a tag such as `v1.0.0`, write short release notes, and publish. GitHub automatically makes a source ZIP available for each release. This is **not** an Edge Store listing; users still need to extract the source and load it as an unpacked extension.

If you later test the extension on real HKU pages, update `TEST_REPORT.md` with the actual date and scope rather than describing simulated tests as live success.

## Helpful official documentation

- [Create a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [Upload files from the web](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [Create a release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [Choose a license](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- [Avoid sensitive-data leaks](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
