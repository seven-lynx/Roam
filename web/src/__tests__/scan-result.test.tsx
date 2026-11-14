/**
 * Tests for the scan card.
 *
 * Two things live here: the dry-feed copy (issue #120), where a cooldown, an empty
 * pool and hidden filters used to reach the user as the same "no signal"; and the
 * frame handoff, where a page that refuses to be embedded must offer a real tab
 * instead of opening a blank white frame.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScanResult } from '@/components/ScanResult';
import { useWorkstation } from '@/components/WorkstationContext';
import { checkFramableOne } from '@/lib/framing-client';
import type { RoamExhaustion } from '@/lib/roam-buffer';
import type { ScanTarget } from '@/lib/scan';

jest.mock('@/components/WorkstationContext', () => ({
  useWorkstation: jest.fn(),
}));

jest.mock('@/lib/framing-client', () => ({
  checkFramableOne: jest.fn(),
}));

const mockUseWorkstation = useWorkstation as unknown as jest.Mock;
const mockCheckFramableOne = checkFramableOne as unknown as jest.Mock;

const openUrl = jest.fn();
const closeWindow = jest.fn();
const openAppView = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseWorkstation.mockReturnValue({ openUrl, closeWindow, openAppView });
  mockCheckFramableOne.mockResolvedValue('unknown');
});

function renderDry(exhaustion: RoamExhaustion | null) {
  return render(
    <ScanResult
      target={null}
      error="catalog is empty"
      exhaustion={exhaustion}
      actionRef={{ current: null }}
      onAgain={jest.fn()}
      onClose={jest.fn()}
    />,
  );
}

const TARGET: ScanTarget = {
  id: 'u1',
  title: 'A page',
  original_url: 'https://publisher.example/article',
  upvotes: 3,
  downvotes: 0,
  wilson_score: 0.5,
  category_id: null,
  subcategory_id: null,
  category: 'Tech',
  subcategory: null,
};

function renderTarget(overrides: Partial<ScanTarget> = {}) {
  return render(
    <ScanResult
      target={{ ...TARGET, ...overrides }}
      error={null}
      exhaustion={null}
      actionRef={{ current: null }}
      onAgain={jest.fn()}
      onClose={jest.fn()}
    />,
  );
}

describe('ScanResult — dry feed', () => {
  it('explains an empty pool as having read everything', () => {
    renderDry({ reason: 'pool_empty', scope: 'global', available_later: null });
    expect(screen.getByText('read it all')).toBeInTheDocument();
    expect(screen.getByText(/Nothing unseen is left in this feed/)).toBeInTheDocument();
  });

  it('turns a cooldown into a wait the reader can size', () => {
    const later = new Date(Date.now() + 3 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString();
    renderDry({ reason: 'cooldown', scope: 'category:abc', available_later: later });
    expect(screen.getByText('feed resting')).toBeInTheDocument();
    expect(screen.getByText(/returns in about 3 hours/)).toBeInTheDocument();
  });

  it('points hidden filters back at the user', () => {
    renderDry({ reason: 'filters', scope: 'subcategory:abc', available_later: null });
    expect(screen.getByText('filtered out')).toBeInTheDocument();
    expect(screen.getByText(/Loosen them in Settings/)).toBeInTheDocument();
  });

  it('keeps the generic copy when the reply carried no reason', () => {
    renderDry(null);
    expect(screen.getByText('no signal')).toBeInTheDocument();
    expect(screen.getByText(/catalog didn/)).toBeInTheDocument();
  });

  it('still surfaces the trace, so a real fault is not hidden', () => {
    renderDry({ reason: 'pool_empty', scope: 'global', available_later: null });
    expect(screen.getByText(/catalog is empty/)).toBeInTheDocument();
  });
});

describe('ScanResult — frame handoff', () => {
  // Reproduces the report: the page is alive but the destination refuses to be
  // framed, so the in-OS browser could only ever show a blank white pane.
  it('offers a real tab when the page refuses framing', async () => {
    mockCheckFramableOne.mockResolvedValue('refuse');

    renderTarget();

    const link = await screen.findByRole('link', { name: /open in new tab/i });
    expect(link).toHaveAttribute('href', TARGET.original_url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText(/refuses to be embedded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try in OS anyway/i })).toBeInTheDocument();
    // Nothing was opened in the OS behind the operator's back.
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('still lets the operator force the in-OS browser', async () => {
    mockCheckFramableOne.mockResolvedValue('refuse');

    renderTarget();
    fireEvent.click(await screen.findByRole('button', { name: /try in OS anyway/i }));

    expect(closeWindow).toHaveBeenCalledWith('scan');
    expect(openUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: TARGET.original_url, framable: false }),
    );
  });

  it('keeps the in-OS Open action when the page can be framed', async () => {
    mockCheckFramableOne.mockResolvedValue('allow');

    renderTarget();
    await waitFor(() => expect(mockCheckFramableOne).toHaveBeenCalledWith(TARGET.original_url));
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));

    expect(openUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: TARGET.original_url, framable: true }),
    );
  });

  it('trusts a verdict the roam path already knew, without probing again', async () => {
    renderTarget({ framable: false });

    expect(await screen.findByRole('link', { name: /open in new tab/i })).toBeInTheDocument();
    expect(mockCheckFramableOne).not.toHaveBeenCalled();
  });

  it('leaves the in-OS action alone when the probe cannot tell', async () => {
    mockCheckFramableOne.mockResolvedValue('unknown');

    renderTarget();
    await waitFor(() => expect(mockCheckFramableOne).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(openUrl).toHaveBeenCalledWith(
      expect.objectContaining({ url: TARGET.original_url, framable: null }),
    );
  });
});
