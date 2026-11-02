/**
 * Slice the cyberdeck control sheets into individual keyed PNGs.
 *
 * The two sheets are renders of the *same* control layout in two states
 * (off/un-toggled vs on/toggled) on a flat magenta background. This script:
 *   1. keys the magenta background to transparency (border flood-fill, like
 *      convert-art.mjs, plus a mild magenta despill on surviving edges),
 *   2. finds each control via connected components,
 *   3. pairs the two sheets by centroid and emits one off/on pair per control
 *      into web/public/cyberdeck/controls/control-NN-{off,on}.png,
 *   4. writes a self-contained contact-sheet.html so the controls can be named.
 *
 * Usage: node web/scripts/slice-controls.mjs
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, '.roam-local', 'assets', 'webapp_art', 'cyberdeck');
const OUT = path.join(ROOT, 'web', 'public', 'cyberdeck', 'controls');

const TOL = 40; // RGB euclidean distance for the magenta key
const PAD = 8; // transparent padding around each slice
const MIN_COMP = 300; // ignore connected components smaller than this (px)

const W = 1774;
const H = 887;

async function loadRaw(file) {
  return sharp(path.join(SRC, `${file}.jpeg`))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

/**
 * Mark border-connected, background-coloured pixels transparent, then despill
 * magenta from the surviving edge pixels. Mutates `px` in place.
 */
function keyOut(px, width, height, tol) {
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

  const tol2 = tol * tol;
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

  const dx = [1, -1, 0, 0, 1, 1, -1, -1];
  const dy = [0, 0, 1, -1, 1, -1, 1, -1];
  while (head < tail) {
    const idx = queue[head++];
    const cx = idx % width;
    const cy = (idx / width) | 0;
    for (let d = 0; d < 8; d++) {
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

  // Mild despill: a magenta fringe has the green channel suppressed. Pull it up
  // toward min(r,b) so surviving edge pixels lose their magenta tint. Genuine
  // green/amber/cyan/red glow is untouched (its green channel is high, or its
  // blue channel is low).
  for (let i = 0; i < width * height; i++) {
    if (px[i * 4 + 3] === 0) continue;
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    const lo = Math.min(r, b);
    if (g < lo - 20) px[i * 4 + 1] = lo;
  }
  return px;
}

/** 8-connected components of opaque pixels, with bbox, area and mean luminance. */
function findComponents(px, width, height) {
  const visited = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  const dx = [1, -1, 0, 0, 1, 1, -1, -1];
  const dy = [0, 0, 1, -1, 1, -1, 1, -1];
  const comps = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (visited[start] || px[start * 4 + 3] === 0) continue;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let count = 0;
      let lum = 0;
      let sp = 0;
      stack[sp++] = start;
      visited[start] = 1;
      while (sp > 0) {
        const ci = stack[--sp];
        const cx = ci % width;
        const cy = (ci / width) | 0;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        count++;
        const o = ci * 4;
        lum += (px[o] + px[o + 1] + px[o + 2]) / 3;
        for (let d = 0; d < 8; d++) {
          const nx = cx + dx[d];
          const ny = cy + dy[d];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (visited[ni] || px[ni * 4 + 3] === 0) continue;
          visited[ni] = 1;
          stack[sp++] = ni;
        }
      }
      if (count >= MIN_COMP) {
        comps.push({
          left: minX,
          top: minY,
          right: maxX,
          bottom: maxY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
          count,
          meanLum: lum / count,
        });
      }
    }
  }

  comps.sort((a, b) => a.top - b.top || a.left - b.left);
  return comps;
}

/** Greedy nearest-centroid pairing of sheet A components to sheet B components. */
function pair(aComps, bComps) {
  const used = new Set();
  const pairs = [];
  for (const a of aComps) {
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < bComps.length; j++) {
      if (used.has(j)) continue;
      const b = bComps[j];
      const dx = a.left + a.right - (b.left + b.right);
      const dy = a.top + a.bottom - (b.top + b.bottom);
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best >= 0) {
      used.add(best);
      pairs.push([a, bComps[best]]);
    }
  }
  return pairs;
}

function unionBox(a, b) {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const rawA = await loadRaw('cyberdeck-controls-1');
  const rawB = await loadRaw('cyberdeck-controls-2');
  const A = Buffer.from(rawA.data);
  const B = Buffer.from(rawB.data);
  keyOut(A, W, H, TOL);
  keyOut(B, W, H, TOL);

  const compsA = findComponents(A, W, H);
  const compsB = findComponents(B, W, H);
  console.log(`components: sheet1=${compsA.length} sheet2=${compsB.length}`);

  const avgLum = (cs) => {
    let s = 0;
    let n = 0;
    for (const c of cs) {
      s += c.meanLum * c.count;
      n += c.count;
    }
    return s / n;
  };
  const lumA = avgLum(compsA);
  const lumB = avgLum(compsB);
  // The brighter sheet is the "on" state (lit indicators / glow).
  const offIsA = lumA <= lumB;
  console.log(
    `mean luminance: sheet1=${lumA.toFixed(1)} sheet2=${lumB.toFixed(1)} -> sheet${offIsA ? '1' : '2'}=off, sheet${offIsA ? '2' : '1'}=on`
  );

  const pairs = pair(compsA, compsB);
  if (pairs.length !== Math.max(compsA.length, compsB.length)) {
    console.warn(`WARN: paired ${pairs.length} of ${Math.max(compsA.length, compsB.length)} components`);
  }

  const cards = [];
  console.log('\n idx | bbox (off)             lum  | bbox (on)              lum');
  console.log('-----+-----------------------------+----------------------------');

  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    const idx = String(i + 1).padStart(2, '0');
    const off = offIsA ? a : b;
    const on = offIsA ? b : a;
    const box = unionBox(a, b);
    const boxW = box.right - box.left + 1;
    const boxH = box.bottom - box.top + 1;

    const offSlice = await sharp(offIsA ? A : B, { raw: { width: W, height: H, channels: 4 } })
      .extract({ left: box.left, top: box.top, width: boxW, height: boxH })
      .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const onSlice = await sharp(offIsA ? B : A, { raw: { width: W, height: H, channels: 4 } })
      .extract({ left: box.left, top: box.top, width: boxW, height: boxH })
      .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    await fs.writeFile(path.join(OUT, `control-${idx}-off.png`), offSlice);
    await fs.writeFile(path.join(OUT, `control-${idx}-on.png`), onSlice);

    const f = (c) => `${c.width}x${c.height}@${c.left},${c.top}`;
    console.log(
      ` ${idx}  | ${f(off).padEnd(19)} ${off.meanLum.toFixed(1).padStart(5)} | ${f(on).padEnd(19)} ${on.meanLum.toFixed(1).padStart(5)}`
    );

    cards.push({
      idx,
      off: offSlice.toString('base64'),
      on: onSlice.toString('base64'),
      offMeta: f(off),
      onMeta: f(on),
    });
  }

  await fs.writeFile(path.join(OUT, 'contact-sheet.html'), contactSheet(cards));
  console.log(`\nWrote ${pairs.length * 2} slices + contact-sheet.html -> ${OUT}`);
}

function contactSheet(cards) {
  const items = cards
    .map(
      (c) => `
    <div class="card">
      <div class="label">control-${c.idx}</div>
      <div class="row">
        <figure><img src="data:image/png;base64,${c.off}" alt="off"><figcaption>off</figcaption></figure>
        <figure><img src="data:image/png;base64,${c.on}" alt="on"><figcaption>on</figcaption></figure>
      </div>
      <div class="meta">off ${c.offMeta} · on ${c.onMeta}</div>
    </div>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Cyberdeck controls — name me</title>
<style>
  body { background:#0d0d0f; color:#e6e6e6; font: 14px/1.4 system-ui, sans-serif; margin:24px; }
  h1 { font-size:20px; }
  p.help { color:#9a9a9a; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:20px; margin-top:20px; }
  .card { background:#16161a; border:1px solid #2a2a30; border-radius:10px; padding:14px; }
  .label { font-weight:600; font-size:16px; margin-bottom:10px; color:#7fd7ff; }
  .row { display:flex; gap:12px; align-items:flex-start; }
  figure { margin:0; text-align:center; }
  img { background:#222; border-radius:6px; max-width:100%; height:auto; }
  figcaption { color:#8a8a8a; font-size:11px; margin-top:4px; }
  .meta { color:#9a9a9a; font-size:11px; margin-top:10px; }
</style>
</head>
<body>
<h1>Cyberdeck controls</h1>
<p class="help">Each control is shown in both states (off / on). Reply with a name for each index,
e.g. <code>01=nixie, 02=slider-left, ...</code>.</p>
<div class="grid">${items}
</div>
</body>
</html>`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
