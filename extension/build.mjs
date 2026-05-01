// build.mjs — esbuild pipeline for the Roam browser extension
// Usage:
//   node build.mjs             → single production build (Chrome)
//   node build.mjs --firefox   → single production build (Firefox)
//   node build.mjs --watch     → watch mode for development (Chrome)

import * as esbuild from 'esbuild';
import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import { copyFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const firefox = process.argv.includes('--firefox');

// ── Load env vars from root .env ────────────────────────────────────────────
function loadRootEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '../.env'), 'utf8');
    return Object.fromEntries(
      raw.split(/\r?\n/)
        .filter(line => /^[A-Z0-9_]+=/.test(line))
        .map(line => {
          const idx = line.indexOf('=');
          const key = line.slice(0, idx);
          const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          return [key, val];
        })
    );
  } catch {
    return {};
  }
}
const env = loadRootEnv();

const supabaseUrl = env.SUPABASE_URL;
const supabaseAnonKey = env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[roam] ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set in the root .env');
  process.exit(1);
}

const outdir = resolve(__dirname, firefox ? 'dist-firefox' : 'dist');
mkdirSync(outdir, { recursive: true });

// Copy static files that don't need bundling
function copyStatics() {
  const manifestSrc = firefox ? 'manifest.firefox.json' : 'manifest.json';
  copyFileSync(resolve(__dirname, manifestSrc),               resolve(outdir, 'manifest.json'));
  copyFileSync(resolve(__dirname, 'src/popup/popup.html'),     resolve(outdir, 'popup.html'));
  copyFileSync(resolve(__dirname, 'src/popup/popup.css'),      resolve(outdir, 'popup.css'));
  copyFileSync(resolve(__dirname, 'src/callback/callback.html'), resolve(outdir, 'callback.html'));
  for (const size of [16, 32, 48, 128]) {
    copyFileSync(
      resolve(__dirname, `icons/icon-${size}.png`),
      resolve(outdir, `icon-${size}.png`)
    );
  }
}

const sentryDsn = env.SENTRY_DSN ?? '';
const sentryAuthToken = env.SENTRY_AUTH_TOKEN ?? '';
const sentryOrg = env.SENTRY_ORG ?? '7-lynx';
const sentryProject = env.SENTRY_PROJECT ?? 'roam-extension';

// Derive a release identifier from package.json version + git SHA (best-effort)
let sentryRelease = 'unknown';
try {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
  sentryRelease = pkg.version ?? 'unknown';
} catch { /* ignore */ }

const sharedConfig = {
  bundle: true,
  minify: !watch,
  // In production: generate source maps with references so Sentry plugin can find them (uploaded, then deleted)
  // In watch mode: inline source maps for debugging
  sourcemap: true,
  target: firefox ? ['firefox121'] : ['chrome120'],
  define: {
    'process.env.NODE_ENV': watch ? '"development"' : '"production"',
    '__SUPABASE_URL__': JSON.stringify(supabaseUrl),
    '__SUPABASE_ANON_KEY__': JSON.stringify(supabaseAnonKey),
    '__SENTRY_DSN__': JSON.stringify(sentryDsn),
    '__ENVIRONMENT__': watch ? '"development"' : '"production"',
    '__SENTRY_RELEASE__': JSON.stringify(sentryRelease),
  },
};

const entryPoints = [
  // Popup UI — `out` is relative to outdir (esbuild appends .js)
  { in: resolve(__dirname, 'src/popup/popup.ts'), out: 'popup' },
  // Background service worker
  { in: resolve(__dirname, 'src/background/background.ts'), out: 'background' },
  // OAuth callback handler
  { in: resolve(__dirname, 'src/callback/callback.ts'), out: 'callback' },
];

if (watch) {
  const contexts = await Promise.all(
    entryPoints.map(({ in: entryPoint, out: name }) =>
      esbuild.context({ ...sharedConfig, entryPoints: [entryPoint], outfile: resolve(outdir, name + '.js'), format: 'iife' })
    )
  );

  copyStatics();
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('[roam] Watching for changes… (Ctrl+C to stop)');
} else {
  // Build all entry points; upload source maps to Sentry if auth token is present
  const canUploadMaps = !firefox && sentryDsn && sentryAuthToken;
  if (!canUploadMaps && sentryAuthToken) {
    console.warn('[roam] Skipping Sentry source map upload for Firefox build.');
  } else if (!sentryAuthToken) {
    console.warn('[roam] SENTRY_AUTH_TOKEN not set — source maps will NOT be uploaded to Sentry.');
  }

  // Single build call with all entry points + one Sentry plugin instance
  await esbuild.build({
    ...sharedConfig,
    entryPoints,
    outdir,
    format: 'iife',
    plugins: canUploadMaps ? [
      sentryEsbuildPlugin({
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProject,
        release: { name: sentryRelease },
        telemetry: false,
        sourcemaps: {
          assets: ['./dist/*.js', './dist/*.js.map'],
          filesToDeleteAfterUpload: ['./dist/*.js.map'],
        },
      }),
    ] : [],
  });
  copyStatics();
  console.log('[roam] Build complete → dist/');
}
