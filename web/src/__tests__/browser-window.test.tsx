/**
 * In-OS browser: what happens when the destination refuses to be framed.
 *
 * The report was "none of the urls are showing when roam is clicked" — a page that
 * sends `X-Frame-Options` renders as a blank white pane with no explanation. These
 * assert the window now says so, offers a real tab, and still lets the operator
 * force the frame if they want to.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserWindow } from '@/components/BrowserWindow';
import { checkFramableOne } from '@/lib/framing-client';

// Window chrome reads the workstation context; the browser reads its own slice.
jest.mock('@/components/WorkstationContext', () => {
  const ctx: Record<string, unknown> = {
    browse: null,
    windows: {
      browser: {
        title: 'ROAM',
        minimized: false,
        maximized: false,
        rect: { x: 40, y: 60, w: 900, h: 600 },
        z: 2,
      },
    },
    updateBrowse: jest.fn(),
    closeBrowse: jest.fn(),
    showAlert: jest.fn(),
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

jest.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ session: null }) }));
jest.mock('@/lib/framing-client', () => ({ checkFramableOne: jest.fn() }));
jest.mock('@/lib/sfx', () => ({ saveUrl: jest.fn() }));
jest.mock('@/lib/scan', () => ({ fetchUrlMeta: jest.fn() }));
jest.mock('@/lib/save-url', () => ({ saveUrlForUser: jest.fn() }));

const ctx = (jest.requireMock('@/components/WorkstationContext') as unknown as {
  __ctx: { browse: Record<string, unknown> | null };
}).__ctx;
const mockCheckFramableOne = checkFramableOne as unknown as jest.Mock;

const BASE = {
  url: 'https://publisher.example/article',
  title: 'A page',
  domain: 'publisher.example',
  category: 'Tech',
  subcategory: null,
  wilsonScore: 0.5,
  upvotes: 3,
  downvotes: 0,
  urlId: 'u1',
};

beforeEach(() => {
  jest.clearAllMocks();
  ctx.browse = { ...BASE };
  mockCheckFramableOne.mockResolvedValue('unknown');
});

describe('BrowserWindow — frame refused', () => {
  it('explains the refusal instead of showing a blank pane', () => {
    ctx.browse = { ...BASE, framable: false };
    const { container } = render(<BrowserWindow />);

    expect(screen.getByText('frame refused')).toBeInTheDocument();
    expect(screen.getByText(/forbids embedding/)).toBeInTheDocument();
    // Scoped to the panel: the toolbar also has an "Open in a new tab" button.
    const panel = within(screen.getByRole('status'));
    const link = panel.getByRole('link', { name: /open in a new tab/i });
    expect(link).toHaveAttribute('href', BASE.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(container.querySelector('iframe.browser-iframe')).toBeNull();
  });

  it('still frames the page when the operator insists', () => {
    ctx.browse = { ...BASE, framable: false };
    const { container } = render(<BrowserWindow />);

    fireEvent.click(screen.getByRole('button', { name: /try anyway/i }));

    expect(container.querySelector('iframe.browser-iframe')).toHaveAttribute('src', BASE.url);
  });

  it('frames a page that admits us', () => {
    ctx.browse = { ...BASE, framable: true };
    const { container } = render(<BrowserWindow />);

    expect(container.querySelector('iframe.browser-iframe')).toHaveAttribute('src', BASE.url);
    expect(screen.queryByText('frame refused')).toBeNull();
  });

  it('probes an unclassified link before framing it', async () => {
    mockCheckFramableOne.mockResolvedValue('refuse');
    const { container } = render(<BrowserWindow />);

    expect(await screen.findByText('frame refused')).toBeInTheDocument();
    expect(mockCheckFramableOne).toHaveBeenCalledWith(BASE.url);
    expect(container.querySelector('iframe.browser-iframe')).toBeNull();
  });
});
