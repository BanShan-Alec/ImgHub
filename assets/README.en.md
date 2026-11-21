<p align="center">
  <img src="logo.svg" width="112" alt="CF-ImgHub">
</p>

<h1 align="center">CF-ImgHub</h1>

<p align="center">
  An image host for personal blogs, running on Cloudflare Workers + R2.<br>
  Fast, compresses in your browser, and never loses Motion Photos or HDR.
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/TG-Twilight/CF-ImgHub"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"></a>
</p>

<p align="center">
  <a href="../README.md">简体中文</a> · <a href="README.zh-Hant.md">繁體中文</a> · <b>English</b>
</p>

## Features

### Fast

Images are served straight from Cloudflare's edge: cache first, then R2 on a miss. No database and no third-party storage on the read path.

### Compression in the browser

Images are transcoded in your browser before upload; the server only stores the result. **AVIF** by default, or WebP / JPEG / PNG, or no compression; three quality levels and an optional longest-edge limit. If the result is larger, the original is kept.

### Motion Photos and HDR, never lost

Uploads are inspected by content to detect Motion Photos (Google Motion Photo, OPPO / OnePlus / realme O Live, including WeChat re-saves) and HDR photos (Ultra HDR / ISO 21496-1 gain maps). HDR photos, animations, SVG, ICO and videos are uploaded as-is; Motion Photos are split, compressed and reassembled in their original structure, so galleries still recognize them:

| Level | What it does |
|------|------|
| Original | Unchanged |
| Slim | Strip phone-private data, lossless |
| **Standard** (default) | Also recompress the still; HDR and the clip are kept, about half the size |
| Compact | Also convert the motion clip to SDR |
| Extreme | Also drop HDR and shrink the still to the longest edge |

The server never modifies file bytes.

## More features

- **Two roles**: uploaders need only a password and can undo uploads from the last 24 hours; admins can browse, search, bulk-delete and change settings
- **Hotlink protection**: custom allowed sites and per-image exceptions; direct visits and RSS readers are unaffected
- **Readable names**: `ImgHub-20261121-153045-k7q2.avif` by default, or keep the original name
- **Multiple domains, backgrounds, quick links**: all on the settings page
- **Telegram storage (optional)**: as a backup for R2, or Telegram only
- **Script uploads**: call `/api/upload` with a Bearer token
- Material 3 Expressive UI, light / dark, 简体中文 / 繁體中文 / English

## Deploy

<details>
<summary>Show deployment steps</summary>

You need a Cloudflare account (the free plan is fine) and a GitHub account. To use your own domain, it must already be on Cloudflare.

### Step 1: one-click deploy

1. Click the **Deploy to Cloudflare** button above and sign in to Cloudflare
2. Connect GitHub when asked. Cloudflare copies this repository into your GitHub account; pushing changes there redeploys automatically
3. Keep the project name `cf-imghub` or pick your own
4. Keep the new R2 bucket (you may rename it)
5. Fill in the five secrets:

   | Name | Value |
   |------|------|
   | `SESSION_SECRET` | A long random string used to sign sessions |
   | `UPLOAD_PASSWORD` | Password for the upload page |
   | `ADMIN_USER` | Admin username |
   | `ADMIN_PASSWORD` | Admin password |
   | `UPLOAD_TOKEN` | Token for script uploads; fill a random string even if unused |

   Generate random strings with a password manager or `openssl rand -hex 32`. Names are case-sensitive; no spaces around values
6. Click the deploy button at the bottom and wait for the build (1–2 minutes)

You now have a working `https://cf-imghub.<your-subdomain>.workers.dev` address.

### Step 2: add your own domain (recommended)

Cloudflare's edge cache does not work on `workers.dev`, so every request reads R2. For real use, add a domain:

1. In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Workers & Pages** → `cf-imghub`
2. Go to **Settings** → **Domains & Routes** → **Add** → **Custom domain**
3. Enter a subdomain such as `img.example.com` and confirm. DNS and the certificate are created for you within minutes

### Step 3: check it works

1. Open `https://img.example.com/`, enter the upload password, upload an image and open the returned link in a new tab
2. Open `https://img.example.com/admin` and sign in with the admin account; the image should be listed

**Hotlink protection is off by default.** Before turning it on, replace the sample domains under "Allowed sites" on the settings page with your blog's domain (subdomains are included), or your blog's images will be blocked.

### Changing passwords or settings later

Everything lives under **Workers & Pages** → `cf-imghub` → **Settings** → **Variables and Secrets**:

- **Change**: edit the entry, enter the new value, then click **Deploy**
- **Add**: click **Add**, choose type **Secret**, fill in the name and value, then click **Deploy**
- Always use **Secret** for passwords; **Text** works too but shows the value in plain sight
- Changing `SESSION_SECRET` signs everyone out; changing a password only signs out that role

Several domains: add more custom domains under the Worker's **Settings → Domains & Routes**; links follow the domain you opened the page on. List them under **Link domains** on the settings page and a globe button appears in the top bar of the upload and admin pages to switch which domain links use.

Telegram storage (optional):

1. Create a bot with [@BotFather](https://t.me/BotFather) and note the token
2. Create a channel (private is fine) and add the bot as an admin with at least **Post messages** and **Delete messages**
3. Find the channel id: open the channel in [Telegram Web](https://web.telegram.org/a/); the `-100…` number after `#` in the address bar is the id
4. Under **Variables and Secrets** add two secrets, `TG_BOT_TOKEN` (the bot token) and `TG_CHAT_ID` (the channel id), then **Deploy**
5. Open **Storage** on the settings page and choose where new uploads go; click **Back up** to copy existing files

### Troubleshooting

| Symptom | Cause and fix |
|------|------|
| Sign-in says "This sign-in method is not configured on the server" | `SESSION_SECRET` is missing, or this page's password is (`UPLOAD_PASSWORD` for uploads; `ADMIN_USER` and `ADMIN_PASSWORD` for admin). Check the spelling under Variables and Secrets |
| "Incorrect password" although it is right | Look for stray spaces or line breaks around the value |
| Script upload returns 401 | `UPLOAD_TOKEN` is missing or differs from the one in your script |
| Images on your blog do not load | Hotlink protection is on but your blog is not in "Allowed sites" |
| Downloaded images are smaller than uploaded and HDR is gone | Polish is enabled on the zone (Pro plans and up). Under the domain's **Rules**, add a Configuration Rule matching the image host's hostname with Polish off |

</details>

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

[AGPL-3.0-or-later](../LICENSE). Icons from [Material Icons](https://github.com/google/material-design-icons) (Apache-2.0); in-browser encoders from [jSquash](https://github.com/jamsinclair/jSquash) (Apache-2.0) and video processing by [Mediabunny](https://github.com/Vanilagy/mediabunny) (MPL-2.0), both copied at build time, not in this repository.
