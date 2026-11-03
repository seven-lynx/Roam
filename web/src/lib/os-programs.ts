/**
 * ROAM-OS in-device "programs" — the small, self-contained web games that live
 * inside the workstation's window manager.
 *
 * Each program is a single-file React component under `components/programs/`,
 * wrapped in `ProgramWindow` and opened as an ordinary `WindowId`. The games
 * are adapted from the Apache-2.0 `zeli-web-games` collection (see
 * THIRD_PARTY_NOTICES.md) — reskinned to the Roam palette and relabeled with
 * diegetic copy. This module is data-only so it can be shared by the window
 * manager, the launcher and the terminal without pulling in React.
 */

export const PROGRAM_IDS = ['snake', 'minesweeper', 'tetris', 'asteroids', 'underweb'] as const;
export type ProgramId = (typeof PROGRAM_IDS)[number];

export interface ProgramLicense {
  name: string;
  spdx: string;
  url: string;
}

export interface Program {
  id: ProgramId;
  /** Window title — diegetic, uppercase. */
  title: string;
  /** UNIX-style path flavor for the window chrome + launcher. */
  file: string;
  /** Short glyph for the launcher tile / window icon. */
  glyph: string;
  /** One-line diegetic description, shown in the ABOUT drawer. */
  tagline: string;
  /** Human controls hint, shown in the ABOUT drawer. */
  controls: string;
  /** Attribution + license for the original source. */
  license: ProgramLicense;
  source: string;
}

const APACHE_2: ProgramLicense = {
  name: 'Apache License 2.0',
  spdx: 'Apache-2.0',
  url: 'https://www.apache.org/licenses/LICENSE-2.0',
};

const ZELI = 'zeli-web-games (github.com/hajunho/zeli-web-games)';

const MIT: ProgramLicense = {
  name: 'MIT License',
  spdx: 'MIT',
  url: 'https://opensource.org/licenses/MIT',
};

export const PROGRAMS: Record<ProgramId, Program> = {
  snake: {
    id: 'snake',
    title: 'RELAY',
    file: '/roam/bin/RELAY',
    glyph: '≋',
    tagline: 'A signal serpent. Swallow relay packets to grow the link — never cross your own line.',
    controls: 'ARROWS / SWIPE steer · on-screen D-PAD',
    license: APACHE_2,
    source: ZELI,
  },
  minesweeper: {
    id: 'minesweeper',
    title: 'BOTFIELD',
    file: '/roam/bin/BOTFIELD',
    glyph: '▦',
    tagline: 'Ten bots are buried in an eight-by-eight grid. Sweep every clean sector; numbers count adjacent bots.',
    controls: 'TAP sweep · ⚑ flag · LONG-PRESS flag',
    license: APACHE_2,
    source: ZELI,
  },
  tetris: {
    id: 'tetris',
    title: 'COMPILER',
    file: '/roam/bin/COMPILER',
    glyph: '▥',
    tagline: 'Falling data shards. Full lines compile out. Do not stack past the top.',
    controls: 'SWIPE / ← → move · ↑ rotate · ↓ drop',
    license: APACHE_2,
    source: ZELI,
  },
  asteroids: {
    id: 'asteroids',
    title: 'DEBRIS',
    file: '/roam/bin/DEBRIS',
    glyph: '✦',
    tagline: 'The dead web left wreckage behind. Drift the debris field and clear it.',
    controls: '← → rotate · ▲ thrust · ● fire',
    license: APACHE_2,
    source: ZELI,
  },
  underweb: {
    id: 'underweb',
    title: 'UNDERWEB',
    file: '/roam/bin/UNDERWEB',
    glyph: '▽',
    tagline: 'Descend the buried web. Recover the five gems and carry them back to the surface.',
    controls: 'TYPE COMMANDS · N/S/E/W · TAKE · LOOK · EXAMINE · LIGHT · OPEN · FEED',
    license: MIT,
    source: 'original Roam-OS interactive fiction (7 Lynx)',
  },
};

export function getProgram(id: ProgramId): Program {
  return PROGRAMS[id];
}
