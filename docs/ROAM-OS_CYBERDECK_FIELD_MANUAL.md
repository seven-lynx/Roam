<!--
  ROAM-OS // CYBERDECK FIELD MANUAL
  A user-facing, in-universe guide to the hardware.
  Diegetic. Read it like the thing you found under a truck seat.
-->

# ROAM-OS // CYBERDECK — FIELD MANUAL

```
~/manuals/cyberdeck.txt          UPLINK: ONLINE
```

> **THE INTERNET IS DEAD. WE BROUGHT A FLASHLIGHT.**

You are holding (or glaring at, or shaking gently because the screen flickers
when you do) a **cyberdeck** — a weathered portable terminal built for one job:
walking the Dead Internet and coming back with whatever is still alive.

This manual tells you what every switch, dial, key, and light does, so the next
time it lights up in your lap at 3 a.m., you know exactly what it's telling
you.

---

## CONTENTS

- 0 · The Wasteland
- 1 · The Machine
- 2 · ROAM-OS
- 3 · The Roam Key
- 4 · The Eight Keys
- 5 · The Right Column
- 6 · Lights & Trim
- 7 · Reading the Field
- 8 · Care & Feeding
- 9 · When the Lights Go Wrong

---

## 0 · The Wasteland

The internet is dead. Not "down for maintenance" dead — **dead**. A wasteland of
`404`s, parked domains, dead links, and endless bot-noise stretching to the
horizon in every direction. The servers that used to matter mostly don't answer
anymore.

But it is not empty.

Signals still come through. A site that outlived its author. A server someone
forgot to turn off. Another **wanderer** still transmitting. The trick was
always knowing where to look — and the trick the cyberdeck solves is that it
does the looking for you.

The deck is not a browser. A browser knocks on doors. The deck holds up a
lantern and walks into the dark.

> *Field note:* The empty web is loud. Ninety percent of what the deck hears is
> noise. Your job is not to read all of it — just to know a real signal when it
> comes through.

---

## 1 · The Machine

```
┌─ FRONT
│    Wide, compact, weathered. Brushed anodized dark-gunmetal housing
│    with fine vertical grain; matte plastic and brass accents; a light
│    dusting of road-grime and honest scuffs.
├─ SCREEN (main-screen)
│    ┌──────────────────────────────┐
│    │         main-screen          │
│    │    phosphor-green · flat     │
│    │   (the OS paints on top)     │
│    └──────────────────────────────┘
│    Large, landscape-oriented. The heart of the whole operation.
├─ TOP EDGE
│    nixie tubes · glass diodes · camera lens · optic-sensor
│    spectrum · diagnostic · core-gauge display · vents · LEDs
├─ KEY ROW
│    key-1 … key-4   ·   [ ROAM ]   ·   key-5 … key-8
│    (a glass-covered recess of live circuitry sits on each side)
├─ RIGHT COLUMN
│    slider-left · slider-right · switch-left · switch-right
│    rotary-dial (WARP) · gauge-core · gauge-aux
├─ FLANKS
│    left : vacuum tubes · coils · resistors · heat pipes · needle dial
│    right: the same gubbins, mirrored
├─ LOWER BAND
│    fuse bank · bottom toggles · vent grilles · LED strips
└─ BACK
     ports · vents · feet · barcode / serial / tamper decals
```

**Palette — use it exactly:**

| Name | Hex | What it is |
|------|-----|-----------|
| abyss | `#0a1214` | the deep-end background |
| bone | `#e6dcc3` | lettering and worn edges |
| phosphor | `#59b3ae` | the screen's glow |
| gold | `#c9a24b` | the trim |
| ember | `#c97b3a` | the warm bits |
| neon | `#ff2e88` | the ROAM key, and nothing else |

**Light:** warm from the upper-left, cool teal fill, a faint magenta kiss.

> *Field note:* It's heavier than it looks. That's fine. Heavy is reliable.
> Heavy means someone bothered to put copper in it.

---

## 2 · ROAM-OS

ROAM-OS is the operating system — the **Wanderer Workstation**. Where a normal
OS hands you a desktop and a file browser, ROAM-OS hands you a receiver, a map,
and a comms line. It does not show you the whole (dead) internet. It shows you
what is still there.

**The windows:**

| Window | What it is |
|--------|-----------|
| PROGRAMS | the launcher — every app the deck carries |
| ROAM | the scan — the deck's whole reason for existing |
| COMMS | feedback — a line back to other survivors |
| TERMINAL | the command line, for those who like it dark |
| SETTINGS | optics, sound, and the small rituals |
| BROWSER | the old way, kept for when the old way works |
| RELAY | a signal serpent — swallow relay packets, never cross your own line |
| BOTFIELD | clear the bot minefield — six bots, six by six |
| COMPILER | stack falling data shards into clean lines |
| DEBRIS | drift the wreckage field and clear it |

**The status bar** reads one thing, and it's the only thing that matters:
`UPLINK: ONLINE`. When it isn't, none of the rest of this manual will help you.

> *Field note:* ROAM-OS signs off the way a dispatcher signs off: *"Keep
> wandering."* It means what it says.

---

## 3 · The Roam Key

The pink key in the center of the key row. The **whole point** of the machine.
Everything else is trim.

It is **momentary**: it sinks and lights only while you hold it down. Release
it, and it springs back and clears whatever it found.

Press it, and the deck fires the Roam cycle:

```
 ┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌─────────┐
 │  SCAN   │───▶│ TRIANGULATE │───▶│ COMPILE │───▶│  MOUNT  │
 └─────────┘    └─────────────┘    └─────────┘    └─────────┘
  reach out        fix the           draw the        light it
  into the         surviving         map of          up on the
  dark             signals           what's left     screen
```

1. **SCAN** — the deck reaches out into the wasteland, listening for anything
   that still answers.
2. **TRIANGULATE** — it fixes each surviving signal, separating the real from
   the noise.
3. **COMPILE** — it draws the map of what's left.
4. **MOUNT** — it lights the strongest result on the screen: a surviving site,
   or another survivor.

That's the whole magic, laid bare. Press. Hold. Read. Release.

> *Field note:* This is not a search. Search assumes an index. There is no
> index anymore. This is a ping into the dark.

---

## 4 · The Eight Keys

Eight select keys, four on each side of the ROAM key. They are **latched**: one
pressed down and lit (pink LED) at a time, or none. They are your destinations,
and your standing among the other wanderers.

```
        left hand                        right hand
 ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      ╭─────────╮      ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
 │key-1│ │key-2│ │key-3│ │key-4│      │  ROAM   │      │key-5│ │key-6│ │key-7│ │key-8│
 └─────┘ └─────┘ └─────┘ └─────┘      ╰─────────╯      └─────┘ └─────┘ └─────┘ └─────┘
  HOME   COLL.  BADGES CHAL.           (the pink        LEAD.  PROFILE MENU   COMMS
                                        key)
```

| Key | Name | What it does |
|-----|------|--------------|
| key-1 | HOME | base camp |
| key-2 | COLLECTIONS | the archive of surviving sites |
| key-3 | BADGES | your standing as a wanderer |
| key-4 | CHALLENGES | the proving grounds |
| key-5 | RANKINGS | other survivors, ranked |
| key-6 | PROFILE | your own record |
| key-7 | MENU | opens the launcher (the `PROGRAMS` window) |
| key-8 | COMMS | opens feedback — a line to other survivors |

> *Field note:* `MENU` and `COMMS` live on **key-7** and **key-8**. They are not
> separate buttons. If you find yourself looking for a ninth key, stop. There
> are eight.

---

## 5 · The Right Column

Everything on the right edge, top to bottom.

```
 ┌──────────────┐
 │ slider-left  │  VOL    — volume. The uplink's loudness.
 ├──────────────┤
 │ slider-right │  BRT    — brightness. The phosphor's glow.
 ├──────────────┤
 │ switch-left  │  FX     — CRT effects: scanlines, grain,
 │              │           vignette, flicker. For the ones
 │              │           who like the static.
 ├──────────────┤
 │ switch-right │  SOUND  — master sound, on/off.
 ├──────────────┤
 │ rotary-dial  │  WARP   — the screen's barrel/curvature.
 │ (rotary-knob)│           Turn it to bend the display
 │              │           back into a tube.
 ├──────────────┤
 │ gauge-core   │  CORE   — telemetry. A meter, not a dial.
 │ gauge-aux    │  AUX    — telemetry. Idle until the OS
 │              │           wires them in.
 └──────────────┘
```

- **slider-left (VOL)** — volume. Dark metal cap on a matte track. Slide it up
  to hear the static louder; slide it down to hear your own thoughts.
- **slider-right (BRT)** — screen brightness. The phosphor's glow, dimmable for
  when you're trying not to be seen.
- **switch-left (FX)** — the CRT effects. Scanlines, grain, vignette, flicker.
  Toggle it on when the world needs to look like it's coming through a tube.
- **switch-right (SOUND)** — master sound. The whole audio bus, on or off.
- **rotary-dial (WARP)** — screen curvature. A black knurled ring, a brushed
  brass center cap, one thin white indicator line, eleven ticks. Turn it to bend
  the flat display back into a tube, like the old days.
- **gauge-core / gauge-aux** — two analog meters: needle, glass, tick marks, a
  glow ring, labeled `CORE` and `AUX`. They are telemetry, not dials, and right
  now they sit idle — the OS hasn't wired them up yet. They watch. You watch
  them watch.

> *Field note:* The sliders are *sliders*, the switches are *switches*, and the
> knob is a *knob*. Never trust a wanderer who calls them all "buttons."

---

## 6 · Lights & Trim

Not everything does something. Some of it just glows, and that's fine.

- **Nixie tubes** (top edge) — decorative. They glow because the deck is awake,
  not because they're reporting anything. Reassurance in glass.
- **Select-key LEDs** — one pink LED per key, showing your current selection.
  Zero lit means "nowhere in particular."
- **ROAM-key ring** — the ring around the pink key, lit while you hold it.
- **Glass recesses** (flanking the key row) — live circuitry under glass, one
  addressable light each.
- **Left-panel needle dial** — a small decorative dial on the left flank,
  distinct from the two real gauges. It lies about everything, charmingly.
- **Fuse bank, bottom toggles, vent grilles, LED strips** — set-dressing. They
  make the thing look like it can survive a fall. (It can.)

> *Field note:* If a nixie tube flickers, do not panic. If a *gauge* moves and
> you did not touch anything, then you may panic.

---

## 7 · Reading the Field

The screen is the map. Dead links are crossed out. Survivors are highlighted.
Coordinates in the corners, categories along the edges, and the signal you
mounted sitting dead-center where it belongs.

The deck does not show you the whole internet — that's gone. It shows you
**what's still there**, and it is honest about the difference.

---

## 8 · Care & Feeding

- Wipe the screen with something soft. The phosphor forgives fingerprints but
  never forgets them.
- Do not submerge the deck. It is waterproof against weather, not rivers.
- Keep it charged. An unlit deck is just a very expensive paperweight.
- If a switch sticks, work it gently. Brute force is how the previous owner
  lost the brass cap off the rotary.
- Let the nixie tubes warm up. Cold tubes lie.

> *Field note:* The deck is happiest slightly dusty, slightly warm, and slightly
> loved. Treat it like a good flashlight: keep the lens clean and the batteries
> full, and it will light your way out of the dark every single time.

---

## 9 · When the Lights Go Wrong

A short field guide to the deck's way of complaining.

| Symptom | What it means | What to do |
|---------|---------------|------------|
| `UPLINK: ONLINE` gone | no signal to the wasteland | move. higher ground, open window. |
| ROAM key lit, screen dark | the deck is mid-cycle | wait. do not mash it. |
| All eight keys dark | no selection | that's allowed. breathe. |
| A gauge moves by itself | the OS wired it up | watch. learn. |
| Nixie flicker | cold tube or mood | let it warm. ignore. |
| Static-only screen | you're in FX and the signal is thin | toggle FX off, try again |

When in doubt: release the ROAM key, wait for the status bar, and press it
again. The deck was built to be pounded on. It forgives everything except
panic.

---

```
ROAM-OS // sent from the wasteland.
Keep wandering.

// the web remembers.
```

---

*This manual is diegetic. It describes the cyberdeck as it is — no invented
controls, no fictional knobs. Every name here (`slider-left`, `rotary-dial`,
`gauge-core`, `key-1` … `key-8`, `roam-key`) is the canonical name used by the
OS and the scene. Hardware reality is the only canon we have left.*



