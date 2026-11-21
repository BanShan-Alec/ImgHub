// 存储路由：按 key 里的上传时间决定在哪个桶，读路径不查数据库。
// 两种 key 都带时间：
//   保持原名  <13 位毫秒时间戳>_<文件名>          （旧图床的链接也是这个格式）
//   规范命名  ImgHub-<YYYYMMDD>-<HHmmss>-<随机>.<扩展名>   （时间是 UTC+8）
// 目前只有 R2 绑定（同账户）；第二个账户的桶（S3 API）以后在这里加类型。
// Telegram 不在路由表里：只存 Telegram 的文件在 R2 留一个占位对象，见 telegram.js。

export const BRAND = 'ImgHub';
const STD_KEY = new RegExp(`^${BRAND}-(\\d{4})(\\d{2})(\\d{2})-(\\d{2})(\\d{2})(\\d{2})-`);

// key 里的上传时间（毫秒），解析不出返回 NaN
export function keyTime(key) {
  const ts = /^(\d{13})_/.exec(key)?.[1];
  if (ts) return Number(ts);
  const m = STD_KEY.exec(key);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return Date.UTC(y, mo - 1, d, h - 8, mi, s);
}

function table(env) {
  const list = Array.isArray(env.STORES) && env.STORES.length ? env.STORES : [{ binding: 'R2_MAIN', from: 0 }];
  return list
    .map((s) => ({ ...s, bucket: env[s.binding] }))
    .filter((s) => s.bucket)
    .sort((a, b) => a.from - b.from);
}

// 读：先查时间所属的桶，其余桶依次兜底（防止路由表改动或手动搬移造成漏查）
export function storesFor(env, key) {
  const list = table(env);
  const ts = keyTime(key);
  if (!Number.isFinite(ts) || list.length < 2) return list;
  let i = list.length - 1;
  while (i > 0 && list[i].from > ts) i--;
  return [list[i], ...list.filter((_, j) => j !== i)];
}

// 写：路由表最后一项（当前桶）
export function writeStore(env) {
  const list = table(env);
  if (!list.length) throw new Error('no storage configured');
  return list[list.length - 1];
}

// 设置对象放在路由表第一项（主桶），以后追加新桶也不会搬家
export function configStore(env) {
  const list = table(env);
  if (!list.length) throw new Error('no storage configured');
  return list[0];
}

export function allStores(env) {
  return table(env);
}
