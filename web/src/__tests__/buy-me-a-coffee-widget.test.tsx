import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BuyMeACoffeeWidget } from '@/components/BuyMeACoffeeWidget';

afterEach(() => {
  document.querySelectorAll('script[data-name="BMC-Widget"]').forEach((el) => el.remove());
});

describe('BuyMeACoffeeWidget', () => {
  it('injects the Buy Me a Coffee widget script for the right account', () => {
    render(<BuyMeACoffeeWidget />);

    const script = document.querySelector(
      'script[data-name="BMC-Widget"]',
    ) as HTMLScriptElement;

    expect(script).toBeInTheDocument();
    expect(script.dataset.id).toBe('7lynx');
    expect(script.src).toBe('https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js');
  });

  it('does not inject a duplicate script when mounted again', () => {
    const first = render(<BuyMeACoffeeWidget />);
    first.unmount();
    render(<BuyMeACoffeeWidget />);

    expect(document.querySelectorAll('script[data-name="BMC-Widget"]')).toHaveLength(1);
  });
});
