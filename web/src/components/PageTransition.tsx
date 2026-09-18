'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Lightweight top-loading progress bar for page transitions.
 * Shows an animated bar at the top of the viewport during Next.js route changes.
 *
 * Uses the .nprogress-bar CSS class defined in globals.css.
 */
export function PageTransition() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const bar = document.createElement('div');
    bar.className = 'nprogress-bar';
    bar.style.width = '0%';
    document.body.appendChild(bar);

    // Simulate progress
    let width = 0;
    const interval = setInterval(() => {
      width += Math.random() * 30;
      if (width > 90) width = 90;
      bar.style.width = `${width}%`;
    }, 150);

    // Complete on next paint
    const raf = requestAnimationFrame(() => {
      clearInterval(interval);
      bar.style.width = '100%';
      setTimeout(() => {
        bar.style.transition = 'opacity 200ms ease';
        bar.style.opacity = '0';
        setTimeout(() => bar.remove(), 200);
      }, 200);
    });

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(raf);
      bar.remove();
    };
  }, [pathname, searchParams]);

  return null;
}