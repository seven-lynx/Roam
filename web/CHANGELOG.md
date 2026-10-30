# Changelog

All notable changes to the Roam web platform.

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
