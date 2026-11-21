// 设置页（管理员）：防盗链与 RSS 阅读器放行、放行网站、链接域名、登录页/上传页背景、页脚友情链接。
// 每项改动立即保存（POST /api/settings），服务端负责规范化与校验
import { t } from './i18n.js';
import { $, BUILTIN_LINKS, api, errText, gate, icon, initLang, logout, setDomains, setShape, setSite, snack, topbarShadow } from './ui.js';

const MAX_BG = 5;
const INTERVALS = [5, 10, 20, 40];
let settings = null;
let saving = false;

initLang();
topbarShadow();
for (const el of document.querySelectorAll('[data-shape]')) setShape(el, el.dataset.shape);
$('#logout').onclick = logout;
document.addEventListener('langchange', () => settings && apply(settings));

const setToggle = (b, on) => b.setAttribute('aria-checked', String(on));
const post = (body) => api('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// 保存期间忽略重复点击；btn 显示忙碌状态
async function save(body, btn) {
  if (saving) return false;
  saving = true;
  btn?.setAttribute('aria-busy', 'true');
  const r = await post(body);
  saving = false;
  btn?.removeAttribute('aria-busy');
  if (!r.ok) {
    if (r.status === 401) return reauth();
    const e = r.body?.error;
    snack(e === 'bad_site' ? t('e_bad_site', { site: r.body.site }) : e === 'bad_link' ? t('e_bad_link', { site: r.body.site }) : e === 'bad_url' ? t('e_bad_url', { site: r.body.site }) : errText(r), { error: true });
    return false;
  }
  apply(r.body);
  snack(t('saved'));
  return true;
}

function apply(s) {
  settings = s;
  for (const row of document.querySelectorAll('[data-flag]')) setToggle($('.toggle', row), s[row.dataset.flag]);
  for (const row of document.querySelectorAll('[data-bg]')) setToggle($('.toggle', row), s.bg[row.dataset.bg]);
  $('#rssNote').textContent = t('rssNote', { list: (s.rssReaders ?? []).join(', ') });
  renderChips('allow');
  renderChips('domains');
  renderBg();
  renderLinks();
  setDomains(s.domains);
  setSite({ bg: s.bg, links: s.links });
}

// ---------- 开关（整行可点；开关本身的点击会冒泡上来） ----------
for (const row of document.querySelectorAll('[data-flag]')) {
  row.onclick = () => save({ [row.dataset.flag]: !settings[row.dataset.flag] }, $('.toggle', row));
}
for (const row of document.querySelectorAll('[data-bg]')) {
  row.onclick = () => save({ bg: { [row.dataset.bg]: !settings.bg[row.dataset.bg] } }, $('.toggle', row));
}

// ---------- 放行网站 / 链接域名：胶囊 + × 移除，保存整份名单 ----------
const CHIPS = {
  allow: { box: '#sites', form: '#siteForm', input: '#siteInput', empty: 'sitesEmpty' },
  domains: { box: '#domains', form: '#domainForm', input: '#domainInput', empty: 'domainsEmpty' },
};
function chip(text, onRemove, extra) {
  const c = document.createElement('span');
  c.className = 'chip';
  const name = document.createElement('span');
  name.textContent = text;
  c.append(name);
  if (extra) c.append(extra);
  if (onRemove) {
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'chip-x state';
    x.title = x.ariaLabel = t('removeSite', { site: text });
    x.append(icon('close', 'sm'));
    x.onclick = () => onRemove(x);
    c.append(x);
  } else {
    c.classList.add('fixed');
  }
  return c;
}
function emptyNote(key) {
  const p = document.createElement('span');
  p.className = 'chips-empty';
  p.textContent = t(key);
  return p;
}
function renderChips(field) {
  const box = $(CHIPS[field].box);
  box.replaceChildren();
  if (!settings[field].length) box.append(emptyNote(CHIPS[field].empty));
  for (const site of settings[field]) box.append(chip(site, (x) => save({ [field]: settings[field].filter((d) => d !== site) }, x)));
}
for (const [field, c] of Object.entries(CHIPS)) {
  $(c.form).onsubmit = async (e) => {
    e.preventDefault();
    const input = $(c.input);
    // 允许一次贴多个：空格、逗号、换行分隔
    const add = input.value.split(/[\s,，、]+/).filter(Boolean);
    if (!add.length) return input.focus();
    if (await save({ [field]: [...settings[field], ...add] }, $(`${c.form} button`))) input.value = '';
  };
}

// ---------- 友情链接：内建两站固定在前、不能移除；自定义的可删 ----------
function renderLinks() {
  const box = $('#links');
  box.replaceChildren();
  for (const b of BUILTIN_LINKS) {
    const tag = document.createElement('span');
    tag.className = 'chip-tag';
    tag.textContent = t('builtin');
    const c = chip(t(b.i18n), null, tag);
    c.title = b.url;
    box.append(c);
  }
  for (const l of settings.links) {
    const c = chip(l.name, (x) => save({ links: settings.links.filter((v) => v !== l) }, x));
    c.title = l.url;
    box.append(c);
  }
}
$('#linkForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = $('#linkName').value.trim();
  const url = $('#linkUrl').value.trim();
  if (!name) return $('#linkName').focus();
  if (!url) return $('#linkUrl').focus();
  if (await save({ links: [...settings.links, { name, url }] }, $('#linkForm button'))) {
    $('#linkName').value = '';
    $('#linkUrl').value = '';
  }
};

// ---------- 背景图：填地址（本站 /file/… 或任意 https 图片），最多 5 个 ----------
function renderBg() {
  const urls = settings.bg.urls;
  const box = $('#bgList');
  box.replaceChildren();
  urls.forEach((src, i) => {
    const item = document.createElement('div');
    item.className = 'bg-item';
    const img = new Image();
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = src;
    img.onerror = () => img.replaceWith(icon('image'));
    item.title = src;
    const n = document.createElement('span');
    n.className = 'bg-n';
    n.textContent = i + 1;
    const bar = document.createElement('div');
    bar.className = 'bg-acts';
    const act = (name, tip, fn, disabled = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn icon sm state';
      b.title = b.ariaLabel = t(tip);
      b.disabled = disabled;
      b.append(icon(name, 'sm'));
      b.onclick = () => fn(b);
      return b;
    };
    const move = (d) => (b) => {
      const next = [...urls];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      save({ bg: { urls: next } }, b);
    };
    bar.append(
      act('left', 'moveLeft', move(-1), i === 0),
      act('right', 'moveRight', move(1), i === urls.length - 1),
      act('delete', 'remove', (b) => save({ bg: { urls: urls.filter((_, j) => j !== i) } }, b)),
    );
    item.append(img, n, bar);
    box.append(item);
  });
  if (!urls.length) box.append(emptyNote('bgEmpty'));
  const full = urls.length >= MAX_BG;
  $('#bgUrl').disabled = full;
  $('#bgForm button').disabled = full;
  $('#bgUrl').placeholder = t(full ? 'bgMax' : 'bgUrl');

  const group = $('#bgInterval');
  group.replaceChildren(
    ...INTERVALS.map((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = t('secN', { n: s });
      b.classList.toggle('on', s === settings.bg.interval);
      b.onclick = () => s !== settings.bg.interval && save({ bg: { interval: s } }, group);
      return b;
    }),
  );
  $('#intervalField').classList.toggle('dim', urls.length < 2);
}

// 本图床的图片链接（任一绑定域名）存成 /file/… 路径，换域名也不失效；可一次贴多个（空白分隔）
function bgPath(s) {
  try {
    const u = new URL(s, location.href);
    const own = u.host === location.host || (settings.domains ?? []).includes(u.hostname);
    return own && u.pathname.startsWith('/file/') ? u.pathname : s;
  } catch {
    return s;
  }
}
$('#bgForm').onsubmit = async (e) => {
  e.preventDefault();
  const input = $('#bgUrl');
  const add = input.value.split(/\s+/).filter(Boolean).map(bgPath);
  if (!add.length) return input.focus();
  const next = [...new Set([...settings.bg.urls, ...add])];
  if (next.length > MAX_BG) return snack(t('bgMax'), { error: true });
  if (await save({ bg: { urls: next } }, $('#bgForm button'))) input.value = '';
};

// ---------- 启动 ----------
let reauthing = null;
function reauth() {
  if (reauthing) return false;
  snack(t('sessionExpired'), { error: true });
  reauthing = gate('admin').then(() => {
    reauthing = null;
    load();
  });
  return false;
}
async function load() {
  const r = await api('/api/settings');
  if (!r.ok) {
    if (r.status === 401) return reauth();
    return snack(errText(r), { error: true });
  }
  apply(r.body);
}

await gate('admin');
load();
