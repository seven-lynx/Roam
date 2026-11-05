'use client';

import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
import { WorkstationShell } from '@/components/WorkstationShell';
import { AppRouteWindow } from '@/components/AppRouteWindow';
import { matchWindowRoute } from '@/lib/os-routes';
import { FlashlightCursor } from '@/components/FlashlightCursor';
import { TerminalOverlay } from '@/components/TerminalOverlay';
import { CookieBanner } from '@/components/CookieBanner';
import { PageTransition } from '@/components/PageTransition';
import { ClassicShell } from '@/components/ClassicShell';
import { ShellModeContext } from '@/components/ShellModeContext';
import type { WebappTheme } from '@/components/WorkstationContext';

const SHELL_KEY = 'roam-webapp-theme';

function Gate({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const pathname = usePathname();

  // The shell decision is a client-side concern (persisted per device). The
  // defer-to-client mount keeps SSR/hydration stable, and the anti-FOUC script
  // in the root layout has already painted the right `data-ui` + `dark` state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [mode, setModeState] = useState<WebappTheme>('roam-os');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SHELL_KEY);
      setModeState(saved === 'classic' ? 'classic' : 'roam-os');
    } catch { /* ignore */ }
  }, []);

  const setMode = useCallback((m: WebappTheme) => {
    setModeState(m);
    try { localStorage.setItem(SHELL_KEY, m); } catch { /* ignore */ }
    document.documentElement.dataset.ui = m;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.ui = mode;
  }, [mode]);

  if (params.get('embed') === '1') {
    // Bare render for pages loaded inside an app window: no shell, footer or
    // overlays. The palette lives on :root, so the page still reads the theme.
    return <main id="main-content" className="embed-root">{children}</main>;
  }

  const overlays = (
    <>
      <FlashlightCursor />
      <TerminalOverlay />
      <CookieBanner />
    </>
  );

  // Internal app routes render as OS windows (not chrome-less full pages), so
  // they get a close button and still respond to "Show Desktop".
  const route = mounted ? matchWindowRoute(pathname) : null;

  const osShell = route ? (
    <WorkstationShell overlays={overlays}>
      <AppRouteWindow route={route} />
    </WorkstationShell>
  ) : (
    <WorkstationShell overlays={overlays}>
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

  return (
    <ShellModeContext.Provider value={{ mode, setMode }}>
      {mode === 'classic' ? (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ClassicShell>{children}</ClassicShell>
        </ThemeProvider>
      ) : (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem forcedTheme="dark" disableTransitionOnChange>
          {osShell}
        </ThemeProvider>
      )}
    </ShellModeContext.Provider>
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
