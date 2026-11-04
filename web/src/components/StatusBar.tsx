'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { avatarPalette } from '@/components/UI';
import { NotificationBell } from '@/components/NotificationBell';
import { toUnixPath } from '@/lib/os-nav';
import { useWorkstation } from '@/components/WorkstationContext';

function SignalBars() {
  return (
    <span className="flex items-end gap-[2px] h-3" role="img" aria-label="Signal strength: strong">
      {[4, 7, 10, 12].map((h, i) => (
        <span key={i} className="w-[3px] bg-phosphor" style={{ height: h, opacity: 0.45 + i * 0.18 }} />
      ))}
    </span>
  );
}

/** On-screen OS bar: path readout, clock, signal, notifications and account menu. */
export function StatusBar() {
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toggleLauncher, handheld, webappTheme, setWebappTheme } = useWorkstation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // The clock renders after mount so server and client markup match.
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  // Track native fullscreen so the toggle stays correct even on Esc / browser UI.
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* fullscreen unsupported */
    }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await createClient().auth.signOut();
    router.push('/');
  };

  const avatarName =
    (session?.user?.user_metadata?.display_name as string | undefined) || session?.user?.email || '?';
  const [avatarBg, avatarFg] = avatarPalette(avatarName);

  return (
    <header className="screen-bar" role="banner">
      <span className="led" aria-hidden="true" />
      {handheld && (
        <button
          type="button"
          onClick={() => router.push('/')}
          className="font-pixel tracking-[0.22em] text-ink bg-transparent border-0 p-0 cursor-pointer hover:text-phosphor transition-colors"
          aria-label="Home"
        >
          ⌂
        </button>
      )}
      <button
        type="button"
        data-launcher-toggle="true"
        onClick={toggleLauncher}
        className="font-pixel tracking-[0.22em] text-ink bg-transparent border-0 p-0 cursor-pointer hover:text-phosphor transition-colors"
        aria-label="Open programs"
      >
        ROAM-OS
      </button>
      <span className="hidden sm:inline text-muted/70" aria-hidden="true">│</span>
      <span className="hidden sm:inline truncate normal-case tracking-normal" aria-label="Current location">
        {toUnixPath(pathname)}
      </span>

      <span className="flex-1" />

      {session ? (
        <>
          <NotificationBell />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open account menu"
              aria-expanded={menuOpen}
              className={`flex items-center justify-center w-7 h-7 rounded-full ${avatarBg} ${avatarFg} text-xs font-bold`}
            >
              {avatarName[0].toUpperCase()}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 panel p-1 z-50 normal-case tracking-normal">
                <Link href="/profile" className="block px-3 py-2 text-sm font-mono text-ink hover:bg-panel-2">Profile</Link>
                <Link href="/settings" className="block px-3 py-2 text-sm font-mono text-ink hover:bg-panel-2">Settings</Link>
                <hr className="my-1 border-line" />
                <button type="button" onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm font-mono text-danger hover:bg-panel-2">
                  Log out
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <Link
          href="/signup?mode=signin"
          className="px-2 py-0.5 rounded border border-line text-[11px] text-ink hover:border-gold hover:text-gold transition-colors"
        >
          Log in
        </Link>
      )}

      <span className="tabular-nums text-ink min-w-[3.2ch]" suppressHydrationWarning>{clock || '--:--'}</span>
      <SignalBars />
      <button
        type="button"
        onClick={() => setWebappTheme(webappTheme === 'roam-os' ? 'classic' : 'roam-os')}
        aria-pressed={webappTheme === 'classic'}
        aria-label={webappTheme === 'roam-os' ? 'Switch to Roam Classic' : 'Switch to Roam-OS'}
        className="px-2 h-7 rounded border border-line text-[10px] font-mono tracking-wide text-ink hover:text-phosphor hover:border-gold transition-colors"
        title={webappTheme === 'roam-os' ? 'Switch to Roam Classic' : 'Switch to Roam-OS'}
      >
        {webappTheme === 'roam-os' ? 'CLASSIC' : 'ROAM-OS'}
      </button>
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        aria-pressed={isFullscreen}
        className="flex items-center justify-center w-7 h-7 rounded border border-line text-ink hover:text-phosphor hover:border-gold transition-colors"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        <span aria-hidden="true">{isFullscreen ? '⤡' : '⤢'}</span>
      </button>
    </header>
  );
}
