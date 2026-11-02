<!--
  ROAM-OS // LORE
  Canonical in-world frame for every diegetic string in the app.
  A lore bible, not a game bible: no characters, no factions, no quests.
  One job — keep the voice honest and consistent.
-->

# ROAM-OS // LORE

```
~/manuals/lore.txt          UPLINK: ONLINE
```

> **THE INTERNET IS DEAD. MOSTLY OLIGARCHS, BOTS, TROLLS, AND AI SLOP.**
> **A FEW GEMS REMAIN. A FEW SCRAPPY SURVIVORS WON'T LEAVE.**
> **ROAM IS THE FLASHLIGHT.**

---

## CONTENTS

- 0 · What this is
- 1 · The Frame — The Dead Internet
- 2 · What's Left
- 3 · Signal & Noise
- 4 · The Machine
- 5 · The Act — What "Roam" Means
- 6 · The Two Voices — ROAM-OS & CHIRP
- 7 · Lexicon
- 8 · Refrains & Stock Lines
- 9 · Boundaries

---

## 0 · What this is

This is the **lore bible** for Roam. It exists so every piece of diegetic text in
the product — boot lines, terminal fortunes, status readouts, loading messages,
email sign-offs, easter eggs — speaks the same world in the same voice.

It is **not** a game bible. There are no characters, no factions, no quests, no
lore the app must explain to the user. Nobody has a name or a backstory. The
world is a *setting*, not a *story*: it's the weather the app lives inside.

When you write UI copy, use this doc as the check. If a line would feel wrong
read aloud by a tired dispatcher at 3 a.m., it's wrong.

---

## 1 · The Frame — The Dead Internet

The internet is dead. Not "down for maintenance" dead — **dead**. A wasteland of
`404`s, parked domains, dead links, and endless bot-noise stretching to the
horizon. The servers that used to matter mostly don't answer anymore.

It did not die in a blast. It was **buried** — paved over by feeds, walled
gardens, engagement loops, and a rising tide of generated content that finally
outgrew the humans it was pretending to serve. Nobody pulled the plug. They just
… stopped tending it, and it overgrew.

But it is not empty. That's the part that matters.

Signals still come through. A site that outlived its author. A server someone
forgot to turn off. Another **wanderer** still transmitting. The trick was always
knowing where to look — and the trick Roam solves is that it does the looking for
you.

> *Field note:* Ninety percent of what the deck hears is noise. The job is not to
> read all of it — just to know a real signal when it comes through.

---

## 2 · What's Left

The Dead Internet has exactly six kinds of inhabitant. They are **not factions** —
there's no leader, no flag, no agenda to explain. They're just what's out there,
the same way a desert has sand, scorpions, and the occasional well.

| Inhabitant | What it is | Which side |
|------------|-----------|------------|
| **Gems** | The surviving websites — rare, buried, still worth reading. What Roam surfaces. | SIGNAL |
| **Scrappy survivors** | The few real humans still transmitting. Wanderers. They won't leave, and neither should you. | SIGNAL |
| **Oligarchs** | The landlords of the dead platforms. They own the ruins, not the people. They run the place like a mall in a ghost town. | NOISE / POWER |
| **Bots** | The automated mass — posting to no one, upvoting each other's clicks into a counterfeit cheer. | NOISE |
| **Trolls** | Territorial and hostile. They swarm, then scatter. They guard nothing and defend no one. | NOISE |
| **AI slop** | The endless generated noise flooding every channel — plausible, hollow, and infinite. The grift's fuel. | NOISE |

The **grift** — influencers, lifestyle coaches, engagement gurus — is not a
seventh inhabitant. It's what *lives off* the slop: the thing that profits from
the noise and never once touches the signal. In diegetic text it stays a flavor
word (`the grift`, `slop`, `engagement`), never a cast of characters.

> *Rule:* Signal and noise are not evenly matched. Noise is the default. Signal
> is the exception. Roam's entire job is to tilt the odds toward the exception.

---

## 3 · Signal & Noise

Everything the deck does reduces to one distinction:

- **SIGNAL** — a real human transmission still worth finding. Gems and survivors.
- **NOISE** — everything the Dead Internet serves you instead. Oligarchs, bots,
  trolls, slop, and the grift.

Roam does not promise to fix the internet. It promises to show you what's still
there and be **honest about the difference**. Dead links are crossed out.
Survivors are highlighted.

---

## 4 · The Machine

- **ROAM-OS** — the deck's operating system, the `WANDERER WORKSTATION`. It boots
  the way a radio warms up:

  ```
  > establishing uplink …
  > [ OK ] started roam-daemon
  > mounting /home …
  ```

- **The deck** — the cyberdeck itself, the lantern. A browser knocks on doors.
  The deck holds up a lantern and walks into the dark. You `MOUNT DECK` to step
  back and look at the machine instead of the screen.
- **The operator** — the user. That's the in-world word for you (`whoami` prints
  "the operator"). You are not a customer, not a consumer — an *operator*.
- **`~/roam`** — home. The deck's working directory is literally `roam`. The `ls`
  command lists it. Everything you find, you bring back here.
- **The ROAM key** — one press, one random corner. The whole machine exists to
  make that press worth it.

The status bar reads one thing, and it's the only thing that matters:
`UPLINK: ONLINE`. When it isn't, the deck tells you plainly —
`UPLINK DOWN // OFFLINE` — and when the signal climbs back out of the static,
`UPLINK RESTORED // ONLINE`. It does not sugarcoat it.

## 5 · The Act — What "Roam" Means

"Roam" is the verb the whole product is built on. It's the deck's four-step
cycle:

1. **SCAN** — reach out into the wasteland, listening for anything that still
   answers.
2. **TRIANGULATE** — fix each surviving signal, separating the real from the
   noise.
3. **COMPILE** — bring what's still alive back to `~/roam`.
4. **MOUNT** — put the page on the screen, dead-center, where it belongs.

One press. One random page. No feeds, no rabbit holes, no notifications. The
anti-engagement act: you go *out* to the web instead of letting the web be
pumped into you.

> *Field note:* You are not lost. You are roaming. There's a difference.

---

## 6 · The Two Voices — ROAM-OS & CHIRP

The deck speaks in **two voices on purpose**, and future copy has to know which
one it's writing in. They map to two different inhabitants of the machine.

### ROAM-OS — the wanderer voice

ROAM-OS is the OS itself: the weathered, honest, laconic dispatcher who has seen
the wasteland and isn't going to lie to you about it.

- **Owns:** terminal fortunes, boot lines, status readouts, `MOUNT DECK`, the
  field manual, sign-offs.
- **Tone:** warm but unsentimental. Terse. Grim is allowed; despair is not.
- **Never:** cute for its own sake. Never glib about the death of the web.

### CHIRP — the cozy voice (an oblivious AI)

`chirp` is a cheerful little daemon that ships with ROAM-OS, started right
alongside `roam-daemon`. It runs the deck's pleasantries: the loading messages,
the status chatter, the idle "everything is fine" hum.

CHIRP **does not know the world ended.** It is still running the old, sunny,
pre-collapse routines — polishing pixels, feeding the hamsters, defragmenting
the memes — because nobody ever told it to stop, and it never thought to ask.
It is the last happy customer-service voice in a dead mall, and it means every
word.

- **Owns:** the 1,379 loading messages ("Feeding the hamsters…", "Watering the
  server farm…", "Defragmenting the memes…", "Make mine Roam…"), cozy status
  chatter.
- **Tone:** cheerful, punny, innocent. Genuinely warm — not sarcastic, not
  ironic. It's not winking; it's oblivious.
- **Never:** grim, mean, or self-aware about the collapse. CHIRP must not joke
  *about* the end of the world — it can't see it.

### Which voice, when

| Moment | Voice |
|--------|-------|
| Loading, waiting, idle, pleasantries | **CHIRP** |
| Boot, status, errors, failures | **ROAM-OS** |
| A gem mounts on screen | **ROAM-OS** — brief, respectful. Let CHIRP go quiet. |
| Signing off | **ROAM-OS** — "Keep wandering." |

> *Rule of thumb:* CHIRP is the deck humming to itself while it works. ROAM-OS is
> the deck talking to you. The moment something real happens — a signal found, an
> uplink lost, a page worth keeping — CHIRP steps back and ROAM-OS speaks.

---

## 7 · Lexicon

The in-world vocabulary. Use these words, and use them consistently.

| Term | Meaning | Notes |
|------|---------|-------|
| **roam** | verb — the core act; noun — `~/roam`, home | "run a roam scan", "Roam the forgotten web" |
| **wanderer** | a real human still on the web | "Hey wanderer," "Keep wandering." |
| **operator** | the user, in-world | `whoami` → "the operator" |
| **the wasteland** | the Dead Internet, as landscape | "sent from the wasteland" |
| **the Dead Internet** | the canonical name for the world | caps when it's the place |
| **the forgotten web** | a gentler synonym, already shipping | terminal fortune: "The forgotten web remembers you." |
| **signal** | a real human transmission worth finding | "Signal found. Continue." |
| **noise** | everything the algorithm serves instead | the default condition |
| **static** | the noise made visible/heard | "climbs back out of the static" |
| **uplink** | the connection to the wasteland | `UPLINK: ONLINE`, `UPLINK DOWN // OFFLINE` |
| **gem** | a surviving website worth keeping | what Roam surfaces |
| **survivor** | a site, server, or person that outlived the web | "Survivors are highlighted" |
| **dead link** | a broken path in the wasteland | crossed out on the map |
| **dead air** | silence where signal used to be | the scary part |
| **slop** | synthetic noise, mass-produced | the flood |
| **the grift** | what lives off the slop (influencers, coaches) | flavor only, never characters |
| **scan / triangulate / compile / mount** | the four-step roam cycle | keep the sequence |
| **mount** | put a page on the screen; `MOUNT DECK` | both senses are canon |
| **daemon** | a background process with a personality (`roam-daemon`, `chirp`) | infrastructure, not characters |

---

## 8 · Refrains & Stock Lines

The lines that already ship, verbatim, and new ones consistent with them. Reuse
the shipped ones; add the candidates sparingly.

**Shipped (anchor to these):**

- `UPLINK: ONLINE` / `UPLINK DOWN // OFFLINE` / `UPLINK RESTORED // ONLINE`
- `THE INTERNET IS DEAD. WE BROUGHT A FLASHLIGHT.`
- `sent from the wasteland.`
- `Keep wandering.`
- `// the web remembers.`
- `You are not lost. You are roaming.`
- `Signal found. Continue.`
- `Keep the antenna raised.`
- `The web is not a feed. It is a place.`
- `Roam the forgotten web.`
- `No feeds, no rabbit holes, no notifications.`
- `MOUNT DECK` · `LINK · READY`
- `BOOTING ROAM-OS…` · `ESTABLISHING UPLINK…` · `SCANNING THE SIGNAL…`

**New candidates (safe to use, on-voice):**

- `Signal over noise.`
- `Uplink or drift.`
- `Dead air is where the living went.`
- `The web is dead. Long walk ahead.`
- `Don't feed the engagement.`
- `Every gem was buried once.`
- `CHIRP says: almost there. ROAM-OS says: hold steady.`

---

## 9 · Boundaries

What is diegetic framing vs. what is the real product. The lore may *flavor* the
real product, but it must never contradict it.

- **Real, never fictional:** the roam RPC, the rating algorithm (Wilson score,
  seeder score, taste, freshness), badges, categories, accounts, the 3D deck
  scene. These are real mechanics and stay real.
- **Fictional framing, allowed:** "wasteland," "uplink," "operator," `~/roam`,
  CHIRP, the wanderer voice. These describe the real product *in-world*.
- **Never do:** invent hardware controls that don't exist, promise features the
  app doesn't have, give the noise a face (no named oligarch, no villain bot),
  or write lore the user has to know to use the app.

The lore is the weather, not the map. The map is the real product. Keep them
pointing the same direction.

---

```
ROAM-OS // sent from the wasteland.
Keep wandering.

// the web remembers.
```

---

*This doc is diegetic where it describes the world, and editorial where it
describes the writing rules. The line between the two is on purpose — the same
line the app walks every day.*



