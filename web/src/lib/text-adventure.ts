/**
 * UNDERWEB — a tiny Zork-style text adventure for the ROAM-OS "Programs" shelf.
 *
 * Deliberately data + pure functions only (no React, no DOM), so the parser and
 * world can be exercised in isolation the same way `steer.ts` and `scan.ts` are.
 * `UnderwebProgram.tsx` is the thin renderer layered on top of this module.
 *
 * The world is the Dead Internet from `ROAM-OS_LORE.md`: you are a wanderer on
 * the surface, and five gems — surviving sites worth keeping — lie buried in the
 * underweb. Descend, recover them, and carry them back up to the Uplink Field.
 */

export type RoomId =
  | 'uplink'
  | 'vault'
  | 'botfield'
  | 'slop-lake'
  | 'troll-bridge'
  | 'far-bank'
  | 'core';

export type Dir = 'north' | 'south' | 'east' | 'west' | 'up' | 'down';

export type TranscriptKind = 'echo' | 'out' | 'sys' | 'win';

export interface TranscriptLine {
  kind: TranscriptKind;
  text: string;
}

export interface GameState {
  room: RoomId;
  /** Object ids carried by the wanderer. */
  inv: string[];
  /** Object ids present in each room (keyed by room id). */
  objects: Record<string, string[]>;
  /** Boolean world state (deckLit, trollGone, coreOpen). */
  flags: Record<string, boolean>;
  moves: number;
  won: boolean;
  transcript: TranscriptLine[];
}

export const GEM_COUNT = 5;
export const START_ROOM: RoomId = 'uplink';

interface ObjectDef {
  id: string;
  name: string;
  synonyms: string[];
  takeable: boolean;
  /** Presence line printed in a room; empty for features baked into prose. */
  here: string;
  /** EXAMINE text; empty for objects whose text depends on world state. */
  examine: string;
}

interface RoomDef {
  id: RoomId;
  name: string;
  description: string;
  exits: Partial<Record<Dir, RoomId>>;
}

const GEM_EXAMINE = 'A gem — a surviving site compressed to a bright stone. It hums with signal.';

export const OBJECTS: Record<string, ObjectDef> = {
  deck: {
    id: 'deck',
    name: 'deck',
    synonyms: ['deck', 'flashlight', 'torch', 'lamp', 'lantern', 'roam deck'],
    takeable: true,
    here: '',
    examine: '',
  },
  cell: {
    id: 'cell',
    name: 'cell',
    synonyms: ['cell', 'battery', 'power cell', 'spare cell'],
    takeable: true,
    here: 'A scavenged power cell rests in the grass.',
    examine: 'A sealed power cell. Enough for one lighting of the deck.',
  },
  note: {
    id: 'note',
    name: 'note',
    synonyms: ['note', 'scrap', 'paper', 'memo'],
    takeable: true,
    here: 'A greasy scrap of paper is pinned under a stone.',
    examine:
      'It reads: "Five gems, buried with the web. Bring them back to the surface. Below, the static is hungry — keep the deck lit."',
  },
  slop: {
    id: 'slop',
    name: 'slop',
    synonyms: ['slop', 'tin', 'slop tin', 'can'],
    takeable: true,
    here: 'A dented tin of slop sits on a ledge.',
    examine: 'A tin of slop. It reeks faintly of engagement. Trolls love the stuff.',
  },
  key: {
    id: 'key',
    name: 'key',
    synonyms: ['key', 'cipher key', 'brass key'],
    takeable: true,
    here: 'A brass cipher key dangles from a rusted hook.',
    examine: 'A brass key stamped with a string of dead characters.',
  },
  'gem-1': {
    id: 'gem-1',
    name: 'gem',
    synonyms: ['gem', 'crystal', 'stone', 'jewel', 'signal'],
    takeable: true,
    here: 'A gem glints on a high shelf.',
    examine: GEM_EXAMINE,
  },
  'gem-2': {
    id: 'gem-2',
    name: 'gem',
    synonyms: ['gem', 'crystal', 'stone', 'jewel', 'signal'],
    takeable: true,
    here: 'Something bright is wedged in the cable trough — a gem.',
    examine: GEM_EXAMINE,
  },
  'gem-3': {
    id: 'gem-3',
    name: 'gem',
    synonyms: ['gem', 'crystal', 'stone', 'jewel', 'signal'],
    takeable: true,
    here: 'A gem rests in the shallows, just out of the scum.',
    examine: GEM_EXAMINE,
  },
  'gem-4': {
    id: 'gem-4',
    name: 'gem',
    synonyms: ['gem', 'crystal', 'stone', 'jewel', 'signal'],
    takeable: true,
    here: 'A gem has been laid among the broken relays.',
    examine: GEM_EXAMINE,
  },
  'gem-5': {
    id: 'gem-5',
    name: 'gem',
    synonyms: ['gem', 'crystal', 'stone', 'jewel', 'signal'],
    takeable: true,
    here: 'One last gem sits in a cradle of dead cable.',
    examine: GEM_EXAMINE,
  },
  troll: {
    id: 'troll',
    name: 'troll',
    synonyms: ['troll', 'beast', 'thing'],
    takeable: false,
    here: '',
    examine: 'A troll — territorial, hostile, and very bored. It guards nothing and defends no one, but it is in the way.',
  },
  door: {
    id: 'door',
    name: 'door',
    synonyms: ['door', 'hatch', 'shaft', 'seal', 'lock', 'cipher lock'],
    takeable: false,
    here: '',
    examine: '',
  },
  hatch: {
    id: 'hatch',
    name: 'hatch',
    synonyms: ['hatch', 'trapdoor', 'trap door', 'door'],
    takeable: false,
    here: '',
    examine: 'A rusted hatch set into the earth. A ladder drops DOWN into the underweb.',
  },
};

export const ROOMS: Record<RoomId, RoomDef> = {
  uplink: {
    id: 'uplink',
    name: 'Uplink Field',
    description:
      'You stand in a wind-scoured field of dead links — URLs that once led somewhere, now rusted into the soil. The sky is a wall of static. A rusted hatch is set into the earth. Beyond it, the Dead Internet stretches to every horizon.',
    exits: { down: 'vault' },
  },
  vault: {
    id: 'vault',
    name: 'The 404 Vault',
    description:
      "Your deck's beam sweeps a buried archive: shelf after shelf of 404s, each a doorway that forgot its room. The air smells of dust and ozone. A ladder climbs UP to the surface.",
    exits: { up: 'uplink', west: 'botfield', east: 'troll-bridge' },
  },
  botfield: {
    id: 'botfield',
    name: 'Botfield Corridor',
    description:
      'A narrow passage strung with dead cables, their sheaths split like shed skins. It runs EAST toward the vault and SOUTH toward a faint wet smell.',
    exits: { east: 'vault', south: 'slop-lake' },
  },
  'slop-lake': {
    id: 'slop-lake',
    name: 'Slop Lake',
    description:
      'The passage opens onto a black lake, its surface sheened with rainbow scum — a century of slop, pooled. NORTH leads back to the corridor.',
    exits: { north: 'botfield' },
  },
  'troll-bridge': {
    id: 'troll-bridge',
    name: 'Troll Bridge',
    description:
      'A narrow span of salvaged server racks crosses a chasm of dead air. WEST returns to the vault; EAST crosses to the far bank.',
    exits: { west: 'vault', east: 'far-bank' },
  },
  'far-bank': {
    id: 'far-bank',
    name: 'Far Bank',
    description:
      "You reach the far bank, where the web's grave is deepest. WEST is the bridge. A heavy door is set in the floor.",
    exits: { west: 'troll-bridge', down: 'core' },
  },
  core: {
    id: 'core',
    name: 'The Core',
    description:
      'You descend into the heart of the underweb — a buried server hall, still faintly humming. At its center a beacon pulses once, slow as a heartbeat. UP is the shaft back.',
    exits: { up: 'far-bank' },
  },
};

const FILLER = new Set(['the', 'a', 'an', 'to', 'at', 'on', 'with', 'into', 'of', 'my', 'your', 'in']);

const DIRS: Record<string, Dir> = {
  n: 'north',
  north: 'north',
  s: 'south',
  south: 'south',
  e: 'east',
  east: 'east',
  w: 'west',
  west: 'west',
  u: 'up',
  up: 'up',
  d: 'down',
  down: 'down',
};

const VERBS: Record<string, string> = {
  l: 'look',
  look: 'look',
  i: 'inv',
  inv: 'inv',
  inventory: 'inv',
  take: 'take',
  get: 'take',
  grab: 'take',
  drop: 'drop',
  discard: 'drop',
  x: 'examine',
  examine: 'examine',
  inspect: 'examine',
  read: 'read',
  light: 'light',
  ignite: 'light',
  open: 'open',
  unlock: 'open',
  feed: 'feed',
  give: 'feed',
  throw: 'feed',
  offer: 'feed',
  score: 'score',
  help: 'help',
  commands: 'help',
  restart: 'restart',
  reset: 'restart',
  quit: 'restart',
};

const MULTI_VERBS: Record<string, string> = {
  'pick up': 'take',
  'turn on': 'light',
  'look at': 'examine',
};

const HELP_LINES = [
  'N / S / E / W / U / D — move',
  'LOOK — describe the room',
  'TAKE <item> — pick something up',
  'DROP <item> — set something down',
  'EXAMINE <item> (or X) — look closer',
  'READ <item> — read something',
  'LIGHT <deck> — light the deck (needs a cell)',
  'OPEN <door> — open the locked door (needs a key)',
  'FEED <slop> TO TROLL — bribe the troll',
  'INVENTORY (or I) — check your pack',
  'SCORE — gems and moves',
  'RESTART — begin again',
];

export const HELP_TEXT = HELP_LINES.join('\n');

function clone(s: GameState): GameState {
  return {
    ...s,
    inv: [...s.inv],
    objects: Object.fromEntries(Object.entries(s.objects).map(([k, v]) => [k, [...v]])),
    flags: { ...s.flags },
    transcript: [...s.transcript],
  };
}

function push(state: GameState, kind: TranscriptKind, text: string): void {
  state.transcript.push({ kind, text });
}

function gemCount(state: GameState): number {
  return state.inv.filter((id) => id.startsWith('gem-')).length;
}

function matches(obj: ObjectDef, noun: string): boolean {
  return obj.synonyms.some((s) => noun.includes(s));
}

function findInRoom(state: GameState, noun: string): string | null {
  for (const id of state.objects[state.room] ?? []) {
    if (matches(OBJECTS[id], noun)) return id;
  }
  return null;
}

function findInInventory(state: GameState, noun: string): string | null {
  for (const id of state.inv) {
    if (matches(OBJECTS[id], noun)) return id;
  }
  return null;
}

function describeRoom(state: GameState): void {
  const room = ROOMS[state.room];
  push(state, 'sys', `— ${room.name} —`);
  push(state, 'out', room.description);

  if (state.room === 'troll-bridge' && (state.objects['troll-bridge'] ?? []).includes('troll')) {
    push(
      state,
      'out',
      'A troll squats mid-span, chewing a broken cable. It guards nothing and defends no one — but it will not let you cross EAST.',
    );
  }
  if (state.room === 'far-bank') {
    push(
      state,
      'out',
      state.flags.coreOpen
        ? 'The door in the floor stands open — a shaft drops into black below.'
        : 'A heavy door in the floor is locked tight.',
    );
  }

  for (const id of state.objects[state.room] ?? []) {
    const here = OBJECTS[id]?.here;
    if (here) push(state, 'out', here);
  }

  const dirs = Object.keys(room.exits) as Dir[];
  if (dirs.length) push(state, 'sys', `Exits: ${dirs.join(', ')}.`);
}

function maybeWin(state: GameState): void {
  if (!state.won && state.room === 'uplink' && gemCount(state) === GEM_COUNT) {
    state.won = true;
    push(state, 'win', 'You climb back into the Uplink Field, five gems heavy in your pack.');
    push(state, 'win', 'ROAM-OS: UPLINK RESTORED. // the web remembers.');
    push(state, 'sys', 'Type RESTART to wander again.');
  }
}

function move(state: GameState, dir: Dir): void {
  const room = ROOMS[state.room];
  const target = room.exits[dir];
  if (!target) {
    if (state.room === 'uplink' && dir === 'up') {
      push(state, 'out', 'The sky is only static. There is nowhere to climb.');
    } else {
      push(state, 'out', "You can't go that way.");
    }
    return;
  }
  if (state.room === 'uplink' && dir === 'down' && !state.flags.deckLit) {
    push(state, 'out', 'The hatch drops into absolute black. Light your deck before you go down.');
    return;
  }
  if (state.room === 'troll-bridge' && dir === 'east' && (state.objects['troll-bridge'] ?? []).includes('troll')) {
    push(state, 'out', 'The troll bars the east span, growling. It eyes your pack.');
    return;
  }
  if (state.room === 'far-bank' && dir === 'down' && !state.flags.coreOpen) {
    push(state, 'out', 'A heavy door seals the shaft down. It is locked with a cipher key.');
    return;
  }
  state.room = target;
  state.moves += 1;
  describeRoom(state);
  maybeWin(state);
}

function doLook(state: GameState, noun: string): void {
  if (!noun || noun === 'around' || noun === 'room' || noun === 'here') {
    describeRoom(state);
    return;
  }
  doExamine(state, noun);
}

function doInventory(state: GameState): void {
  const gems = gemCount(state);
  const others = state.inv.filter((id) => !id.startsWith('gem-'));
  const parts = others.map((id) => `a ${OBJECTS[id].name}`);
  if (gems > 0) parts.push(`${gems} ${gems === 1 ? 'gem' : 'gems'}`);
  push(state, 'out', parts.length ? `You are carrying ${parts.join(', ')}.` : 'You are carrying nothing.');
}

function doTake(state: GameState, noun: string): void {
  if (!noun) {
    push(state, 'out', 'Take what?');
    return;
  }
  const id = findInRoom(state, noun);
  if (!id) {
    push(state, 'out', `There is no ${noun} here.`);
    return;
  }
  if (!OBJECTS[id].takeable) {
    push(state, 'out', "You can't take that.");
    return;
  }
  state.objects[state.room] = (state.objects[state.room] ?? []).filter((o) => o !== id);
  state.inv.push(id);
  push(state, 'out', 'Taken.');
}

function doDrop(state: GameState, noun: string): void {
  if (!noun) {
    push(state, 'out', 'Drop what?');
    return;
  }
  const id = findInInventory(state, noun);
  if (!id) {
    push(state, 'out', "You aren't carrying that.");
    return;
  }
  state.inv = state.inv.filter((o) => o !== id);
  state.objects[state.room] = [...(state.objects[state.room] ?? []), id];
  push(state, 'out', 'Dropped.');
}

function doExamine(state: GameState, noun: string): void {
  if (!noun) {
    push(state, 'out', 'Examine what?');
    return;
  }
  const id = findInInventory(state, noun) ?? findInRoom(state, noun);
  if (!id) {
    push(state, 'out', "You don't see that.");
    return;
  }
  if (id === 'deck') {
    push(
      state,
      'out',
      state.flags.deckLit
        ? 'Your ROAM deck, lamp burning steady. The antenna twitches, listening for a signal.'
        : 'Your ROAM deck — antenna, screen, and a lamp. Its cell is dead.',
    );
    return;
  }
  if (id === 'door') {
    push(
      state,
      'out',
      state.flags.coreOpen
        ? 'The door stands open, a shaft dropping into black below.'
        : 'A heavy door set in the floor. A cipher lock glows faintly. It needs a key.',
    );
    return;
  }
  push(state, 'out', OBJECTS[id].examine);
}

function doLight(state: GameState, noun: string): void {
  if (noun && !matches(OBJECTS.deck, noun)) {
    push(state, 'out', "You can't light that.");
    return;
  }
  if (state.flags.deckLit) {
    push(state, 'out', 'The deck is already lit.');
    return;
  }
  if (!state.inv.includes('cell')) {
    push(state, 'out', 'The deck hums and stays dark. It needs a cell.');
    return;
  }
  state.inv = state.inv.filter((id) => id !== 'cell');
  state.flags.deckLit = true;
  push(state, 'out', "The deck's lamp flares to life — a hard white beam in the dead air.");
}

function doOpen(state: GameState, noun: string): void {
  if (!noun) {
    push(state, 'out', 'Open what?');
    return;
  }
  const id = findInRoom(state, noun);
  if (id === 'door') {
    if (state.flags.coreOpen) {
      push(state, 'out', 'The door is already open.');
      return;
    }
    if (!state.inv.includes('key')) {
      push(state, 'out', 'The door is locked. It needs a cipher key.');
      return;
    }
    state.flags.coreOpen = true;
    push(state, 'out', 'The key turns. The door grinds open — a shaft drops into black below.');
    return;
  }
  if (id === 'hatch') {
    push(state, 'out', 'The hatch is already open. The way is DOWN.');
    return;
  }
  if (id) {
    push(state, 'out', "You can't open that.");
    return;
  }
  push(state, 'out', "You don't see that here.");
}

function doFeed(state: GameState, noun: string): void {
  if (state.room !== 'troll-bridge' || !(state.objects['troll-bridge'] ?? []).includes('troll')) {
    push(state, 'out', 'There is nothing here to feed.');
    return;
  }
  if (!/slop|tin|can/.test(noun)) {
    push(state, 'out', 'Feed the troll what?');
    return;
  }
  if (!state.inv.includes('slop')) {
    push(state, 'out', "You don't have any slop.");
    return;
  }
  state.inv = state.inv.filter((id) => id !== 'slop');
  state.flags.trollGone = true;
  state.objects['troll-bridge'] = (state.objects['troll-bridge'] ?? []).filter((id) => id !== 'troll');
  push(state, 'out', 'The troll snatches the tin, grins a gappy grin, and ambles off into the static. The east span is clear.');
}

function doScore(state: GameState): void {
  push(state, 'out', `GEMS: ${gemCount(state)}/${GEM_COUNT} · MOVES: ${state.moves}`);
}

function doHelp(state: GameState): void {
  for (const line of HELP_LINES) push(state, 'out', line);
}

export function createGame(): GameState {
  const state: GameState = {
    room: START_ROOM,
    inv: ['deck'],
    objects: {
      uplink: ['cell', 'note', 'hatch'],
      vault: ['gem-1'],
      botfield: ['gem-2', 'slop'],
      'slop-lake': ['gem-3', 'key'],
      'troll-bridge': ['troll'],
      'far-bank': ['gem-4', 'door'],
      core: ['gem-5'],
    },
    flags: { deckLit: false, trollGone: false, coreOpen: false },
    moves: 0,
    won: false,
    transcript: [],
  };
  push(state, 'sys', 'UNDERWEB — a Roam-OS interactive fiction');
  push(state, 'sys', 'UPLINK: ONLINE');
  push(state, 'out', 'THE INTERNET IS DEAD. WE BROUGHT A FLASHLIGHT.');
  push(
    state,
    'out',
    'You are a wanderer on the surface of the Dead Internet. A signal from below: five gems, buried with the web. Bring them back up to the surface.',
  );
  push(state, 'out', 'Type HELP for commands.');
  describeRoom(state);
  return state;
}

export function runCommand(prev: GameState, raw: string): GameState {
  const state = clone(prev);
  const line = raw.trim();
  push(state, 'echo', `> ${line}`);
  if (state.won) {
    push(state, 'sys', 'You have already returned to the surface. Type RESTART to wander again.');
    return state;
  }
  if (!line) return state;

  const tokens = line.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
  if (tokens.length === 0) return state;

  const dir = DIRS[tokens[0]];
  if (dir) {
    move(state, dir);
    return state;
  }
  if (tokens[0] === 'go') {
    const d = tokens[1] ? DIRS[tokens[1]] : undefined;
    if (d) move(state, d);
    else push(state, 'out', 'Go where?');
    return state;
  }

  const two = tokens.slice(0, 2).join(' ');
  const multi = MULTI_VERBS[two];
  const verb = multi ?? VERBS[tokens[0]];
  const restTokens = (multi ? tokens.slice(2) : tokens.slice(1)).filter((t) => !FILLER.has(t));
  const noun = restTokens.join(' ');

  if (!verb) {
    push(state, 'out', "I don't understand. Type HELP.");
    return state;
  }

  switch (verb) {
    case 'look':
      doLook(state, noun);
      break;
    case 'inv':
      doInventory(state);
      break;
    case 'take':
      doTake(state, noun);
      break;
    case 'drop':
      doDrop(state, noun);
      break;
    case 'examine':
    case 'read':
      doExamine(state, noun);
      break;
    case 'light':
      doLight(state, noun);
      break;
    case 'open':
      doOpen(state, noun);
      break;
    case 'feed':
      doFeed(state, noun);
      break;
    case 'score':
      doScore(state);
      break;
    case 'help':
      doHelp(state);
      break;
    case 'restart':
      return createGame();
    default:
      push(state, 'out', "I don't understand. Type HELP.");
  }
  return state;
}






