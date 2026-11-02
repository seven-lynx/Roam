/**
 * Detect "screen" regions in the keyed desk-art WebPs so the diegetic overlays
 * (sat-nav readout, cyberdeck code, compass needle, notebook pages) can be
 * anchored to the real hardware in each photo.
 *
 * Heuristic: find the densest cluster of bright, saturated "phosphor" pixels
 * (green / teal / amber / cyan) inside the opaque (keyed) part of the image,
 * and report its bounding box as a normalized rect (0..1). For the compass we
 * additionally report the centroid of its bright circular dial face.
 *
 * Usage: node scripts/detect-screens.mjs
 */
import sharp from 'sharp';

const TARGETS = ['gps-a', 'cyberdeck-a', 'compass-a', 'notebook-open-a'];

/** Is this pixel a glowing "screen" colour? */
function isScreen(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx < 110) return false; // must be bright
  if (mx - mn < 24) return false; // must be saturated
  const greenish = g >= r && g >= b && g > 90;
  const teal = g > 80 && b > 80 && r < g;
  const amber = r > 140 && g > 90 && b < 95;
  const cyan = g > 100 && b > 100 && r < 90;
  return greenish || teal || amber || cyan;
}

function isBright(r, g, b) {
  return (r + g + b) / 3 > 120;
}

async function analyze(name) {
  const { data, info } = await sharp(`public/desk/${name}.webp`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels } = info;
  const step = Math.max(1, Math.floor(Math.min(W, H) / 220)); // coarse scan for speed

  const screenPts = [];
  const brightPts = [];
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels >= 4 ? data[i + 3] : 255;
      if (a < 40) continue; // transparent (keyed) padding
      if (isScreen(r, g, b)) screenPts.push([x, y]);
      if (isBright(r, g, b)) brightPts.push([x, y]);
    }
  }

  const rect = (pts) => {
    if (!pts.length) return null;
    let minX = W, minY = H, maxX = 0, maxY = 0;
    let sx = 0, sy = 0;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sx += x;
      sy += y;
    }
    const cx = sx / pts.length;
    const cy = sy / pts.length;
    return {
      x: minX / W,
      y: minY / H,
      w: (maxX - minX) / W,
      h: (maxY - minY) / H,
      cx: cx / W,
      cy: cy / H,
      n: pts.length,
    };
  };

  console.log(`\n=== ${name} (${W}x${H}) ===`);
  console.log('  screen pixels:', screenPts.length, '->', JSON.stringify(rect(screenPts)));
  console.log('  bright pixels:', brightPts.length, '->', JSON.stringify(rect(brightPts)));
}

for (const t of TARGETS) {
  try {
    await analyze(t);
  } catch (e) {
    console.error(`\n=== ${t} === ERROR:`, e.message);
  }
}
