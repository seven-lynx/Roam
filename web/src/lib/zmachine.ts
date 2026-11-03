/**
 * SUBSTRATE — a Z-machine session wrapper around the `tszm` engine.
 *
 * `tszm` (BSD-3-Clause, npm `tszm`) runs the MIT-licensed Zork I story
 * (`public/stories/zork1.z3`) as a Z-machine. This module supplies the
 * browser-friendly I/O device `tszm` needs, rewrites Zork's intro/rubric text
 * into the diegetic SUBSTRATE copy, and models the ANSI output as a clean
 * transcript + status line.
 *
 * Async logic + data only (no React, no DOM) so it can be exercised in
 * isolation alongside `steer.ts`, `scan.ts` and `text-adventure.ts`.
 */

import { Buffer } from 'buffer';
import { ZMachine, type ZMInputOutputDevice } from 'tszm';
import { ZScreen } from './zscreen';

// `tszm` is CommonJS and references the global `Buffer` (plus a node-only
// `fs/promises` branch). Supply the Buffer polyfill globally before the engine
// is used; `fs` / `fs/promises` are aliased to no-ops for the client bundle in
// next.config.ts.
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

/** The exact intro/rubric strings Zork I prints, mapped to SUBSTRATE copy. */
export const SUBSTRATE_REWRITES: Record<string, string> = {
  'ZORK I: The Great Underground Empire': 'SUBSTRATE: The Buried Foundation',
  'Infocom interactive fiction - a fantasy story': 'A recovered interactive fiction',
  'ZORK is a registered trademark of Infocom, Inc.': 'buried beneath the dead web',
};

/** Rewrite the intro/rubric substrings wherever they appear in emitted text. */
export function rewriteIntro(text: string): string {
  let out = text;
  for (const [from, to] of Object.entries(SUBSTRATE_REWRITES)) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

/**
 * tszm decodes Zork I's paragraph marker (ZSCII 183) as U+00B7 (·); Zork I uses
 * it to separate paragraphs, so emit it as a newline.
 */
export function normalizeStoryText(text: string): string {
  return text.replace(/\u00B7/g, '\n');
}

export interface SubstrateCallbacks {
  /** Fired whenever the transcript or status line changes. */
  onUpdate?: () => void;
  /** Fired when the story quits (the in-game QUIT command). */
  onQuit?: () => void;
  /** Fired on a fatal engine error. */
  onError?: (err: unknown) => void;
}

export interface SubstrateSession {
  readonly statusLine: string;
  readonly mainText: string;
  readonly lines: string[];
  /** Whether the interpreter is currently blocked waiting for input. */
  isIdle(): boolean;
  /** Feed a command line to the interpreter (echoed after the engine prompt). */
  send(line: string): void;
  /** Resolve when the interpreter next blocks waiting for input. */
  whenIdle(): Promise<void>;
  /** Release resources. */
  destroy(): void;
}

/** `tszm`'s I/O device, routed into a `ZScreen` and an input queue. */
class SubstrateDevice implements ZMInputOutputDevice {
  readonly screen = new ZScreen();
  private inputResolvers: ((line: string) => void)[] = [];
  private idleWaiters: (() => void)[] = [];
  private idle = false;

  constructor(private readonly onUpdate?: () => void) {}

  async readChar(): Promise<string> {
    const line = await this.readLine();
    return line.charAt(0) || '\n';
  }

  async readLine(): Promise<string> {
    this.idle = true;
    this.idleWaiters.shift()?.();
    this.onUpdate?.();
    return new Promise((resolve) => this.inputResolvers.push(resolve));
  }

  async writeChar(char: string): Promise<void> {
    this.writeRaw(char);
  }

  async writeString(str: string): Promise<void> {
    this.writeRaw(str);
  }

  close(): void {}

  isIdle(): boolean {
    return this.idle;
  }

  private writeRaw(s: string): void {
    this.screen.write(normalizeStoryText(rewriteIntro(s)));
    this.onUpdate?.();
  }

  provideInput(line: string): void {
    this.idle = false;
    this.inputResolvers.shift()?.(line);
  }

  whenIdle(): Promise<void> {
    if (this.idle) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }
}

/**
 * Create a session for the given story (a URL in the browser, a filesystem path
 * in Node/tests). The interpreter loop starts as soon as the story loads.
 */
export function createSubstrateSession(
  story: string,
  callbacks: SubstrateCallbacks = {},
): SubstrateSession {
  const device = new SubstrateDevice(callbacks.onUpdate);
  const machine = new ZMachine(story, device);
  let destroyed = false;

  const runLoop = async (): Promise<void> => {
    try {
      for (;;) {
        await machine.executeInstruction();
        if (destroyed) return;
      }
    } catch (err) {
      if ((err as Error)?.message === 'QUIT') {
        callbacks.onQuit?.();
      } else if (!destroyed) {
        callbacks.onError?.(err);
      }
    }
  };

  machine
    .load()
    .then(() => {
      callbacks.onUpdate?.();
      void runLoop();
    })
    .catch((err) => callbacks.onError?.(err));

  return {
    get statusLine() {
      return device.screen.statusLine;
    },
    get mainText() {
      return device.screen.mainText;
    },
    get lines() {
      return device.screen.lines;
    },
    isIdle: () => device.isIdle(),
    send(line: string) {
      const cmd = line.trim();
      if (!cmd || destroyed) return;
      // Echo the command after the engine's own ">" prompt (add a space).
      device.screen.write(` ${cmd}\n`);
      callbacks.onUpdate?.();
      device.provideInput(cmd);
    },
    whenIdle: () => device.whenIdle(),
    destroy() {
      destroyed = true;
      device.close();
      void machine.close();
    },
  };
}
