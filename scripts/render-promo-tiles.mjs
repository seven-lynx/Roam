import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, "..", "assets");

const iconPath = path.join(__dirname, "..", "extension", "icons", "icon-128.png");
const iconBase64 = fs.readFileSync(iconPath).toString("base64");
const iconDataUrl = `data:image/png;base64,${iconBase64}`;

// Feature items for the right panel of marquee tiles
function featureItems() {
  return [
    { emoji: "🔀", title: "Random Discovery", desc: "Stumble upon fascinating sites you never knew existed" },
    { emoji: "📚", title: "Hundreds of Topics", desc: "Hand-picked categories from history to science to sports" },
    { emoji: "⚡", title: "One Click Away", desc: "Instant serendipity right from your browser toolbar" },
  ];
}

function makeHtml(width, height, isChrome) {
  const h = height;
  const isSmall = h === 280;

  const storeAccent1 = isChrome ? "rgba(66,133,244,0.10)" : "rgba(255,149,0,0.08)";
  const storeAccent2 = isChrome ? "rgba(66,133,244,0.15)" : "rgba(255,149,0,0.12)";
  const storeName = isChrome ? "Chrome Extension" : "Firefox Extension";
  const storeLabel = isChrome ? "Available on Chrome Web Store" : "🦊 Available on Firefox Add-ons";
  const dotStyle = isChrome
    ? "background: linear-gradient(135deg, #4285F4, #34A853, #FBBC04, #EA4335);"
    : "background: #e94560; box-shadow: 0 0 4px #e94560;";

  const starCount = isSmall ? 12 : 40;
  const stars = [];
  for (let i = 0; i < starCount; i++) {
    stars.push({
      left: ((i * 137.508) % 100).toFixed(1),
      top: ((i * 97.631) % 100).toFixed(1),
      size: (1 + (i % 2) * 1).toFixed(0),
      opacity: (0.12 + (i % 4) * 0.09).toFixed(2),
    });
  }

  // ── Small tile: compact centered layout ──
  if (isSmall) {
    const iconPx = 48;
    const titlePx = 28;
    const taglinePx = 11;
    const badgePx = 10;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: ${width}px; height: ${height}px;
  background: linear-gradient(135deg, #0d0d24 0%, #1a1a2e 35%, #16213e 65%, #0f1630 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; position: relative;
}
.bg-mesh {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 15% 20%, rgba(233,69,96,0.12) 0%, transparent 55%),
    radial-gradient(ellipse 50% 60% at 85% 75%, ${storeAccent1} 0%, transparent 55%),
    radial-gradient(ellipse 40% 40% at 50% 50%, rgba(233,69,96,0.04) 0%, transparent 60%);
  pointer-events: none;
}
.slash {
  position: absolute; top: -20%; right: -10%; width: 40%; height: 150%;
  background: linear-gradient(180deg, rgba(233,69,96,0.05) 0%, rgba(233,69,96,0.10) 40%, rgba(233,69,96,0.02) 60%, transparent 80%);
  transform: rotate(-12deg); pointer-events: none; border-radius: 999px;
}
${stars.map((s, i) => `.s${i} { position:absolute; left:${s.left}%; top:${s.top}%; width:${s.size}px; height:${s.size}px; border-radius:50%; background:rgba(233,233,234,${s.opacity}); pointer-events:none; }`).join("\n")}
.content {
  position: relative; z-index: 2; display: flex; flex-direction: column;
  align-items: center; gap: 4px; text-align: center; padding: 20px;
}
.icon-wrap { position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
.icon-ring {
  position: absolute; width: 62px; height: 62px; border-radius: 50%;
  border: 1px solid transparent; border-top-color: rgba(233,69,96,0.5); border-right-color: rgba(233,69,96,0.25);
}
.icon { width: 48px; height: 48px; border-radius: 12px; box-shadow: 0 0 24px rgba(233,69,96,0.25), 0 4px 16px rgba(0,0,0,0.3); position: relative; z-index: 1; }
.title-row { display: flex; align-items: baseline; gap: 5px; }
.title { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: 0.02em; text-shadow: 0 0 14px rgba(233,69,96,0.25); line-height: 1; }
.title-accent { font-size: 15px; font-weight: 600; color: #e94560; }
.tagline { font-size: 11px; color: #999; line-height: 1.5; max-width: 330px; }
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  background: linear-gradient(135deg, rgba(233,69,96,0.18), ${storeAccent2});
  border: 1px solid rgba(233,69,96,0.35); border-radius: 8px;
  padding: 3px 12px; font-size: 10px; color: #e94560; font-weight: 600;
  letter-spacing: 0.02em; margin-top: 2px;
}
.badge-dot { width: 6px; height: 6px; border-radius: 50%; ${dotStyle} }
.store-foot {
  position: absolute; bottom: 8px; right: 12px; display: flex; align-items: center;
  gap: 5px; font-size: 9px; color: #555; letter-spacing: 0.03em; font-weight: 500;
}
.store-dot { width: 6px; height: 6px; border-radius: 50%; ${dotStyle} }
</style>
</head>
<body>
<div class="bg-mesh"></div><div class="slash"></div>
${stars.map((_, i) => `<div class="s${i}"></div>`).join("\n")}
<div class="content">
  <div class="icon-wrap"><div class="icon-ring"></div><img class="icon" src="${iconDataUrl}" alt="Roam icon" /></div>
  <div class="title-row"><span class="title">Roam</span><span class="title-accent">✦</span></div>
  <div class="tagline">Discover the web again. Jump to something interesting with one click.</div>
  <div class="badge"><span class="badge-dot"></span>${storeName}</div>
</div>
<div class="store-foot"><div class="store-dot"></div>${storeLabel}</div>
</body>
</html>`;
  }

  // ── Marquee tile: split layout, left brand + right features ──
  const iconPx = 100;
  const titlePx = 46;
  const taglinePx = 15;
  const badgePx = 14;
  const features = featureItems();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: ${width}px; height: ${height}px;
  background: linear-gradient(135deg, #0d0d24 0%, #1a1a2e 35%, #16213e 65%, #0f1630 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; position: relative;
}
.bg-mesh {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 55% 55% at 12% 30%, rgba(233,69,96,0.12) 0%, transparent 55%),
    radial-gradient(ellipse 50% 60% at 88% 65%, ${storeAccent1} 0%, transparent 55%),
    radial-gradient(ellipse 35% 35% at 50% 50%, rgba(233,69,96,0.04) 0%, transparent 60%);
  pointer-events: none;
}
.slash {
  position: absolute; top: -20%; right: -8%; width: 35%; height: 150%;
  background: linear-gradient(180deg, rgba(233,69,96,0.05) 0%, rgba(233,69,96,0.08) 40%, rgba(233,69,96,0.01) 60%, transparent 80%);
  transform: rotate(-10deg); pointer-events: none; border-radius: 999px;
}
${stars.map((s, i) => `.s${i} { position:absolute; left:${s.left}%; top:${s.top}%; width:${s.size}px; height:${s.size}px; border-radius:50%; background:rgba(233,233,234,${s.opacity}); pointer-events:none; }`).join("\n")}

/* ── Main layout: two columns ── */
.main-row {
  position: relative; z-index: 2; display: flex; align-items: center;
  width: 100%; height: 100%; padding: 40px 50px 50px 50px;
  gap: 40px;
}

/* ── Left panel: brand ── */
.left-panel {
  flex: 0 0 380px; display: flex; flex-direction: column;
  align-items: center; text-align: center; gap: 12px;
}
.icon-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
.icon-ring {
  position: absolute; width: 130px; height: 130px; border-radius: 50%;
  border: 2px solid transparent; border-top-color: rgba(233,69,96,0.5); border-right-color: rgba(233,69,96,0.25);
}
.icon { width: 100px; height: 100px; border-radius: 25px; box-shadow: 0 0 50px rgba(233,69,96,0.25), 0 8px 30px rgba(0,0,0,0.3); position: relative; z-index: 1; }
.title-row { display: flex; align-items: baseline; gap: 8px; }
.title { font-size: 46px; font-weight: 800; color: #fff; letter-spacing: 0.02em; text-shadow: 0 0 20px rgba(233,69,96,0.25); line-height: 1; }
.title-accent { font-size: 25px; font-weight: 600; color: #e94560; }
.tagline { font-size: 15px; color: #aaa; line-height: 1.5; max-width: 340px; }
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, rgba(233,69,96,0.18), ${storeAccent2});
  border: 1px solid rgba(233,69,96,0.35); border-radius: 12px;
  padding: 7px 18px; font-size: 14px; color: #e94560; font-weight: 600;
  letter-spacing: 0.02em; margin-top: 4px;
}
.badge-dot { width: 8px; height: 8px; border-radius: 50%; ${dotStyle} }

/* ── Divider ── */
.divider {
  width: 1px; height: 200px;
  background: linear-gradient(180deg, transparent, rgba(233,69,96,0.2), transparent);
}

/* ── Right panel: features ── */
.right-panel {
  flex: 1; display: flex; flex-direction: column; gap: 20px; padding-left: 10px;
}
.feature-card {
  display: flex; align-items: flex-start; gap: 16px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; padding: 16px 20px;
}
.feature-emoji {
  font-size: 28px; line-height: 1; flex-shrink: 0; width: 44px; text-align: center;
}
.feature-text { display: flex; flex-direction: column; gap: 3px; }
.feature-title { font-size: 16px; font-weight: 700; color: #e0e0e0; }
.feature-desc { font-size: 13px; color: #888; line-height: 1.5; }

/* ── Store foot ── */
.store-foot {
  position: absolute; bottom: 16px; right: 24px; display: flex; align-items: center;
  gap: 6px; font-size: 11px; color: #555; letter-spacing: 0.03em; font-weight: 500; z-index: 3;
}
.store-dot { width: 8px; height: 8px; border-radius: 50%; ${dotStyle} }
</style>
</head>
<body>
<div class="bg-mesh"></div><div class="slash"></div>
${stars.map((_, i) => `<div class="s${i}"></div>`).join("\n")}
<div class="main-row">
  <div class="left-panel">
    <div class="icon-wrap"><div class="icon-ring"></div><img class="icon" src="${iconDataUrl}" alt="Roam icon" /></div>
    <div class="title-row"><span class="title">Roam</span><span class="title-accent">✦</span></div>
    <div class="tagline">Discover the web again. Jump to something interesting with one click.</div>
    <div class="badge"><span class="badge-dot"></span>${storeName}</div>
  </div>
  <div class="divider"></div>
  <div class="right-panel">
${features.map(f => `    <div class="feature-card">
      <span class="feature-emoji">${f.emoji}</span>
      <div class="feature-text">
        <span class="feature-title">${f.title}</span>
        <span class="feature-desc">${f.desc}</span>
      </div>
    </div>`).join("\n")}
  </div>
</div>
<div class="store-foot"><div class="store-dot"></div>${storeLabel}</div>
</body>
</html>`;
}

async function main() {
  const browser = await puppeteer.launch({ headless: "new" });

  const tiles = [
    { name: "firefox-promo-small", width: 440, height: 280, chrome: false },
    { name: "firefox-promo-marquee", width: 1400, height: 560, chrome: false },
    { name: "chrome-promo-small", width: 440, height: 280, chrome: true },
    { name: "chrome-promo-marquee", width: 1400, height: 560, chrome: true },
  ];

  for (const { name, width, height, chrome } of tiles) {
    const html = makeHtml(width, height, chrome);
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const outputPath = path.join(outputDir, `${name}.png`);
    await page.screenshot({ path: outputPath, type: "png", omitBackground: false });
    console.log(`✓ Saved ${name}.png (${width}×${height})`);
    await page.close();
  }

  await browser.close();
  console.log("\nDone!");
}

main().catch(e => { console.error(e); process.exit(1); });