// build.mjs — esbuild pipeline for the Roam browser extension
// Usage:
//   node build.mjs          → single production build
//   node build.mjs --watch  → watch mode for development

import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

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

const outdir = resolve(__dirname, 'dist');
mkdirSync(outdir, { recursive: true });

// Copy static files that don't need bundling
function copyStatics() {
  copyFileSync(resolve(__dirname, 'manifest.json'),        resolve(outdir, 'manifest.json'));
  copyFileSync(resolve(__dirname, 'src/popup/popup.html'), resolve(outdir, 'popup.html'));
  copyFileSync(resolve(__dirname, 'src/popup/popup.css'),  resolve(outdir, 'popup.css'));
  for (const size of [16, 32, 48, 128]) {
    copyFileSync(
      resolve(__dirname, `icons/icon-${size}.png`),
      resolve(outdir, `icon-${size}.png`)
    );
  }
}

const sharedConfig = {
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  target: ['chrome120', 'firefox121'],
  define: {
    'process.env.NODE_ENV': watch ? '"development"' : '"production"',
    '__SUPABASE_URL__': JSON.stringify(supabaseUrl),
    '__SUPABASE_ANON_KEY__': JSON.stringify(supabaseAnonKey),
  },
};

const entryPoints = [
  // Popup UI
  { in: resolve(__dirname, 'src/popup/popup.ts'), out: resolve(outdir, 'popup') },
  // Background service worker
  { in: resolve(__dirname, 'src/background/background.ts'), out: resolve(outdir, 'background') },
];

if (watch) {
  const contexts = await Promise.all(
    entryPoints.map(({ in: entryPoint, out: outfile }) =>
      esbuild.context({ ...sharedConfig, entryPoints: [entryPoint], outfile: outfile + '.js', format: 'iife' })
    )
  );

  copyStatics();
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('[roam] Watching for changes… (Ctrl+C to stop)');
} else {
  await Promise.all(
    entryPoints.map(({ in: entryPoint, out: outfile }) =>
      esbuild.build({ ...sharedConfig, entryPoints: [entryPoint], outfile: outfile + '.js', format: 'iife' })
    )
  );
  copyStatics();
  console.log('[roam] Build complete → dist/');
}
