'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { avatarPalette } from '@/components/UI';
import { NotificationBell } from '@/components/NotificationBell';
import { toUnixPath } from '@/lib/os-nav';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [clock, setClock] = useState('');
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
      <Link href="/" className="font-pixel tracking-[0.22em] text-ink" aria-label="Roam home">ROAM-OS</Link>
      <span className="hidden sm:inline text-muted/70" aria-hidden="true">│</span>
      <span className="hidden sm:inline truncate normal-case tracking-normal" aria-label="Current location">
        {toUnixPath(pathname)}
      </span>

      <span className="flex-1" />

      <SignalBars />
      <span className="tabular-nums text-ink min-w-[3.2ch]" suppressHydrationWarning>{clock || '--:--'}</span>

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
                  Sign out
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <Link href="/signup?mode=signin" className="text-gold hover:text-gold-bright">Sign in</Link>
      )}
    </header>
  );
}
