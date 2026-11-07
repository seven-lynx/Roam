import {
  type Board,
  chordReveal,
  countFlags,
  countSwept,
  createBoard,
  ensureFirstClickSafe,
  floodReveal,
  isCleared,
  revealAllMines,
  toggleFlag,
} from '@/lib/minesweeper';

/** Deterministic LCG so the board layout is stable across runs. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function mineTotal(board: Board): number {
  return board.reduce((n, row) => n + row.filter((cell) => cell.mine).length, 0);
}

/** Builds a board from ASCII rows ('*' = mine) with neighbour counts filled in. */
function boardFrom(rows: string[]): Board {
  const size = rows.length;
  const cells: Board = rows.map((row) =>
    Array.from(row).map((ch) => ({ mine: ch === '*', revealed: false, flagged: false, count: 0 })),
  );
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c].mine) continue;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && cells[nr][nc].mine) n++;
        }
      cells[r][c].count = n;
    }
  }
  return cells;
}

describe('minesweeper board rules', () => {
  it('buries exactly the requested number of mines', () => {
    const board = createBoard(8, 10, seeded(42));
    expect(board).toHaveLength(8);
    expect(mineTotal(board)).toBe(10);
  });

  it('neighbour counts match the buried mines', () => {
    const board = createBoard(8, 10, seeded(7));
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board.length; c++) {
        if (board[r][c].mine) continue;
        let expected = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc].mine) expected++;
          }
        expect(board[r][c].count).toBe(expected);
      }
    }
  });

  it('flood reveal expands through empty sectors and stops at numbers', () => {
    const board = createBoard(8, 10, seeded(3));
    let empty: [number, number] | null = null;
    for (let r = 0; r < 8 && !empty; r++)
      for (let c = 0; c < 8 && !empty; c++)
        if (!board[r][c].mine && board[r][c].count === 0) empty = [r, c];
    expect(empty).not.toBeNull();
    const [r, c] = empty as [number, number];
    const revealed = floodReveal(board, r, c);
    expect(revealed[r][c].revealed).toBe(true);
    expect(countSwept(revealed)).toBeGreaterThan(1);
  });

  it('a fresh board is not cleared and a fully swept one is', () => {
    const board = createBoard(8, 10, seeded(11));
    expect(isCleared(board)).toBe(false);
    let swept = board;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) if (!board[r][c].mine) swept = floodReveal(swept, r, c);
    expect(isCleared(swept)).toBe(true);
    expect(countSwept(swept)).toBe(54);
  });

  it('flood reveal never uncovers a mine', () => {
    for (let seed = 0; seed < 40; seed++) {
      const board = createBoard(8, 10, seeded(seed + 1));
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
          if (board[r][c].mine) continue;
          const revealed = floodReveal(board, r, c);
          expect(revealed.every((row) => row.every((cell) => !cell.mine || !cell.revealed))).toBe(true);
        }
    }
  });

  it('revealing every mine marks them all', () => {
    const board = createBoard(8, 10, seeded(5));
    const exploded = revealAllMines(board);
    expect(exploded.every((row) => row.every((cell) => !cell.mine || cell.revealed))).toBe(true);
  });

  it('flags toggle but never on a swept sector', () => {
    const board = createBoard(8, 10, seeded(9));
    const flagged = toggleFlag(board, 0, 0);
    expect(flagged[0][0].flagged).toBe(true);
    expect(countFlags(flagged)).toBe(1);
    expect(toggleFlag(flagged, 0, 0)[0][0].flagged).toBe(false);
  });

  it('will not flag an already revealed sector', () => {
    const board = createBoard(8, 10, seeded(9));
    let empty: [number, number] | null = null;
    for (let r = 0; r < 8 && !empty; r++)
      for (let c = 0; c < 8 && !empty; c++)
        if (!board[r][c].mine && board[r][c].count === 0) empty = [r, c];
    const [r, c] = empty as [number, number];
    const revealed = floodReveal(board, r, c);
    expect(toggleFlag(revealed, r, c)[r][c].flagged).toBe(false);
  });
});

describe('first-click safety', () => {
  it('never buries a mine under or around the opening click', () => {
    for (let seed = 0; seed < 60; seed++) {
      const board = createBoard(8, 10, seeded(seed + 1));
      const r = 3;
      const c = 3;
      const safe = ensureFirstClickSafe(board, r, c, seeded(seed + 500));
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) expect(safe[nr][nc].mine).toBe(false);
        }
      expect(safe[r][c].count).toBe(0);
      // Mines are relocated, not dropped, when there is room.
      expect(mineTotal(safe)).toBe(10);
      // The opening click opens more than the single sector.
      expect(countSwept(floodReveal(safe, r, c))).toBeGreaterThan(1);
    }
  });

  it('conserves the mine count for a corner click too', () => {
    const board = createBoard(8, 10, seeded(2));
    expect(mineTotal(ensureFirstClickSafe(board, 0, 0, seeded(2)))).toBe(10);
  });
});

describe('chording', () => {
  it('opens the remaining neighbours when the flags match the number', () => {
    // 2x2: mine at (0,0). Reveal (0,1) [count 1], flag (0,0), chord.
    const board = boardFrom(['*.', '..']).map((row) => row.map((cell) => ({ ...cell })));
    board[0][1] = { ...board[0][1], revealed: true };
    board[0][0] = { ...board[0][0], flagged: true };
    const { board: after, hitMine } = chordReveal(board, 0, 1);
    expect(hitMine).toBe(false);
    expect(after[1][0].revealed).toBe(true);
    expect(after[1][1].revealed).toBe(true);
  });

  it('does nothing when the flags do not match the number', () => {
    const board = boardFrom(['*.', '..']).map((row) => row.map((cell) => ({ ...cell })));
    board[0][1] = { ...board[0][1], revealed: true };
    const { board: after, hitMine } = chordReveal(board, 0, 1);
    expect(hitMine).toBe(false);
    expect(after).toBe(board); // untouched
    expect(after[1][0].revealed).toBe(false);
  });

  it('detonates when a wrong flag leaves a real mine unmarked', () => {
    // 2x2: mine at (0,1). Reveal (0,0) [count 1]; mis-flag (1,0); chord.
    const board = boardFrom(['.*', '..']).map((row) => row.map((cell) => ({ ...cell })));
    board[0][0] = { ...board[0][0], revealed: true };
    board[1][0] = { ...board[1][0], flagged: true };
    const { board: after, hitMine } = chordReveal(board, 0, 0);
    expect(hitMine).toBe(true);
    expect(after[0][1].revealed).toBe(true); // the real mine is now shown
  });

  it('ignores a click on a covered sector or a mine', () => {
    const board = boardFrom(['*.', '..']);
    expect(chordReveal(board, 0, 1).board).toBe(board); // covered number
    expect(chordReveal(board, 0, 0).board).toBe(board); // a mine
  });
});
