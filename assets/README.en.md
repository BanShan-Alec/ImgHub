<p align="center">
  <img src="logo.svg" width="112" alt="CF-ImgHub">
</p>

<h1 align="center">CF-ImgHub</h1>

<p align="center">
  An image host for personal blogs, running on Cloudflare Workers + R2.<br>
  Fast, compresses in your browser, and keeps Motion Photos and HDR intact.
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/TG-Twilight/CF-ImgHub"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"></a>
</p>

<p align="center">
  <a href="../README.md">简体中文</a> · <a href="README.zh-Hant.md">繁體中文</a> · <b>English</b>
</p>

## Why CF-ImgHub

### Fast

Images are served straight from Cloudflare's edge: edge cache first, then R2 on the same network. **No database and no third-party storage on the read path.**

Responses support `Range` (seekable video) and `ETag`/304, and carry `Cache-Control: immutable, no-transform`, so browsers cache them for a year and Cloudflare Polish and similar optimizations leave them alone.

### Compression in the browser

Images are transcoded in your own browser before upload; the server only stores the final bytes:

- Auto mode converts to **AVIF**; you can also pick WebP / JPEG / PNG, or skip compression
- Three quality levels and an optional max edge; multiple images are processed in parallel (Web Workers)
- Keeps the original if the result is larger; images that are already AVIF / WebP / JXL are not recompressed

### Motion Photos and HDR, kept intact

Compression strips the video from a **Motion Photo** (a JPEG with a short clip inside) and the gain map from an **Ultra HDR** photo. CF-ImgHub **inspects each file's contents** before upload and sends these as-is:

- Motion Photos: Google Motion Photo, OPPO / OnePlus / realme O Live
- HDR: Ultra HDR / ISO 21496-1 gain-map JPEG, HEIF / AVIF with a gain map
- Animations (GIF, APNG, animated WebP / AVIF), SVG, ICO, video

The server never touches the bytes, so a download matches the file on your phone exactly. Ultra HDR images light up in Chrome / Edge on HDR displays.

## More features

- **Upload and admin pages**: Material 3 Expressive UI, light / dark, Simplified Chinese / Traditional Chinese / English
- **Two roles**: uploaders need only a password and can undo uploads from the last 24 hours; admins can browse, search, preview, bulk delete and manage hotlink protection
- **Hotlink protection**: one switch on the admin page. Allowed sites (subdomains included) are listed there too, and single images can be exempted. Requests without a referrer (direct visits, RSS apps) and common web RSS readers always pass
- **Readable file names**: `ImgHub-20261121-153045-k7q2.avif` (upload time + random code) by default, or keep the original name
- **Script uploads**: call `/api/upload` with a Bearer token from your writing workflow

## Deploy

Click **Deploy to Cloudflare** above and follow the steps:

1. Sign in to Cloudflare with GitHub. The repository is copied to your GitHub account, and every push redeploys automatically
2. The R2 bucket is created for you; you can rename it
3. Fill in the secrets:

   | Name | Purpose |
   |------|---------|
   | `SESSION_SECRET` | Long random string that signs login sessions; changing it signs everyone out |
   | `UPLOAD_PASSWORD` | Upload page password |
   | `ADMIN_USER` / `ADMIN_PASSWORD` | Admin username and password |
   | `UPLOAD_TOKEN` | Token for script uploads; fill a random string if unused |

4. After deployment, add a custom domain (e.g. `img.example.com`) under the Worker's **Settings → Domains & Routes**

`https://img.example.com/` is the upload page and `/admin` is the admin page.

**Hotlink protection is off by default.** Before turning it on, replace the sample domains under "Allowed sites" on the admin page with your blog's domain (subdomains included), or images on your blog will be blocked.

If the Worker has several domains, add the variable `PUBLIC_BASE` (e.g. `https://img.example.com`) under **Settings → Variables and Secrets** so upload links always use that domain.

## Script uploads

```bash
curl -H "Authorization: Bearer $UPLOAD_TOKEN" \
     -H "Content-Type: image/avif" \
     --data-binary @photo.avif \
     "https://img.example.com/api/upload?name=photo.avif"
# Returns JSON with the image link in `url`; add &naming=original to keep the original name
```

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in the secrets
npm run dev
```

## License

[AGPL-3.0-or-later](../LICENSE). Icons from [Material Icons](https://github.com/google/material-design-icons) (Apache-2.0); in-browser encoders from [jSquash](https://github.com/jamsinclair/jSquash) (Apache-2.0, copied at build time, not in this repository).
