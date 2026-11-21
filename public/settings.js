// 设置页（管理员）：防盗链与 RSS 阅读器放行、放行网站、链接域名、登录页/上传页背景、页脚友情链接。
// 每项改动立即保存（POST /api/settings），服务端负责规范化与校验
import { t } from './i18n.js';
import { $, BUILTIN_LINKS, api, errText, fileUrl, gate, icon, initLang, loader, logout, setDomains, setShape, setSite, snack, timeOf, topbarShadow } from './ui.js';

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
    snack(e === 'bad_site' ? t('e_bad_site', { site: r.body.site }) : e === 'bad_link' ? t('e_bad_link', { site: r.body.site }) : errText(r), { error: true });
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

// ---------- 背景图 ----------
function renderBg() {
  const keys = settings.bg.keys;
  const box = $('#bgList');
  box.replaceChildren();
  keys.forEach((key, i) => {
    const item = document.createElement('div');
    item.className = 'bg-item';
    const img = new Image();
    img.alt = '';
    img.loading = 'lazy';
    img.src = fileUrl(key);
    img.onerror = () => img.replaceWith(icon('image'));
    item.title = key;
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
      const next = [...keys];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      save({ bg: { keys: next } }, b);
    };
    bar.append(
      act('left', 'moveLeft', move(-1), i === 0),
      act('right', 'moveRight', move(1), i === keys.length - 1),
      act('delete', 'remove', (b) => save({ bg: { keys: keys.filter((k) => k !== key) } }, b)),
    );
    item.append(img, n, bar);
    box.append(item);
  });
  if (keys.length < MAX_BG) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'bg-add state';
    add.append(icon('add'), Object.assign(document.createElement('span'), { textContent: t('bgPick') }));
    add.onclick = openPicker;
    box.append(add);
  }
  if (!keys.length) box.append(emptyNote('bgEmpty'));

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
  $('#intervalField').classList.toggle('dim', keys.length < 2);
}

// 选图对话框：列出图床里的图片（新的在前），点选 / 取消，顺序即点选顺序
const picker = $('#picker');
let images = null;
let picked = [];
async function openPicker() {
  picked = [...settings.bg.keys];
  $('#pickQ').value = '';
  picker.showModal();
  if (!images) {
    $('#pickGrid').replaceChildren(loader(true));
    const all = [];
    let cursor = '';
    do {
      const r = await api(`/api/list?limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      if (!r.ok) {
        picker.close();
        if (r.status === 401) return reauth();
        return snack(errText(r), { error: true });
      }
      all.push(...r.body.items);
      cursor = r.body.cursor;
    } while (cursor);
    images = all.filter((o) => /^image\//.test(o.contentType)).sort((a, b) => timeOf(b) - timeOf(a));
  }
  renderPicker();
}
const LIMIT = 240;
function renderPicker() {
  const q = $('#pickQ').value.trim().toLowerCase();
  const list = images.filter((o) => !q || o.key.toLowerCase().includes(q) || o.name?.toLowerCase().includes(q)).slice(0, LIMIT);
  const grid = $('#pickGrid');
  grid.replaceChildren();
  if (!list.length) grid.append(emptyNote(images.length ? 'noMatch' : 'noImages'));
  for (const o of list) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tile pick';
    el.dataset.key = o.key;
    el.title = o.name || o.key;
    const media = document.createElement('div');
    media.className = 'media';
    const img = new Image();
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = fileUrl(o.key);
    img.onerror = () => img.replaceWith(icon('image'));
    media.append(img);
    const check = document.createElement('span');
    check.className = 'check';
    el.append(media, check);
    el.onclick = () => {
      const i = picked.indexOf(o.key);
      if (i >= 0) picked.splice(i, 1);
      else if (picked.length >= MAX_BG) return snack(t('bgMax'), { error: true });
      else picked.push(o.key);
      syncPicker();
    };
    grid.append(el);
  }
  syncPicker();
}
function syncPicker() {
  for (const el of picker.querySelectorAll('.tile')) {
    const i = picked.indexOf(el.dataset.key);
    el.classList.toggle('sel', i >= 0);
    $('.check', el).textContent = i >= 0 ? i + 1 : '';
  }
  $('#pickCount').textContent = t('bgPicked', { n: picked.length });
}
let pickTimer;
$('#pickQ').addEventListener('input', () => {
  clearTimeout(pickTimer);
  pickTimer = setTimeout(renderPicker, 150);
});
$('[value=cancel]', picker).onclick = () => picker.close();
$('[value=done]', picker).onclick = async (e) => {
  const same = picked.length === settings.bg.keys.length && picked.every((k, i) => k === settings.bg.keys[i]);
  if (same || (await save({ bg: { keys: picked } }, e.currentTarget))) picker.close();
};
picker.addEventListener('click', (e) => e.target === picker && picker.close());

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
