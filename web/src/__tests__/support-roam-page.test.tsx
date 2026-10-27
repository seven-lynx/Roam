import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SupportRoamPage from '@/app/support-roam/page';

describe('SupportRoamPage', () => {
  it('spells out the operating costs transparently', () => {
    render(<SupportRoamPage />);

    expect(screen.getByRole('heading', { name: /support roam/i })).toBeInTheDocument();
    expect(screen.getByText(/\$25\/month/)).toBeInTheDocument();
    expect(screen.getByText(/\$14 every 2 years/)).toBeInTheDocument();
    expect(screen.getByText(/\$27\/month goal/)).toBeInTheDocument();
  });

  it('links to Buy Me a Coffee and the GitHub project', () => {
    render(<SupportRoamPage />);

    expect(screen.getByRole('link', { name: /buy me a coffee/i })).toHaveAttribute(
      'href',
      'https://buymeacoffee.com/7lynx',
    );
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute(
      'href',
      'https://github.com/seven-lynx/Roam',
    );
  });

  it('shows the monthly goal progress bar', () => {
    render(<SupportRoamPage />);

    const bar = screen.getByRole('progressbar', { name: /monthly support goal progress/i });
    expect(bar).toHaveAttribute('aria-valuemax', '27');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });
});
