#!/usr/bin/env node
/**
 * Export a signed-in Playwright storageState JSON by opening a headed Chromium
 * and letting you sign in manually. The saved file (cookies + localStorage,
 * which covers Supabase's default localStorage session) feeds
 * `record-screens.mjs --storage-state`.
 *
 * Usage (from the `web` workspace):
 *   node scripts/make-storage-state.mjs
 *   node scripts/make-storage-state.mjs -- --base-url http://localhost:3000 --out ../../artifacts/visuals/web/storageState.json
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(__dirname, '../../artifacts/visuals/web/storageState.json');

function usage() {
  return `Usage: make-storage-state.mjs [options]
  --base-url <url>    Roam origin (default http://localhost:3000)
  --out <file>        Output JSON path (default artifacts/visuals/web/storageState.json)
  --max-wait <sec>    How long to wait for sign-in (default 600)`;
}

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.WEB_BASE_URL || 'http://localhost:3000',
    outFile: process.env.STORAGE_STATE_OUT || DEFAULT_OUT,
    maxWaitMs: Number(process.env.STORAGE_STATE_WAIT_MS || 600) * 1000,
  };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => rest[++i];
    switch (a) {
      case '--base-url': args.baseUrl = next(); break;
      case '--out': args.outFile = next(); break;
      case '--max-wait': args.maxWaitMs = Number(next()) * 1000; break;
      case '--help': console.log(usage()); process.exit(0); break;
      default:
        console.error(`Unknown argument: ${a}\n${usage()}`);
        process.exit(1);
    }
  }
  return args;
}

function isAuthPage(u) {
  const p = new URL(u).pathname;
  return (
    p.startsWith('/signup') ||
    p.startsWith('/forgot') ||
    p.startsWith('/auth') ||
    p.includes('reset-password')
  );
}

async function main() {
  const args = parseArgs(process.argv);
  mkdirSync(path.dirname(args.outFile), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(new URL('/signup?mode=signin', args.baseUrl).toString(), { waitUntil: 'domcontentloaded' });

  console.log('────────────────────────────────────────────────────────────');
  console.log('Sign in manually in the browser window that just opened.');
  console.log('This saves cookies + localStorage once you leave the auth');
  console.log('pages (or the timeout elapses), so magic links work too.');
  console.log('────────────────────────────────────────────────────────────');

  const deadline = Date.now() + args.maxWaitMs;
  let lastDot = 0;
  let done = false;
  while (Date.now() < deadline) {
    if (context.pages().some((p) => !isAuthPage(p.url()))) {
      // Small settle so the Supabase client persists the session.
      await page.waitForTimeout(2500);
      done = true;
      break;
    }
    if (Date.now() - lastDot > 5000) {
      process.stdout.write('.');
      lastDot = Date.now();
    }
    await page.waitForTimeout(1500);
  }
  console.log();
  if (!done) console.log('Timeout reached; saving whatever session state exists now.');

  await context.storageState({ path: args.outFile });
  console.log(`Saved: ${args.outFile}`);
  console.log(`Use:  node scripts/record-screens.mjs --storage-state ${args.outFile}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
