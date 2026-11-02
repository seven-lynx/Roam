# Cyberdeck Scene — Object Naming Reference

A human-readable map of the 3D cyberdeck scene's object names and group structure. Use it to locate any part by name, understand the naming scheme, and see which objects are "protected" (addressed by name at runtime).

> **Stats:** 1,008 objects · all names unique kebab-case · no duplicates

## Contents

- [Overview](#overview)
- [Naming Conventions](#naming-conventions)
- [Scene Map](#scene-map)
- [Group Hierarchy](#group-hierarchy)
- [Reference by Region](#reference-by-region)
  - [Scene Root and Groups](#scene-root-and-groups)
  - [Roam Key and Keys](#roam-key-and-keys)
  - [Controls (Right Column)](#controls-right-column)
  - [Nixie Tubes and Top Edge](#nixie-tubes-and-top-edge)
  - [Lower Band and Bottom Edge](#lower-band-and-bottom-edge)
  - [Flanking Panels and Wiring](#flanking-panels-and-wiring)
  - [Traces, Rivets, Screws and Parts](#traces-rivets-screws-and-parts)
  - [Sides and Back](#sides-and-back)
- [Rename Notes](#rename-notes)
- [Protected Objects](#protected-objects)

## Overview

Every object in the scene has a unique, kebab-case name. There are **1,008 objects**, no duplicate names, and no non-kebab names. 701 objects were renamed from mixed casing to kebab-case during the naming pass (see [Rename Notes](#rename-notes)).

### Notation

| Token | Meaning | Example |
|-------|---------|---------|
| `{a..b}` | numbered siblings | `key-{1..8}` = `key-1` … `key-8` |
| `{a,b}` | named variants | `circuit-part-{1..11}-{resistor\|capacitor\|chip\|via-led}` |
| `*` | wildcard suffix | `nixie-glass-*` |
| `→` | parent → children | `roam-key → roam-key-base` |

## Naming Conventions

- **kebab-case everywhere** — lowercase, words joined by hyphens (`trace-net-left`).
- **Left / right** — always from the camera's view. `-l` / `-r` tokens were expanded to `-left` / `-right` (e.g. `slider-l-cap` → `slider-left-cap`, `status-seg-r3` → `status-seg-right-3`).
- **Location prefixes** — a leading token says where the part lives:
  - `left-edge-*` is the **left side face** — a location, **not** one half of a left/right pair.
  - `lower-*`, `bottom-*`, `top-*`, `back-*`, `flank-*` refer to their respective face or band.
- **Corner suffixes** — `-top-left`, `-top-right`, `-bottom-left`, `-bottom-right`. Bolts use `-upper-front`, `-upper-back`, `-lower-front`, `-lower-back`.
- **Indexed duplicates** — repeated parts get numeric suffixes (`back-foot-1` … `back-foot-4`).
- **Merged meshes** — geometry combined into one mesh keeps a `-merged` suffix (`corner-screw-heads-merged`, `scale-ticks-merged`).
- **Children** — a part's sub-parts are parented to it, shown with `→`.

### Name anatomy

```
camera-lens  +  screw  +  top-left  →  camera-lens-screw-top-left
[part]        [sub-part]  [corner]
```

## Scene Map

Schematic front view — regions are arranged by the scene's own section names, not to scale.

```text
                        ┌───────────────────────────────────────────────┐
  TOP EDGE              │  nixie-tube-left        nixie-tube-right        │
                        │  nixie-detail-cluster · nixie-accent-lights    │
                        │  glass-diode-1..3 · camera-lens · displays     │
                        │  top-vent-assembly · top-chips · status-seg    │
                        │  bezel-accent-dots                             │
                        ├───────────────────────────────────────────────┤
                        │  signal-readout-left     signal-readout-right  │
  SCREEN (centre)       │  ┌─────────────────────────────────────────┐   │
                        │  │                                         │   │
                        │  │          main-screen  (0,0,0)           │   │
                        │  │      nixie-digit-left / -right          │   │
                        │  │                                         │   │
                        │  └─────────────────────────────────────────┘   │
                        │   title-roam-cyberdeck · lynx-logo · ticks    │
                        ├───────────────────────────────────────────────┤
  KEYS                  │  key-well-left (key-1..4)    key-well-right   │
                        │              ┌──────────┐    (key-5..8)       │
                        │              │ roam-key │                     │
                        │              └──────────┘                     │
                        ├───────────────────────────────────────────────┤
  RIGHT COLUMN          │                    slider-left / slider-right │
                        │                    switch-left / switch-right │
                        │                    rotary-dial                │
                        │                    gauge-core · gauge-aux     │
                        ├───────────────────────────────────────────────┤
  LOWER BAND            │  lower-band-left-details · lower-band-right    │
                        │  fuse-bank · bottom-strip-toggles             │
                        ├───────────────────────────────────────────────┤
  BOTTOM EDGE           │  bottom-vent-* grilles · led-strips           │
                        └───────────────────────────────────────────────┘
  SIDES / BACK          flank-panel-left · flank-panel-right · wiring
                        back-panel · side-ports · left-edge-access
```

## Group Hierarchy

Scene-wide groups (flat, at root) and the nested interactive assemblies.

```text
scene root
├─ chassis-and-plates
├─ back-panel
├─ scene-lights
├─ trace-network
├─ data-pulses
├─ lower-band-left-details
├─ lower-band-right-details
├─ bezel-accent-dots
├─ led-lines
├─ flank-panel-left
├─ flank-panel-right
├─ key-well-left-assembly
├─ key-well-right-assembly
├─ bottom-vent-left-grille
├─ bottom-vent-right-grille
├─ fuse-bank
├─ bottom-strip-toggles
├─ nixie-accent-lights
├─ gauge-accessories
│
├─ roam-key ── roam-key-base · roam-key-outer-ring · roam-key-glow-ring
│              └─ roam-key-plunger ── roam-key-body · roam-key-top
├─ key-1..8 ── key-N-plunger ── key-N-cap · key-N-glow
├─ slider-left / slider-right ── -slot · -frame · -travel ── -handle ── -cap · -grip
├─ switch-left / switch-right ── -base · -collar · -pivot ── -lever · -tip
├─ rotary-dial ── rotary-knob-housing · rotary-knob-ring · rotary-knob ── -body · -top · -pointer
├─ gauge-core / gauge-aux ── -needle · -glass · -dial · -bezel · -brass-ring · …
└─ (protected, ungrouped) main-screen · signal-readout-left · signal-readout-right
                           nixie-digit-left · nixie-digit-right
```

## Reference by Region

Every group is listed with its children. Compressed `{…}` notation applies (see [Overview](#overview)).

### Scene Root and Groups

- **chassis-and-plates** — `chassis-body`, `bezel-outer`, `bezel-lip`, `main-screen-backplate`, `deck-plate`, `deck-inner-plate`, `stack-plate`, `nixie-housing`, `slider-panel`, `switch-panel`, `rotary-knob-panel`
- **Protected, ungrouped** — `main-screen`, `signal-readout-left`, `signal-readout-right`, `nixie-digit-left`, `nixie-digit-right`
- **Top-level singles** — `title-roam-cyberdeck`, `lynx-logo`, `scale-ticks` → `scale-ticks-merged`, `camera-main`, `camera-deck`
- **scene-lights** — `key-light-directional`, `magenta-accent-light`, `green-accent-light`, `roam-key-glow-light`, `gauge-core-backlight`, `gauge-aux-backlight`, `status-led-glow-left`, `status-led-glow-right`

### Roam Key and Keys

- **roam-key** → `roam-key-base`, `roam-key-outer-ring`, `roam-key-glow-ring`, `roam-key-plunger` → `roam-key-body`, `roam-key-top`
- **key-{1..8}** → `key-N-plunger` → `key-N-cap`, `key-N-glow` *(left four + right four; no left/right suffix)*
- **key-well-left-assembly** — `key-well-left`, `key-well-left-rim-{1..8}`
- **key-well-right-assembly** — `key-well-right`, `key-well-right-rim-{1..8}`
- **led-lines** — `led-line-green-well-left`, `led-line-green-well-right`, `led-line-blue-well-left`, `led-line-blue-well-right`, `led-line-green-deck`, `led-line-green-left`

### Controls (Right Column)

- **slider-left / slider-right** → `-slot`, `-frame`, `-travel` → `-handle` → `-cap`, `-grip`
- **switch-left / switch-right** → `-base`, `-collar`, `-pivot` → `-lever`, `-tip`, plus `-diode-bezel`, `-diode-lens`
- **rotary-dial** → `rotary-knob-housing`, `rotary-knob-ring`, `rotary-knob` → `-body`, `-top`, `-pointer`, plus `rotary-knob-tick-{1..11}`
- **gauge-core / gauge-aux** → `-needle-pivot`, `-needle`, `-hub`, `-rivet-{1,2}`, `-glass`, `-tick-{1..9}`, `-minor-tick-{1..8}`, `-glow-ring`, `-dial`, `-well`, `-bezel`, `-brass-ring`, `-brass-ring-lip`
- **gauge-accessories** — `gauge-status-led-{1,2}`, `gauge-stud-{1,2}`, `gauge-caption-core`, `gauge-caption-aux`

### Nixie Tubes and Top Edge

- **nixie-tube-left / nixie-tube-right** → `nixie-glass-*`, `nixie-dome-*`, `nixie-base-*`, `nixie-collar-*`, `nixie-glow-*`, `nixie-cathode-cage-*`, `nixie-backplate-*`
- **nixie-detail-cluster** — `nixie-detail-cap-{left,right}-{0..2}`, `-header`, `-header-pin-{0..11}`, `-bus`, `-smd-body-{0..7}`, `-smd-cap-{left,right}-{0..7}`, `-chip-a`, `-chip-b`, `-chip-{a,b}-pin-{top,bottom}-{n}`, `-chip-{a,b}-dimple`
- **nixie-accent-lights** — `nixie-accent-led-{1..4}`, `nixie-accent-strip`
- **glass-diode-{1..3}** → `diode-N-light`, `-halo`, `-dome`, `-glass`, `-filament`, `-cup`, `-post`, `-flange`, `-collar`
- **camera-lens** → `camera-lens-status-led`, `-screw-{top,bottom}-{left,right}`, `-highlight`, `-iris`, `-glass`, `-inner-lens`, `-baffle`, `-knurl-ring`, `-neon-ring`, `-barrel`, `-brass-ring`, `-mount-plate`
- **Displays** — `optic-sensor`, `spectrum-display`, `diagnostic-display`, `core-gauge-display` (each with its `-bezel`, `-glass`/`-screen`, bars and lamps)
- **top-vent-assembly** → `top-vent-slats-merged`, `top-vent-recess`
- **top-chips** — `top-chip`, `top-chip-pins-merged`, `top-capacitor-{1..3}`
- **status-segments** — `status-seg-{left,right}-{1..5}`
- **bezel-accent-dots** — `blue-accent-bezel-dot-{1..11}`, `green-accent-bezel-dot-{1..12}`

### Lower Band and Bottom Edge

- **lower-band-left-details** — `lower-label-left`, `lower-label-plate-left`, `lower-dip-chip-left`, `lower-dip-pin-{top,bottom}-{0..5}`, `lower-led-left-{1..3}`, `lower-brass-hex-left-{1,2}`
- **lower-band-right-details** — `lower-label-right`, `lower-label-plate-right`, `lower-led-right-{1..4}`, `lower-trim-pot-base-right`, `lower-trim-pot-slot-right`, `lower-brass-gland-right`, `lower-gland-collar-right`, `lower-brass-hex-right-1`
- **bottom-vents** → `left-vent-slots-merged`, `right-vent-slots-merged` *(hidden)*
- **bottom-vent-left-grille / bottom-vent-right-grille** — `-rail-top`, `-rail-bottom`, `-back`, `-bars-merged`
- **fuse-bank** — `fuse-label`, `fuse-holder-{1..4}`, `fuse-tube-{1..4}`, `fuse-glass-{1..4}`, `fuse-cap-{a,b}-{1..4}`
- **bottom-strip-toggles** — `bottom-strip-toggle-{base,lever,tip}-{1..4}`
- **led-strips** → `led-strip-bottom-left`, `led-strip-bottom-right`, `led-strip-side-orange`

### Flanking Panels and Wiring

- **flank-panel-left** — `-frame`, `-base`, `-tube-{1..3}-{socket,base,glass,dome,filament,getter}`, `-cap-{1..3}-{body,sleeve,top}`, `-resistor-{1..3}`, `-dial-{bezel,face,glow,needle}`, `-wire-left-{1..3}-{seg,joint}-N`, `-ferrule-*`
- **flank-panel-right** — `-frame`, `-base`, `-tube-{1..3}-*`, `-cap-{1,2}-*`, `-coil`, `-coil-core`, `-toggle-{base,lever,tip}`, `-led-{1..3}`, `-led-bezel-{1..3}`, `-screw-{1..3}`, `-washer-{1..3}`, `-wire-right-*`, `-ferrule-*`
- **wiring-and-pipes** — `wire-left-{1..4}`, `wire-right-{1..3}`, `copper-heat-pipe-right-{1,2}`, `clamp-left-1`, `clamp-right-{1..3}`
- **pipe-fittings** — `fitting-collar-wire-{1..3}-end`, `fitting-collar-pipe-{1,2}-{start,end}`
- **wire-plugs** — `plug-junction-{left,right}-{top,bottom}` and `-cap` variants

### Traces, Rivets, Screws and Parts

- **trace-network** — `trace-copper`, `trace-groove`
- **data-pulses** — `data-pulse-{1..10}`
- **circuit-components** — `circuit-part-{1..11}-{resistor|capacitor|chip|via-led}`
- **circuit-components-extra** — `circuit-part-xc-{1..6}-*`, `circuit-part-xd-{1..4}-*`
- **plate-rivets** — `plate-rivets-merged`, `drill-rim-rivets-merged`
- **corner-screws** — `corner-screw-{slots,heads,washers}-merged`
- **drill-rims** → `drill-rim-corners-merged`
- **tech-embellishments** — `embellishment-{pot,fuse,heat,chip,bnc}-*`, `level-meter-seg-{1..6}`, `level-meter-housing`

### Sides and Back

- **left-side-vent** → `side-vent-ribs-merged`, `side-vent-recess`
- **left-edge-access-recess** — `left-edge-{recess-wall-*, recess-liner, stamped-plate, slot-bezel-{1..3}, slot-slit-{1..3}, label-*, led-{1..3}, led-ring-{1..3}, led-label-{1..3}, rib-*, plate-bolt-*, vent-upper-*, vent-lower-*}`
- **side-ports** — `port-panel-{plate,rail-t,rail-b}`, `port-{1..7}-*`, `port-label-{1..7}`, `port-led-{1..6}`
- **back-panel** — `back-plate`, `back-strap-*`, `back-detail-strap-bar`, `back-barcode-decal`, `back-sticker-plate`, `back-serial-plate`, `back-tamper-seal`, `back-vent`, `back-text` (16 labels), `back-power-cover` (24 parts), `back-feet` → `back-foot-{1..4}`, `back-screws` (4 merged meshes)

## Rename Notes

Changes made during the naming pass.

### Renamed prefixes

| Before | After |
|--------|-------|
| PascalCase / other | `kebab-case` (701 objects) |
| `-l` / `-r` | `-left` / `-right` (camera view) |
| `nxp-*` | `flank-panel-left-*` / `flank-panel-right-*` |
| `cam-lens-*` | `camera-lens-*` |
| `fit-collar-*` | `fitting-collar-*` |
| `pipe-right-*` | `copper-heat-pipe-right-*` |
| `gr-*` / `grille-bars-*` | `bottom-vent-*-grille-*` |
| `emb-*` | `embellishment-*` |
| `trace-part-*` | `circuit-part-*` |
| `left-key-well` | `key-well-left` |
| `keywell-*-rim-*` | `key-well-*-rim-*` |
| `camera` / `deck-camera` | `camera-main` / `camera-deck` |
| `directional-light` | `key-light-directional` |

### Corner suffixes

- Camera-lens screws: `-top-left`, `-top-right`, `-bottom-left`, `-bottom-right`.
- Left-edge plate bolts: `-upper-front`, `-upper-back`, `-lower-front`, `-lower-back`.

### Indexed duplicates

Shared names received numeric suffixes — e.g. `back-foot-1` … `back-foot-4`, `back-cover-screw-head-1` … `-4`.

### Groups added

`chassis-and-plates`, `back-panel`, `plate-rivets`, `scene-lights`, `trace-network`, `data-pulses`, `lower-band-left-details`, `lower-band-right-details`, `bezel-accent-dots`, `led-lines`, `flank-panel-left`, `flank-panel-right`, `key-well-left-assembly`, `key-well-right-assembly`, `bottom-vent-left-grille`, `bottom-vent-right-grille`, `fuse-bank`, `bottom-strip-toggles`, `nixie-accent-lights`, `gauge-accessories`.

Parts were moved into groups with **world positions preserved**.

### Kept unchanged

- `main-screen`, the `signal-readout-*` and `nixie-digit-*` quads, the decals (`lynx-logo`, `back-barcode-decal`) and both cameras are **not in groups**, so their transforms cannot shift.
- `title-roam-cyberdeck`, `side-ports`, `rotary-dial` and the display groups were left as they were.
- Keys remain `key-1` … `key-8` (left four, right four) without `left`/`right` suffixes.

### Notes

- An empty duplicate group named `plate-rivets` was removed; the remaining `plate-rivets` group holds the merged rivet meshes.
- The diode and nixie lights were originally swept into a lights group; they were moved back under `glass-diode-1..3` and `nixie-tube-left` / `nixie-tube-right`. **Rule of thumb:** a light belongs to its parent part, while `scene-lights` holds scene-wide lights only.
- The interaction script's lookups were updated for the renamed slider, switch, diode and pulse objects, but had not been re-verified in play mode at the time of writing.

## Protected Objects

These are addressed **by name at runtime** (for projection, tinting, or interaction). Do not rename, merge, or re-parent them.

| Object | Role |
|--------|------|
| `main-screen` | screen projection quad (at `0,0,0`) |
| `signal-readout-left` | left readout projection quad |
| `signal-readout-right` | right readout projection quad |
| `nixie-digit-left` | left nixie digit projection quad |
| `nixie-digit-right` | right nixie digit projection quad |

---
*Generated from the Spline scene naming pass.*