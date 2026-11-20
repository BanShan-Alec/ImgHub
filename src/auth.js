// 身份验证：两种角色
//   upload —— 上传页，只要密码（UPLOAD_PASSWORD）；本机脚本也可用 Authorization: Bearer <UPLOAD_TOKEN>
//   admin  —— 后台管理，账号 + 密码（ADMIN_USER / ADMIN_PASSWORD），权限包含 upload
// 浏览器会话：HttpOnly Cookie，内容为 `<角色>.<过期秒>.<HMAC>`，不需要数据库。
// 签名密钥 = SESSION_SECRET + 该角色当前的凭据，所以改密码或轮换 SESSION_SECRET 会让旧会话全部失效。

const COOKIE = 'imghub_session';
const TTL = { upload: 30 * 86400, admin: 12 * 3600 };
const enc = new TextEncoder();

// 返回 'admin' | 'upload' | null
export async function identify(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (header.startsWith('Bearer ')) {
    return env.UPLOAD_TOKEN && (await safeEqual(header.slice(7), env.UPLOAD_TOKEN)) ? 'upload' : null;
  }
  const raw = readCookie(request, COOKIE);
  if (!raw) return null;
  const [role, exp, sig] = raw.split('.');
  if (!TTL[role] || !/^\d+$/.test(exp) || !sig || Number(exp) < Date.now() / 1000) return null;
  const key = await signingKey(env, role);
  if (!key) return null;
  let mac;
  try {
    mac = fromB64url(sig);
  } catch {
    return null;
  }
  const ok = await crypto.subtle.verify('HMAC', key, mac, enc.encode(`${role}.${exp}`));
  return ok ? role : null;
}

// Cookie 会话的写操作要求同源（SameSite=Strict 之外再加一层）
export function sameOrigin(request, url) {
  if ((request.headers.get('Authorization') || '').startsWith('Bearer ')) return true;
  const origin = request.headers.get('Origin');
  return !origin || origin === url.origin;
}

// POST /api/login  {role:'upload', password} | {role:'admin', username, password}
export async function login(request, env, url) {
  if (!sameOrigin(request, url)) return { status: 403, body: { error: 'bad_origin' } };
  if (env.LOGIN_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const { success } = await env.LOGIN_LIMITER.limit({ key: `login:${ip}` });
    if (!success) return { status: 429, body: { error: 'rate_limited' } };
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return { status: 400, body: { error: 'bad_request' } };
  }
  const role = input?.role === 'admin' ? 'admin' : 'upload';
  const key = await signingKey(env, role);
  if (!key) return { status: 503, body: { error: 'not_configured' } };

  const password = String(input.password ?? '');
  // 两项都比较完再判断，避免按用户名短路泄露时间差
  const checks =
    role === 'admin'
      ? [safeEqual(String(input.username ?? ''), env.ADMIN_USER), safeEqual(password, env.ADMIN_PASSWORD)]
      : [safeEqual(password, env.UPLOAD_PASSWORD)];
  const ok = (await Promise.all(checks)).every(Boolean);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
    return { status: 401, body: { error: role === 'admin' ? 'bad_credentials' : 'bad_password' } };
  }

  const exp = Math.floor(Date.now() / 1000) + TTL[role];
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${role}.${exp}`)));
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return {
    status: 200,
    body: { role, user: role === 'admin' ? env.ADMIN_USER : undefined, exp },
    cookie: `${COOKIE}=${role}.${exp}.${toB64url(sig)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${TTL[role]}${secure}`,
  };
}

export function logoutCookie(url) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function hasRole(role, need) {
  return role === 'admin' || (need === 'upload' && role === 'upload');
}

// 未配置对应凭据时返回 null（该角色无法登录）
async function signingKey(env, role) {
  const cred = role === 'admin' ? env.ADMIN_USER && env.ADMIN_PASSWORD && `${env.ADMIN_USER}\0${env.ADMIN_PASSWORD}` : env.UPLOAD_PASSWORD;
  if (!env.SESSION_SECRET || !cred) return null;
  return crypto.subtle.importKey('raw', enc.encode(`${env.SESSION_SECRET}\0${role}\0${cred}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

// 常数时间比较：先各自取 SHA-256，长度一致后再比
async function safeEqual(given, expected) {
  if (!expected || !given) return false;
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(expected))]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function readCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

const toB64url = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
