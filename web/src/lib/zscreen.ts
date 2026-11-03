/**
 * ZSCREEN — a minimal VT100 screen model for rendering `tszm`'s Z-machine output.
 *
 * `tszm` (BSD-3-Clause) emits ANSI/VT100 escape sequences for the v1-3 status
 * line (save/restore cursor + reverse video) plus a few window-management codes.
 * This module parses that subset and produces the two things the UI needs:
 *   - `statusLine` — the reverse-video status line (location + score/moves)
 *   - `mainText`   — the linear scrolling text (room descriptions, responses)
 *
 * Deliberately data + string handling only (no React, no DOM) so it can be
 * tested in isolation, the same way `steer.ts` and `scan.ts` are.
 */

const ESC = '\x1b';
const CSI = `${ESC}[`;
const CLEAR_SCREEN = `${CSI}2J`;
const HOME = `${CSI}H`;
const HOME_F = `${CSI}f`;
const SAVE_CURSOR = `${ESC}7`;
const RESTORE_CURSOR = `${ESC}8`;
const INVERSE_ON = `${CSI}7m`;
const RESET = `${CSI}0m`;

/** Characters that terminate a CSI (control sequence introducer) sequence. */
const CSI_FINAL = /[A-Za-z]/;

export class ZScreen {
  private main = '';
  private status = '';
  private inverse = false;

  /** Feed a chunk of interpreter output (text + ANSI escapes). */
  write(chunk: string): void {
    let i = 0;
    while (i < chunk.length) {
      const ch = chunk[i];
      if (ch === ESC) {
        const { code, next } = this.readEscape(chunk, i);
        this.applyEscape(code);
        i = next;
        continue;
      }
      this.writeChar(ch);
      i++;
    }
  }

  private readEscape(chunk: string, start: number): { code: string; next: number } {
    // `start` points at ESC. Return the full escape string and the index just
    // past it. CSI sequences end in a letter; ESC 7/8 are single-char escapes.
    let i = start + 1;
    if (i < chunk.length && chunk[i] === '[') {
      i++; // skip '['
      while (i < chunk.length && !CSI_FINAL.test(chunk[i])) i++;
      if (i < chunk.length) i++; // consume the final letter
      return { code: chunk.slice(start, i), next: i };
    }
    if (i < chunk.length) i++; // single-char escape (ESC 7 / ESC 8)
    return { code: chunk.slice(start, i), next: i };
  }

  private applyEscape(code: string): void {
    switch (code) {
      case CLEAR_SCREEN:
        this.main = '';
        this.status = '';
        break;
      case HOME:
      case HOME_F:
      case SAVE_CURSOR:
      case RESTORE_CURSOR:
        // Cursor movement — the main text is linear, so these are no-ops.
        break;
      case INVERSE_ON:
        this.inverse = true;
        this.status = ''; // a fresh status line replaces the previous one
        break;
      case RESET:
        this.inverse = false;
        break;
      default:
        // Cursor positioning, erase, scroll-region, etc. — ignored for linear text.
        break;
    }
  }

  private writeChar(ch: string): void {
    if (ch === '\r') return;
    if (this.inverse) {
      this.status += ch;
    } else {
      this.main += ch;
    }
  }

  /** The full linear scrolling text accumulated so far. */
  get mainText(): string {
    return this.main;
  }

  /** The current status line (location + score/moves), trimmed. */
  get statusLine(): string {
    return this.status.trim();
  }

  /** The main text split into display lines (trailing whitespace trimmed). */
  get lines(): string[] {
    return this.main.split('\n').map((line) => line.replace(/\s+$/, ''));
  }
}
