/**
 * Tests for the scan card's dry-feed copy (issue #120).
 *
 * A cooldown, an empty pool and hidden filters used to reach the user as the same
 * "no signal", which is the dead end the whole change exists to remove. These
 * assert the three cases stay distinct — and that a reply with no reason keeps the
 * old copy instead of inventing one.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScanResult } from '@/components/ScanResult';
import type { RoamExhaustion } from '@/lib/roam-buffer';

jest.mock('@/components/WorkstationContext', () => ({
  useWorkstation: () => ({
    openUrl: jest.fn(),
    closeWindow: jest.fn(),
    openAppView: jest.fn(),
  }),
}));

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
