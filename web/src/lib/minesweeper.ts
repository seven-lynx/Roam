/**
 * BOTFIELD board rules — pure data + functions so the minesweeper logic
 * unit-tests without React. The React component (`MinesweeperProgram.tsx`) is a
 * thin shell over these; the Android port mirrors them in `Botfield.kt`.
 *
 * Adapted from zeli-web-games "Minesweeper" (Apache-2.0).
 */

/** One sector of the board. */
export interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  /** Adjacent mines; only meaningful on a non-mine cell. */
  count: number;
}

/** A square board; `board[row][col]`. */
export type Board = Cell[][];

/** Injectable RNG so tests are deterministic; defaults to `Math.random`. */
export type Rng = () => number;

/** Outcome of a chord: the resulting board and whether it set off a mine. */
export interface ChordResult {
  board: Board;
  hitMine: boolean;
}

/** Recomputes every cell's adjacent-mine count from the current mine layout. */
function recomputeCounts(board: Board): Board {
  const size = board.length;
  return board.map((row, r) =>
    row.map((cell, c) => {
      if (cell.mine) return { ...cell, count: 0 };
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc].mine) count++;
        }
      }
      return { ...cell, count };
    }),
  );
}

/** Deals a fresh board: `mines` buried at random, neighbour counts filled in. */
export function createBoard(size: number, mines: number, rng: Rng = Math.random): Board {
  const cells: Board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ mine: false, revealed: false, flagged: false, count: 0 })),
  );
  // Guard against an impossible board rather than looping forever.
  const target = Math.min(mines, size * size);
  let placed = 0;
  while (placed < target) {
    const r = Math.floor(rng() * size);
    const c = Math.floor(rng() * size);
    if (!cells[r][c].mine) {
      cells[r][c].mine = true;
      placed++;
    }
  }
  return recomputeCounts(cells);
}

/**
 * The classic flood fill: reveals `row`/`col` and, for every empty sector it
 * touches, its eight neighbours. Flagged and already-revealed sectors stop it.
 */
export function floodReveal(board: Board, sr: number, sc: number): Board {
  const size = board.length;
  const next = board.map((row) => row.map((cell) => ({ ...cell })));
  const stack: Array<[number, number]> = [[sr, sc]];
  while (stack.length) {
    const [r, c] = stack.pop()!;
    if (r < 0 || r >= size || c < 0 || c >= size) continue;
    const cell = next[r][c];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.count === 0 && !cell.mine) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) stack.push([r + dr, c + dc]);
    }
  }
  return next;
}

/** True when every clean sector has been swept. */
export function isCleared(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell.mine || cell.revealed));
}

/** Reveals every buried mine — the game-over board. */
export function revealAllMines(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell.mine ? { ...cell, revealed: true } : { ...cell })));
}

/** Toggles the flag on a sector that has not been swept yet. */
export function toggleFlag(board: Board, r: number, c: number): Board {
  const cell = board[r][c];
  if (cell.revealed) return board;
  return board.map((row, ri) =>
    row.map((cc, ci) => (ri === r && ci === c ? { ...cc, flagged: !cc.flagged } : cc)),
  );
}

/** Number of flagged sectors. */
export function countFlags(board: Board): number {
  return board.reduce((n, row) => n + row.filter((cell) => cell.flagged).length, 0);
}

/** Number of clean sectors swept — the score shown on the overlay. */
export function countSwept(board: Board): number {
  return board.reduce((n, row) => n + row.filter((cell) => cell.revealed && !cell.mine).length, 0);
}

/**
 * Guarantees the first sweep of a level is safe and opens an area: any mine in
 * the 3×3 around `r`/`c` is relocated to a random clean sector outside that
 * zone, then the neighbour counts are rebuilt. Modern Minesweeper never lets the
 * opening click hit a mine.
 */
export function ensureFirstClickSafe(board: Board, r: number, c: number, rng: Rng = Math.random): Board {
  const size = board.length;
  const next = board.map((row) => row.map((cell) => ({ ...cell })));

  let removed = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && next[nr][nc].mine) {
        next[nr][nc].mine = false;
        removed++;
      }
    }
  }

  // Candidate clean sectors outside the safe zone to receive the moved mines.
  const candidates: Array<[number, number]> = [];
  for (let nr = 0; nr < size; nr++)
    for (let nc = 0; nc < size; nc++) {
      const inZone = Math.abs(nr - r) <= 1 && Math.abs(nc - c) <= 1;
      if (!inZone && !next[nr][nc].mine) candidates.push([nr, nc]);
    }
  for (let i = 0; i < removed && candidates.length; i++) {
    const idx = Math.floor(rng() * candidates.length);
    const [nr, nc] = candidates.splice(idx, 1)[0];
    next[nr][nc].mine = true;
  }

  return recomputeCounts(next);
}

/**
 * Chording: clicking an already-revealed number whose adjacent flags equal that
 * number opens the remaining (unflagged) neighbours. If a flag is wrong and a
 * real mine sits under one of those neighbours, the board detonates and
 * `hitMine` is true (all mines revealed).
 */
export function chordReveal(board: Board, r: number, c: number): ChordResult {
  const size = board.length;
  const cell = board[r][c];
  // Chording only applies to a revealed number.
  if (!cell.revealed || cell.mine || cell.count === 0) return { board, hitMine: false };

  let adjacentFlags = 0;
  const toOpen: Array<[number, number]> = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const n = board[nr][nc];
      if (n.flagged) adjacentFlags++;
      else if (!n.revealed) toOpen.push([nr, nc]);
    }
  }

  if (adjacentFlags !== cell.count || toOpen.length === 0) return { board, hitMine: false };

  if (toOpen.some(([nr, nc]) => board[nr][nc].mine)) {
    return { board: revealAllMines(board), hitMine: true };
  }

  let next = board;
  for (const [nr, nc] of toOpen) next = floodReveal(next, nr, nc);
  return { board: next, hitMine: false };
}
