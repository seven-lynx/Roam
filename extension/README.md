# Roam Extension ΓÇö Source Code Build Instructions

This document is provided for Mozilla AMO reviewers to reproduce the Firefox extension build from source.

## Build Environment

| Item | Value |
|------|-------|
| OS | Windows 11 or Ubuntu 24.04 LTS (both supported) |
| Node.js | v24.x (tested on v24.15.0) |
| pnpm | v10.x (tested on v10.33.2) |
| Architecture | x64 or ARM64 |

The default Mozilla reviewer environment (Ubuntu 24.04 ARM64, Node 24.x) is fully compatible.

## Prerequisites

### 1. Install pnpm

pnpm is the package manager used by this project. Install it via npm:

```bash
npm install -g pnpm
```

### 2. Create the environment file

The build reads two public configuration values from a `.env` file located **one directory above** the `extension/` folder (i.e. at the repo root). Both values are the Supabase public anon key ΓÇö they are already embedded in the distributed extension and visible to all users.

Create `../.env` (relative to this `extension/` directory) with the following content:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=sb_publishable_YOUR_KEY_HERE
```

These are the same values baked into the submitted extension package.

### 3. Install dependencies

From the `extension/` directory:

```bash
pnpm install
```

This will install all dependencies as pinned in `pnpm-lock.yaml`.

## Building the Firefox Extension

```bash
pnpm run build -- --firefox
```

This produces the `dist-firefox/` directory containing:

- `manifest.json` (copied from `manifest.firefox.json`)
- `background.js` ΓÇö service worker bundle
- `popup.js`, `popup.html`, `popup.css` ΓÇö popup UI
- `callback.js`, `callback.html` ΓÇö OAuth callback handler
- `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`
- `roam-extension-firefox.zip` ΓÇö the final extension package

## Verifying the Build

The generated `dist-firefox/roam-extension-firefox.zip` should match the submitted extension zip. You can compare the two using any diff tool on the unzipped contents.

Note: Source maps (`background.js.map`, `popup.js.map`, `callback.js.map`) are included in the Firefox build for debugging and will appear in the zip. **Sentry source map upload is skipped** for Firefox builds ΓÇö no `SENTRY_AUTH_TOKEN` is required.

## Build Script Overview

- `build.mjs` ΓÇö esbuild orchestration script (bundles TypeScript, copies statics, creates zip)
- `src/background/background.ts` ΓÇö service worker (auth, routing, queue management)
- `src/popup/popup.ts` ΓÇö popup UI logic
- `src/callback/callback.ts` ΓÇö OAuth PKCE callback handler
- `src/lib/` ΓÇö shared utilities (Supabase client, message types, queue)

## Third-Party Libraries

All third-party code is loaded from npm and listed in `package.json`. No libraries have been modified. Dependencies:

- `@supabase/supabase-js` ΓÇö Supabase client (auth, database, edge functions)
- `@sentry/browser` ΓÇö Error monitoring SDK (source of the `innerHTML` warnings flagged by the validator ΓÇö this is internal Sentry SDK code, not extension code)
- `esbuild` ΓÇö TypeScript bundler (build-time only)