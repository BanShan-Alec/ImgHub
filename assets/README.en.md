# CF-ImgHub

[简体中文](../README.md) · [繁體中文](README.zh-Hant.md) · **English**

A small, fast self-hosted image host on Cloudflare Workers + R2. Files are stored and served **byte-for-byte**: no server-side compression or transcoding, so HDR gain maps (Ultra HDR) and Motion Photos survive intact.

## Features

- **Fast**: no database on the read path — Cache API → R2. Supports `Range`/206 and `ETag`/304; responses carry `immutable, no-transform`, so Cloudflare Polish and similar features leave images alone
- **Lossless storage**: the Worker only moves bytes. Optional compression happens **in the browser** (AVIF / WebP / JPEG / PNG, three quality levels, optional max edge). ico, svg, gif, animations, HDR, Motion Photos and videos are uploaded untouched automatically
- **Hotlink protection**: global switch plus per-image switch, on by default. Requests without a referrer (direct visits, RSS apps) and allow-listed sites always pass
- **Two naming modes**: standard names like `ImgHub-20261121-153045-k7q2.avif` (upload time + random code), or keep the original name as `<ms timestamp>_<name>`
- **Seamless migration**: old links missing from R2 are fetched from the legacy host and written to R2 on first access
- **Upload & admin pages**: Material 3 Expressive UI, light/dark, Simplified Chinese / Traditional Chinese / English
- **Two roles**: uploader (password only, may undo uploads from the last 24 hours) and admin (username + password: browse, search, preview, bulk delete, hotlink settings). Scripts can upload with a Bearer token

## Architecture

```text
GET/HEAD /file/<key>   hotlink check → Cache API → R2 → legacy origin (optional)
/api/*                 login, upload, delete, list, stats, settings
everything else        static assets in public/ (upload page /, admin page /admin)
```

| Path | Purpose |
|------|---------|
| `src/serve.js` | File serving, caching, Range, hotlink protection, legacy migration |
| `src/api.js` | Upload, delete, list, stats and settings API |
| `src/auth.js` | Stateless signed-cookie sessions, login rate limiting |
| `src/stores.js` | Picks a bucket from the upload time in the key (multi-bucket ready) |
| `src/settings.js` | Runtime settings (stored in R2 as `.imghub/settings.json`) |
| `public/` | Upload page, admin page, in-browser transcoding worker |

## Deploy

Requires Node.js 22.12+ and a Cloudflare account.

```bash
npm install
npx wrangler r2 bucket create cf-imghub

# Secrets (you will be prompted for each value)
npx wrangler secret put SESSION_SECRET    # long random string; rotate to sign everyone out
npx wrangler secret put UPLOAD_PASSWORD   # upload page password
npx wrangler secret put ADMIN_USER        # admin username
npx wrangler secret put ADMIN_PASSWORD    # admin password
npx wrangler secret put UPLOAD_TOKEN      # optional: Bearer token for scripts

npm run deploy
```

Then attach a custom domain to the Worker in the Cloudflare dashboard. `vars` in `wrangler.jsonc`:

| Variable | Meaning |
|----------|---------|
| `STORES` | Storage routing table by upload time; new uploads go to the last entry |
| `LEGACY_ORIGIN` | Legacy host to fall back to when R2 misses; empty disables it |
| `LEGACY_BEFORE` | Only old-format keys older than this ms timestamp fall back; 0 = no limit |
| `PUBLIC_BASE` | Link prefix returned to uploaders; empty uses the request host |

## Local development

Create `.dev.vars` in the project root with the five secrets above (`KEY=value`, one per line), then:

```bash
npm run dev
```

`npm run dev` / `npm run deploy` first run `npm run vendor`, which copies the jSquash encoders from `node_modules` into `public/vendor/`.

## Uploading from scripts

```bash
curl -H "Authorization: Bearer $UPLOAD_TOKEN" \
     -H "Content-Type: image/avif" \
     --data-binary @photo.avif \
     "https://img.example.com/api/upload?name=photo.avif"
# add &naming=original to keep the original file name
```

## License

[AGPL-3.0-or-later](../LICENSE). Icons from [Material Icons](https://github.com/google/material-design-icons) (Apache-2.0); in-browser encoders from [jSquash](https://github.com/jamsinclair/jSquash) (Apache-2.0, copied at build time, not in this repository).
