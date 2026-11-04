'use client';

import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { WorkstationShell } from '@/components/WorkstationShell';
import { FlashlightCursor } from '@/components/FlashlightCursor';
import { TerminalOverlay } from '@/components/TerminalOverlay';
import { CookieBanner } from '@/components/CookieBanner';
import { PageTransition } from '@/components/PageTransition';

function Gate({ children }: { children: ReactNode }) {
  const params = useSearchParams();

  if (params.get('embed') === '1') {
    // Bare render for pages loaded inside an app window: no OS shell, footer or
    // overlays. The palette lives on :root, so the page still reads the theme.
    return <main id="main-content" className="embed-root">{children}</main>;
  }

  return (
    <WorkstationShell
      overlays={
        <>
          <FlashlightCursor />
          <TerminalOverlay />
          <CookieBanner />
        </>
      }
    >
      <Suspense><PageTransition /></Suspense>
      <main id="main-content" className="min-h-full">
        {children}
      </main>
      <footer className="border-t border-line px-6 py-6 text-center font-mono text-xs text-muted">
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/how-it-works" className="hover:text-ink">How It Works</Link>
          <Link href="/support-roam" className="hover:text-gold">Support Roam</Link>
          <Link href="/extensions" className="hover:text-ink">Extensions</Link>
          <Link href="/android" className="hover:text-ink">Android</Link>
          <Link href="/stats" className="hover:text-ink">Stats</Link>
          <Link href="/changelog" className="hover:text-ink">Changelog</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <a href="https://github.com/seven-lynx/Roam" target="_blank" rel="noopener noreferrer" className="hover:text-ink">GitHub</a>
        </nav>
      </footer>
    </WorkstationShell>
  );
}

/** Wraps the root shell; when `?embed=1`, renders the page bare. */
export function EmbedGate({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<main className="embed-root" />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
