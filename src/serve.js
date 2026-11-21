// GET/HEAD /file/<key>：Cache API → R2 → 回源旧图床（取回后写入 R2）
// 原样返回字节，不做任何转换；no-transform 让 Polish 等功能不处理图片（HDR 增益图要靠这个保住）
import { mimeFromName } from './mime.js';
import { storesFor, writeStore } from './stores.js';
import { getSettings } from './settings.js';

const LONG_CACHE = 'public, max-age=31536000, immutable, no-transform';
const MISS_CACHE = 'public, max-age=60';
const CACHE_PUT_LIMIT = 512 * 1024 * 1024; // Cache API 单个对象上限
const LEGACY_LIMIT = 100 * 1024 * 1024; // 回源迁移时整个读进内存，超过就只转发不迁移
// 防盗链内建放行的网页版 RSS 阅读器（含所有子域名）：它们会带自己域名的 Referer（App 版通常不带，本来就放行）。
// 博客等其他网站由管理页填写（设置里的 allow）；图床自己的域名另外放行
const RSS_READERS = [
  'feedly.com', 'inoreader.com', 'innoreader.com', 'newsblur.com', 'theoldreader.com', 'feedbin.com', 'bazqux.com',
  'follow.is', 'folo.is', 'feeder.co', 'netvibes.com', 'qireader.com', 'commafeed.com', 'readwise.io', 'feedspot.com',
];

export async function serveFile(request, env, ctx, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  let key;
  try {
    key = decodeURIComponent(url.pathname.slice('/file/'.length));
  } catch {
    return plain(400, 'Bad file key');
  }
  if (!key || key.startsWith('.')) return plain(404, 'Not Found'); // . 开头是内部对象（设置等）

  // 防盗链放在查缓存之前：缓存里的回应不分来源，判断只看 Referer 和设置（设置在内存里缓存，不额外耗时）
  const settings = await getSettings(env);
  if (settings.hotlink && !settings.exemptSet.has(key) && !refererAllowed(request, url, settings)) {
    return plain(403, 'Hotlinking not allowed');
  }

  // 缓存键只取路径，忽略查询串，防止被人用 ?x=1 刷穿缓存
  const cacheUrl = url.origin + url.pathname;
  const cache = caches.default;
  const hit = await cache.match(new Request(cacheUrl, { headers: conditionalHeaders(request) }));
  if (hit) return request.method === 'HEAD' ? withoutBody(hit) : hit;

  for (const store of storesFor(env, key)) {
    const res = await fromStore(store.bucket, key, request);
    if (res) {
      if (res.status === 200 && request.method === 'GET') maybeCache(ctx, cache, cacheUrl, res);
      return res;
    }
  }

  return fromLegacy(request, env, ctx, key, cache, cacheUrl);
}

// 读 R2：找不到返回 null；支持 Range、If-None-Match/If-Modified-Since
async function fromStore(bucket, key, request) {
  if (request.method === 'HEAD') {
    const obj = await bucket.head(key);
    return obj && new Response(null, { status: 200, headers: objectHeaders(obj, key) });
  }

  let obj;
  try {
    obj = await bucket.get(key, { range: request.headers, onlyIf: request.headers });
  } catch (err) {
    // 范围越界等情况 R2 会抛错
    const head = await bucket.head(key);
    if (!head) return null;
    if (request.headers.has('Range')) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
    }
    throw err;
  }
  if (obj === null) return null;

  const headers = objectHeaders(obj, key);
  if (!('body' in obj)) return new Response(null, { status: 304, headers }); // 条件请求命中

  if (obj.range && request.headers.has('Range')) {
    const { start, end } = rangeOf(obj.range, obj.size);
    headers.set('Content-Range', `bytes ${start}-${end}/${obj.size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}

// 回源旧图床：取整个文件 → 写入当前桶 → 再按原请求（可能带 Range）从 R2 返回
async function fromLegacy(request, env, ctx, key, cache, cacheUrl) {
  // 旧图床只有「13 位时间戳_文件名」格式，且只有切换之前的；新 key 被删后不该再回源
  const ts = Number(/^(\d{13})_/.exec(key)?.[1]);
  const before = Number(env.LEGACY_BEFORE) || Infinity;
  if (!env.LEGACY_ORIGIN || !(ts < before)) return notFound();

  let upstream;
  try {
    upstream = await fetch(`${env.LEGACY_ORIGIN}/file/${encodeURIComponent(key)}`, { redirect: 'manual' });
  } catch {
    return plain(502, 'Legacy origin unreachable');
  }
  const type = upstream.headers.get('Content-Type') || '';
  // 旧图床找不到时返回 404，被拦截时可能重定向或返回 HTML；都当作不存在。
  // 404 缓存 60 秒，免得同一个不存在的地址每次都回源
  if (upstream.status !== 200 || /^text\/html/i.test(type)) {
    const res = notFound();
    if (request.method === 'GET') ctx.waitUntil(cache.put(new Request(cacheUrl), res.clone()).catch(() => {}));
    return res;
  }

  const length = Number(upstream.headers.get('Content-Length'));
  if (length > LEGACY_LIMIT) {
    const headers = new Headers(upstream.headers);
    headers.set('Cache-Control', 'public, max-age=86400, no-transform');
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: 200, headers });
  }

  const body = await upstream.arrayBuffer();
  const store = writeStore(env);
  await store.bucket.put(key, body, {
    httpMetadata: { contentType: type || mimeFromName(key), contentDisposition: 'inline' },
    customMetadata: { source: 'legacy' },
  });
  console.log(JSON.stringify({ event: 'legacy-migrated', key, size: body.byteLength, store: store.binding }));

  const res = await fromStore(store.bucket, key, request);
  if (res && res.status === 200 && request.method === 'GET') maybeCache(ctx, cache, cacheUrl, res);
  return res ?? notFound();
}

function objectHeaders(obj, key) {
  const h = new Headers();
  obj.writeHttpMetadata(h);
  if (!h.has('Content-Type')) h.set('Content-Type', mimeFromName(key));
  if (!h.has('Content-Disposition')) h.set('Content-Disposition', 'inline');
  h.set('Cache-Control', LONG_CACHE);
  h.set('ETag', obj.httpEtag);
  h.set('Last-Modified', obj.uploaded.toUTCString());
  h.set('Accept-Ranges', 'bytes');
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag');
  h.set('X-Content-Type-Options', 'nosniff');
  // SVG 可以带脚本：禁止执行，防止被当成 XSS 跳板
  if (/^image\/svg\+xml/i.test(h.get('Content-Type'))) {
    h.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
  return h;
}

// 没有 Referer（直接打开、RSS 阅读器、大部分 App）放行；来自博客、图床自身的放行
function refererAllowed(request, url, settings) {
  const ref = request.headers.get('Referer');
  if (!ref) return true;
  let host;
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === url.hostname) return true;
  if (settings.domainSet.has(host)) return true;
  const match = (d) => host === d || host.endsWith(`.${d}`);
  return settings.allow.some(match) || RSS_READERS.some(match);
}

function rangeOf(range, size) {
  if ('suffix' in range && range.suffix !== undefined) {
    const len = Math.min(range.suffix, size);
    return { start: size - len, end: size - 1 };
  }
  const start = range.offset ?? 0;
  const len = range.length ?? size - start;
  return { start, end: Math.min(start + len, size) - 1 };
}

function maybeCache(ctx, cache, cacheUrl, res) {
  if (Number(res.headers.get('Content-Length')) > CACHE_PUT_LIMIT) return;
  ctx.waitUntil(
    cache.put(new Request(cacheUrl), res.clone()).catch((err) => console.warn('cache.put failed', err.message)),
  );
}

// 只把条件请求和 Range 头带进缓存查询，Cache API 会据此返回 304 / 206
function conditionalHeaders(request) {
  const h = new Headers();
  for (const name of ['Range', 'If-None-Match', 'If-Modified-Since']) {
    const v = request.headers.get(name);
    if (v) h.set(name, v);
  }
  return h;
}

function withoutBody(res) {
  return new Response(null, { status: res.status, headers: res.headers });
}

function notFound() {
  return plain(404, 'Not Found', MISS_CACHE);
}

function plain(status, text, cacheControl = 'no-store') {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': cacheControl },
  });
}
