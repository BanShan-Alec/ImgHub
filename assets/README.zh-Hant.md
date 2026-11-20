# CF-ImgHub

[简体中文](../README.md) · **繁體中文** · [English](README.en.md)

跑在 Cloudflare Workers + R2 上的自架圖床，小而快。圖片**原樣存取**，伺服器端不做任何壓縮或轉碼，HDR 增益圖（Ultra HDR）和實況照片（Motion Photo）都能完整保留。

## 特點

- **快**：讀取路徑不查資料庫，Cache API → R2 直接回應；支援 `Range`/206、`ETag`/304，回應帶 `immutable, no-transform`，Cloudflare Polish 等功能不會改動圖片
- **原樣保存**：Worker 只搬位元組。需要壓縮時在**瀏覽器裡**轉碼（AVIF / WebP / JPEG / PNG，三檔品質，可限制最長邊），ico、svg、gif、動圖、HDR、實況照片、影片會自動原樣上傳
- **防盜連**：全域開關 + 單張圖片開關，預設開啟；沒有 Referer 的請求（直接開啟、RSS App）與放行名單內的網站不受限
- **兩種命名**：規範命名 `ImgHub-20261121-153045-k7q2.avif`（上傳時間 + 隨機碼），或保持原檔名 `<毫秒時間戳>_<原名>`
- **舊圖床平滑遷移**：R2 裡找不到的舊連結會回源舊圖床，取回後寫入 R2（存取時遷移）
- **上傳頁與管理頁**：Material 3 Expressive 風格介面，亮/暗色，简体中文 / 繁體中文 / English
- **兩種角色**：上傳（只要密碼，可撤回 24 小時內的上傳）與管理（帳號 + 密碼，瀏覽、搜尋、預覽、批次刪除、防盜連設定）；腳本可用 Bearer Token 上傳

## 架構

```text
GET/HEAD /file/<key>   防盜連判斷 → Cache API → R2 → 回源舊圖床（可選）
/api/*                 登入、上傳、刪除、列表、統計、設定
其餘路徑               靜態資源 public/（上傳頁 /、管理頁 /admin）
```

| 路徑 | 說明 |
|------|------|
| `src/serve.js` | 讀檔、快取、Range、防盜連、回源遷移 |
| `src/api.js` | 上傳、刪除、列表、統計、設定 API |
| `src/auth.js` | 無狀態簽章 Cookie 工作階段、登入限速 |
| `src/stores.js` | 依 key 裡的上傳時間選桶（預留多桶分流） |
| `src/settings.js` | 執行期設定（存於 R2 的 `.imghub/settings.json`） |
| `public/` | 上傳頁、管理頁、瀏覽器端轉碼 Worker |

## 部署

需要 Node.js 22.12+ 和一個 Cloudflare 帳戶。

```bash
npm install
npx wrangler r2 bucket create cf-imghub

# 設定密鑰（會提示輸入值）
npx wrangler secret put SESSION_SECRET    # 隨機長字串，輪換即讓所有人重新登入
npx wrangler secret put UPLOAD_PASSWORD   # 上傳頁密碼
npx wrangler secret put ADMIN_USER        # 管理帳號
npx wrangler secret put ADMIN_PASSWORD    # 管理密碼
npx wrangler secret put UPLOAD_TOKEN      # 可選：腳本上傳用的 Bearer Token

npm run deploy
```

然後在 Cloudflare 面板為 Worker 綁定自訂網域。`wrangler.jsonc` 的 `vars`：

| 變數 | 說明 |
|------|------|
| `STORES` | 儲存路由表，依上傳時間選桶；新上傳寫入最後一項 |
| `LEGACY_ORIGIN` | 舊圖床位址，R2 找不到時回源；留空則關閉 |
| `LEGACY_BEFORE` | 只有早於此毫秒時間戳的舊格式 key 才回源；0 = 不限 |
| `PUBLIC_BASE` | 回傳給上傳者的連結前綴；留空則用目前網域 |

## 本機開發

在專案根目錄建立 `.dev.vars`，寫入上面 5 個密鑰（`KEY=value` 每行一個），然後：

```bash
npm run dev
```

`npm run dev` / `npm run deploy` 會先執行 `npm run vendor`，把 jSquash 編碼器從 `node_modules` 複製到 `public/vendor/`。

## 用腳本上傳

```bash
curl -H "Authorization: Bearer $UPLOAD_TOKEN" \
     -H "Content-Type: image/avif" \
     --data-binary @photo.avif \
     "https://img.example.com/api/upload?name=photo.avif"
# 加上 &naming=original 保持原檔名
```

## 授權

[AGPL-3.0-or-later](../LICENSE)。圖示來自 [Material Icons](https://github.com/google/material-design-icons)（Apache-2.0）；瀏覽器端編碼器來自 [jSquash](https://github.com/jamsinclair/jSquash)（Apache-2.0，建置時複製，不在倉庫中）。
