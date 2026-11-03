import { PROGRAMS, PROGRAM_IDS, getProgram } from '@/lib/os-programs';
import { WINDOW_DEFAULTS } from '@/components/WorkstationContext';

describe('os-programs registry', () => {
  it('declares every program with complete metadata', () => {
    expect(PROGRAM_IDS.length).toBeGreaterThanOrEqual(4);
    for (const id of PROGRAM_IDS) {
      const p = PROGRAMS[id];
      expect(p.id).toBe(id);
      expect(p.title).toBeTruthy();
      expect(p.file).toContain('/roam/bin/');
      expect(p.glyph).toBeTruthy();
      expect(p.tagline).toBeTruthy();
      expect(p.controls).toBeTruthy();
      expect(p.license.name).toBeTruthy();
      expect(p.license.spdx).toBeTruthy();
      expect(p.license.url).toBeTruthy();
      expect(p.source).toBeTruthy();
    }
  });

  it('keeps titles, files and glyphs unique', () => {
    const titles = PROGRAM_IDS.map((id) => PROGRAMS[id].title);
    const files = PROGRAM_IDS.map((id) => PROGRAMS[id].file);
    const glyphs = PROGRAM_IDS.map((id) => PROGRAMS[id].glyph);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(files).size).toBe(files.length);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('looks up programs by id', () => {
    expect(getProgram('snake').title).toBe('RELAY');
    expect(getProgram('minesweeper').title).toBe('BOTFIELD');
    expect(getProgram('tetris').title).toBe('COMPILER');
    expect(getProgram('asteroids').title).toBe('DEBRIS');
    expect(getProgram('underweb').title).toBe('UNDERWEB');
  });

  it('licenses the zeli ports as Apache-2.0 and the fiction as MIT', () => {
    for (const id of ['snake', 'minesweeper', 'tetris', 'asteroids'] as const) {
      expect(PROGRAMS[id].license.spdx).toBe('Apache-2.0');
      expect(PROGRAMS[id].source).toContain('zeli-web-games');
    }
    expect(PROGRAMS.underweb.license.spdx).toBe('MIT');
    expect(PROGRAMS.underweb.source).toContain('original');
  });

  it('registers every program as an openable window', () => {
    for (const id of PROGRAM_IDS) {
      expect(WINDOW_DEFAULTS[id]).toBeDefined();
      expect(WINDOW_DEFAULTS[id].title).toBe(PROGRAMS[id].title);
    }
  });
});
