// build.mjs — esbuild pipeline for the Roam browser extension
// Usage:
//   node build.mjs             → single production build (Chrome)
//   node build.mjs --firefox   → single production build (Firefox)
//   node build.mjs --watch     → watch mode for development (Chrome)

import * as esbuild from 'esbuild';
import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import { copyFileSync, mkdirSync, readFileSync, createWriteStream, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

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

const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
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

// Create a zip file from the dist folder for store submission
function createZip() {
  return new Promise((promiseResolve, reject) => {
    const zipPath = resolve(outdir, firefox ? 'roam-extension-firefox.zip' : 'roam-extension.zip');
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      const zipName = firefox ? 'roam-extension-firefox.zip' : 'roam-extension.zip';
      console.log(`[roam] Zip archive created: ${zipName} (${archive.pointer()} bytes)`);
      promiseResolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    output.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add all files from dist except the zip file itself
    const files = readdirSync(outdir).filter(f => !f.endsWith('.zip'));
    for (const file of files) {
      const filePath = resolve(outdir, file);
      archive.file(filePath, { name: file });
    }

    archive.finalize();
  });
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

// Firefox-specific plugin: replace src/lib/sentry.ts with a no-op stub so that
// @sentry/browser (and its innerHTML usage via rrweb/Preact) is tree-shaken
// out of the build artifact entirely.
function sentryFirefoxStubPlugin() {
  return {
    name: 'sentry-firefox-stub',
    setup(build) {
      // The resolved path on Windows uses backslashes. Match either separator.
      build.onLoad(
        { filter: /[\\\/]lib[\\\/]sentry\.ts$/ },
        () => ({
          contents:
            'function noop() {}\n' +
            'export const Sentry = { init: noop, captureException: noop, captureMessage: noop };\n',
          loader: 'ts',
        }),
      );
    },
  };
}

const sharedConfig = {
  bundle: true,
  minify: !watch,
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
  { in: resolve(__dirname, 'src/popup/popup.ts'), out: 'popup' },
  { in: resolve(__dirname, 'src/background/background.ts'), out: 'background' },
  { in: resolve(__dirname, 'src/callback/callback.ts'), out: 'callback' },
];

if (watch) {
  const contexts = await Promise.all(
    entryPoints.map(({ in: entryPoint, out: name }) =>
      esbuild.context({
        ...sharedConfig,
        plugins: firefox ? [sentryFirefoxStubPlugin()] : [],
        entryPoints: [entryPoint],
        outfile: resolve(outdir, name + '.js'),
        format: 'iife',
      })
    )
  );

  copyStatics();
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('[roam] Watching for changes… (Ctrl+C to stop)');
} else {
  const canUploadMaps = sentryDsn && sentryAuthToken;
  if (!sentryAuthToken) {
    console.warn('[roam] SENTRY_AUTH_TOKEN not set — source maps will NOT be uploaded to Sentry.');
  }

  const buildPlugins = [];
  if (firefox) {
    buildPlugins.push(sentryFirefoxStubPlugin());
  }
  if (canUploadMaps && !firefox) {
    buildPlugins.push(
      sentryEsbuildPlugin({
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProject,
        release: { name: sentryRelease, setCommits: { auto: true } },
        telemetry: false,
        sourcemaps: {
          assets: ['./dist/*.js', './dist/*.js.map'],
          filesToDeleteAfterUpload: ['./dist/*.js.map'],
        },
      }),
    );
  }

  await esbuild.build({
    ...sharedConfig,
    plugins: buildPlugins,
    entryPoints,
    outdir,
    format: 'iife',
  });
  copyStatics();
  try {
    await createZip();
  } catch (err) {
    console.error('[roam] Error creating zip file:', err);
    process.exit(1);
  }
  console.log('[roam] Build complete → dist/');
}