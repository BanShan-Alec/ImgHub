// 把浏览器端用到的编码器（jSquash 的单线程 AVIF / SIMD WebP）复制到 public/vendor/
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
];
for (const [from, to] of files) copyFileSync(join(root, 'node_modules', from), join(out, to));
console.log(`vendor: ${files.length} files -> public/vendor/`);
