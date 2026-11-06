import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SubmitSignalNotice } from '@/components/SubmitSignalNotice';

describe('SubmitSignalNotice', () => {
  it('speaks in the ROAM-OS register', () => {
    render(<SubmitSignalNotice variant="roam-os" />);

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('// uncharted signal');
    expect(notice).toHaveTextContent('SIGNAL FOUND');
    expect(notice).toHaveTextContent("This page isn't in ~/roam yet.");
    expect(notice).toHaveTextContent('You found it first');
  });

  it('speaks in the Roam Classic register', () => {
    render(<SubmitSignalNotice variant="classic" />);

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('New signal');
    expect(notice).toHaveTextContent('SIGNAL FOUND');
    expect(notice).toHaveTextContent('Nobody has logged this page before.');
    expect(notice).toHaveTextContent('Good find, wanderer');
  });

  it('never uses the retired "gem" noun', () => {
    for (const variant of ['roam-os', 'classic'] as const) {
      const { unmount } = render(<SubmitSignalNotice variant={variant} />);
      expect(screen.getByRole('status').textContent ?? '').not.toMatch(/gem/i);
      unmount();
    }
  });
});