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

<details>
<summary>展开部署步骤</summary>

准备：一个 Cloudflare 账户（免费版即可）和一个 GitHub 账户。想用自己的域名，域名需要已经托管在 Cloudflare。

### 第 1 步：一键部署

1. 点上方 **Deploy to Cloudflare** 按钮，登录 Cloudflare
2. 按提示连接 GitHub 并授权。Cloudflare 会把本仓库复制一份到你的 GitHub 账户，以后在那里改代码会自动重新部署
3. 项目名称保持 `cf-imghub` 或自己改
4. R2 桶保持新建，名称可以改
5. 依次填写下面 5 个密钥（页面上每项都附有说明）：

   | 名称 | 填什么 |
   |------|------|
   | `SESSION_SECRET` | 一串随机长字符串，用来签名登录会话 |
   | `UPLOAD_PASSWORD` | 上传页的密码 |
   | `ADMIN_USER` | 管理页的账号 |
   | `ADMIN_PASSWORD` | 管理页的密码 |
   | `UPLOAD_TOKEN` | 脚本上传用的 Token；不用脚本也请填一串随机字符 |

   随机字符串可以用密码管理器生成，或在终端运行 `openssl rand -hex 32`。名称区分大小写，值的前后不要带空格
6. 点页面底部的部署按钮，等待构建完成（约 1–2 分钟）

完成后会得到一个 `https://cf-imghub.<你的子域>.workers.dev` 地址，已经可以打开使用。

### 第 2 步：绑定自己的域名（推荐）

`workers.dev` 地址用不上 Cloudflare 的边缘缓存，每次都要读 R2，正式使用请绑定域名：

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/)，左侧选「Workers 和 Pages」，点进 `cf-imghub`
2. 进入「设置」→「域和路由」→「添加」→「自定义域」
3. 填写子域名，如 `img.example.com`，确认。DNS 记录和证书会自动创建，几分钟内生效

### 第 3 步：确认可以用

1. 打开 `https://img.example.com/`，输入上传密码，传一张图片，复制返回的链接在新标签页打开
2. 打开 `https://img.example.com/admin`，用管理账号登录，能看到刚才那张图

**防盗链默认关闭。**要开启时，先在管理页的「放行网站」把预置的示例域名换成你博客的域名（子域名一并放行），再打开开关，否则博客里的图片会被拦下。

### 以后修改密码或设置

都在「Workers 和 Pages」→ `cf-imghub` →「设置」→「变量和机密」：

- **修改**：点该项右侧的编辑，填入新的「值」，再点「部署」
- **新增**：点「添加」，类型选「**密钥**」，填写「变量名称」和「值」，再点「部署」
- 密码类一律选「密钥」；选「文本」也能用，但值会明文显示在面板上
- 修改 `SESSION_SECRET` 会让所有人重新登录；修改某个密码只会让对应的登录失效

多个域名：在 Worker 的「设置 → 域和路由」再添加自定义域即可，链接默认跟随打开页面时的域名。把这些域名登记在管理页的「链接域名」后，上传页和管理页顶栏会出现地球按钮，可随时切换链接用哪个域名。

### 常见问题

| 现象 | 原因与处理 |
|------|------|
| 登录时提示「服务器尚未设置这种登录方式」 | 缺少 `SESSION_SECRET`，或缺少这个页面的密码（上传页要 `UPLOAD_PASSWORD`，管理页要 `ADMIN_USER` 和 `ADMIN_PASSWORD`）。到「变量和机密」核对名称拼写 |
| 提示「密码不正确」，但确定没输错 | 检查「值」的前后是否多了空格或换行 |
| 脚本上传返回 401 | `UPLOAD_TOKEN` 没设置，或与脚本里用的不一致 |
| 博客里的图片显示不出来 | 开了防盗链，但「放行网站」里没有博客的域名 |
| 下载回来的图片比上传时小、HDR 效果没了 | 域名所在区域开了 Polish（Pro 及以上套餐才有）。在该域名的「规则」里新建一条配置规则（Configuration Rule）：主机名等于图床域名，Polish 设为关闭 |

</details>

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
