# CF-ImgHub

**简体中文** · [繁體中文](assets/README.zh-Hant.md) · [English](assets/README.en.md)

跑在 Cloudflare Workers + R2 上的自建图床，小而快。图片**原样存取**，服务端不做任何压缩或转码，HDR 增益图（Ultra HDR）和实况照片（Motion Photo）都能完整保留。

## 特点

- **快**：读路径不查数据库，Cache API → R2 直接返回；支持 `Range`/206、`ETag`/304，回应带 `immutable, no-transform`，Cloudflare Polish 等功能不会改动图片
- **原样保存**：Worker 只搬字节。需要压缩时在**浏览器里**转码（AVIF / WebP / JPEG / PNG，三档质量，可限制最长边），ico、svg、gif、动图、HDR、实况照片、视频会自动原样上传
- **防盗链**：全局开关 + 单张图片开关，默认开启；无 Referer 的请求（直接打开、RSS App）与放行名单内的站点不受限
- **两种命名**：规范命名 `ImgHub-20261121-153045-k7q2.avif`（上传时间 + 随机码），或保持原文件名 `<毫秒时间戳>_<原名>`
- **旧图床平滑迁移**：R2 里找不到的旧链接会回源旧图床，取回后写入 R2（访问时迁移）
- **上传页与管理页**：Material 3 Expressive 风格界面，亮/暗色，简体中文 / 繁體中文 / English
- **两种角色**：上传（只要密码，可撤回 24 小时内的上传）与管理（账号 + 密码，浏览、搜索、预览、批量删除、防盗链设置）；脚本可用 Bearer Token 上传

## 架构

```text
GET/HEAD /file/<key>   防盗链判断 → Cache API → R2 → 回源旧图床（可选）
/api/*                 登录、上传、删除、列表、统计、设置
其余路径               静态资源 public/（上传页 /、管理页 /admin）
```

| 路径 | 说明 |
|------|------|
| `src/serve.js` | 读文件、缓存、Range、防盗链、回源迁移 |
| `src/api.js` | 上传、删除、列表、统计、设置 API |
| `src/auth.js` | 无状态签名 Cookie 会话、登录限速 |
| `src/stores.js` | 按 key 里的上传时间选桶（预留多桶分流） |
| `src/settings.js` | 运行时设置（存于 R2 的 `.imghub/settings.json`） |
| `public/` | 上传页、管理页、浏览器端转码 Worker |

## 部署

需要 Node.js 22.12+ 和一个 Cloudflare 账户。

```bash
npm install
npx wrangler r2 bucket create cf-imghub

# 设置密钥（会提示输入值）
npx wrangler secret put SESSION_SECRET    # 随机长字符串，轮换即让所有人重新登录
npx wrangler secret put UPLOAD_PASSWORD   # 上传页密码
npx wrangler secret put ADMIN_USER        # 管理账号
npx wrangler secret put ADMIN_PASSWORD    # 管理密码
npx wrangler secret put UPLOAD_TOKEN      # 可选：脚本上传用的 Bearer Token

npm run deploy
```

然后在 Cloudflare 面板给 Worker 绑定自定义域名。`wrangler.jsonc` 的 `vars`：

| 变量 | 说明 |
|------|------|
| `STORES` | 存储路由表，按上传时间选桶；新上传写最后一项 |
| `LEGACY_ORIGIN` | 旧图床地址，R2 找不到时回源；留空关闭 |
| `LEGACY_BEFORE` | 只有早于此毫秒时间戳的旧格式 key 才回源；0 = 不限 |
| `PUBLIC_BASE` | 返回给上传者的链接前缀；留空用当前域名 |

## 本地开发

在项目根目录建 `.dev.vars`，写入上面 5 个密钥（`KEY=value` 每行一个），然后：

```bash
npm run dev
```

`npm run dev` / `npm run deploy` 会先执行 `npm run vendor`，把 jSquash 编码器从 `node_modules` 复制到 `public/vendor/`。

## 用脚本上传

```bash
curl -H "Authorization: Bearer $UPLOAD_TOKEN" \
     -H "Content-Type: image/avif" \
     --data-binary @photo.avif \
     "https://img.example.com/api/upload?name=photo.avif"
# 加 &naming=original 保持原文件名
```

## 授权

[AGPL-3.0-or-later](LICENSE)。图标来自 [Material Icons](https://github.com/google/material-design-icons)（Apache-2.0）；浏览器端编码器来自 [jSquash](https://github.com/jamsinclair/jSquash)（Apache-2.0，构建时复制，不在仓库中）。
