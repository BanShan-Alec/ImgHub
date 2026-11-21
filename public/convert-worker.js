// 浏览器端转码（Web Worker）：收到 ImageBitmap → 缩放 → 编码成 AVIF / WebP / JPEG / PNG
// AVIF、WebP 用 jSquash 的 wasm 编码器（libavif / libwebp），JPEG、PNG 用浏览器自带编码
import avifFactory from './vendor/avif_enc.js';
import webpFactory from './vendor/webp_enc_simd.js';

const QUALITY = {
  avif: { high: 70, balanced: 58, small: 45 },
  webp: { high: 90, balanced: 80, small: 68 },
  jpeg: { high: 0.92, balanced: 0.85, small: 0.75 },
};

// embind 需要完整的参数对象（取自 @jsquash/*/meta.js 的默认值）
const AVIF_OPTS = {
  quality: 50, qualityAlpha: -1, denoiseLevel: 0, tileColsLog2: 0, tileRowsLog2: 0,
  speed: 6, subsample: 1, chromaDeltaQ: false, sharpness: 0, tune: 0,
  enableSharpYUV: true, bitDepth: 8, lossless: false,
};
const WEBP_OPTS = {
  quality: 75, target_size: 0, target_PSNR: 0, method: 4, sns_strength: 50,
  filter_strength: 60, filter_sharpness: 0, filter_type: 1, partitions: 0, segments: 4,
  pass: 1, show_compressed: 0, preprocessing: 0, autofilter: 0, partition_limit: 0,
  alpha_compression: 1, alpha_filtering: 1, alpha_quality: 100, lossless: 0, exact: 0,
  image_hint: 0, emulate_jpeg_size: 0, thread_level: 0, low_memory: 0, near_lossless: 100,
  use_delta_palette: 0, use_sharp_yuv: 0,
};

let avif, webp;

self.onmessage = async ({ data }) => {
  const { id, bitmap, format, quality, maxEdge, q } = data; // q：直接指定 JPEG 质量（实况主图用）
  try {
    const { width, height } = fit(bitmap.width, bitmap.height, maxEdge);
    const canvas = drawScaled(bitmap, width, height, format === 'jpeg');
    bitmap.close();

    let buf;
    if (format === 'avif' || format === 'webp') {
      const img = canvas.getContext('2d').getImageData(0, 0, width, height);
      let out;
      if (format === 'avif') {
        avif ??= avifFactory({ noInitialRun: true });
        out = (await avif).encode(new Uint8Array(img.data.buffer), width, height, { ...AVIF_OPTS, quality: QUALITY.avif[quality] });
      } else {
        webp ??= webpFactory({ noInitialRun: true });
        out = (await webp).encode(img.data, width, height, { ...WEBP_OPTS, quality: QUALITY.webp[quality] });
      }
      if (!out) throw new Error('encode failed');
      buf = out.byteLength === out.buffer.byteLength ? out.buffer : out.slice().buffer;
    } else {
      const blob = await canvas.convertToBlob({ type: `image/${format}`, quality: q ?? QUALITY.jpeg[quality] });
      buf = await blob.arrayBuffer();
    }
    self.postMessage({ id, buf, width, height }, [buf]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};

function fit(w, h, maxEdge) {
  const edge = Math.max(w, h);
  if (!maxEdge || edge <= maxEdge) return { width: w, height: h };
  const s = maxEdge / edge;
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

// 缩小超过一半时逐级减半，避免一次性大比例缩放产生锯齿
function drawScaled(src, width, height, opaque) {
  let cur = src;
  let cw = src.width;
  let ch = src.height;
  while (cw / 2 >= width && ch / 2 >= height) {
    cw = Math.round(cw / 2);
    ch = Math.round(ch / 2);
    const step = new OffscreenCanvas(cw, ch);
    const c = step.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(cur, 0, 0, cw, ch);
    cur = step;
  }
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (opaque) {
    ctx.fillStyle = '#fff'; // JPEG 没有透明通道
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, width, height);
  return canvas;
}
