import path from 'path';
import { createSubstrateSession, rewriteIntro, normalizeStoryText, hasSubstrateWon, SUBSTRATE_REWRITES } from '@/lib/zmachine';
import { ZScreen } from '@/lib/zscreen';

// The story is a checked-in asset; in Node (Jest) tszm reads it via fs.
const STORY = path.resolve(__dirname, '..', '..', 'public', 'stories', 'zork1.z3');

describe('SUBSTRATE Z-machine', () => {
  it('rewrites the intro strings and leaves everything else untouched', () => {
    expect(rewriteIntro('ZORK I: The Great Underground Empire')).toBe('SUBSTRATE: The Buried Foundation');
    expect(rewriteIntro('Infocom interactive fiction - a fantasy story')).toBe('A recovered interactive fiction');
    expect(rewriteIntro('ZORK is a registered trademark of Infocom, Inc.')).toBe('buried beneath the dead web');

    // The copyright + release lines arrive in chunks from tszm, so the rewrite
    // keys target the pieces that land intact.
    expect(rewriteIntro('Copyright (c) 1981, 1982, 1983, 1984, 1985, 1986')).toBe('recovered from the substrate archives');
    expect(rewriteIntro(' Infocom, Inc. All rights reserved.')).toBe(' — all signals preserved');
    expect(rewriteIntro('Release ')).toBe('build ');
    expect(rewriteIntro(' / Serial number ')).toBe(' · sector ');

    expect(rewriteIntro("Play 'ZORK: The Great Underground Empire, Part II'.")).toBe(
      "Play 'SUBSTRATE: The Deeper Foundations, Part II'.",
    );
    expect(rewriteIntro('Score: 0')).toBe('SIGNAL: 0');
    expect(rewriteIntro('Moves: 0')).toBe('TURNS: 0');
    expect(rewriteIntro('West of House')).toBe('West of House');
    expect(rewriteIntro('')).toBe('');
    expect(Object.keys(SUBSTRATE_REWRITES)).toHaveLength(10);
  });

  it('detects the endgame line', () => {
    expect(hasSubstrateWon('You have gained the mastery of the first part of the Great Underground Empire')).toBe(true);
    expect(hasSubstrateWon('West of House')).toBe(false);
    expect(hasSubstrateWon('')).toBe(false);
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

    // No out-of-world branding may leak into the transcript or status line.
    for (const token of ['ZORK', 'Zork', 'Infocom', 'trademark', 'Copyright', 'copyright']) {
      expect(intro).not.toContain(token);
      expect(s.statusLine).not.toContain(token);
    }
    expect(s.statusLine).toContain('SIGNAL:');
    expect(s.statusLine).toContain('TURNS:');

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
