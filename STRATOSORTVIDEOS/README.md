# Product preview video

Place **exactly one** file here for the landing page hero video:

| Property | Value |
|----------|--------|
| **Folder** | `STRATOSORTVIDEOS/` (this folder) |
| **Filename** | `stratosort-product-ad.mp4` |
| **Referenced from** | `index.html` → `<source src="STRATOSORTVIDEOS/stratosort-product-ad.mp4">` |

## Upload on GitHub

1. Open the repo on GitHub.
2. Go to **`STRATOSORTVIDEOS/`** (create the folder with **Add file → Upload files** if it does not exist yet).
3. Upload your encoded file and name it **`stratosort-product-ad.mp4`** (or upload then rename in the GitHub UI).
4. Commit to the branch that **GitHub Pages** publishes (e.g. `main` or `gh-pages`).

## Size and format

- GitHub blocks files **larger than 100 MB** in normal Git. Keep the export under that limit (or use Git LFS / external hosting).
- Prefer **H.264** video and **AAC** audio in an **MP4** container for broad browser support.

After the file is on the branch Pages uses, wait for the site to rebuild, then hard-refresh the page.
