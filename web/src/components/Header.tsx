'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { avatarPalette } from '@/components/UI';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useState, useEffect, useRef } from 'react';

export function Header() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Track scroll position for shadow effect
  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 4);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Focus trap for mobile menu
  useEffect(() => {
    if (!menuOpen || !mobileMenuRef.current) return;
    const menu = mobileMenuRef.current;
    const focusable = menu.querySelectorAll<HTMLElement>(
      'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setMenuOpen(false); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    menu.addEventListener('keydown', handleKeyDown);
    return () => menu.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const handleLogout = async () => {
    setProfileMenu(false);
    await supabase.auth.signOut();
    router.push('/');
  };

  const avatarName = (session?.user?.user_metadata?.display_name as string | undefined)
    || session?.user?.email
    || '?';
  const [avatarBg, avatarFg] = avatarPalette(avatarName);

  const headerClasses = `sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm transition-shadow duration-200 ${scrolled ? 'shadow-sm' : ''}`;

  if (loading) {
    return (
      <header className={headerClasses}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-2xl text-zinc-900 dark:text-white">
            <Image src="/icon-512.png" alt="Roam" width={32} height={32} />
            Roam
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className={headerClasses}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-2xl text-zinc-900 dark:text-white shrink-0">
          <Image src="/icon-512.png" alt="Roam" width={32} height={32} className="shrink-0" />
          Roam
        </Link>

        {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 ml-8">
          {session ? (
            <>
              <Link
                href="/how-it-works"
                className={`text-sm font-medium transition-colors ${
                  pathname === '/how-it-works'
                    ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white pb-0.5'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                How It Works
              </Link>
              <Link
                href="/collections"
                className={`text-sm font-medium transition-colors ${
                  pathname === '/collections'
                    ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white pb-0.5'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Collections
              </Link>
              <Link
                href="/submit"
                className={`text-sm font-medium transition-colors ${
                  pathname === '/submit'
                    ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 pb-0.5'
                    : 'text-amber-600 dark:text-amber-400 hover:text-amber-500'
                }`}
              >
                + Submit
              </Link>
              <Link
                href="/profile"
                className={`text-sm font-medium transition-colors ${
                  pathname === '/profile'
                    ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white pb-0.5'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Profile
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/how-it-works"
                className={`text-sm font-medium transition-colors ${
                  pathname === '/how-it-works'
                    ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white pb-0.5'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                How It Works
              </Link>
              <Link
                href="/collections"
                className={`text-sm font-medium transition-colors ${
                  pathname === '/collections'
                    ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white pb-0.5'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Collections
              </Link>
            </>
          )}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right group */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {session ? (
            <>
              <NotificationBell />
              {/* Avatar dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileMenu(v => !v)}
                  aria-label="Open account menu"
                  aria-expanded={profileMenu}
                  className={`flex items-center justify-center w-9 h-9 rounded-full ${avatarBg} ${avatarFg} hover:opacity-90 transition-opacity font-bold text-sm`}
                >
                  {avatarName[0].toUpperCase()}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 ml-0.5 text-zinc-400" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {profileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800 py-1 z-50">
                    <Link
                      href="/profile"
                      onClick={() => setProfileMenu(false)}
                      className="block px-4 py-2 text-sm text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setProfileMenu(false)}
                      className="block px-4 py-2 text-sm text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Settings
                    </Link>
                    <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/signup?mode=signin"
                className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
              >
                Get started
              </Link>
            </>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="md:hidden flex flex-col gap-1.5 w-10 h-10 items-center justify-center"
          >
            <span className="w-6 h-0.5 bg-zinc-900 dark:bg-white rounded transition-transform" />
            <span className="w-6 h-0.5 bg-zinc-900 dark:bg-white rounded" />
            <span className="w-6 h-0.5 bg-zinc-900 dark:bg-white rounded transition-transform" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav ref={mobileMenuRef} className="md:hidden border-t border-zinc-200 dark:border-zinc-800 py-4 px-6 flex flex-col gap-4">
          <Link href="/how-it-works" className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
            How It Works
          </Link>
          <Link href="/collections" className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
            Collections
          </Link>
          {session ? (
            <>
              <Link href="/submit" className="text-amber-600 dark:text-amber-400 font-medium hover:text-amber-500">
                + Submit a URL
              </Link>
              <Link href="/profile" className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
                Profile
              </Link>
              <Link href="/settings" className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="text-left text-red-600 hover:text-red-700"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/signup?mode=signin" className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
                Sign in
              </Link>
              <Link href="/signup" className="text-amber-500 font-semibold">
                Get started
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}