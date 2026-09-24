const path = require('path');
const sharp = require('../frontend/node_modules/sharp');

async function loadRaw(src) {
  return sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function cropOpaque(out, w, h, pad = 6) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (out[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return { left: 0, top: 0, width: w, height: h };
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(w - 1, maxX + pad);
  const bottom = Math.min(h - 1, maxY + pad);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Kenardan saf siyah zemini sil — gri yazı / renkli ikon kalsın */
function removeNearBlackBg(out, w, h, lumMax = 18) {
  const visited = new Uint8Array(w * h);
  const stack = [];
  const isBg = (i) => {
    if (out[i + 3] < 8) return true;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat > 0.18 && max > 35) return false; // ikon
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum <= lumMax;
  };
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isBg(p * 4)) stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    out[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

/** Kalan koyu nötr pikselleri (yazı) beyaza çevir */
function whitenRemainingText(out, w) {
  const textRight = Math.floor(w * 0.62);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] < 10) continue;
    const x = (i / 4) % w;
    if (x > textRight) continue;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat > 0.28 && max > 70) continue;
    if (lum >= 140) continue;
    const t = Math.max(0.15, Math.min(1, (140 - lum) / 140));
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = Math.round(255 * Math.pow(t, 0.65));
  }
}

async function writePng(raw, w, h, outPath) {
  const region = cropOpaque(raw, w, h);
  await sharp(Buffer.from(raw), { raw: { width: w, height: h, channels: 4 } })
    .extract(region)
    .png()
    .toFile(outPath);
  console.log(path.basename(outPath), `${region.width}x${region.height}`);
}

async function main() {
  const src = path.join(__dirname, '../frontend/public/brand/logo-full.jpg');
  const { data, info } = await loadRaw(src);
  const { width: w, height: h } = info;

  // Login — şeffaf + koyu yazı
  const light = Buffer.from(data);
  removeNearBlackBg(light, w, h, 16);
  await writePng(light, w, h, path.join(__dirname, '../frontend/public/brand/logo.png'));

  // Sidebar — şeffaf + beyaz yazı
  const dark = Buffer.from(data);
  removeNearBlackBg(dark, w, h, 16);
  whitenRemainingText(dark, w);
  await writePng(dark, w, h, path.join(__dirname, '../frontend/public/brand/logo-full.png'));
  await writePng(Buffer.from(dark), w, h, path.join(__dirname, '../frontend/public/brand/logo-white.png'));

  const iconSrc =
    'C:/Users/Baran/.cursor/projects/c-Users-Baran-Desktop-G-zel-Teknoloji-anypay-tahsilat/assets/c__Users_Baran_AppData_Roaming_Cursor_User_workspaceStorage_bda72762d068d0383fe9f87659a7c910_images_ikon-8ce6fc83-9ccb-4336-aa28-a4a60ce41b63.png';
  const icon = await loadRaw(iconSrc);
  const iconBuf = Buffer.from(icon.data);
  removeNearBlackBg(iconBuf, icon.info.width, icon.info.height, 22);
  await sharp(iconBuf, {
    raw: { width: icon.info.width, height: icon.info.height, channels: 4 },
  })
    .png()
    .toFile(path.join(__dirname, '../frontend/public/brand/logo-icon.png'));
  console.log('logo-icon.png cleaned');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
