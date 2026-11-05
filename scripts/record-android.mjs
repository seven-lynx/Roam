#!/usr/bin/env node
/**
 * Run every Maestro flow in `.maestro/flows/android` against a connected device
 * or emulator, capturing a debug output (video + screenshots) per flow.
 *
 * Prereqs:
 *   - Maestro CLI installed (https://maestro.mobile.dev/getting-started/installing-maestro)
 *   - A booted Android emulator or physical device (adb devices)
 *   - The debug APK installed, or pass --app to install it first:
 *       maestro test uses the installed app (appId app.roam.android)
 *
 * Usage:
 *   node scripts/record-android.mjs
 *   node scripts/record-android.mjs --device emulator-5554 --flow discover
 *   ROAM_EMAIL=you@example.com ROAM_PASSWORD=secret node scripts/record-android.mjs
 */

import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLOWS_DIR = path.resolve(__dirname, '../.maestro/flows/android');
const DEFAULT_OUT = process.env.VISUALS_OUT || path.resolve(__dirname, '../artifacts/visuals/android');

function parseArgs(argv) {
  const args = { device: '', flow: '', out: DEFAULT_OUT, app: '' };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const next = () => rest[++i];
    switch (a) {
      case '--device': args.device = next(); break;
      case '--flow': args.flow = next(); break;
      case '--out': args.out = next(); break;
      case '--app': args.app = next(); break; // optional APK to install first
      case '--help': console.log(usage()); process.exit(0); break;
      default:
        console.error(`Unknown argument: ${a}`);
        console.log(usage());
        process.exit(1);
    }
  }
  return args;
}

function usage() {
  return `Usage: record-android.mjs [options]
  --device <id>   adb device id (optional; auto-detected if one device)
  --flow <name>   Only run the flow matching this basename (e.g. discover)
  --out <dir>     Output root (default artifacts/visuals/android)
  --app <apk>     Install this APK before running flows`;
}

function flows() {
  if (!existsSync(FLOWS_DIR)) {
    console.error(`No flows directory found at ${FLOWS_DIR}`);
    process.exit(1);
  }
  return readdirSync(FLOWS_DIR)
    .filter((f) => f.endsWith('.yaml') && !f.startsWith('_')) // subflows start with _
    .sort();
}

function maestroArgs(args) {
  const a = ['test'];
  if (args.device) a.push('--device', args.device);
  // Forward the seeded test account into the login subflow.
  if (process.env.ROAM_EMAIL) a.push('-e', `ROAM_EMAIL=${process.env.ROAM_EMAIL}`);
  if (process.env.ROAM_PASSWORD) a.push('-e', `ROAM_PASSWORD=${process.env.ROAM_PASSWORD}`);
  return a;
}

function main() {
  const args = parseArgs(process.argv);
  const list = flows();
  const targets = args.flow ? list.filter((f) => f.startsWith(args.flow)) : list;
  if (!targets.length) {
    console.error(`No flows to run. Available: ${list.join(', ')}`);
    process.exit(1);
  }

  mkdirSync(args.out, { recursive: true });

  if (args.app) {
    console.log(`Installing ${args.app} ...`);
    const inst = spawnSync('adb', ['install', '-r', args.app], { stdio: 'inherit' });
    if (inst.status !== 0) process.exit(inst.status ?? 1);
  }

  let failed = 0;
  for (const flow of targets) {
    const name = flow.replace(/\.yaml$/, '');
    const outDir = path.join(args.out, name);
    mkdirSync(outDir, { recursive: true });
    console.log(`\n===== ${flow} =====`);
    const res = spawnSync(
      'maestro',
      [...maestroArgs(args), path.join(FLOWS_DIR, flow), '--debug-output', outDir, '--flatten-debug-output'],
      { stdio: 'inherit' },
    );
    if (res.status !== 0) {
      failed++;
      console.error(`FAILED: ${flow}`);
    }
  }

  console.log(`\nDone. ${targets.length - failed}/${targets.length} flows passed.`);
  console.log(`Artifacts in: ${args.out}`);
  if (failed) process.exitCode = 1;
}

main();
