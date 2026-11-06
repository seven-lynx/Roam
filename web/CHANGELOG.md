# Changelog

All notable changes to the Roam web platform.

## [2026-11-05] — Diagnostics nameplate
### Changed
- Lifted the deck-diagnostics title out of the circular disc into a normal widget header, renamed to `DIAGNOSTICS`, and docked the tile at the same 210px height as Sys.Telemetry and Rankings so all three sit flush along the top-right rail.
- Fattened the rings: the default stroke goes from 9 to 16 viewBox units with the outer ring anchored to the rim and each ring claiming an equal slot, and the thickness slider now spans 10–18 (stored configs outside the range are clamped on load).
- The ring configuration panel now floats over the tile instead of inside the disc, so its chamfered corners survive and all controls fit without scrolling; the readout gained clearance inside the fatter innermost ring.

### Fixed
- The `DECK DIAGNOSTICS` label was clipped by the disc's circular border — the header row overhung the chord of the circle by roughly 20px per side.

## [2026-11-02] — SUBSTRATE text adventure (Zork I port)
### Added
- A sixth in-OS program, SUBSTRATE (`/roam/bin/SUBSTRATE`): a rebranded port of the MIT-licensed Infocom classic Zork I, running on the BSD-3-Clause `tszm` Z-machine interpreter. The story (`public/stories/zork1.z3`) ships unmodified; the intro/rubric text is rewritten at the renderer layer to the ROAM-OS lore ("descend to the substrate…").
- A pure ANSI screen model (`lib/zscreen.ts`) and a browser session wrapper (`lib/zmachine.ts`), plus a terminal renderer (`programs/SubstrateProgram.tsx`).
- Unit + integration tests (`zmachine.test.ts`) covering the title rewrite, the status-line model, and a command round-trip.

## [2026-11-02] — UNDERWEB text adventure program
### Added
- A fifth in-OS program, UNDERWEB (`/roam/bin/UNDERWEB`): a Zork-style text adventure rethemed to the ROAM-OS lore. You are a wanderer on the surface of the Dead Internet; descend the buried underweb, recover the five gems, and carry them back up to the Uplink Field. Built on a pure TypeScript engine (`lib/text-adventure.ts`) with a terminal renderer (`programs/UnderwebProgram.tsx`) that uses the native soft keyboard for text input on touch devices.
- Pure-logic unit tests for the UNDERWEB parser, world, and full win path (`underweb.test.ts`).
### Changed
- Generalized the program ABOUT line from "adapted from …" to a neutral "· source" separator so the original in-OS fiction can sit alongside the Apache-2.0 zeli ports.

## [2026-11-02] — Radial barrel warp
### Changed
- Replaced the separable cubic CRT displacement map with a true radial barrel warp that mirrors the Android `CrtOverlay` shader (`center + d·(1 + amount·r²)`), so the edges bow outward like a fisheye instead of a barely-visible anamorphic zoom.
- Made the warp resolution-independent (the filter now runs in `objectBoundingBox` units) and scaled it to the Android app's strength — up to 0.70 at the max dial, which pushes corners ~17% toward centre.

### Fixed
- Removed the filter's `-8%…116%` ink-overflow region and hard-clipped the screen with a matching `clip-path`, so the stronger warp no longer escapes the screen or overruns scrollable menus.

## [2026-11-02] — Window manager & widget legibility pass

### Changed
- Deepened the desktop widget chamfer (10px → 24px bevel) and added translucent, chamfered backing chips behind widget text so it stays legible over busy wallpapers (including the deck-diagnostics disc's transparent mode).
- The topmost (focused) window now shows a brighter title bar and a faint phosphor ring, and double-clicking a window's title bar toggles maximize.

### Fixed
- Clamped the PROGRAMS launcher dropdown, dock display/sound trays, and launcher fly-outs with a max-height + scroll so they can no longer overflow the screen on short viewports.
- Switched window clipping from `overflow: clip` to `overflow: hidden` (plus `contain: paint`) for reliable clipping on all browsers, added `overflow-x: hidden` to window scroll regions, and raised the minimum window size so game controls are never cut off.


## [2026-11-02] — ROAM-OS polish & CRT overhaul

### Changed
- Replaced the Windows-flavored diegetic program paths (`C:\ROAM\...\*.EXE`) with UNIX-style paths (`/roam/bin/RELAY`, etc.), and relabeled the in-screen dock (was "taskbar") across the dock, settings, and chrome.
- Enlarged the game playfields (RELAY 18×18, COMPILER 10×20, DEBRIS 480×560, BOTFIELD 8×8) and made them scale-to-fit their windows, so they fill the window — including when maximized.
- Docked the desktop widgets into a right-edge rail with transparent, chamfered (bevelled) tiles; dragging a widget's grip reorders it within the rail, and its bottom-left handle resizes it.
- Moved wallpaper selection off the desktop and into the Settings hub (WALLPAPER section with swatches, auto-cycle, upload, and remove-custom).

### Added
- Granular CRT display-effect toggles (scanlines, aperture grille, grain, static, fringe, vignette, flicker, curvature, barrel warp) alongside the master switch.
- Per-sound-effect toggles with factory defaults that keep only the UI clicks and loading chimes on; everything else (game blips, feed jingles, mains hum) defaults off.
- A real barrel-warp CRT filter: the unreliable SVG data-URI displacement maps were replaced with runtime-generated PNG maps, so the geometric curvature actually renders instead of collapsing to a plain zoom.
- Prettier Conky-style deck-diagnostic rings (per-ring colors, a bezel ring, and tick marks).

### Fixed
- Hardened window chrome (`contain: paint`, `overflow: clip`) so scrolling content can no longer escape its window.
- Every window now exposes minimize + close (maximize remains desktop-only).

## [2026-11-02] — Touch controls for in-device programs

### Added
- Touch controls for the in-device programs: swipe steering in RELAY and COMPILER, an on-screen arcade pad (rotate/thrust/fire) in DEBRIS, and a flag-mode toggle in BOTFIELD — so every program is playable without a keyboard.
- Shared swipe resolver (`lib/steer.ts`, a TypeScript port of the Android `SteerDirection.kt`) with unit tests, used by the games' swipe steering.

### Changed
- Updated the programs' controls hints (`os-programs.ts`) to reflect the new touch inputs.

## [2026-11-02] — Handheld shell & touch gestures

### Added
- Handheld layout toggle in the ROAM-OS settings hub ("Handheld mode" — palm-top shell with full-screen programs, a thumb-sized control deck, and a swipeable widget strip; off returns to the desk rig), with auto-detection and a "Reset to auto-detect" control.
- Responsive handheld shell (no physical chassis): the OS fills the viewport edge-to-edge with CRT effects on; the desktop becomes a 4-column app grid, the launcher becomes a full-screen drawer, and windows open full-screen with a slide-in.
- Touch gestures while in handheld mode — swipe up from the bottom for the launcher, swipe down from the top for settings, and edge-swipe from either side to go back.

### Changed
- Added a `viewport` export (`viewport-fit: cover`) and a `useIsMobile` media-query hook for app-like, edge-to-edge mobile rendering.

## [2026-11-02] — ROAM-OS cyberdeck desktop & in-device programs

### Added
- 3D cyberdeck desktop (`/desktop`) — a full-viewport cyberdeck with the live ROAM-OS projected onto its screen, physical controls (sliders, switches, rotary knob, gauges) wired to OS state, and a screen-calibration overlay.
- Window-manager chrome — the launcher (`PROGRAMS`), scan (`ROAM`), comms (`COMMS`), terminal (`TERMINAL`), settings (`SETTINGS`), and browser (`BROWSER`) windows, plus `CYBERDECK CONTROLS`, `MOUNT DECK`, `ROAM INFO`, and `REFUEL`.
- Four in-device programs — RELAY, BOTFIELD, COMPILER, and DEBRIS (reskinned Snake, Minesweeper, Tetris, and Asteroids) with shared window chrome, scoped keyboard capture, and Apache-2.0 attribution.
- `check-urls` and `home-stats` API routes.
- Boot-time controls guide — a dismissible "how to play / controls" overlay shown whenever an in-device program launches.

### Changed
- Replaced the desk-gadget landing with the cyberdeck window manager; the landing, leaderboard, and settings surfaces restyled to the ROAM-OS theme.
- Third-party notices now credit zeli-web-games (Apache-2.0).

## [2026-10-29] — Android ROAM-OS control deck & hardware customization

### Added
- Android diegetic control deck — a handheld hardware chassis with a physical key deck (Roam/thumbs/nav), latched keys, click sounds, and a mute/comms key pair.
- Android system readout — a scrolling message pager with READY/BUFFER queue LEDs and an e-ink display (default) plus the 7-segment LED as an option.
- Android hardware customization — chassis/deck material textures (metal/plastic/wood/leather), deck layout/size/shape, button labels, and a bezel fisheye toggle.
- Android OS + hardware color schemes, a theme-locked launcher icon, and boot/standby animations.

### Changed
- Android ROAM-OS is now the default theme, with Linux-flavored flavor text.

## [2026-10-28] — Android ROAM-OS theme

### Added
- Android "ROAM-OS" theme — a retro-futuristic ROAM-OS handheld look matching the web's workstation aesthetic (phosphor-teal and gold palette, Space Grotesk + IBM Plex Mono, CRT scanlines/grain/vignette, OS status bar).
- Android appearance settings — theme switcher (Roam Classic / ROAM-OS), device-frame toggle, and CRT-effects toggle.
- Android boot/scan loading screen with themed messages.

## [2026-10-27] — Retro-futuristic workstation redesign

### Added
- Retro-futuristic "workstation" landing experience — an interactive desktop metaphor with gadgets (radar puck, cassette, compass, floppy-disk changelog, notebook, polaroid, sat-nav), a boot sequence, radar sweep, glitch text, and ambient sound effects.
- Live community counters and a monthly showcase on the homepage.
- New marketing pages: `/android` (app landing), `/extensions` (Chrome & Firefox), `/stats` (public counters), `/changelog` (notable updates), and `/support-roam` (support + tips).
- "Buy Me a Coffee" support button.

### Changed
- Homepage, how-it-works, and admin UI restyled to the new workstation design system.
- Replaced the previous header/footer with the workstation shell and OS-style navigation.

### Fixed
- Buy Me a Coffee widget now renders reliably (synchronous mount).
- Streak parity, workstation polish, and edge-function CORS fixes.

## [2026-10-09] — Challenges UI

### Added
- Challenges UI with daily challenges and consolidated reward handling.
