// 主题与深浅色：在 <head> 里同步执行（普通脚本，不是 module），首屏就套上，不闪色。
// 配色：枫橙（maple）用 style.css 里手调的色板；其他颜色由种子色生成 M3 风格的色调配色——
// 在 OKLCH 里定色相与彩度，按 M3 色调（tone = CIE L*）解出明度，超出 sRGB 时降彩度。
// 设置来源：站点设置 {color, mode, logo}（管理员定，经 /api/site 下发并缓存在 localStorage）+ 访客自选的深浅色。
// mode 不是 auto 时为强制，访客的选择无效，切换按钮隐藏。
(() => {
  const SITE_KEY = 'imghub.theme'; // 站点设置缓存 {color, mode, logo}
  const MODE_KEY = 'imghub.mode'; // 访客自选：auto | light | dark
  const PRESETS = {
    maple: '#fc4d00',
    sakura: '#e0457b',
    amber: '#e8a200',
    bamboo: '#3f8f4a',
    teal: '#00a3a3',
    ocean: '#1e6fd9',
    violet: '#7e57c2',
    ink: '#6b7280',
  };
  const dark = matchMedia('(prefers-color-scheme: dark)');

  // ---------- 颜色换算 ----------
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toGam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  function hexToOklch(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
  }
  // OKLCH → 线性 sRGB
  function lin(L, C, h) {
    const a = C * Math.cos((h * Math.PI) / 180);
    const b = C * Math.sin((h * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  }
  const tone = ([r, g, b]) => {
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
  };
  const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  // 给定色调（L*）与色相：找出明度，彩度在 sRGB 内取到不超过 C 的最大值
  function solveL(T, C, h) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (tone(lin(mid, C, h)) < T) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function color(T, C, h) {
    let L = solveL(T, C, h);
    if (!inGamut(lin(L, C, h))) {
      let lo = 0;
      let hi = C;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut(lin(solveL(T, mid, h), mid, h))) lo = mid;
        else hi = mid;
      }
      C = lo;
      L = solveL(T, C, h);
    }
    const hex = lin(L, C, h).map((v) => Math.round(Math.min(1, Math.max(0, toGam(Math.max(0, v)))) * 255).toString(16).padStart(2, '0'));
    return `#${hex.join('')}`;
  }

  // ---------- 色板 ----------
  // 主色彩度随色调变化（按手调的枫橙色板量出来的比例），两端自然收窄
  const CURVE = [[0, 0.3], [10, 0.47], [20, 0.65], [30, 0.83], [40, 1], [80, 0.62], [90, 0.29], [100, 0.1]];
  const curve = (T) => {
    for (let i = 1; i < CURVE.length; i++) {
      const [t1, v1] = CURVE[i];
      const [t0, v0] = CURVE[i - 1];
      if (T <= t1) return v0 + ((v1 - v0) * (T - t0)) / (t1 - t0);
    }
    return 0.1;
  };
  const ROLES = {
    // 名称: [色板, 浅色色调, 深色色调]；色板 p 主色 s 次色 t 第三色 n 中性 v 中性变体
    primary: ['p', 40, 80], 'on-primary': ['p', 100, 20],
    'primary-container': ['p', 90, 30], 'on-primary-container': ['p', 10, 90],
    secondary: ['s', 40, 80], 'on-secondary': ['s', 100, 20],
    'secondary-container': ['s', 90, 30], 'on-secondary-container': ['s', 10, 90],
    tertiary: ['t', 40, 80], 'on-tertiary': ['t', 100, 20],
    'tertiary-container': ['t', 90, 30], 'on-tertiary-container': ['t', 10, 90],
    surface: ['n', 98, 6], 'on-surface': ['n', 10, 90], 'on-surface-variant': ['v', 30, 80],
    'surface-lowest': ['n', 100, 4], 'surface-low': ['n', 96, 10], 'surface-container': ['n', 94, 12],
    'surface-high': ['n', 92, 17], 'surface-highest': ['n', 90, 22],
    outline: ['v', 50, 60], 'outline-variant': ['v', 80, 30],
    'inverse-surface': ['n', 20, 90], 'inverse-on-surface': ['n', 95, 20], 'inverse-primary': ['p', 80, 40],
  };
  const memo = {};
  function palette(seed, isDark) {
    const id = `${seed}|${isDark}`;
    if (memo[id]) return memo[id];
    const { c, h } = hexToOklch(seed);
    const pc = Math.min(c, 0.155);
    const pal = {
      p: (T) => color(T, pc * curve(T), h),
      s: (T) => color(T, Math.min(0.045, pc / 3.4), h),
      t: (T) => color(T, Math.min(0.11, pc * 0.7), (h + 60) % 360),
      n: (T) => color(T, Math.min(0.018, pc / 8.5), h),
      v: (T) => color(T, Math.min(0.026, pc / 6), h),
    };
    const out = {};
    for (const [k, [p, l, d]] of Object.entries(ROLES)) out[k] = pal[p](isDark ? d : l);
    return (memo[id] = out);
  }

  // ---------- 套用 ----------
  const read = (k, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  let site = read(SITE_KEY, { color: 'maple', mode: 'auto' });
  const seedOf = (c) => PRESETS[c] || (/^#[0-9a-f]{6}$/.test(c) ? c : PRESETS.maple);
  const forced = () => (site.mode === 'light' || site.mode === 'dark' ? site.mode : null);
  const userMode = () => {
    const m = localStorage.getItem(MODE_KEY);
    return m === 'light' || m === 'dark' ? m : 'auto';
  };
  const resolved = () => forced() || (userMode() === 'auto' ? (dark.matches ? 'dark' : 'light') : userMode());

  function apply() {
    const root = document.documentElement;
    const mode = resolved();
    root.dataset.mode = mode;
    root.dataset.forced = forced() ? '1' : '';
    root.toggleAttribute('data-tint', site.logo === true); // Logo 与站名跟随主题色
    for (const k of Object.keys(ROLES)) root.style.removeProperty(`--${k}`);
    const seed = seedOf(site.color);
    if (seed !== PRESETS.maple) for (const [k, v] of Object.entries(palette(seed, mode === 'dark'))) root.style.setProperty(`--${k}`, v);
    // 浏览器地址栏颜色跟着页面底色
    const surface = getComputedStyle(root).getPropertyValue('--surface').trim();
    if (surface) for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.content = surface;
    document.dispatchEvent(new CustomEvent('themechange'));
  }

  dark.addEventListener('change', apply);
  addEventListener('storage', (e) => {
    if (e.key === MODE_KEY) apply();
    if (e.key === SITE_KEY) {
      site = read(SITE_KEY, site);
      apply();
    }
  });
  // meta 在本脚本之后才解析：DOM 就绪后再同步一次地址栏颜色
  document.addEventListener('DOMContentLoaded', apply, { once: true });

  window.imghubTheme = {
    PRESETS,
    palette,
    seedOf,
    forced,
    userMode,
    resolved,
    // 站点设置（来自 /api/site 或设置页保存后）
    setSite(t) {
      const next = { color: t?.color || 'maple', mode: t?.mode || 'auto', logo: t?.logo === true };
      if (next.color === site.color && next.mode === site.mode && next.logo === site.logo) return;
      site = next;
      localStorage.setItem(SITE_KEY, JSON.stringify(site));
      apply();
    },
    // 访客自选深浅色
    setMode(m) {
      if (m === 'auto') localStorage.removeItem(MODE_KEY);
      else localStorage.setItem(MODE_KEY, m);
      apply();
    },
  };
  apply();
})();
