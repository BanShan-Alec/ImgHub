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

<details>
<summary>展開部署步驟</summary>

準備：一個 Cloudflare 帳戶（免費版即可）和一個 GitHub 帳戶。想用自己的網域，網域需要已經託管在 Cloudflare。

### 第 1 步：一鍵部署

1. 點上方 **Deploy to Cloudflare** 按鈕，登入 Cloudflare
2. 依提示連接 GitHub 並授權。Cloudflare 會把本倉庫複製一份到你的 GitHub 帳戶，以後在那裡改程式碼會自動重新部署
3. 專案名稱保持 `cf-imghub` 或自己改
4. R2 儲存桶保持新建，名稱可以改
5. 依序填寫下面 5 個密鑰（頁面上每項都附有說明）：

   | 名稱 | 填什麼 |
   |------|------|
   | `SESSION_SECRET` | 一串隨機長字串，用來簽署登入工作階段 |
   | `UPLOAD_PASSWORD` | 上傳頁的密碼 |
   | `ADMIN_USER` | 管理頁的帳號 |
   | `ADMIN_PASSWORD` | 管理頁的密碼 |
   | `UPLOAD_TOKEN` | 腳本上傳用的 Token；不用腳本也請填一串隨機字元 |

   隨機字串可以用密碼管理器產生，或在終端機執行 `openssl rand -hex 32`。名稱區分大小寫，值的前後不要帶空格
6. 點頁面底部的部署按鈕，等待建置完成（約 1–2 分鐘）

完成後會得到一個 `https://cf-imghub.<你的子網域>.workers.dev` 網址，已經可以打開使用。

### 第 2 步：綁定自己的網域（建議）

`workers.dev` 網址用不上 Cloudflare 的邊緣快取，每次都要讀 R2，正式使用請綁定網域：

1. 打開 [Cloudflare 主控台](https://dash.cloudflare.com/)，左側選「Workers 和 Pages」，點進 `cf-imghub`
2. 進入「設定」→「網域和路由」→「新增」→「自訂網域」
3. 填寫子網域，如 `img.example.com`，確認。DNS 記錄和憑證會自動建立，幾分鐘內生效

### 第 3 步：確認可以用

1. 打開 `https://img.example.com/`，輸入上傳密碼，傳一張圖片，複製回傳的連結在新分頁打開
2. 打開 `https://img.example.com/admin`，用管理帳號登入，能看到剛才那張圖

**防盜鏈預設關閉。**要開啟時，先在管理頁的「放行網站」把預置的範例網域換成你部落格的網域（子網域一併放行），再打開開關，否則部落格裡的圖片會被擋下。

### 以後修改密碼或設定

都在「Workers 和 Pages」→ `cf-imghub` →「設定」→「變數和密碼」：

- **修改**：點該項右側的編輯，填入新的「值」，再點「部署」
- **新增**：點「新增」，類型選「**密鑰**」，填寫「變數名稱」和「值」，再點「部署」
- 密碼類一律選「密鑰」；選「文字」也能用，但值會明文顯示在面板上
- 修改 `SESSION_SECRET` 會讓所有人重新登入；修改某個密碼只會讓對應的登入失效

選用設定：圖床綁了多個網域時，可以新增 `PUBLIC_BASE`（類型「文字」，值如 `https://img.example.com`），上傳後回傳的連結統一用這個網域。

### 常見問題

| 現象 | 原因與處理 |
|------|------|
| 登入時提示「伺服器尚未設定這種登入方式」 | 缺少 `SESSION_SECRET`，或缺少這個頁面的密碼（上傳頁要 `UPLOAD_PASSWORD`，管理頁要 `ADMIN_USER` 和 `ADMIN_PASSWORD`）。到「變數和密碼」核對名稱拼寫 |
| 提示「密碼不正確」，但確定沒輸錯 | 檢查「值」的前後是否多了空格或換行 |
| 腳本上傳回傳 401 | `UPLOAD_TOKEN` 沒設定，或與腳本裡用的不一致 |
| 部落格裡的圖片顯示不出來 | 開了防盜鏈，但「放行網站」裡沒有部落格的網域 |
| 下載回來的圖片比上傳時小、HDR 效果沒了 | 網域所在區域開了 Polish（Pro 以上方案才有）。在該網域的「規則」裡新建一條設定規則（Configuration Rule）：主機名稱等於圖床網域，Polish 設為關閉 |

</details>

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
