'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { avatarPalette } from '@/components/UI';
import { NotificationBell } from '@/components/NotificationBell';
import { useState, useEffect, useRef } from 'react';
export function Header() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

  const handleLogout = async () => {
    setProfileMenu(false);
    await supabase.auth.signOut();
    router.push('/');
  };

  const avatarName = (session?.user?.user_metadata?.display_name as string | undefined)
    || session?.user?.email
    || '?';
  const [avatarBg, avatarFg] = avatarPalette(avatarName);

  if (loading) {
    return (
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-2xl text-zinc-900 dark:text-white">
            <Image src="/icon-512.png" alt="Roam" width={32} height={32} />
            Roam
          </Link>
        </div>
      </header>
    );
  }

  if (!session) {
    return (
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-2xl text-zinc-900 dark:text-white">
            <Image src="/icon-512.png" alt="Roam" width={32} height={32} />
            Roam
          </Link>
          <div className="flex gap-4 items-center">
            <Link
              href="/signup?mode=signin"
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/profile" className="flex items-center gap-2 font-bold text-2xl text-zinc-900 dark:text-white">
          <Image src="/icon-512.png" alt="Roam" width={32} height={32} />
          Roam
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <NotificationBell />
          <Link href="/profile" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
            Profile
          </Link>
          <Link href="/settings" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
            Settings
          </Link>
          <Link href="/how-it-works" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
            How It Works
          </Link>
        </nav>

        {/* Avatar dropdown */}
        <div className="relative hidden md:block" ref={dropdownRef}>
          <button
            onClick={() => setProfileMenu(v => !v)}
            aria-label="Open account menu"
            aria-expanded={profileMenu}
            className={`flex items-center justify-center w-10 h-10 rounded-full ${avatarBg} ${avatarFg} hover:opacity-90 transition-opacity font-bold text-sm`}
          >
            {avatarName[0].toUpperCase()}
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

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="md:hidden flex flex-col gap-1.5 w-10 h-10 items-center justify-center"
        >
          <span className="w-6 h-0.5 bg-zinc-900 dark:bg-white rounded"></span>
          <span className="w-6 h-0.5 bg-zinc-900 dark:bg-white rounded"></span>
          <span className="w-6 h-0.5 bg-zinc-900 dark:bg-white rounded"></span>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden border-t border-zinc-200 dark:border-zinc-800 py-4 px-6 flex flex-col gap-4">
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
        </nav>
      )}
    </header>
  );
}

