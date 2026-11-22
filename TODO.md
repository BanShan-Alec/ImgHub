# ImgHub 图床后续待办事项 (TODO)

## 📌 当前已完成状态
- [x] Cloudflare R2 存储桶创建：`cf-imghub`
- [x] Worker 部署成功：`https://cf-imghub.banshan-alec.workers.dev`
- [x] 机密变量配置完成（已注入 Cloudflare Workers）：
  - 上传密码 (`UPLOAD_PASSWORD`)
  - 管理账号与密码 (`ADMIN_USER` / `ADMIN_PASSWORD`)
  - 脚本 API 上传密钥 (`UPLOAD_TOKEN`)
  - 会话加密签名密钥 (`SESSION_SECRET`)
- [x] 登录与上传接口已验证通过（HTTP 200）

---

## ⏳ 待办事项清单 (待用户购买域名后处理)

### 1. 购买独立域名
- [ ] 选购一个便宜的正规顶级域名（用于解决国内访问限制、微信/杀毒软件拦截问题，并开启 Cloudflare CDN 边缘强缓存）
  - **国内推荐**：阿里云 / 腾讯云（`.top`、`.xyz`、`.icu`，首年约 ¥5 ~ ¥10）
  - **海外免实名推荐**：Spaceship / NameSilo（纯数字 `.xyz`，每年约 $0.99）

### 2. 将域名托管到 Cloudflare
- [ ] 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)，点击「添加站点（Add a site）」，输入购买的根域名，选择 **Free** 套餐。
- [ ] 前往域名注册商控制台，将 DNS 服务器（Nameservers）修改为 Cloudflare 分配的 2 个 NS 地址。
- [ ] 等待 Cloudflare 显示站点状态变为「有效（Active）」。

### 3. 绑定自定义子域名到 Worker
- [ ] 进入「Workers 和 Pages」-> `cf-imghub` ->「设置」->「域和路由」->「添加」->「自定义域」。
- [ ] 填写二级域名（例如：`img.yourdomain.com`），点击确认。
- [ ] Cloudflare 会自动配置 DNS 解析与 SSL/TLS 证书。

### 4. 开启图床防盗链与设置优化
- [ ] 打开 `https://img.yourdomain.com/settings`。
- [ ] 在「放行网站」中添加您的博客或个人网站域名。
- [ ] 开启「防盗链」开关，防止他人盗刷图片流量。
- [ ] （可选）如需无上限存储，可按文档配置 Telegram 频道备份存储。
