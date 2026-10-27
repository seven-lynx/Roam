import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BuyMeACoffeeButton } from '@/components/BuyMeACoffeeButton';

describe('BuyMeACoffeeButton', () => {
  it('links to the Buy Me a Coffee page', () => {
    render(<BuyMeACoffeeButton />);

    const link = screen.getByRole('link', { name: /buy me a coffee/i });
    expect(link).toHaveAttribute('href', 'https://buymeacoffee.com/7lynx');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
