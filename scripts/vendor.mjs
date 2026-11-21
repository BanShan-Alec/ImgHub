// 把浏览器端用到的编码器（jSquash 的单线程 AVIF / SIMD WebP、mediabunny）复制到 public/vendor/
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'vendor');
mkdirSync(out, { recursive: true });

const files = [
  ['@jsquash/avif/codec/enc/avif_enc.js', 'avif_enc.js'],
  ['@jsquash/avif/codec/enc/avif_enc.wasm', 'avif_enc.wasm'],
  ['@jsquash/webp/codec/enc/webp_enc_simd.js', 'webp_enc_simd.js'],
  ['@jsquash/webp/codec/enc/webp_enc_simd.wasm', 'webp_enc_simd.wasm'],
  ['@jsquash/avif/LICENSE', 'LICENSE-jsquash-avif'],
  ['@jsquash/webp/LICENSE', 'LICENSE-jsquash-webp'],
  // 实况视频转码（MP4 拆包/封装 + WebCodecs），只在实况「压视频」档按需加载
  ['mediabunny/dist/bundles/mediabunny.min.mjs', 'mediabunny.min.mjs'],
  ['mediabunny/LICENSE', 'LICENSE-mediabunny'],
];
for (const [from, to] of files) copyFileSync(join(root, 'node_modules', from), join(out, to));
console.log(`vendor: ${files.length} files -> public/vendor/`);
