'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consented = localStorage.getItem('roam-cookie-consent');
      if (!consented) setVisible(true);
    } catch {
      // localStorage unavailable — don't show banner
    }
  }, []);

  if (!visible) return null;

  function accept() {
    try {
      localStorage.setItem('roam-cookie-consent', 'true');
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Roam uses a single session cookie for authentication. No tracking, no ads.{" "}
          <Link href="/privacy" className="underline hover:text-zinc-900 dark:hover:text-white transition-colors">
            Learn more
          </Link>
          .
        </p>
        <button
          onClick={accept}
          className="shrink-0 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Got it
        </button>
      </div>
    </div>
  );
}