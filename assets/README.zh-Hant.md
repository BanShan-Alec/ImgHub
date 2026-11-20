<p align="center">
  <img src="logo.svg" width="112" alt="CF-ImgHub">
</p>

<h1 align="center">CF-ImgHub</h1>

<p align="center">
  為個人部落格打造的圖床，跑在 Cloudflare Workers + R2 上。<br>
  快、在瀏覽器裡壓縮、原樣保存實況照片與 HDR。
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/TG-Twilight/CF-ImgHub"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"></a>
</p>

<p align="center">
  <a href="../README.md">简体中文</a> · <b>繁體中文</b> · <a href="README.en.md">English</a>
</p>

## 為什麼用它

### 快

圖片直接從 Cloudflare 邊緣回傳：先查邊緣快取，沒命中就讀同一網路裡的 R2，**讀取路徑上沒有資料庫，也不繞道第三方儲存**。

回應支援 `Range`（影片可拖曳）、`ETag`/304，並帶 `Cache-Control: immutable, no-transform`，瀏覽器快取一年；Cloudflare Polish 等最佳化也不會再改動圖片。

### 在瀏覽器裡壓縮

上傳前在你自己的瀏覽器裡轉檔，伺服器只存最終的位元組：

- 自動模式轉 **AVIF**，也可以指定 WebP / JPEG / PNG，或完全不壓縮
- 三檔品質，可限制最長邊；多張圖平行處理（Web Worker）
- 壓完反而變大時自動用原圖；本來就是 AVIF / WebP / JXL 的圖不重複壓縮

### 實況照片與 HDR 完整保留

手機拍的**實況照片**（Motion Photo，一個 JPEG 裡帶著一段影片）和 **Ultra HDR** 照片（JPEG + 增益圖），一經壓縮，影片和 HDR 資訊就會遺失。CF-ImgHub 上傳時會**逐張檢查檔案內容**，認出以下格式就跳過壓縮、原樣上傳：

- 實況照片：Google Motion Photo、OPPO / 一加 / realme 的 O Live
- HDR：Ultra HDR / ISO 21496-1 增益圖 JPEG、帶增益圖的 HEIF / AVIF
- 動圖（GIF、APNG、動態 WebP / AVIF）、SVG、ICO、影片

伺服器從不改動檔案位元組，下載回來和手機裡的原檔一模一樣。Ultra HDR 圖片在支援 HDR 的螢幕上用 Chrome / Edge 開啟會自動顯示高亮。

## 其他功能

- **上傳頁與管理頁**：Material 3 Expressive 介面，亮 / 暗色，简体中文 / 繁體中文 / English
- **兩種身分**：上傳者只需密碼，可撤回 24 小時內的上傳；管理員可瀏覽、搜尋、預覽、批次刪除和設定防盜連
- **防盜連**：在管理頁一鍵開啟，放行的網站（含子網域）在管理頁填寫，也可以單張圖片單獨放行。沒有 Referer 的請求（直接開啟、RSS App）和常見網頁版 RSS 閱讀器不受限
- **易讀的檔名**：預設命名為 `ImgHub-20261121-153045-k7q2.avif`（上傳時間 + 隨機碼），也可以保持原檔名
- **腳本上傳**：用 Bearer Token 呼叫 `/api/upload`，方便接入寫作流程

## 部署

點上方 **Deploy to Cloudflare** 按鈕，依頁面提示操作：

1. 用 GitHub 登入 Cloudflare，它會把本倉庫複製到你的 GitHub 帳號，之後推送程式碼就會自動重新部署
2. R2 桶會自動建立，名稱可以改
3. 填寫密鑰：

   | 名稱 | 說明 |
   |------|------|
   | `SESSION_SECRET` | 隨機長字串，用來簽署登入工作階段；更換即讓所有人重新登入 |
   | `UPLOAD_PASSWORD` | 上傳頁密碼 |
   | `ADMIN_USER` / `ADMIN_PASSWORD` | 管理頁帳號與密碼 |
   | `UPLOAD_TOKEN` | 腳本上傳用的 Token；不用也請隨便填一串隨機字元 |

4. 部署完成後，在 Worker 的 **Settings → Domains & Routes** 綁定自訂網域（如 `img.example.com`）

開啟 `https://img.example.com/` 是上傳頁，`/admin` 是管理頁。

**防盜連預設關閉。**要開啟時，先在管理頁的「放行網站」把預置的範例網域換成你部落格的網域（子網域一併放行），再打開開關，否則部落格裡的圖片會被擋下。

如果圖床同時綁了多個網域，可以在 Worker 的 **Settings → Variables and Secrets** 新增變數 `PUBLIC_BASE`（如 `https://img.example.com`），上傳後回傳的連結統一用這個網域。

## 用腳本上傳

```bash
curl -H "Authorization: Bearer $UPLOAD_TOKEN" \
     -H "Content-Type: image/avif" \
     --data-binary @photo.avif \
     "https://img.example.com/api/upload?name=photo.avif"
# 回傳 JSON，其中 url 為圖片連結；加 &naming=original 保持原檔名
```

## 本機開發

```bash
npm install
cp .dev.vars.example .dev.vars   # 填入密鑰
npm run dev
```

## 授權

[AGPL-3.0-or-later](../LICENSE)。圖示來自 [Material Icons](https://github.com/google/material-design-icons)（Apache-2.0）；瀏覽器端編碼器來自 [jSquash](https://github.com/jamsinclair/jSquash)（Apache-2.0，建置時複製，不在倉庫中）。
