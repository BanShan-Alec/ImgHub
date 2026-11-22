// 扩展名 → Content-Type。只收图床会遇到的类型，其余按 application/octet-stream 处理
const TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', jfif: 'image/jpeg',
  png: 'image/png', apng: 'image/apng', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', jxl: 'image/jxl', heic: 'image/heic', heif: 'image/heif',
  ico: 'image/x-icon', cur: 'image/x-icon', svg: 'image/svg+xml', bmp: 'image/bmp',
  tif: 'image/tiff', tiff: 'image/tiff',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mkv: 'video/x-matroska', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg',
  wav: 'audio/wav', flac: 'audio/flac', pdf: 'application/pdf', txt: 'text/plain; charset=utf-8',
};

export function mimeFromName(name) {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return (ext && TYPES[ext]) || 'application/octet-stream';
}

// 上传时决定 Content-Type：扩展名优先（结果稳定），认不出再用客户端给的——但只收图片 / 视频 / 音频，
// 否则一律 octet-stream：text/html 等会在图床域名上执行脚本，借管理员的会话调用 /api
export function pickContentType(name, clientType) {
  const byExt = mimeFromName(name);
  if (byExt !== 'application/octet-stream') return byExt;
  const t = (clientType || '').split(';')[0].trim().toLowerCase();
  return /^(image|video|audio)\/[a-z0-9.+-]+$/.test(t) && !t.includes('svg') ? t : byExt;
}

// 浏览器会当作文档渲染、可能执行脚本的类型以外，都能放心 inline（图片 / 视频 / 音频 / PDF / 纯文本）
export const isPassive = (type) => /^(image\/(?!svg)|video\/|audio\/|application\/pdf|text\/plain)/i.test(type || '');
