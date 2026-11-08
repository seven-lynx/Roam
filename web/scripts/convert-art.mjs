/**
 * One-time asset pipeline: convert source JPEGs (isolated objects on a
 * near-black background) into keyed, web-optimized WebP under
 * web/public/desk/<slug>-<variant>.webp.
 *
 * Keying: flood-fill from the border. Pixels connected to the border and close
 * in colour to the border colour become transparent. This preserves *enclosed*
 * dark subjects (e.g. black cables) that a luminance threshold would erase.
 * `brushed-metal-texture` is full-bleed and stays opaque.
 *
 * Usage:  node web/scripts/convert-art.mjs
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, '.roam-local', 'assets', 'webapp_art');
const OUT = path.join(ROOT, 'web', 'public', 'desk');

const MAX_DIM = 900; // longest side
const QUALITY = 84;
const ALPHA_QUALITY = 92;
const TOL = 26; // RGB euclidean distance for the background key
const PAD = 6; // transparent padding after trim

// Source filename stem (without -a/-b) -> output slug. Keep in sync with
// src/lib/art.ts ArtSlug.
const SLUGS = {
  '35mm-camera': 'camera',
  'blank-brass-plaque': 'plaque',
  'blank-instant-photo': 'polaroid',
  'brushed-metal-texture': 'metal',
  'cassette-tape': 'cassette',
  'coiled-cable': 'coil-cable',
  'cyberdeck-terminal': 'cyberdeck',
  'floppy-disk': 'floppy',
  'handheld-gps': 'gps',
  'ide-ribbon-cable': 'ribbon-cable',
  'loose-cable': 'loose-cable',
  'nixie-tube-module': 'nixie',
  'notebook-closed': 'notebook-closed',
  'notebook-open': 'notebook-open',
  'radar-puck': 'radar',
  'rotary-knob': 'knob',
  'sticky-notes': 'sticky',
  'surveyor-compass': 'compass',
  'vacuum-tube': 'vacuum',
  'vent-port-plate': 'vent',
};

// Full-bleed textures that must stay opaque and untrimmed.
const OPAQUE = new Set(['metal']);

/**
 * Mark border-connected, background-coloured pixels transparent and return the
 * buffer. Uses an explicit ring buffer so large images cannot overflow the
 * stack.
 */
function keyOutBlack(px, width, height) {
  // Mean colour of the outermost 2px ring = the background reference.
  let n = 0;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  for (let y = 0; y < height; y++) {
    for (const x of [0, 1, width - 2, width - 1]) {
      const i = (y * width + x) * 4;
      sr += px[i];
      sg += px[i + 1];
      sb += px[i + 2];
      n++;
    }
  }
  for (let x = 0; x < width; x++) {
    for (const y of [0, 1, height - 2, height - 1]) {
      const i = (y * width + x) * 4;
      sr += px[i];
      sg += px[i + 1];
      sb += px[i + 2];
      n++;
    }
  }
  const br = sr / n;
  const bg = sg / n;
  const bb = sb / n;

  const tol2 = TOL * TOL;
  const isBg = (x, y) => {
    const i = (y * width + x) * 4;
    const dr = px[i] - br;
    const dg = px[i + 1] - bg;
    const db = px[i + 2] - bb;
    return dr * dr + dg * dg + db * db < tol2;
  };

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const seed = (x, y) => {
    const idx = y * width + x;
    if (!visited[idx] && isBg(x, y)) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }

  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];
  while (head < tail) {
    const idx = queue[head++];
    const cx = idx % width;
    const cy = (idx / width) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + dx[d];
      const ny = cy + dy[d];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (visited[ni]) continue;
      if (isBg(nx, ny)) {
        visited[ni] = 1;
        queue[tail++] = ni;
      }
    }
  }

  for (let i = 0; i < width * height; i++) {
    if (visited[i]) px[i * 4 + 3] = 0;
  }
  return px;
}

/** Bounding box of opaque pixels (after keying), or null if empty. */
function opaqueBounds(px, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function convert(file) {
  const stem = file.replace(/\.jpe?g$/i, '');
  const m = stem.match(/^(.*)-([ab])$/);
  if (!m) return;
  const slug = SLUGS[m[1]];
  if (!slug) return;
  const variant = m[2];
  const outPath = path.join(OUT, `${slug}-${variant}.webp`);

  const resized = sharp(path.join(SRC, file))
    .rotate()
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true });

  if (OPAQUE.has(slug)) {
    await resized.webp({ quality: 88 }).toFile(outPath);
    console.log(`opaque  ${slug}-${variant}`);
    return;
  }

  const { data, info } = await resized
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const keyed = keyOutBlack(Buffer.from(data), info.width, info.height);
  const bounds = opaqueBounds(keyed, info.width, info.height);
  if (!bounds) {
    console.log(`EMPTY   ${slug}-${variant} (skipped)`);
    return;
  }

  await sharp(keyed, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(bounds)
    .extend({
      top: PAD,
      bottom: PAD,
      left: PAD,
      right: PAD,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: QUALITY, alphaQuality: ALPHA_QUALITY })
    .toFile(outPath);
  console.log(`keyed   ${slug}-${variant} (${bounds.width}x${bounds.height})`);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const files = (await fs.readdir(SRC)).filter((f) => /\.jpe?g$/i.test(f));
  if (files.length === 0) {
    console.error(`No JPEGs found in ${SRC}`);
    process.exit(1);
  }
  for (const file of files.sort()) {
    await convert(file);
  }
  console.log(`\nDone. ${files.length} source files -> ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
