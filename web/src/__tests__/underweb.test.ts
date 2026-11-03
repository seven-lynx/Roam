import {
  createGame,
  runCommand,
  GEM_COUNT,
  START_ROOM,
  ROOMS,
  OBJECTS,
  HELP_TEXT,
  type GameState,
} from '@/lib/text-adventure';

const text = (s: GameState): string => s.transcript.map((l) => l.text).join('\n');

describe('UNDERWEB text adventure', () => {
  it('starts on the surface with the deck and all five gems buried', () => {
    const s = createGame();
    expect(s.room).toBe(START_ROOM);
    expect(s.inv).toEqual(['deck']);
    expect(s.won).toBe(false);
    const gems = Object.keys(OBJECTS).filter((id) => id.startsWith('gem-'));
    expect(gems).toHaveLength(GEM_COUNT);
  });

  it("won't descend into the dark without lighting the deck", () => {
    let s = createGame();
    s = runCommand(s, 'down');
    expect(s.room).toBe('uplink');
    expect(text(s)).toContain('The hatch drops into absolute black. Light your deck before you go down.');
  });

  it('lighting the deck requires the scavenged cell', () => {
    let s = createGame();
    s = runCommand(s, 'light deck');
    expect(s.flags.deckLit).toBe(false);
    expect(text(s)).toContain('The deck hums and stays dark. It needs a cell.');
  });

  it('the troll blocks the east span until bribed with slop', () => {
    let s = createGame();
    s = runCommand(s, 'take cell');
    s = runCommand(s, 'light deck');
    s = runCommand(s, 'down'); // vault
    s = runCommand(s, 'east'); // troll bridge
    s = runCommand(s, 'east'); // blocked
    expect(s.room).toBe('troll-bridge');
    expect(text(s)).toContain('The troll bars the east span, growling. It eyes your pack.');
  });

  it('the core door stays locked without the cipher key', () => {
    let s = createGame();
    s = runCommand(s, 'take cell');
    s = runCommand(s, 'light deck');
    s = runCommand(s, 'down'); // vault
    s = runCommand(s, 'west'); // botfield
    s = runCommand(s, 'take slop');
    s = runCommand(s, 'east'); // vault
    s = runCommand(s, 'east'); // troll bridge
    s = runCommand(s, 'feed slop to troll');
    s = runCommand(s, 'east'); // far bank
    s = runCommand(s, 'open door');
    expect(s.flags.coreOpen).toBe(false);
    expect(text(s)).toContain('The door is locked. It needs a cipher key.');
  });

  it('reports inventory and score', () => {
    let s = createGame();
    s = runCommand(s, 'take cell');
    s = runCommand(s, 'inventory');
    expect(text(s)).toContain('You are carrying a deck, a cell.');
    s = runCommand(s, 'score');
    expect(text(s)).toContain('GEMS: 0/5 · MOVES: 0');
  });

  it('can recover all five gems and return to the surface', () => {
    let s = createGame();
    s = runCommand(s, 'take cell');
    s = runCommand(s, 'light deck');
    s = runCommand(s, 'down'); // vault — gem 1
    s = runCommand(s, 'take gem');
    s = runCommand(s, 'west'); // botfield — gem 2 + slop
    s = runCommand(s, 'take gem');
    s = runCommand(s, 'take slop');
    s = runCommand(s, 'south'); // slop lake — gem 3 + key
    s = runCommand(s, 'take gem');
    s = runCommand(s, 'take key');
    s = runCommand(s, 'north'); // botfield
    s = runCommand(s, 'east'); // vault
    s = runCommand(s, 'east'); // troll bridge
    s = runCommand(s, 'feed slop to troll');
    s = runCommand(s, 'east'); // far bank — gem 4
    s = runCommand(s, 'take gem');
    s = runCommand(s, 'open door');
    s = runCommand(s, 'down'); // core — gem 5
    s = runCommand(s, 'take gem');
    s = runCommand(s, 'up'); // far bank
    s = runCommand(s, 'west'); // troll bridge
    s = runCommand(s, 'west'); // vault
    s = runCommand(s, 'up'); // surface
    expect(s.won).toBe(true);
    expect(text(s)).toContain('ROAM-OS: UPLINK RESTORED. // the web remembers.');
  });

  it('ships help text and a seven-room map', () => {
    expect(HELP_TEXT.length).toBeGreaterThan(0);
    expect(Object.keys(ROOMS)).toHaveLength(7);
  });
});
