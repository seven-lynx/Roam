#!/usr/bin/env node
/**
 * Record screenshots + videos of every Roam web screen.
 *
 * Crawls the Next.js route map (every `page.tsx` under web/src/app) and captures each
 * screen in one or more shell modes (roam-os, classic, embed) at one or more
 * viewports. Output layout:
 *   <out>/<viewport>/<mode>/<screen-id>/screenshot.png   (+ video.webm)
 *   <out>/index.html  (gallery)  +  <out>/manifest.json
 *
 * The shell-mode decision is read from localStorage key `roam-webapp-theme`
 * (see web/src/components/EmbedGate.tsx), so this script sets that key before
 * navigating to force each mode deterministically.
 *
 * Usage (from the `web` workspace):
 *   pnpm record:screens                          # localhost:3000, desktop+mobile
 *   pnpm record:screens -- --base-url https://roamtheweb.app
 *   node scripts/record-screens.mjs --viewports desktop --modes roam-os --no-video
 *
 * Requires Playwright + downloaded browsers:
 *   pnpm add -D playwright && npx playwright install chromium
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '../src/app');
const DEFAULT_OUT = path.resolve(__dirname, '../../artifacts/visuals/web');

/** Dynamic routes need a concrete sample URL to navigate to. */
const DYNAMIC_SAMPLES = {
  'collections/[slug]': '/collections/sample-collection',
  'u/[username]': '/u/sample-user',
};

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/** Shell modes supported by EmbedGate. */
const MODES = ['roam-os', 'classic', 'embed'];

/**
 * In-OS windows + programs, reached by clicking the handheld app drawer rather
 * than a URL. `query` is the exact app-drawer tile label to search + click;
 * `icon` (README only) is a handheld home-screen tile. Titles match
 * `WINDOW_DEFAULTS` in WorkstationContext.tsx so we can verify the window.
 */
const OS_SURFACES = [
  { id: 'terminal', title: 'TERMINAL', query: 'TERMINAL' },
  { id: 'comms', title: 'COMMS', query: 'COMMS' },
  { id: 'roam', title: 'ROAM', query: 'Roam' },
  { id: 'settings', title: 'SETTINGS', query: 'Config' },
  { id: 'info', title: 'ROAM INFO', query: 'ROAM INFO' },
  { id: 'refuel', title: 'REFUEL', query: 'REFUEL' },
  { id: 'gallery', title: 'GALLERY', query: 'GALLERY' },
  { id: 'readme', title: 'README', icon: 'README' },
  { id: 'relay', title: 'RELAY', query: 'RELAY' },
  { id: 'botfield', title: 'BOTFIELD', query: 'BOTFIELD' },
  { id: 'compiler', title: 'COMPILER', query: 'COMPILER' },
  { id: 'debris', title: 'DEBRIS', query: 'DEBRIS' },
  { id: 'firewalk', title: 'FIREWALK', query: 'FIREWALK' },
  { id: 'underweb', title: 'UNDERWEB', query: 'UNDERWEB' },
  { id: 'substrate', title: 'SUBSTRATE', query: 'SUBSTRATE' },
];

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.WEB_BASE_URL || 'http://localhost:3000',
    out: process.env.VISUALS_OUT || DEFAULT_OUT,
    viewports: process.env.VIEWPORTS ? process.env.VIEWPORTS.split(',') : Object.keys(VIEWPORTS),
    modes: process.env.MODES ? process.env.MODES.split(',') : ['roam-os', 'classic'],
    video: process.env.RECORD_VIDEO !== 'false' && process.env.RECORD_VIDEO !== '0',
    settleMs: Number(process.env.SETTLE_MS || 700),
    only: process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null,
    storageState: process.env.STORAGE_STATE || null,
    extra: (process.env.EXTRA_ROUTES || '').split(',').filter(Boolean),
    osSurfaces: process.env.OS_SURFACES !== 'false' && process.env.OS_SURFACES !== '0',
    onlyOs: process.env.ONLY_OS ? new RegExp(process.env.ONLY_OS, 'i') : null,
  };

  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => rest[++i];
    switch (a) {
      case '--base-url': args.baseUrl = next(); break;
      case '--out': args.out = next(); break;
      case '--viewports': args.viewports = next().split(','); break;
      case '--modes': args.modes = next().split(','); break;
      case '--no-video': args.video = false; break;
      case '--settle': args.settleMs = Number(next()); break;
      case '--only': args.only = new RegExp(next(), 'i'); break;
      case '--storage-state': args.storageState = next(); break;
      case '--extra-routes': args.extra = next().split(',').filter(Boolean); break;
      case '--os-surfaces': args.osSurfaces = true; break;
      case '--no-os-surfaces': args.osSurfaces = false; break;
      case '--only-os': args.onlyOs = new RegExp(next(), 'i'); break;
      case '--help': console.log(usage()); process.exit(0); break;
      default:
        console.error(`Unknown argument: ${a}\n${usage()}`);
        process.exit(1);
    }
  }
  return args;
}

function usage() {
  return `Usage: record-screens.mjs [options]
  --base-url <url>       Roam origin (default http://localhost:3000)
  --out <dir>            Output dir (default artifacts/visuals/web)
  --viewports a,b        desktop,mobile (default both)
  --modes a,b,c          roam-os,classic,embed (default roam-os,classic)
  --no-video             Skip video recording
  --settle <ms>          Extra settle time after load (default 700)
  --only <regex>         Only capture screens matching id/path
  --storage-state <f>    Playwright storageState JSON (signed-in capture)
  --extra-routes a,b     Extra paths (real /u/<name>, /collections/<slug>)
  --no-os-surfaces       Skip in-OS windows/programs (terminal, games, …)
  --only-os <regex>      Only capture matching in-OS surfaces`;
}

function findFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findFiles(full));
    else out.push(full);
  }
  return out;
}

function slugFor(p) {
  if (!p || p === '/') return 'home';
  return (
    p.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'home'
  );
}

function deriveRoutes(extraRoutes) {
  const pages = findFiles(APP_DIR).filter((f) => path.basename(f) === 'page.tsx');
  const routes = pages.map((f) => {
    const rel = path.relative(APP_DIR, path.dirname(f)).split(path.sep).join('/');
    if (!rel) return { path: '/', id: 'home', label: 'Landing (/)' };
    if (rel.includes('[')) {
      const sample = DYNAMIC_SAMPLES[rel] || `/${rel.replace(/\[|\]/g, '')}`;
      return { path: sample, id: slugFor(sample), label: `${rel} (dynamic)` };
    }
    const r = `/${rel.replace(/\\/g, '/')}`;
    return { path: r, id: slugFor(r), label: r };
  });

  const seen = new Set(routes.map((r) => r.id));
  for (const extra of extraRoutes) {
    if (!seen.has(slugFor(extra))) {
      routes.push({ path: extra, id: slugFor(extra), label: `${extra} (extra)` });
      seen.add(slugFor(extra));
    }
  }
  return routes;
}

async function capture(browser, item, viewportName, viewport, mode, opts, manifest) {
  const outDir = path.join(opts.out, viewportName, mode, item.id);
  mkdirSync(outDir, { recursive: true });

  const context = await browser.newContext({
    viewport,
    recordVideo: opts.video
      ? { dir: outDir, size: { width: viewport.width, height: viewport.height } }
      : undefined,
    storageState: opts.storageState || undefined,
  });

  const page = await context.newPage();
  await page.addInitScript((m) => {
    try {
      localStorage.setItem('roam-webapp-theme', m === 'classic' ? 'classic' : 'roam-os');
    } catch {
      /* ignore */
    }
  }, mode);

  const url = new URL(item.path, opts.baseUrl);
  if (mode === 'embed') url.searchParams.set('embed', '1');

  let ok = true;
  let error = '';
  try {
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(opts.settleMs);

    await page
      .getByRole('button', { name: /accept|got it|agree|allow/i })
      .first()
      .click({ timeout: 800 })
      .catch(() => {});

    await page.screenshot({ path: path.join(outDir, 'screenshot.png') });
  } catch (e) {
    ok = false;
    error = e.message;
  } finally {
    await context.close().catch(() => {});
  }

  if (opts.video) {
    const video = readdirSync(outDir).find((f) => f.endsWith('.webm'));
    if (video && video !== 'video.webm') {
      try {
        renameSync(path.join(outDir, video), path.join(outDir, 'video.webm'));
      } catch {
        /* ignore */
      }
    }
  }

  manifest.push({
    id: item.id,
    label: item.label,
    path: item.path,
    viewport: viewportName,
    mode,
    screenshot: [viewportName, mode, item.id, 'screenshot.png'].join('/'),
    ok,
    error,
  });

  console.log(`${ok ? 'ok  ' : 'FAIL'} [${viewportName}][${mode}] ${item.path}`);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Click the button whose `labelSel` child contains exactly `text`. Returns
 * false (instead of throwing) when the label is absent or not clickable, so a
 * caller can fall through to the next opener.
 */
async function clickByExactLabel(scope, labelSel, text) {
  const label = scope
    .locator(labelSel)
    .filter({ hasText: new RegExp(`^${escapeRegExp(text)}$`) })
    .first();
  if ((await label.count()) === 0) return false;
  try {
    await label.locator('xpath=..').click({ timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a surface from the handheld all-apps drawer: dock Menu → search → tile.
 * ROAM-OS forces handheld layout during OS capture (`roam-ui-mode=handheld`), so
 * the dock Menu button always opens the drawer rather than the start menu.
 */
async function openViaDrawer(page, query) {
  const menu = page.locator('[role="toolbar"][aria-label="Dock"] button[aria-label="Menu"]');
  try {
    await menu.click({ timeout: 3000 });
  } catch {
    return false;
  }
  const drawer = page.locator('[role="dialog"][aria-label="All apps"]');
  try {
    await drawer.waitFor({ state: 'visible', timeout: 2500 });
  } catch {
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }
  await drawer.locator('input[aria-label="Search apps"]').fill(query);
  await page.waitForTimeout(150);
  return clickByExactLabel(drawer, '.app-tile-label', query);
}

/** Open a surface from a handheld home-screen tile (used for README). */
async function openViaIcon(page, label) {
  return clickByExactLabel(page, '.desktop-label', label);
}

async function captureOsSurface(browser, surface, viewportName, viewport, opts, manifest) {
  const id = `os/${surface.id}`;
  const outDir = path.join(opts.out, viewportName, 'roam-os', id);
  mkdirSync(outDir, { recursive: true });

  const context = await browser.newContext({
    viewport,
    recordVideo: opts.video
      ? { dir: outDir, size: { width: viewport.width, height: viewport.height } }
      : undefined,
    storageState: opts.storageState || undefined,
  });

  const page = await context.newPage();
  // Force ROAM-OS + handheld so the app drawer is the universal launcher and the
  // desktop README auto-open (desktop-only) doesn't interfere.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('roam-webapp-theme', 'roam-os');
      localStorage.setItem('roam-ui-mode', 'handheld');
    } catch {
      /* ignore */
    }
  });

  let ok = true;
  let error = '';
  try {
    await page.goto(new URL('/', opts.baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(opts.settleMs);

    await page
      .getByRole('button', { name: /accept|got it|agree|allow/i })
      .first()
      .click({ timeout: 800 })
      .catch(() => {});

    const opened = surface.icon ? await openViaIcon(page, surface.icon) : await openViaDrawer(page, surface.query ?? surface.title);
    if (!opened) {
      throw new Error(`No opener could launch ${surface.title} (${surface.icon ? `icon "${surface.icon}"` : `drawer "${surface.query}"`})`);
    }

    const win = page.locator(`section[role="dialog"][aria-label="${surface.title}"]`).first();
    await win.waitFor({ state: 'visible', timeout: 8_000 });
    await page.waitForTimeout(opts.settleMs);
    await page.screenshot({ path: path.join(outDir, 'screenshot.png') });
  } catch (e) {
    ok = false;
    error = e.message;
  } finally {
    await context.close().catch(() => {});
  }

  if (opts.video) {
    const video = readdirSync(outDir).find((f) => f.endsWith('.webm'));
    if (video && video !== 'video.webm') {
      try {
        renameSync(path.join(outDir, video), path.join(outDir, 'video.webm'));
      } catch {
        /* ignore */
      }
    }
  }

  manifest.push({
    id,
    label: surface.title,
    path: `os:${surface.title}`,
    viewport: viewportName,
    mode: 'roam-os',
    screenshot: [viewportName, 'roam-os', id, 'screenshot.png'].join('/'),
    ok,
    error,
  });

  console.log(`${ok ? 'ok  ' : 'FAIL'} [${viewportName}][roam-os] ${surface.title} (os/${surface.id})`);
}

function writeGallery(out, manifest) {
  const byViewport = {};
  for (const m of manifest) (byViewport[m.viewport] ||= []).push(m);

  const cards = Object.entries(byViewport)
    .map(([vp, items]) => {
      const body = items
        .map(
          (it) => `<div class="card ${it.ok ? '' : 'fail'}">
  <img src="${it.screenshot}" alt="${it.label}" loading="lazy" onerror="this.parentNode.classList.add('missing')">
  <div class="cap"><code>${it.mode}/${it.id}</code><span>${it.label}</span></div>
</div>`,
        )
        .join('');
      return `<h2>${vp}</h2><div class="grid">${body}</div>`;
    })
    .join('\n');

  writeFileSync(
    path.join(out, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8"><title>Roam web screens</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;background:#0b0b10;color:#e6e6eb;padding:24px;margin:0}
h1{font-size:20px}h2{margin:24px 0 8px;color:#9aa}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.card{background:#14141b;border:1px solid #26262f;border-radius:8px;overflow:hidden}
.card img{width:100%;display:block;background:#000}.card.fail,.card.missing{border-color:#7a2a2a}
.cap{padding:8px 10px;color:#9aa;display:flex;flex-direction:column;gap:2px}
.cap code{color:#cff;font-size:12px}.cap span{font-size:13px}
</style></head><body><h1>Roam web screens</h1>${cards}</body></html>`,
  );
  writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

async function main() {
  const opts = parseArgs(process.argv);
  const routes = deriveRoutes(opts.extra);
  const screens = opts.only
    ? routes.filter((r) => opts.only.test(r.id) || opts.only.test(r.path))
    : routes;

  const total = screens.length * opts.viewports.length * opts.modes.length;
  console.log(`Capturing ${total} screens (${screens.length} routes x ${opts.viewports.length} viewport(s) x ${opts.modes.length} mode(s)).`);
  console.log(`Base URL: ${opts.baseUrl}`);
  console.log(`Output:   ${opts.out}`);

  mkdirSync(opts.out, { recursive: true });
  const browser = await chromium.launch();
  const manifest = [];

  for (const viewportName of opts.viewports) {
    const viewport = VIEWPORTS[viewportName];
    if (!viewport) {
      console.warn(`Unknown viewport "${viewportName}", skipping.`);
      continue;
    }
    for (const mode of opts.modes) {
      if (!MODES.includes(mode)) {
        console.warn(`Unknown mode "${mode}", skipping.`);
        continue;
      }
      for (const item of screens) {
        await capture(browser, item, viewportName, viewport, mode, opts, manifest);
      }
    }
  }

  // In-OS windows & programs (only meaningful in roam-os; classic/embed have no
  // window manager). Always captured in forced handheld layout so the app drawer
  // is the universal launcher on both viewports.
  if (opts.osSurfaces && opts.modes.includes('roam-os')) {
    const osScreens = opts.onlyOs
      ? OS_SURFACES.filter((s) => opts.onlyOs.test(s.id) || opts.onlyOs.test(s.title) || (s.query && opts.onlyOs.test(s.query)))
      : OS_SURFACES;
    if (osScreens.length) {
      console.log(`In-OS surfaces: ${osScreens.length * opts.viewports.length} captures (${osScreens.length} surfaces x ${opts.viewports.length} viewport(s), handheld layout).`);
    }
    for (const viewportName of opts.viewports) {
      const viewport = VIEWPORTS[viewportName];
      if (!viewport) continue;
      for (const surface of osScreens) {
        await captureOsSurface(browser, surface, viewportName, viewport, opts, manifest);
      }
    }
  }

  await browser.close();
  writeGallery(opts.out, manifest);
  const failed = manifest.filter((m) => !m.ok).length;
  console.log(`\nDone. Captured ${manifest.length} screens (${failed} failed).`);
  console.log(`Review: ${path.join(opts.out, 'index.html')}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


