# Cyberdeck Model: Visual Layout Specification

## Table of contents

- [Purpose and coordinate system](#purpose-and-coordinate-system)
- [Overall composition](#overall-composition)
- [Layout diagram](#layout-diagram)
- [Element inventory](#element-inventory)
- [Controls and actions](#controls-and-actions)
- [Variables and OS-level names](#variables-and-os-level-names)
- [Suggested code structure](#suggested-code-structure)
- [Unspecified properties](#unspecified-properties)
- [Your term → canonical](#your-term--canonical)

## Purpose and coordinate system

This document describes the visible layout of the cyberdeck 3D model and maps its components to code. It is a visual reference, not an operating guide.

Coordinates are approximate estimates from the 504 × 282 reference render. The origin (0, 0) is at the render's top-left. Normalize coordinates for other sizes with:

```text
x_normalized = x / 504
y_normalized = y / 282
```

"Left" and "right" refer to the viewer's perspective.

## Overall composition

The cyberdeck is a wide, compact, weathered portable terminal with a detailed outer housing and a large screen centered in the upper portion. Its materials are brushed anodized dark gunmetal with fine vertical grain, weathered matte plastic, brass accents, and light dust and scuffs.

Use this palette exactly:

| Name | Hex |
|------|-----|
| abyss | #0a1214 |
| bone | #e6dcc3 |
| phosphor | #59b3ae |
| gold | #c9a24b |
| ember | #c97b3a |
| neon | #ff2e88 |

Lighting is warm from the upper-left, with cool teal ambient fill and a faint magenta neon accent.

Below the screen, eight select keys are arranged four on the left and four on the right, flanking the central roam-key. Each select key has an LED above it; the roam-key has a surrounding ring LED. A glass-covered recess with visible circuitry and one addressable light source flanks the key row on each side.

The right column holds the sliders, switches, rotary control, and gauges. The flanking panels contain visible components including vacuum tubes, coils, resistors, wiring, and copper heat pipes. The left flank panel also has a small decorative needle dial, separate from the gauges.

## Layout diagram

Schematic only; not to scale. Approximate bounds from the reference render: outer housing x≈72–436, y≈40–250; main-screen x≈109–368, y≈66–182.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Left flank panel     Top edge details        Glass diodes       │
│                      Nixie tubes             Small displays     │
│                      ┌──────────────────┐    slider-left        │
│                      │                  │    slider-right       │
│                      │   main-screen    │    switch-left        │
│                      │   flat quad      │    switch-right       │
│                      └──────────────────┘    rotary-dial        │
│                       Title plate, logo       (rotary-knob cap)  │
│                       and scale ticks         gauge-core         │
│                                               gauge-aux          │
│ [left glass recess] LEDs key-1…key-4          [right glass recess]│
│                        roam-key   key-5…key-8                    │
│ Lower band: fuse bank, bottom toggles, vent grilles, LED strips  │
└──────────────────────────────────────────────────────────────────┘
```

The diagram simplifies the device. The top edge also includes vents, chips, status segments, and accent LEDs. The right column is ordered from top to bottom as listed above.

## Element inventory

| Element | Count | Approximate location | Visual description |
|---------|-------|----------------------|--------------------|
| Outer housing | 1 | x≈72–436, y≈40–250 | Wide, detailed frame surrounding the screen and controls. |
| main-screen | 1 | x≈109–368, y≈66–182 | Large landscape-oriented, dark phosphor-green screen. It is a flat quad; the live OS UI overlays it. |
| Top-edge details | Group | Along the top edge | Two decorative nixie tubes, glass diodes, camera lens, optic-sensor, spectrum, diagnostic, and core-gauge displays, vents, chips, status segments, and accent LEDs. |
| Right column | Group | Right side of the front | slider-left, slider-right, switch-left, switch-right, rotary-dial with rotary-knob cap, gauge-core, and gauge-aux, in that order from top to bottom. |
| Key row | 9 controls | Beneath main-screen | key-1 through key-8, arranged four left and four right, with the central roam-key between them. |
| Left and right glass-covered recesses | 2 | Flanking the key row | Deep recesses with visible circuitry under glass, each with one addressable light source. Scene: recesses group; recess-glass-left / recess-glass-right glass covers; circuit-components / circuit-components-extra circuitry; status-led-glow-left / status-led-glow-right glow lights. |
| Flanking panels | 2 | Left and right edges | Vacuum tubes, coils, resistors, wiring, and copper heat pipes. The left flank panel also has a decorative needle dial. |
| Lower band | Group | Bottom area | Fuse bank, bottom toggles, vent grilles, and LED strips. |
| Back | Group | Rear face | Ports, vents, feet, and barcode, serial, and tamper decals. |

The nixie tubes provide decorative ambient glow only and are not interactive. gauge-core and gauge-aux are addressable analog gauges, but currently sit idle because their scene variables are not yet wired to the OS.

Key anatomy: each key-N sits in a key-N-recess; its face (key-N-cap) carries a key-label-N label, and an LED (key-N-glow, light key-N-led-light) sits above the face. roam-key's ring is roam-key-glow-ring.

## Controls and actions

| Canonical name | Appearance and behavior |
|----------------|-------------------------|
| slider-left | Volume control (VOL, 0–1). Dark metal cap on a matte plastic track. |
| slider-right | Brightness control (BRT). Device value is 0–1 and maps to the OS brightness range of 0.35–1.3. Same cap and track style as slider-left. |
| switch-left | FX: toggles CRT scanlines, grain, vignette, and flicker. Dark metal toggle with a matte collar. |
| switch-right | SOUND: master sound on/off. Dark metal toggle with a matte collar. |
| rotary-dial / rotary-knob | rotary-dial is the assembly; rotary-knob is its cap. Controls WARP (0–1), the CRT barrel/curvature warp. Black anodized aluminum knurled ring, brushed brass center cap, one thin white indicator line, and 11 tick marks. |
| roam-key | ROAM / scan. A momentary control outside the eight-key group: it sinks and lights only while held, springs back on release, and clears the selection. Slightly raised pink key with a neon (#ff2e88) LED. |
| key-1–key-8 | Eight latched select keys in a radio group: one is lit/down at a time, or none when activeKey is 0. Weathered matte plastic with pink (#ff2e88) LEDs. |
| gauge-core, gauge-aux | Addressable analog gauges/meters with a needle, glass, tick marks, glow ring, and "CORE" / "AUX" captions. They are not knobs or dials. |

### Key-to-action map

| Key | Action |
|-----|--------|
| key-1 | Home |
| key-2 | Collections |
| key-3 | Badges |
| key-4 | Challenges |
| key-5 | Rankings (route `/leaderboard`) |
| key-6 | Profile |
| key-7 | MENU — opens the launcher |
| key-8 | COMMS — opens feedback |

MENU and COMMS are actions assigned to key-7 and key-8; they are not separate buttons.

## Variables and OS-level names

### Spline Variables panel

| Variable | Type / range | Binding or purpose |
|----------|--------------|--------------------|
| vol | Number, 0–1 | Volume; bound to slider-left. |
| bright | Number, 0–1 | Brightness; bound to slider-right. |
| warp | Number, 0–1 | Warp; driven by rotary-knob. |
| warp-angle | Number | Helper for rotary-knob rotation: knob rotation.z = 135 − warp·270. |
| fx | Boolean | CRT effects; bound to switch-left. |
| sound | Boolean | Master sound; bound to switch-right. |
| activeKey | Number, 0–8 | Which select key is lit; 0 means none. |
| core | Number | Drives gauge-core; exists in the scene but is not yet wired to the OS. |
| aux | Number | Drives gauge-aux; exists in the scene but is not yet wired to the OS. |

### React state and window names

Use these OS-level names when describing what a control does: volume, brightness, warp, fx, sound, muted, inspect, fullscreen, and camera (zoom / pan / fit).

Window names: launcher = PROGRAMS; scan = ROAM; feedback = COMMS; terminal = TERMINAL; settings = SETTINGS; browser = BROWSER; cyberdeck = CYBERDECK CONTROLS; deck = MOUNT DECK; info = ROAM INFO; coffee = REFUEL; snake = RELAY; minesweeper = BOTFIELD; tetris = COMPILER; asteroids = DEBRIS.

## Suggested code structure

Use canonical names for controls and variables. The hierarchy below shows component placement without assigning additional component IDs.

```text
cyberdeck
├── Outer housing
├── main-screen
├── Top edge
│   ├── Nixie tubes
│   ├── Glass diodes
│   ├── Camera lens
│   ├── optic-sensor
│   ├── spectrum
│   ├── diagnostic
│   ├── core-gauge display
│   ├── Vents, chips, status segments, accent LEDs
├── Right column
│   ├── slider-left
│   ├── slider-right
│   ├── switch-left
│   ├── switch-right
│   ├── rotary-dial
│   │   └── rotary-knob
│   ├── gauge-core
│   └── gauge-aux
├── Key row
│   ├── key-1
│   ├── key-2
│   ├── key-3
│   ├── key-4
│   ├── roam-key
│   ├── key-5
│   ├── key-6
│   ├── key-7
│   └── key-8
├── Left glass-covered recess
├── Right glass-covered recess
├── Left flank panel
├── Right flank panel
├── Lower band
└── Back
```

## Unspecified properties

Exact dimensions and positions beyond the approximate bounds are not specified. The detailed geometry, labels, materials of individual small components, and numerical ranges for core and aux are also unspecified. Whether the recess glow lights (status-led-glow-left / status-led-glow-right) are wired or animated is unverified. The recess, frame-led-1..3, and key sub-part names (key-N-cap, key-N-glow, key-N-led-light, key-N-recess, key-label-N) postdate CYBERDECK_NAMING_REFERENCE.md and are not documented there.

## Your term → canonical

| Earlier term or ID | Canonical name or wording |
|--------------------|---------------------------|
| display.main / "Main display" | main-screen |
| "Curved screen" | main-screen is a flat quad; curvature is from bezel geometry and the software warp filter. |
| slider.1 / "first vertical slider" | slider-left |
| slider.2 / "second vertical slider" | slider-right |
| switch.1 / "first switch" | switch-left |
| switch.2 / "second switch" | switch-right |
| knob.main / "rotary knob" | rotary-dial for the assembly; rotary-knob for the cap. |
| gauge.1 | gauge-core |
| gauge.2 | gauge-aux |
| button.left.1–button.left.4 | key-1–key-4 |
| button.right.1–button.right.4 | key-5–key-8 |
| key.roam / "Roam Key" | roam-key |
| Left-panel decorative needle dial | Decorative needle dial on the left flank panel; distinct from gauge-core and gauge-aux. |
| button.bank_left, button.bank_right | Left and right groups of the key row; individual controls are key-1 through key-8. |
| recess.left, recess.right | recesses group, containing recess-glass-left and recess-glass-right. |
| cover.glass.left, cover.glass.right | recess-glass-left / recess-glass-right. |
| circuitry.left, circuitry.right | circuit-components / circuit-components-extra (circuit-part-*). |
| light.recess_left, light.recess_right | status-led-glow-left / status-led-glow-right (glow lights); sporadic flicker driven by frame-led-1..3 via frame-led-N-color / frame-led-N-intensity. Glow-light wiring is unverified. |
