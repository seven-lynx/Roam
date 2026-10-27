import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BuyMeACoffeeWidget } from '@/components/BuyMeACoffeeWidget';

describe('BuyMeACoffeeWidget', () => {
  it('renders the Buy Me a Coffee widget script with the correct account and styling', () => {
    const { container } = render(<BuyMeACoffeeWidget />);

    const script = container.querySelector(
      'script[data-name="BMC-Widget"]',
    ) as HTMLScriptElement;

    expect(script).toBeInTheDocument();
    expect(script.getAttribute('src')).toBe(
      'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js',
    );
    expect(script.getAttribute('data-id')).toBe('7lynx');
    expect(script.getAttribute('data-color')).toBe('#40DCA5');
    expect(script.getAttribute('data-position')).toBe('Right');
  });
});
