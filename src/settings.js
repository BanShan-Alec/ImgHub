// 运行时设置（后台可改）：存成主桶里的一个 JSON 对象，读路径在 isolate 内存里缓存 30 秒。
// 放 R2 而不是 KV / vars：不用多建资源，改了不用重新部署；读路径每个 isolate 每 30 秒最多读一次。
//
// 防盗链语义：hotlink=true 时全局开启；exempt 里的 key 单独放行（单张开关）。
// 单张设置不写进对象的 customMetadata，因为图片回应会在 Cache API 里缓存一年，
// 改了 metadata 也清不掉其他机房的缓存；放在设置里则所有机房 30 秒内生效。
import { configStore } from './stores.js';

export const SETTINGS_KEY = '.imghub/settings.json';
const TTL = 30 * 1000;
const DEFAULTS = { hotlink: true, exempt: [] };

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
  memo = normalize(data);
  memo.exemptSet = new Set(memo.exempt);
  memoAt = Date.now();
  return memo;
}

export async function saveSettings(env, next) {
  const data = normalize(next);
  await configStore(env).bucket.put(SETTINGS_KEY, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' },
  });
  memo = { ...data, exemptSet: new Set(data.exempt) };
  memoAt = Date.now();
  return data;
}

// 只保留已知字段，exempt 去重
function normalize(d) {
  return {
    hotlink: typeof d?.hotlink === 'boolean' ? d.hotlink : DEFAULTS.hotlink,
    exempt: Array.isArray(d?.exempt) ? [...new Set(d.exempt.filter((k) => typeof k === 'string' && k))] : [],
  };
}

export function publicSettings(s) {
  return { hotlink: s.hotlink, exempt: s.exempt };
}
