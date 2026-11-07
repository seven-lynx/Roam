# Visual recording — every screen across Roam platforms

**Last Updated:** 2026-11-07

Automated capture of **screenshots + videos** for every screen of the Web app
and the Android app. (iOS does not exist yet, and the browser extension is
intentionally out of scope for now — see [Limitations](#limitations).)

We deliberately use the best tool per surface rather than one tool everywhere:

| Platform | Tool | Why |
|---|---|---|
| **Android** | [Maestro](https://maestro.mobile.dev) | Native mobile driver; YAML flows; auto-records a video + screenshots per flow. No app-code changes. |
| **Web** | [Playwright](https://playwright.dev) | The web surface is a *desktop* windowed OS (ROAM-OS) plus account/admin pages. Maestro is a mobile driver and can't drive desktop Chromium; Playwright has first-class `recordVideo` + `screenshot()` and matches the existing TS/Node stack. |

## Repo layout

```
.maestro/flows/android/          Maestro flows (one per Android screen)
  _signin.yaml                   login subflow (email/password, uses env vars)
  discover.yaml, profile.yaml, … 16 screen flows
scripts/record-android.mjs       Node runner: loops the flows, runs `maestro test`
web/scripts/record-screens.mjs   Playwright crawler for the web route map + in-OS surfaces
web/scripts/make-storage-state.mjs  headed-browser helper to export a signed-in storageState JSON
.github/workflows/visual-record.yml   CI (cron + manual dispatch)
artifacts/visuals/               output (gitignored)
```

## Prerequisites

```bash
# Android
curl -Ls "https://get.maestro.mobile.dev" | bash   # Maestro CLI
# …plus a booted emulator/physical device (adb devices) with the debug APK installed.

# Web (run once; this also registers `playwright` in pnpm-lock.yaml)
cd web
pnpm install
npx playwright install chromium
```

## Web recording

The crawler derives its screen list from the real route map
(`web/src/app/**/page.tsx`) so it never drifts from the pages. Each route is
captured in every shell mode × every viewport.

```bash
cd web
pnpm record:screens                          # localhost:3000, desktop+mobile, roam-os+classic, +video
pnpm record:screens -- --base-url https://roamtheweb.app
node scripts/record-screens.mjs --viewports desktop --modes roam-os --no-video
node scripts/record-screens.mjs --only badges        # filter by id/path
```

### Flags

| Flag | Default | Meaning |
|---|---|---|
| `--base-url <url>` | `http://localhost:3000` | Roam origin to record |
| `--out <dir>` | `artifacts/visuals/web` | Output root |
| `--viewports a,b` | `desktop,mobile` | `1440×900` and `390×844` |
| `--modes a,b,c` | `roam-os,classic` | Shell modes (also `embed`) |
| `--no-video` | video on | Screenshots only |
| `--settle <ms>` | `700` | Extra settle time after load |
| `--only <regex>` | — | Only capture matching ids/paths |
| `--storage-state <f>` | — | Playwright `storageState` JSON (signed-in) |
| `--extra-routes a,b` | — | Extra paths (real `/u/<name>`, `/collections/<slug>`) |
| `--no-os-surfaces` | on | Skip in-OS windows & programs (terminal, games, …) |
| `--only-os <regex>` | — | Only capture matching in-OS surface ids/titles |

### Shell modes

`EmbedGate` (`web/src/components/EmbedGate.tsx`) chooses the shell from
`localStorage["roam-webapp-theme"]`: `classic` → `ClassicShell`, otherwise the
ROAM-OS workstation. The crawler sets that key before each navigation:

- **`roam-os`** — the ROAM-OS desktop; internal app routes render as OS windows.
- **`classic`** — the classic shell.
- **`embed`** — bare page content (`?embed=1`, no shell/overlays).

### Output

```
artifacts/visuals/web/
  index.html                 # review gallery
  manifest.json              # per-screen ok/fail + metadata
  <viewport>/<mode>/<id>/screenshot.png  (+ video.webm)
```

### Signed-in capture

Without a `storageState` you capture the signed-out experience (what most
anonymous users see). To record signed-in screens, export a Playwright
`storageState` JSON and pass `--storage-state`:

```bash
node scripts/make-storage-state.mjs --base-url http://localhost:3000
node scripts/record-screens.mjs --storage-state ../../artifacts/visuals/web/storageState.json
```

`make-storage-state.mjs` opens a headed Chromium pointed at the sign-in page and
saves the session (cookies + localStorage, which covers Supabase's default
localStorage session) once you land back on a non-auth page.

### In-OS surfaces

Beyond the URL route map, ROAM-OS has windows and programs that can only be
opened by clicking the dock / app drawer (no URL). The crawler captures these
too, in **forced handheld layout** (`roam-ui-mode=handheld`) so the Android-style
app drawer — opened via the dock **Menu** button — is the single launcher on
every viewport.

| Surface | Window | Opened via |
|---|---|---|
| Terminal | `TERMINAL` | drawer "TERMINAL" |
| Comms | `COMMS` | drawer "COMMS" |
| Roam (scan) | `ROAM` | drawer "Roam" |
| Config | `SETTINGS` | drawer "Config" |
| Roam Info | `ROAM INFO` | drawer "ROAM INFO" |
| Refuel | `REFUEL` | drawer "REFUEL" |
| Gallery | `GALLERY` | drawer "GALLERY" |
| Readme | `README` | handheld home tile "README" |
| 7 games | `RELAY` … `SUBSTRATE` | drawer "<game title>" |

Each surface is opened, settled, screenshotted (+video) and closed in a fresh
browser context, keyed by its `WINDOW_DEFAULTS` title. Surfaces appear in the
gallery under `os/<id>`.

```bash
node scripts/record-screens.mjs --no-video --only-os relay   # one game
node scripts/record-screens.mjs --no-os-surfaces             # routes only
```

## Android recording

```bash
# 1) Boot a device/emulator and install the debug APK (appId app.roam.android).
# 2) Sign in once (or run the sign-in subflow below on a clean install).
ROAM_EMAIL=you@example.com ROAM_PASSWORD=secret node scripts/record-android.mjs

# Run a single screen:
node scripts/record-android.mjs --flow profile
```

The runner discovers `flows/*.yaml`, runs each with
`maestro test … --debug-output artifacts/visuals/android/<name> --flatten-debug-output`,
and forwards `ROAM_EMAIL`/`ROAM_PASSWORD` into the `_signin` subflow.

### Flows (16 screens)

| Flow | Screen | Reached via Settings Hub row |
|---|---|---|
| `discover` | Discover (main) | — |
| `settings-hub` | Settings Hub | — |
| `profile` | Profile | `account` |
| `saved` | Saved | `Collections` |
| `history` | History | `log` |
| `notifications` | Notifications | `alerts` |
| `leaderboard` | Leaderboard | `rankings` |
| `badges` | Badges | `Badges` |
| `challenges` | Challenges | `quests` |
| `activity-feed` | Activity feed | `stream` |
| `appearance` | Appearance | `Display // Optics` |
| `browser` | Browser settings | `Net // Browser` |
| `discovery-settings` | Discovery settings | `Scan // Discovery` |
| `effects` | Notifications & effects | `Sensory // Feedback` |
| `sound` | Sound | `Audio // Channels` |

`onboarding.yaml` captures the signed-out onboarding (it uses `clearState` and
will log you out).

### Notes & tuning

- **Theme variant**: the app defaults to `ROAM_OS`. The Settings Hub row labels
  differ from classic mode (e.g. `Display // Optics` vs `Appearance`), so the
  flows target the ROAM-OS labels. If you switch to classic, update the row
  labels (see the per-flow comments).
- **Selectors are text/`contentDescription`-based** (the app sets no
  `testTag`s), so they may need tuning if labels change. Use `maestro studio`
  to inspect the hierarchy and adjust `tapOn`/`assertVisible` values.
- **Classic mode records nothing.** Every flow starts by asserting `Settings` and
  then taps ROAM-OS row labels, so switching the shell to Roam Classic fails all
  16 flows at their first assertion (`0/16`). To shoot a Classic screen, either
  capture it by hand or use a dedicated flow written against the Classic labels.

## Curated captures (walkthrough theme previews)

The onboarding walkthrough's theme step shows one real capture per shell instead
of a drawn mockup. Full-resolution captures are kept locally in
`assets/Screenshots/` (gitignored — the set is ~7 MB of unresizable photo PNG);
the committed derivatives are cut from them with `sharp`:

| Master (`assets/Screenshots/`) | Derivative |
|---|---|
| `roamos-home.png` (web, 1920×1080) | `web/public/walkthrough/theme-roam-os.webp` (1200×675) |
| `roam-classic-home.png` (web, 1920×1080) | `web/public/walkthrough/theme-roam-classic.webp` (1200×675) |
| `android-discover.png` (1080×2400) | `android/app/src/main/res/drawable-nodpi/walkthrough_theme_roam_os.webp` (810×1800) |
| `android-discover-classic.png` (1080×2400) | `android/app/src/main/res/drawable-nodpi/walkthrough_theme_roam_classic.webp` (810×1800) |

Refresh by re-shooting the master (the recorders above, or a plain
`adb shell screencap` for the handheld) and re-running the resize to the sizes in
the table. Keep the derivatives under ~150 KB: `drawable-nodpi` is not
density-scaled, so the full-resolution PNG would ship ~2.4 MB into the APK.

## CI

`.github/workflows/visual-record.yml`:

- **`record-web`** — runs on a Monday cron and on `workflow_dispatch`; records
  against production (override with the `base_url` input) and uploads the
  `index.html` gallery + screenshots/videos as a GitHub Actions artifact.
- **`record-android`** — opt-in via the `record_android` input (needs Firebase
  `google-services.json` + Supabase config as CI secrets and an emulator, so it
  is disabled by default).

## Limitations / next steps

- **Desktop windowed layout is not yet captured** — in-OS surfaces are recorded
  in forced handheld layout (full-screen windows, matching the Android flows).
  Capturing the desktop's draggable-icon layout and side widgets, and the
  in-OS **browser / 3D cyberdeck** windows that only open indirectly (browsing a
  URL, mounting the deck), is a later extension.
- **Dynamic routes** (`/u/[username]`, `/collections/[slug]`) use sample slugs;
  pass real values with `--extra-routes`.
- **Browser extension** is out of scope (per current plan); add it later with a
  Playwright persistent context loading `extension/dist/`.
- **iOS** is out of scope until an iOS codebase exists; Maestro will cover it
  then with the same flow pattern.


