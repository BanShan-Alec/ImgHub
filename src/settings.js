// 运行时设置（后台可改）：存成主桶里的一个 JSON 对象，读路径在 isolate 内存里缓存 30 秒。
// 放 R2 而不是 KV / vars：不用多建资源，改了不用重新部署；读路径每个 isolate 每 30 秒最多读一次。
//
// 防盗链语义：hotlink=true 时全局开启；allow 是后台填的放行网站（含子域）；exempt 里的 key 单独放行（单张开关）。
// 单张设置不写进对象的 customMetadata，因为图片回应会在 Cache API 里缓存一年，
// 改了 metadata 也清不掉其他机房的缓存；放在设置里则所有机房 30 秒内生效。
import { configStore } from './stores.js';

export const SETTINGS_KEY = '.imghub/settings.json';
const TTL = 30 * 1000;
// 没有设置对象时：防盗链关闭，放行名单预置三项（本站两个博客 + 示例域名，部署者在管理页改成自己的）
const DEFAULTS = { hotlink: false, allow: ['awads.cc', 'awavenue.top', 'example.com'], exempt: [] };
export const MAX_SITES = 200;

let memo = null;
let memoAt = 0;

// fresh：改设置前读最新值，免得用了本 isolate 里过期的副本、覆盖掉别处刚写的修改
export async function getSettings(env, { fresh = false } = {}) {
  if (!fresh && memo && Date.now() - memoAt < TTL) return memo;
  let data = {};
  try {
    const obj = await configStore(env).bucket.get(SETTINGS_KEY);
    if (obj) data = await obj.json();
  } catch (err) {
    console.warn('settings read failed', err.message);
    if (memo) return memo; // 读失败时沿用旧值，别因此放开防盗链
  }
  memo = withSets(normalize(data));
  memoAt = Date.now();
  return memo;
}

export async function saveSettings(env, next) {
  const data = normalize(next);
  await configStore(env).bucket.put(SETTINGS_KEY, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' },
  });
  memo = withSets(data);
  memoAt = Date.now();
  return data;
}

const withSets = (d) => ({ ...d, exemptSet: new Set(d.exempt) });

// 只保留已知字段；allow 规范化成主机名，exempt 去重
function normalize(d) {
  return {
    hotlink: typeof d?.hotlink === 'boolean' ? d.hotlink : DEFAULTS.hotlink,
    allow: Array.isArray(d?.allow) ? [...new Set(d.allow.map(normSite).filter(Boolean))].slice(0, MAX_SITES) : [...DEFAULTS.allow],
    exempt: Array.isArray(d?.exempt) ? [...new Set(d.exempt.filter((k) => typeof k === 'string' && k))] : [],
  };
}

// 后台填的网站 → 小写主机名。接受 blog.example.com、https://example.com/path、*.example.com、中文域名（转成 punycode）；
// 不合法返回 null。example.com 同时放行它的所有子域
export function normSite(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase().replace(/^\*?\./, '');
  if (!s || s.length > 253) return null;
  try {
    const host = new URL(s.includes('://') ? s : `http://${s}`).hostname;
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

export function publicSettings(s) {
  return { hotlink: s.hotlink, allow: s.allow, exempt: s.exempt };
}
