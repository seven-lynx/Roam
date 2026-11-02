# Changelog

All notable changes to the Roam web platform.

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
