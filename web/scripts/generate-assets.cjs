/*
 * Generates the SmartTraffic Analytics raster icons and social card.
 *
 * Everything is drawn from the same geometry as `web/src/components/Brand.tsx`
 * so the favicon, the PWA icons and the Open Graph card stay in sync with the
 * inline SVG wordmark. Run with:  node web/scripts/generate-assets.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public');

const INK = [0x0e, 0x42, 0x25, 255];
const PRIMARY = [0x28, 0x73, 0x4a, 255];
const SURFACE = [0xf6, 0xed, 0xcc, 255];
const LINE = [0xeb, 0xe0, 0xba, 255];
const BG = [0xfb, 0xf5, 0xdd, 255];

/* ---------------------------------------------------------------- canvas */

function canvas(w, h) {
  return { w, h, data: Buffer.alloc(w * h * 4) };
}

function blend(c, x, y, colour) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const a = colour[3] / 255;
  if (a === 1) {
    const i = (y * c.w + x) * 4;
    c.data[i] = colour[0];
    c.data[i + 1] = colour[1];
    c.data[i + 2] = colour[2];
    c.data[i + 3] = 255;
    return;
  }
  const i = (y * c.w + x) * 4;
  c.data[i] = Math.round(c.data[i] * (1 - a) + colour[0] * a);
  c.data[i + 1] = Math.round(c.data[i + 1] * (1 - a) + colour[1] * a);
  c.data[i + 2] = Math.round(c.data[i + 2] * (1 - a) + colour[2] * a);
  c.data[i + 3] = Math.max(c.data[i + 3], Math.round(255 * a));
}

function roundRect(c, x, y, w, h, radius, colour) {
  const r = Math.min(radius, w / 2, h / 2);
  for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
    for (let px = Math.floor(x); px < Math.ceil(x + w); px++) {
      const cx = Math.min(Math.max(px + 0.5, x + r), x + w - r);
      const cy = Math.min(Math.max(py + 0.5, y + r), y + h - r);
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r + 0.0001) blend(c, px, py, colour);
    }
  }
}

function polygon(c, points, colour) {
  const ys = points.map((p) => p[1]);
  const xs = points.map((p) => p[0]);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(c.h - 1, Math.ceil(Math.max(...ys)));
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(c.w - 1, Math.ceil(Math.max(...xs)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (inside(points, x + 0.5, y + 0.5)) blend(c, x, y, colour);
    }
  }
}

function inside(points, px, py) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Thick line drawn as a rotated quad so we never need a stroke rasteriser. */
function bar(c, x1, y1, x2, y2, width, colour) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  polygon(c, [
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x2 - nx, y2 - ny],
    [x1 - nx, y1 - ny],
  ], colour);
}

/** Antialiasing by supersampling the whole mark. */
function mark(size, supersample = 4) {
  const c = canvas(size, size);
  const s = size * supersample;
  const t = canvas(s, s);
  const u = (v) => (v / 48) * s;

  roundRect(t, u(1.5), u(1.5), u(45), u(45), u(13), INK);

  // dashed centre line
  for (let x = 11; x < 37; x += 9) {
    bar(t, u(x), u(34), u(Math.min(x + 4, 37)), u(34), u(2.5), LINE);
  }

  // shield
  const shield = [
    [24, 9.5],
    [12.5, 15],
    [12.5, 25.5],
    [17.5, 32.4],
    [24, 36.5],
    [30.5, 32.4],
    [35.5, 25.5],
    [35.5, 15],
  ].map(([x, y]) => [u(x), u(y)]);
  polygon(t, shield, SURFACE);
  const inner = [
    [24, 11.6],
    [14.2, 16.2],
    [14.2, 25.3],
    [18.7, 31.3],
    [24, 34.9],
    [29.3, 31.3],
    [33.8, 25.3],
    [33.8, 16.2],
  ].map(([x, y]) => [u(x), u(y)]);
  polygon(t, inner, PRIMARY);

  // signal plate + cross
  roundRect(t, u(18.5), u(20), u(11), u(11), u(2.5), SURFACE);
  bar(t, u(18.5), u(24.2), u(29.5), u(24.2), u(1.6), PRIMARY);
  bar(t, u(22.2), u(20), u(22.2), u(31), u(1.6), PRIMARY);

  // downsample
  const n = supersample;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const i = ((y * n + sy) * s + (x * n + sx)) * 4;
          const al = t.data[i + 3] / 255;
          r += t.data[i] * al;
          g += t.data[i + 1] * al;
          b += t.data[i + 2] * al;
          a += al;
        }
      }
      const o = (y * size + x) * 4;
      if (a === 0) continue;
      c.data[o] = Math.round(r / a);
      c.data[o + 1] = Math.round(g / a);
      c.data[o + 2] = Math.round(b / a);
      c.data[o + 3] = Math.round((a / (n * n)) * 255);
    }
  }
  return c;
}

/* ------------------------------------------------------------------ png */

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(c) {
  const raw = Buffer.alloc(c.h * (c.w * 4 + 1));
  for (let y = 0; y < c.h; y++) {
    raw[y * (c.w * 4 + 1)] = 0;
    c.data.copy(raw, y * (c.w * 4 + 1) + 1, y * c.w * 4, (y + 1) * c.w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function icoFile(pngBuffers) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngBuffers.length, 4);
  const dir = Buffer.alloc(16 * pngBuffers.length);
  let offset = 6 + 16 * pngBuffers.length;
  pngBuffers.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir[o] = size >= 256 ? 0 : size;
    dir[o + 1] = size >= 256 ? 0 : size;
    dir[o + 2] = 0;
    dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngBuffers.map((p) => p.data)]);
}

/* ----------------------------------------------------------------- write */

function write(name, buf, dir = OUT) {
  fs.writeFileSync(path.join(dir, name), buf);
  console.log(`${path.relative(path.join(__dirname, '..'), path.join(dir, name)).padEnd(34)} ${(buf.length / 1024).toFixed(1)} kB`);
}

[16, 32, 180, 192, 512].forEach((size) => {
  write(`icon-${size}.png`, png(mark(size)));
});
const ico = icoFile([16, 32].map((size) => ({ size, data: png(mark(size)) })));
write('favicon.ico', ico);

/* ---------------------------------------------------- social share card */

function socialCard() {
  const W = 1200;
  const H = 630;
  const c = canvas(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) blend(c, x, y, BG);
  }
  // header band
  roundRect(c, 0, 0, W, 104, 0, INK);
  // header dashes
  for (let x = 64; x < 460; x += 46) bar(c, x, 52, x + 22, 52, 7, LINE);
  // footer band
  roundRect(c, 0, H - 12, W, 12, 0, PRIMARY);

  // big mark
  const m = mark(300, 3);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      const i = (y * m.w + x) * 4;
      if (m.data[i + 3] === 0) continue;
      blend(c, 96 + x, 170 + y, [m.data[i], m.data[i + 1], m.data[i + 2], 255]);
    }
  }

  // risk distribution bars
  const bars = [0.32, 0.46, 0.72, 0.94];
  const tones = [[0x34, 0xd3, 0x99], [0xfb, 0xbf, 0x24], [0xf9, 0x73, 0x16], [0xef, 0x44, 0x44]];
  bars.forEach((v, i) => {
    const x = 500 + i * 150;
    roundRect(c, x, 200, 96, 320, 18, [0x0e, 0x42, 0x25, 16]);
    roundRect(c, x, 200 + 320 * (1 - v), 96, 320 * v, 18, [...tones[i], 255]);
  });

  // risk gauge arc
  for (let a = Math.PI; a <= 2 * Math.PI; a += 0.001) {
    const r = 118;
    const cx = 760;
    const cy = 570;
    for (let w = -9; w <= 9; w++) {
      const rr = r + w;
      blend(c, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), PRIMARY);
    }
  }
  return png(c);
}

write('og-image.png', socialCard());

/* App-router metadata files take precedence over `public/`, so mirror them. */
const APP = path.join(__dirname, '..', 'src', 'app');
write('favicon.ico', ico, APP);
write('icon.png', png(mark(512)), APP);
write('apple-icon.png', png(mark(180)), APP);
write('opengraph-image.png', socialCard(), APP);
write('twitter-image.png', socialCard(), APP);
