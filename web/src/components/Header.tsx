'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/lib/hooks';
import { useEffect, useState } from 'react';

export function Header() {
  const { session, loading } = useSession();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-bold text-2xl">🧭 Roam</Link>
        </div>
      </header>
    );
  }

  if (!session) {
    return (
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-bold text-2xl">🧭 Roam</Link>
          <div className="flex gap-4">
            <Link href="/join" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
              Sign in
            </Link>
            <Link href="/join" className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90">
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
        <Link href="/dashboard" className="font-bold text-2xl">🧭 Roam</Link>

        {/* Navigation */}
        <nav className="hidden md:flex gap-8">
          <Link href="/dashboard" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            Discover
          </Link>
          <Link href="/collections" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            Collections
          </Link>
          <Link href="/friends" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            Friends
          </Link>
        </nav>

        {/* Profile menu */}
        <div className="relative">
          <button
            onClick={() => setProfileMenu(!profileMenu)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-zinc-900 dark:text-white font-semibold"
          >
            {session.user?.email?.[0].toUpperCase()}
          </button>

          {profileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800 py-2 z-50">
              <Link href="/profile" className="block px-4 py-2 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Profile
              </Link>
              <Link href="/collections" className="block px-4 py-2 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Collections
              </Link>
              <Link href="/following" className="block px-4 py-2 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Following
              </Link>
              <Link href="/history" className="block px-4 py-2 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                History
              </Link>
              <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
              <Link href="/settings" className="block px-4 py-2 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col gap-1 w-10 h-10 items-center justify-center"
        >
          <span className="w-6 h-0.5 bg-zinc-900 dark:bg-white"></span>
          <span className="w-6 h-0.5 bg-zinc-900 dark:bg-white"></span>
          <span className="w-6 h-0.5 bg-zinc-900 dark:bg-white"></span>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden border-t border-zinc-200 dark:border-zinc-800 py-4 px-6 flex flex-col gap-4">
          <Link href="/dashboard" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            Discover
          </Link>
          <Link href="/collections" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            Collections
          </Link>
          <Link href="/friends" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            Friends
          </Link>
        </nav>
      )}
    </header>
  );
}
