'use client';

import { useEffect } from 'react';
import { BUY_ME_A_COFFEE_USERNAME } from '@/lib/constants';

const WIDGET_SCRIPT_SRC = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';

/**
 * Loads Buy Me a Coffee's official floating tip widget.
 *
 * The script is self-initializing and appends its own button to the document,
 * so we inject it once and guard against double-injection across remounts and
 * client-side navigation.
 */
export function BuyMeACoffeeWidget() {
  useEffect(() => {
    if (document.querySelector('script[data-name="BMC-Widget"]')) return;

    const script = document.createElement('script');
    script.dataset.name = 'BMC-Widget';
    script.dataset.cfasync = 'false';
    script.src = WIDGET_SCRIPT_SRC;
    script.dataset.id = BUY_ME_A_COFFEE_USERNAME;
    script.dataset.description = 'Support Roam on Buy Me a Coffee!';
    script.dataset.message = 'Thanks for helping keep Roam online!';
    script.dataset.color = '#F59E0B';
    script.dataset.position = 'Right';
    script.dataset.x_margin = '18';
    script.dataset.y_margin = '18';

    document.body.appendChild(script);
  }, []);

  return null;
}
