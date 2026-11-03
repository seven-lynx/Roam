import path from 'path';
import { createSubstrateSession, rewriteIntro, normalizeStoryText, SUBSTRATE_REWRITES } from '@/lib/zmachine';
import { ZScreen } from '@/lib/zscreen';

// The story is a checked-in asset; in Node (Jest) tszm reads it via fs.
const STORY = path.resolve(__dirname, '..', '..', 'public', 'stories', 'zork1.z3');

describe('SUBSTRATE Z-machine', () => {
  it('rewrites the intro strings and leaves everything else untouched', () => {
    expect(rewriteIntro('ZORK I: The Great Underground Empire')).toBe('SUBSTRATE: The Buried Foundation');
    expect(rewriteIntro('Infocom interactive fiction - a fantasy story')).toBe('A recovered interactive fiction');
    expect(rewriteIntro('ZORK is a registered trademark of Infocom, Inc.')).toBe('buried beneath the dead web');
    expect(
      rewriteIntro(
        'ZORK I: The Great Underground Empire\nInfocom interactive fiction - a fantasy story\nCopyright (c) 1981',
      ),
    ).toBe('SUBSTRATE: The Buried Foundation\nA recovered interactive fiction\nCopyright (c) 1981');
    expect(rewriteIntro('West of House')).toBe('West of House');
    expect(rewriteIntro('')).toBe('');
    expect(Object.keys(SUBSTRATE_REWRITES)).toHaveLength(3);
  });

  it('normalizes Zork I paragraph markers to newlines', () => {
    expect(normalizeStoryText('Release 119 / Serial number 880429·')).toBe('Release 119 / Serial number 880429\n');
    expect(normalizeStoryText('a·b·c')).toBe('a\nb\nc');
    expect(normalizeStoryText('no markers')).toBe('no markers');
  });

  it('models the reverse-video status line separately from the main text', () => {
    const s = new ZScreen();
    s.write('West of House\n');
    s.write('You are standing in an open field.\n\n> ');
    s.write('\x1b7\x1b[1;1H\x1b[7m West of House  Score: 0  Moves: 0\x1b[0m\x1b8');
    expect(s.statusLine).toContain('West of House');
    expect(s.statusLine).toContain('Score: 0');
    expect(s.statusLine).toContain('Moves: 0');
    expect(s.mainText).toContain('You are standing in an open field.');
    expect(s.mainText).not.toContain('Score: 0');
  });

  it('boots Zork I with the diegetic title and responds to commands', async () => {
    const s = createSubstrateSession(STORY);
    await s.whenIdle();
    const intro = s.mainText;
    expect(intro).toContain('SUBSTRATE: The Buried Foundation');
    expect(intro).not.toContain('ZORK I:');
    expect(intro).toContain('West of House');

    s.send('open mailbox');
    await s.whenIdle();
    expect(s.mainText).toContain('> open mailbox');
    expect(s.mainText).toContain('Opening the small mailbox reveals a leaflet.');

    s.send('take leaflet');
    await s.whenIdle();
    expect(s.mainText).toContain('Taken.');

    s.destroy();
  }, 20000);
});
