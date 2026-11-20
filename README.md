<p align="center">
  <img src="assets/logo.svg" width="112" alt="CF-ImgHub">
</p>

<h1 align="center">CF-ImgHub</h1>

<p align="center">
  为个人博客打造的图床，跑在 Cloudflare Workers + R2 上。<br>
  快，在浏览器里压缩，原样保存实况照片与 HDR。
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/TG-Twilight/CF-ImgHub"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"></a>
</p>

<p align="center">
  <b>简体中文</b> · <a href="assets/README.zh-Hant.md">繁體中文</a> · <a href="assets/README.en.md">English</a>
</p>

## 为什么用它

### 快

图片直接从 Cloudflare 边缘返回：先查边缘缓存，没命中就读同一网络里的 R2，**读取路径上没有数据库，也不绕道第三方存储**。

回应支持 `Range`（视频可拖动）、`ETag`/304，并带 `Cache-Control: immutable, no-transform`，浏览器缓存一年；Cloudflare Polish 等优化也不会再改动图片。

### 在浏览器里压缩

上传前在你自己的浏览器里转码，服务器只存最终的字节：

- 自动模式转 **AVIF**，也可以指定 WebP / JPEG / PNG，或完全不压缩
- 三档质量，可限制最长边；多张图并行处理（Web Worker）
- 压完反而变大时自动用原图；本来就是 AVIF / WebP / JXL 的图不重复压缩

### 实况照片与 HDR 完整保留

手机拍的**实况照片**（Motion Photo，一个 JPEG 里带着一段视频）和 **Ultra HDR** 照片（JPEG + 增益图），一经压缩，视频和 HDR 信息就会丢失。CF-ImgHub 上传时会**逐张检查文件内容**，认出以下格式就跳过压缩、原样上传：

- 实况照片：Google Motion Photo、OPPO / 一加 / realme 的 O Live
- HDR：Ultra HDR / ISO 21496-1 增益图 JPEG，带增益图的 HEIF / AVIF
- 动图（GIF、APNG、动态 WebP / AVIF）、SVG、ICO、视频

服务器从不改动文件字节，所以下载回来和手机里的原档一模一样。Ultra HDR 图片在支持 HDR 的屏幕上用 Chrome / Edge 打开会自动显示高亮。

## 其他功能

- **上传页与管理页**：Material 3 Expressive 界面，亮 / 暗色，简体中文 / 繁體中文 / English
- **两种身份**：上传者只需密码，可撤回 24 小时内的上传；管理员可浏览、搜索、预览、批量删除和设置防盗链
- **防盗链**：在管理页一键开启，放行的网站（含子域名）在管理页填写，也可以单张图片单独放行。没有 Referer 的请求（直接打开、RSS App）和常见网页版 RSS 阅读器不受限
- **易读的文件名**：默认命名为 `ImgHub-20261121-153045-k7q2.avif`（上传时间 + 随机码），也可以保持原文件名
- **脚本上传**：用 Bearer Token 调用 `/api/upload`，方便接入写作流程

## 部署

点上方 **Deploy to Cloudflare** 按钮，按页面提示操作：

1. 用 GitHub 登录 Cloudflare，它会把本仓库复制到你的 GitHub 账户，之后推送代码就会自动重新部署
2. R2 桶会自动创建，名称可以改
3. 填写密钥：

   | 名称 | 说明 |
   |------|------|
   | `SESSION_SECRET` | 随机长字符串，用来签名登录会话；更换即让所有人重新登录 |
   | `UPLOAD_PASSWORD` | 上传页密码 |
   | `ADMIN_USER` / `ADMIN_PASSWORD` | 管理页账号与密码 |
   | `UPLOAD_TOKEN` | 脚本上传用的 Token；不用也请随便填一串随机字符 |

4. 部署完成后，在 Worker 的 **Settings → Domains & Routes** 绑定自定义域名（如 `img.example.com`）

打开 `https://img.example.com/` 是上传页，`/admin` 是管理页。

**防盗链默认关闭。**要开启时，先在管理页的「放行网站」把预置的示例域名换成你博客的域名（子域名一并放行），再打开开关，否则博客里的图片会被拦下。

如果图床同时绑了多个域名，可以在 Worker 的 **Settings → Variables and Secrets** 添加变量 `PUBLIC_BASE`（如 `https://img.example.com`），上传后返回的链接统一用这个域名。

## 用脚本上传

```bash
curl -H "Authorization: Bearer $UPLOAD_TOKEN" \
     -H "Content-Type: image/avif" \
     --data-binary @photo.avif \
     "https://img.example.com/api/upload?name=photo.avif"
# 返回 JSON，其中 url 为图片链接；加 &naming=original 保持原文件名
```

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars   # 填入密钥
npm run dev
```

## 授权

[AGPL-3.0-or-later](LICENSE)。图标来自 [Material Icons](https://github.com/google/material-design-icons)（Apache-2.0）；浏览器端编码器来自 [jSquash](https://github.com/jamsinclair/jSquash)（Apache-2.0，构建时复制，不在仓库中）。
