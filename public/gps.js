// 去除定位：把文件里的 GPS 信息原地清零，文件长度与结构不变（MPF 偏移、实况视频位置都不受影响，HDR 照样保留）
//   EXIF   找所有「Exif\0\0 + TIFF 头」（JPEG 主图 / 增益图、HEIC、AVIF、WebP 都是这个写法），清空 GPS IFD 及其数据
//   XMP    exif:GPS… 属性与元素换成等长空格
//   MP4    ©xyz（Android / 多数相机）、loci（3GPP）改成 free 盒并清零
// PNG 的 eXIf 块带 CRC，没处理（手机很少写）；QuickTime 的 com.apple.quicktime.location 也没处理

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
const EXIF = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"

/** 返回去掉定位后的 Blob；没有定位信息时返回原 Blob */
export async function stripGps(blob) {
  const u8 = new Uint8Array(await blob.arrayBuffer());
  const n = stripExif(u8) + stripXmp(u8) + stripMp4(u8);
  return n ? new Blob([u8], { type: blob.type }) : blob;
}

// 在 u8 里找字节序列，返回下标或 -1
function find(u8, seq, from) {
  for (let i = u8.indexOf(seq[0], from); i >= 0 && i <= u8.length - seq.length; i = u8.indexOf(seq[0], i + 1)) {
    let k = 1;
    while (k < seq.length && u8[i + k] === seq[k]) k++;
    if (k === seq.length) return i;
  }
  return -1;
}

function stripExif(u8) {
  let count = 0;
  for (let i = find(u8, EXIF, 0); i >= 0; i = find(u8, EXIF, i + 6)) {
    const t = i + 6; // TIFF 头
    if (t + 8 > u8.length) break;
    const le = u8[t] === 0x49 && u8[t + 1] === 0x49 && u8[t + 2] === 0x2a && u8[t + 3] === 0;
    const be = u8[t] === 0x4d && u8[t + 1] === 0x4d && u8[t + 2] === 0 && u8[t + 3] === 0x2a;
    if (!le && !be) continue;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const u16 = (o) => dv.getUint16(o, le);
    const u32 = (o) => dv.getUint32(o, le);
    const ok = (o, len) => o >= t && o + len <= u8.length;
    const ifd0 = t + u32(t + 4);
    if (!ok(ifd0, 2)) continue;
    const n0 = u16(ifd0);
    if (!ok(ifd0 + 2, n0 * 12)) continue;
    for (let e = 0; e < n0; e++) {
      const p = ifd0 + 2 + e * 12;
      if (u16(p) !== 0x8825) continue; // GPS IFD 指针
      const gps = t + u32(p + 8);
      if (!ok(gps, 2)) break;
      const n = u16(gps);
      if (!n || !ok(gps + 2, n * 12)) break;
      for (let g = 0; g < n; g++) {
        const q = gps + 2 + g * 12;
        const len = (TYPE_SIZE[u16(q + 2)] || 1) * u32(q + 4);
        const at = t + u32(q + 8);
        if (len > 4 && ok(at, len)) u8.fill(0, at, at + len); // 放在别处的值（经纬度等）
      }
      u8.fill(0, gps, gps + 2 + n * 12); // 条目数归零，条目本身也清掉
      count++;
      break;
    }
  }
  return count;
}

// XMP 只出现在文件头部附近（JPEG 的 APP1、HEIF 的 mime 项），扫前 2MB
function stripXmp(u8) {
  const end = Math.min(u8.length, 2 * 1024 * 1024);
  let s = '';
  for (let i = 0; i < end; i += 65536) s += String.fromCharCode(...u8.subarray(i, Math.min(end, i + 65536)));
  if (!s.includes('exif:GPS')) return 0;
  let count = 0;
  const re = /\sexif:GPS\w+="[^"]*"|<exif:GPS(\w+)\b[^>]*>[\s\S]*?<\/exif:GPS\1>|<exif:GPS\w+\b[^>]*\/>/g;
  for (const m of s.matchAll(re)) {
    // 只替换 ASCII 范围，长度按字节不变
    if (/[^\x20-\x7e\s]/.test(m[0])) continue;
    u8.fill(0x20, m.index, m.index + m[0].length);
    count++;
  }
  return count;
}

const FREE = [0x66, 0x72, 0x65, 0x65];
function stripMp4(u8) {
  let count = 0;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  // ©xyz：size(4) '©xyz' strlen(2) lang(2) "+31.2304+121.4737/"
  for (let i = find(u8, [0xa9, 0x78, 0x79, 0x7a], 4); i >= 0; i = find(u8, [0xa9, 0x78, 0x79, 0x7a], i + 4)) {
    const size = dv.getUint32(i - 4);
    if (size < 12 || size > 256 || i - 4 + size > u8.length) continue;
    const len = dv.getUint16(i + 4);
    if (len + 12 !== size) continue;
    const str = String.fromCharCode(...u8.subarray(i + 8, i + 8 + len));
    if (!/^[+-][\d.+\-/A-Za-z]*$/.test(str)) continue;
    u8.set(FREE, i);
    u8.fill(0, i + 4, i - 4 + size);
    count++;
  }
  // loci：size(4) 'loci' version/flags(4) lang(2) name\0 role(1) lon(4) lat(4) alt(4) body\0 notes\0
  for (let i = find(u8, [0x6c, 0x6f, 0x63, 0x69], 4); i >= 0; i = find(u8, [0x6c, 0x6f, 0x63, 0x69], i + 4)) {
    const size = dv.getUint32(i - 4);
    if (size < 26 || size > 512 || i - 4 + size > u8.length || dv.getUint32(i + 4) !== 0) continue;
    u8.set(FREE, i);
    u8.fill(0, i + 4, i - 4 + size);
    count++;
  }
  return count;
}
