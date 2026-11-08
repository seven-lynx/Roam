/**
 * Window chrome contract: the title bar — and therefore the close button — is
 * outside the scrolling flow of a window, so content can never scroll it away.
 *
 * Covers the DOM structure (bar precedes the body, never nested inside it) and
 * the stylesheet rules that make the guarantee hold when something *does*
 * scroll (sticky bar, clipped window box).
 */

import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Window } from '@/components/Window';

// Window reads the workstation context and the SFX helpers at render/call time.
jest.mock('@/components/WorkstationContext', () => {
  const ctx = {
    windows: {
      webapp: {
        title: 'PROFILE',
        minimized: false,
        maximized: false,
        rect: { x: 120, y: 160, w: 760, h: 560 },
        z: 1,
      },
    },
    screenRef: { current: null },
    focusWindow: jest.fn(),
    minimizeWindow: jest.fn(),
    toggleMaximize: jest.fn(),
    closeWindow: jest.fn(),
    moveWindow: jest.fn(),
    handheld: false,
  };
  return { useWorkstation: () => ctx, __ctx: ctx, TOP_BAR_H: 40, DOCK_H: 44 };
});

jest.mock('@/lib/sfx', () => ({ click: jest.fn() }));

interface MockContext {
  closeWindow: jest.Mock;
  minimizeWindow: jest.Mock;
  toggleMaximize: jest.Mock;
  moveWindow: jest.Mock;
}

const ctx = (jest.requireMock('@/components/WorkstationContext') as unknown as { __ctx: MockContext }).__ctx;

/** The body of the first rule block for `selector` in the global stylesheet. */
function cssRule(selector: string): string {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match ? match[1] : '';
}

beforeEach(() => {
  ctx.closeWindow.mockClear();
  ctx.minimizeWindow.mockClear();
  ctx.toggleMaximize.mockClear();
  ctx.moveWindow.mockClear();
});

describe('Window chrome', () => {
  it('renders the title bar with the window title', () => {
    render(<Window id="webapp">content</Window>);
    expect(screen.getByRole('dialog', { name: 'PROFILE' })).toBeInTheDocument();
    expect(screen.getByText('PROFILE')).toHaveClass('window-title');
  });

  it('keeps the title bar ahead of the body in DOM order', () => {
    const { container } = render(<Window id="webapp">content</Window>);
    const section = container.querySelector('.window');
    const bar = container.querySelector('.window-bar');
    expect(section?.firstElementChild).toBe(bar);
  });

  it('never nests the title bar inside the scrolling body', () => {
    const { container } = render(<Window id="webapp">content</Window>);
    expect(container.querySelector('.window-body .window-bar')).toBeNull();
    expect(container.querySelector('.window-bar .window-body')).toBeNull();
  });

  it('keeps the close button inside the title bar', () => {
    const { container } = render(<Window id="webapp">content</Window>);
    const bar = container.querySelector('.window-bar');
    const close = screen.getByRole('button', { name: 'Close' });
    expect(bar).toContainElement(close);
  });

  it('closes the window from the title bar', () => {
    render(<Window id="webapp">content</Window>);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(ctx.closeWindow).toHaveBeenCalledWith('webapp');
  });

  it('keeps minimize and maximize in the title bar', () => {
    const { container } = render(<Window id="webapp">content</Window>);
    const bar = container.querySelector('.window-bar');
    expect(bar).toContainElement(screen.getByRole('button', { name: 'Minimize' }));
    expect(bar).toContainElement(screen.getByRole('button', { name: 'Maximize' }));
  });
});

describe('Window chrome stylesheet contract', () => {
  it('pins the title bar to the top of the window', () => {
    const bar = cssRule('.window-bar');
    expect(bar).toContain('position: sticky');
    expect(bar).toMatch(/top:\s*0/);
    expect(bar).toContain('flex: 0 0 auto');
  });

  it('clips the window box so its chrome cannot be scrolled', () => {
    const win = cssRule('.window');
    expect(win).toContain('overflow: hidden');
    expect(win).toContain('overscroll-behavior: contain');
  });

  it('scrolls window content in its own body, not the window', () => {
    expect(cssRule('.window-body')).toContain('overflow: hidden');
    expect(cssRule('.window-scroll')).toContain('overflow-y: auto');
  });

  it('pins the quick-settings head and scrolls only the sheet body', () => {
    expect(cssRule('.quick-settings')).toContain('overflow: hidden');
    expect(cssRule('.quick-settings-head')).toContain('flex: 0 0 auto');
    expect(cssRule('.quick-settings-scroll')).toContain('overflow-y: auto');
  });
});
