'use client';

import { Suspense, type ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CookieBanner } from '@/components/CookieBanner';
import { PageTransition } from '@/components/PageTransition';
import { useShellMode } from '@/components/ShellModeContext';

/**
 * Roam Classic — the original standalone web-app shell (pre-cyberdeck): a plain
 * sticky header, breadcrumbs, page content, and footer. There is no OS desktop,
 * dock, status bar or CRT chrome. A small pill switches back to ROAM-OS.
 */
export function ClassicShell({ children }: { children: ReactNode }) {
  const { setMode } = useShellMode();

  return (
    <div className="classic-root min-h-full flex flex-col">
      <Header />
      <Suspense fallback={null}>
        <PageTransition />
      </Suspense>
      <Breadcrumbs />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <CookieBanner />

      <button
        type="button"
        onClick={() => setMode('roam-os')}
        aria-label="Switch to ROAM-OS"
        title="Switch to ROAM-OS"
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-lg backdrop-blur-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        ⛶ ROAM-OS
      </button>
    </div>
  );
}
