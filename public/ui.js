// 上传页与管理页共用：图标、形状变形、登录闸门、语言菜单、提示条、确认框、API 调用
import { LANGS, applyI18n, detectLang, getLang, setLang, t } from './i18n.js';

export const $ = (s, root = document) => root.querySelector(s);

// ---------- 图标（Material Icons，Apache-2.0；内联以免请求外部字体） ----------
const ICONS = {
  upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z',
  cloud: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  code: 'M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  md: 'M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12c.79 0 1.44.63 1.44 1.41v9.18c0 .78-.65 1.41-1.44 1.41zM6.81 15.19v-3.66l1.92 2.35 1.92-2.35v3.66h1.93V8.81h-1.93l-1.92 2.35-1.92-2.35H4.89v6.38h1.92zM19.69 12h-1.92V8.81h-1.92V12h-1.93l2.89 3.28L19.69 12z',
  logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  shield: 'M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  translate: 'M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z',
  tune: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  visibility: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  open: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
  image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  movie: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
  file: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  selectAll: 'M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2zM7 17h10V7H7v10zm2-8h6v6H9V9z',
  history: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  sweep: 'M5 13h14v-2H5v2zm-2 4h14v-2H3v2zM7 7v2h14V7H7z',
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
};

export function icon(name, cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `icon ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICONS[name] || ICONS.file);
  svg.append(p);
  return svg;
}
// Logo：枫橙圆角方块 + 白色站点枫叶（awads.cc 的标志，按原图描成多边形），左下角一朵上传云把方块咬掉一角。
// 缺口用 mask 做成透明，任何背景上都成立；颜色由 CSS 的 .logo 规则控制。mask id 每个实例唯一
const LEAF = 'M49.6 1L49 18.1L56.6 17.6L52.1 22.6L52.1 22.9L51.4 23.5L50.8 24.5L46.9 28.8L46.9 29L40.1 36.9L55.6 30.6L54.6 36.5L64 39.4L25.6 43.4ZM31.5 3.4L34 8.4L34.2 8.5L34.2 9.2L27 29.5L26.4 30.8L26.1 31.9L25.9 32L12.2 15.4L10 10.1L9.1 8.6L9.1 8.2L16.2 14.8L20.8 10.9L23.2 26L23.2 27.2L23.5 27.4ZM6.1 9.9L8.9 15.6L8 20.6L4 18.9ZM0 20.9L0.4 20.9L14 27L21.5 43.6L21.5 44.1L21.2 44.2L19.1 48.2L3.2 44.5L3.4 44.1L3.6 44.1L5.5 42.4L7.8 40.8L7.9 40.1ZM63.6 42.8L63.9 42.9L55.5 51L55.8 51.6L57.8 53.6L37.1 56.8L36.8 57.2L36 63L35.8 63L35.2 62.2L34.2 61.5L34.2 61.2L24.2 51.1L23.9 51.4L18.9 61.2L18.6 61.5L15.2 61.8L23.5 47L58.2 43.5Z';
const CLOUD_BODY = 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z';
const CLOUD_ARROW = 'M14 13v4h-4v-4H7l5-5 5 5h-3z';
let logoSeq = 0;
export function logo(cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const id = `logo-mask-${++logoSeq}`;
  const ct = 'translate(-4 30) scale(1.32)';
  svg.setAttribute('viewBox', '-4 -3 70 70');
  svg.setAttribute('class', `logo ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    `<mask id="${id}"><rect x="-8" y="-8" width="80" height="80" fill="#fff"/><path d="${CLOUD_BODY}" transform="${ct}" stroke="#000" stroke-width="2.73" stroke-linejoin="round"/></mask>` +
    `<g mask="url(#${id})"><rect class="logo-bg" width="64" height="64" rx="18"/><path class="logo-leaf" transform="translate(10.6 8.6) scale(0.7)" d="${LEAF}"/></g>` +
    `<path class="logo-cloud" transform="${ct}" d="${CLOUD_BODY}"/><path class="logo-arrow" transform="${ct}" d="${CLOUD_ARROW}"/>`;
  return svg;
}
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('i[data-icon]')) {
    el.replaceWith(el.dataset.icon === 'logo' ? logo(el.className) : icon(el.dataset.icon, el.className));
  }
}

// ---------- 形状（M3E 形状库的近似：极坐标半径函数 → clip-path 多边形） ----------
// 顶点数统一为 N，这样任意两个形状之间都能用 WAAPI 平滑插值
const N = 96;
const SHAPES = {
  circle: () => 1,
  cookie9: (a) => 0.9 + 0.1 * Math.cos(9 * a),
  cookie7: (a) => 0.88 + 0.12 * Math.cos(7 * a),
  clover4: (a) => 0.78 + 0.22 * Math.abs(Math.cos(2 * a)) ** 0.6,
  burst12: (a) => 0.84 + 0.16 * Math.cos(12 * a) ** 3,
  pentagon: (a) => 0.9 + 0.1 * Math.cos(5 * a),
  sunny8: (a) => 0.92 + 0.08 * Math.cos(8 * a),
  pill: (a) => Math.min(1, 0.62 / Math.max(0.01, Math.abs(Math.cos(a)))) * 0.9 + 0.1,
};
const cache = {};
export function shape(name) {
  if (cache[name]) return cache[name];
  const f = SHAPES[name] || SHAPES.circle;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 50 * f(a);
    pts.push(`${(50 + r * Math.sin(a)).toFixed(2)}% ${(50 - r * Math.cos(a)).toFixed(2)}%`);
  }
  return (cache[name] = `polygon(${pts.join(',')})`);
}
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const SPRING = getComputedStyle(document.documentElement).getPropertyValue('--spring').trim() || 'ease-out';

// 静态形状
// 变形画在 ::before 上（CSS 变量 --shape），里面的图标保持不转
export function setShape(el, name) {
  el.style.setProperty('--shape', shape(name));
}
const PSEUDO = { pseudoElement: '::before' };

// 循环变形：每段用弹簧曲线停在一个形状上，同时整体缓慢旋转。返回控制器
export function morph(el, seq = ['cookie9', 'clover4', 'burst12', 'pentagon'], { step = 1600, spin = 12000 } = {}) {
  setShape(el, seq[0]);
  if (reduceMotion.matches) return { speed() {}, stop() {} };
  const frames = [...seq, seq[0]].map((n, i, arr) => ({ clipPath: shape(n), offset: i / (arr.length - 1), easing: SPRING }));
  const a = el.animate(frames, { ...PSEUDO, duration: step * seq.length, iterations: Infinity });
  const b = el.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { ...PSEUDO, duration: spin, iterations: Infinity });
  return {
    speed(rate) {
      a.updatePlaybackRate(rate);
      b.updatePlaybackRate(rate);
    },
    stop() {
      a.cancel();
      b.cancel();
    },
  };
}

// 一次性形状切换（比如成功时变成 sunny）
export function morphTo(el, name, duration = 600) {
  const from = getComputedStyle(el, '::before').clipPath;
  for (const a of el.getAnimations({ subtree: true })) if (a.effect?.getKeyframes?.()[0]?.clipPath) a.cancel();
  setShape(el, name);
  if (!reduceMotion.matches) el.animate([{ clipPath: from }, { clipPath: shape(name) }], { ...PSEUDO, duration, easing: SPRING });
}

// M3E LoadingIndicator：多边形轮流变形 + 旋转
export function loader(contained = false) {
  const el = document.createElement('span');
  el.className = 'morph loader' + (contained ? ' contained' : '');
  morph(el, ['cookie9', 'pentagon', 'pill', 'burst12', 'clover4', 'sunny8'], { step: 650, spin: 4000 });
  if (!contained) return el;
  const box = document.createElement('span');
  box.className = 'loader-box';
  box.append(el);
  return box;
}

// 波浪进度条。p 为 null 时是不确定进度
export function wavy() {
  const el = document.createElement('div');
  el.className = 'wavy indeterminate';
  el.setAttribute('role', 'progressbar');
  el.innerHTML = '<div class="wave"></div><div class="track"></div>';
  return {
    el,
    set(p) {
      if (p == null) {
        el.classList.add('indeterminate');
        el.removeAttribute('aria-valuenow');
        return;
      }
      el.classList.remove('indeterminate');
      el.style.setProperty('--p', p);
      el.setAttribute('aria-valuenow', p);
    },
  };
}

// ---------- 语言 ----------
export function initLang() {
  setLang(detectLang());
  hydrateIcons();
  for (const b of document.querySelectorAll('[data-lang-menu]')) langMenu(b);
}

let menuSeq = 0;
function langMenu(button) {
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.popover = 'auto';
  menu.id = `menu-${++menuSeq}`;
  for (const [v, label] of Object.entries(LANGS)) {
    const b = document.createElement('button');
    b.className = 'state';
    b.dataset.v = v;
    b.textContent = label;
    b.onclick = () => {
      setLang(v);
      menu.hidePopover();
    };
    menu.append(b);
  }
  document.body.append(menu);
  button.addEventListener('click', () => {
    for (const b of menu.children) b.classList.toggle('on', b.dataset.v === getLang());
    menu.showPopover();
    const r = button.getBoundingClientRect();
    menu.style.top = `${r.bottom + 6}px`;
    menu.style.left = `${Math.max(8, Math.min(r.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8))}px`;
  });
}

// ---------- 提示条 ----------
let snackTimer;
export function snack(msg, { error = false } = {}) {
  let el = $('#snackbar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'snackbar';
    el.className = 'snackbar';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.replaceChildren(icon(error ? 'error' : 'check', 'sm'), document.createTextNode(msg));
  el.classList.toggle('raised', Boolean($('.ftb.show')));
  el.classList.add('show');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- 确认框 ----------
export function confirmBox({ title, text, ok = t('confirm'), iconName = 'delete' }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dlg';
    d.innerHTML = '<div class="dlg-icon"></div><h3 class="headline"></h3><p></p><div class="actions"><button class="btn state" value="no"></button><button class="btn danger state" value="yes"></button></div>';
    $('.dlg-icon', d).append(icon(iconName));
    $('h3', d).textContent = title;
    $('p', d).textContent = text;
    const [no, yes] = d.querySelectorAll('.actions button');
    no.textContent = t('cancel');
    yes.textContent = ok;
    no.onclick = () => d.close('no');
    yes.onclick = () => d.close('yes');
    d.onclose = () => {
      resolve(d.returnValue === 'yes');
      d.remove();
    };
    document.body.append(d);
    d.showModal();
    no.focus();
  });
}

// ---------- 复制 ----------
export async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  snack(t('copied'));
  if (btn && !btn.classList.contains('ok')) {
    const old = btn.firstElementChild;
    btn.classList.add('ok');
    btn.replaceChildren(icon('check'));
    setTimeout(() => {
      btn.classList.remove('ok');
      btn.replaceChildren(old);
    }, 1200);
  }
}

// ---------- API ----------
export async function api(path, init = {}) {
  let res;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    return { ok: false, status: 0, body: { error: 'network' } };
  }
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
export function errText(r) {
  const code = r.body?.error ? `e_${r.body.error}` : null;
  return code && t(code) !== code ? t(code) : t('e_server', { s: r.status });
}

// ---------- 登录闸门 ----------
// need：'upload' | 'admin'。返回 { role, user }
export const canDo = (role, need) => role === 'admin' || (need === 'upload' && role === 'upload');

export async function gate(need) {
  const r = await api('/api/session');
  if (canDo(r.body?.role, need)) {
    document.body.classList.remove('locked');
    return r.body;
  }
  return showLogin(need);
}

export async function logout() {
  await api('/api/logout', { method: 'POST' });
  location.reload();
}

function showLogin(need) {
  return new Promise((resolve) => {
    document.body.classList.add('locked');
    const wrap = document.createElement('div');
    wrap.className = 'gate';
    wrap.innerHTML = `
      <button class="btn icon corner state" data-lang-menu data-i18n-tip="language"><i data-icon="translate"></i></button>
      <div class="gate-card">
        <span class="emblem"><i data-icon="logo"></i><span class="badge"><i data-icon="lock"></i></span></span>
        <h1 class="headline"></h1>
        <div class="muted sub"></div>
        <form novalidate>
          <div class="field user"><input id="g-user" name="username" autocomplete="username" placeholder=" " spellcheck="false"><label for="g-user" data-i18n="username"></label></div>
          <div class="field pw"><input id="g-pw" name="password" type="password" autocomplete="current-password" placeholder=" "><label for="g-pw" data-i18n="password"></label>
            <button type="button" class="btn icon state eye" data-i18n-tip="showPw"><i data-icon="visibility"></i></button></div>
          <div class="err" role="alert"></div>
          <button class="btn filled lg block state submit" type="submit"><span data-i18n="signIn"></span></button>
        </form>
        <button class="btn sm state switch" type="button"></button>
      </div>`;
    document.body.prepend(wrap);
    hydrateIcons(wrap);
    langMenu($('[data-lang-menu]', wrap));

    const card = $('.gate-card', wrap);
    const emblem = $('.emblem', wrap);
    const form = $('form', wrap);
    const err = $('.err', wrap);
    const submit = $('.submit', wrap);
    const sw = $('.switch', wrap);
    let mode = need === 'admin' ? 'admin' : 'upload';

    const render = () => {
      const admin = mode === 'admin';
      $('.user', wrap).hidden = !admin;
      $('h1', wrap).dataset.i18n = admin ? 'adminLoginTitle' : 'loginTitle';
      $('.sub', wrap).dataset.i18n = admin ? 'adminLoginSub' : 'loginSub';
      emblem.classList.toggle('admin', admin);
      $('.badge', emblem).replaceChildren(icon(admin ? 'shield' : 'lock'));
      // 管理页只接受管理员；上传页两种都可以
      sw.hidden = need === 'admin' && admin;
      sw.dataset.i18n = admin ? 'asUploader' : 'asAdmin';
      if (need === 'admin' && !admin) sw.dataset.i18n = 'asAdmin';
      err.textContent = '';
      applyI18n(wrap);
      (admin ? $('#g-user', wrap) : $('#g-pw', wrap)).focus();
    };
    const relabel = () => applyI18n(wrap);
    document.addEventListener('langchange', relabel);
    sw.onclick = () => {
      mode = mode === 'admin' ? 'upload' : 'admin';
      if (need === 'admin') mode = 'admin';
      render();
    };
    $('.eye', wrap).onclick = () => {
      const pw = $('#g-pw', wrap);
      pw.type = pw.type === 'password' ? 'text' : 'password';
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const body = { role: mode, password: $('#g-pw', wrap).value };
      if (mode === 'admin') body.username = $('#g-user', wrap).value.trim();
      submit.disabled = true;
      submit.replaceChildren(loader());
      const r = await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      submit.disabled = false;
      submit.replaceChildren(Object.assign(document.createElement('span'), { textContent: t('signIn') }));
      $('span', submit).dataset.i18n = 'signIn';
      if (!r.ok) {
        err.textContent = errText(r);
        for (const f of form.querySelectorAll('.field')) f.classList.add('error');
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        $('#g-pw', wrap).select();
        return;
      }
      if (!canDo(r.body.role, need)) {
        err.textContent = t('e_forbidden');
        return;
      }
      emblem.classList.add('ok');
      $('.badge', emblem).replaceChildren(icon('check'));
      card.classList.add('out');
      setTimeout(() => {
        document.removeEventListener('langchange', relabel);
        wrap.remove();
        document.body.classList.remove('locked');
        resolve(r.body);
      }, 380);
    };
    for (const input of form.querySelectorAll('input')) {
      input.addEventListener('input', () => {
        for (const f of form.querySelectorAll('.field')) f.classList.remove('error');
        err.textContent = '';
      });
    }
    render();
  });
}

// ---------- 杂项 ----------
export function size(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
export const when = (ms, style = 'medium') => new Date(ms).toLocaleString(getLang(), { dateStyle: style, timeStyle: 'short' });

// 顶栏滚动后加底色
export function topbarShadow() {
  const bar = $('.topbar');
  if (!bar) return;
  const f = () => bar.classList.toggle('scrolled', scrollY > 4);
  addEventListener('scroll', f, { passive: true });
  f();
}

export function snippet(kind, entry) {
  if (kind === 'md') return `![${entry.name}](${entry.url})`;
  if (kind === 'html') return `<img src="${entry.url}" alt="${entry.name.replace(/"/g, '&quot;')}" loading="lazy">`;
  return entry.url;
}
