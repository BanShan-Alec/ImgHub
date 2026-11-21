// /api/*：登录、上传、删除、列表。权限见 auth.js：upload 角色可上传、可撤回 24 小时内的上传；admin 角色全部可做
// 错误只返回代码（error 字段），由前端按语言翻译
import { pickContentType } from './mime.js';
import { allStores, BRAND, keyTime, writeStore } from './stores.js';
import { BG_INTERVALS, MAX_BG, MAX_DOMAINS, MAX_LINKS, MAX_SITES, getSettings, normBgUrl, normLink, normSite, publicSettings, saveSettings, siteInfo } from './settings.js';
import { RSS_READERS } from './serve.js';
import { hasRole, identify, login, logoutCookie, sameOrigin } from './auth.js';

// 只对 Bearer 调用开放跨域；Cookie 会话是 SameSite=Strict，跨域请求本来就带不上
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};
const UNDO_WINDOW = 24 * 3600 * 1000;

export async function handleApi(request, env, ctx, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const path = url.pathname;
  const method = request.method;
  if (path === '/api/ping' && method === 'GET') return json({ ok: true });
  if (path === '/api/login' && method === 'POST') {
    const r = await login(request, env, url);
    return json(r.body, r.status, r.cookie);
  }
  if (path === '/api/logout' && method === 'POST') return json({ ok: true }, 200, logoutCookie(url));
  // 登录页也要用：背景图与页脚链接（不含任何需要保密的设置）
  if (path === '/api/site' && method === 'GET') return json(siteInfo(await getSettings(env)));

  const role = await identify(request, env);
  if (path === '/api/session' && method === 'GET') {
    // domains：已登录时告诉前端还能用哪些域名生成链接
    const domains = role ? (await getSettings(env)).domains : undefined;
    return json({ role, user: role === 'admin' ? env.ADMIN_USER : undefined, domains });
  }
  if (!role) return json({ error: 'unauthorized' }, 401);
  if (method !== 'GET' && !sameOrigin(request, url)) return json({ error: 'bad_origin' }, 403);

  if (path === '/api/upload' && method === 'POST') return upload(request, env, url);
  if (path.startsWith('/api/file/') && method === 'DELETE') {
    let key;
    try {
      key = decodeURIComponent(path.slice('/api/file/'.length));
    } catch {
      return json({ error: 'bad_key' }, 400);
    }
    if (!key) return json({ error: 'bad_key' }, 400);
    if (!hasRole(role, 'admin') && !recent(key)) return json({ error: 'forbidden' }, 403);
    await removeKeys(env, url, [key]);
    return json({ ok: true, key });
  }

  if (!hasRole(role, 'admin')) return json({ error: 'forbidden' }, 403);
  if (path === '/api/list' && method === 'GET') return list(env, url);
  if (path === '/api/stats' && method === 'GET') return stats(env);
  if (path === '/api/settings' && method === 'GET') return json({ ...publicSettings(await getSettings(env)), rssReaders: RSS_READERS });
  if (path === '/api/settings' && method === 'POST') {
    // {hotlink?, rss?: boolean, allow?, domains?: string[], bg?: {urls?, login?, upload?, interval?}, links?: [{name, url}]}，至少给一项
    const body = await request.json().catch(() => null);
    const next = {};
    for (const f of ['hotlink', 'rss']) {
      if (!(f in (body ?? {}))) continue;
      if (typeof body[f] !== 'boolean') return json({ error: 'bad_request' }, 400);
      next[f] = body[f];
    }
    if ('allow' in (body ?? {})) {
      if (!Array.isArray(body.allow) || body.allow.length > MAX_SITES) return json({ error: 'bad_request' }, 400);
      const sites = body.allow.map(normSite);
      const bad = body.allow.find((_, i) => !sites[i]);
      if (bad !== undefined) return json({ error: 'bad_site', site: String(bad) }, 400);
      next.allow = sites;
    }
    if ('domains' in (body ?? {})) {
      if (!Array.isArray(body.domains) || body.domains.length > MAX_DOMAINS) return json({ error: 'bad_request' }, 400);
      const hosts = body.domains.map(normSite);
      const bad = body.domains.find((_, i) => !hosts[i]);
      if (bad !== undefined) return json({ error: 'bad_site', site: String(bad) }, 400);
      next.domains = hosts;
    }
    if ('links' in (body ?? {})) {
      if (!Array.isArray(body.links) || body.links.length > MAX_LINKS) return json({ error: 'bad_request' }, 400);
      const links = body.links.map(normLink);
      const bad = body.links.find((_, i) => !links[i]);
      if (bad !== undefined) return json({ error: 'bad_link', site: String(bad?.url ?? '') }, 400);
      next.links = links;
    }
    let bgPatch;
    if ('bg' in (body ?? {})) {
      const b = body.bg;
      if (!b || typeof b !== 'object') return json({ error: 'bad_request' }, 400);
      if ('urls' in b) {
        if (!Array.isArray(b.urls) || b.urls.length > MAX_BG) return json({ error: 'bad_request' }, 400);
        const urls = b.urls.map(normBgUrl);
        const bad = b.urls.find((_, i) => !urls[i]);
        if (bad !== undefined) return json({ error: 'bad_url', site: String(bad) }, 400);
        b.urls = urls;
      }
      delete b.keys;
      if (('login' in b && typeof b.login !== 'boolean') || ('upload' in b && typeof b.upload !== 'boolean')) return json({ error: 'bad_request' }, 400);
      if ('interval' in b && !BG_INTERVALS.includes(b.interval)) return json({ error: 'bad_request' }, 400);
      bgPatch = b;
    }
    if (!Object.keys(next).length && !bgPatch) return json({ error: 'bad_request' }, 400);
    const cur = await getSettings(env, { fresh: true });
    if (bgPatch) next.bg = { ...cur.bg, ...bgPatch };
    return json({ ...publicSettings(await saveSettings(env, { ...cur, ...next })), rssReaders: RSS_READERS });
  }
  // POST /api/exempt {keys, on}：单张防盗链开关。on=true 表示这几张允许外链
  if (path === '/api/exempt' && method === 'POST') {
    const body = await request.json().catch(() => null);
    const keys = Array.isArray(body?.keys) ? body.keys.filter((k) => typeof k === 'string' && k && !k.startsWith('.')) : [];
    if (!keys.length || keys.length > 1000 || typeof body.on !== 'boolean') return json({ error: 'bad_request' }, 400);
    const cur = await getSettings(env, { fresh: true });
    const set = new Set(cur.exempt);
    for (const k of keys) body.on ? set.add(k) : set.delete(k);
    return json({ ...publicSettings(await saveSettings(env, { ...cur, exempt: [...set] })), rssReaders: RSS_READERS });
  }
  if (path === '/api/delete' && method === 'POST') {
    const body = await request.json().catch(() => null);
    const keys = Array.isArray(body?.keys) ? body.keys.filter((k) => typeof k === 'string' && k) : [];
    if (!keys.length || keys.length > 100) return json({ error: 'bad_key' }, 400);
    await removeKeys(env, url, keys);
    return json({ ok: true, deleted: keys.length });
  }
  return json({ error: 'not_found' }, 404);
}

// upload 角色只能撤回 24 小时内上传的文件（按 key 里的上传时间判断）
function recent(key) {
  const ts = keyTime(key);
  return Number.isFinite(ts) && Date.now() - ts < UNDO_WINDOW && ts <= Date.now() + 60000;
}

// POST /api/upload?name=<原文件名>&naming=std|original，请求体就是文件本身（不用 multipart，直接流式写进 R2）
// naming 默认 std（规范命名）；original 为「13 位时间戳_原文件名」，与旧图床格式相同
async function upload(request, env, url) {
  const length = Number(request.headers.get('Content-Length'));
  if (!request.body || !Number.isFinite(length) || length <= 0) return json({ error: 'empty_body' }, 411);

  const name = sanitizeName(url.searchParams.get('name') || 'file');
  const contentType = pickContentType(name, request.headers.get('Content-Type'));
  const store = writeStore(env);
  const original = url.searchParams.get('naming') === 'original';

  // 冲突概率极低（同毫秒同名 / 同秒且 20 位随机码相同），仍然检查一下
  let ts = Date.now();
  let key = original ? `${ts}_${name}` : stdName(ts, name);
  for (let i = 0; i < 5 && (await store.bucket.head(key)); i++) key = original ? `${++ts}_${name}` : stdName(ts, name);

  const fileName = original ? name : key;
  const obj = await store.bucket.put(key, request.body, {
    httpMetadata: {
      contentType,
      contentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
    customMetadata: original ? undefined : { name },
  });

  // 从哪个域名进来就用哪个域名；要换成其他绑定域名由前端改写（见 ui.js 的 linkOf）
  return json({ key, url: `${url.origin}/file/${encodeURIComponent(key)}`, size: obj.size, contentType, store: store.binding });
}

// 规范名：ImgHub-YYYYMMDD-HHmmss-xxxx.ext，时间按 UTC+8；随机码用去掉 0/o/1/l 的 32 个字符，防同秒冲突、也防按时间猜链接
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz';
export function stdName(ts, name) {
  const d = new Date(ts + 8 * 3600 * 1000).toISOString(); // 2026-11-21T15:30:45.123Z（已是 UTC+8 的钟面）
  const stamp = `${d.slice(0, 10).replaceAll('-', '')}-${d.slice(11, 19).replaceAll(':', '')}`;
  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => ALPHABET[b & 31]).join('');
  const ext = /\.([a-z0-9]{1,8})$/i.exec(name)?.[1].toLowerCase().replace(/^jpeg$/, 'jpg');
  return `${BRAND}-${stamp}-${rand}${ext ? `.${ext}` : ''}`;
}

// GET /api/list?cursor=&limit=：只列当前写入桶，按 R2 的字典序（即时间顺序）
async function list(env, url) {
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 1000);
  const store = writeStore(env);
  const res = await store.bucket.list({
    limit,
    cursor: url.searchParams.get('cursor') || undefined,
    prefix: url.searchParams.get('prefix') || undefined,
    include: ['httpMetadata', 'customMetadata'],
  });
  return json({
    items: res.objects.filter((o) => !o.key.startsWith('.')).map((o) => ({
      key: o.key,
      name: o.customMetadata?.name,
      url: `${url.origin}/file/${encodeURIComponent(o.key)}`,
      size: o.size,
      contentType: o.httpMetadata?.contentType,
      uploaded: o.uploaded,
    })),
    cursor: res.truncated ? res.cursor : null,
  });
}

// 从所有桶删除。Cache API 只能清当前机房的缓存，其他机房要等过期或在面板清除
async function removeKeys(env, url, keys) {
  const stores = allStores(env);
  await Promise.all(stores.map((s) => s.bucket.delete(keys)));
  // 顺手把它们从防盗链豁免名单里拿掉（背景图是自由填写的地址，不跟着删）
  const cur = await getSettings(env, { fresh: true });
  const origins = [...new Set([url.origin, ...cur.domains.map((d) => `https://${d}`)])];
  const gone = new Set(keys);
  if (keys.some((k) => cur.exemptSet.has(k))) {
    await saveSettings(env, { ...cur, exempt: cur.exempt.filter((k) => !gone.has(k)) });
  }
  await Promise.all(
    keys.flatMap((key) => {
      const path = `/file/${encodeURIComponent(key)}`;
      return origins.map((o) => caches.default.delete(new Request(o + path)));
    }),
  );
}

// GET /api/stats：遍历当前写入桶统计数量和总大小（最多 20 页 = 2 万个对象，够用很久）
async function stats(env) {
  const store = writeStore(env);
  let cursor;
  let count = 0;
  let bytes = 0;
  let pages = 0;
  do {
    const res = await store.bucket.list({ limit: 1000, cursor });
    for (const o of res.objects) {
      if (o.key.startsWith('.')) continue;
      count++;
      bytes += o.size;
    }
    cursor = res.truncated ? res.cursor : undefined;
  } while (cursor && ++pages < 20);
  return json({ count, bytes, partial: Boolean(cursor) });
}

// 文件名：保留中文等 Unicode，去掉路径分隔符、URL 特殊字符和控制字符，空白换成下划线
export function sanitizeName(raw) {
  let name = raw
    .normalize('NFC')
    .replace(/[\\/?#%&*:"<>|\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '');
  if ([...name].length > 120) name = [...name].slice(-120).join('');
  return name || 'file';
}

function json(data, status = 200, cookie) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(JSON.stringify(data), { status, headers });
}
