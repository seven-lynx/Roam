'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm0 12.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zm-5.657-5.657a.75.75 0 010 1.061l-1.06 1.06a.75.75 0 11-1.062-1.06l1.06-1.06a.75.75 0 011.062 0zm11.314 0a.75.75 0 010-1.062l1.06-1.06a.75.75 0 011.061 1.06l-1.06 1.06a.75.75 0 01-1.061 0zM10 6a4 4 0 100 8 4 4 0 000-8zm-9 3.25a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5H1zm16.5 0a.75.75 0 000 1.5H19a.75.75 0 000-1.5h-1.5zm-13.185-.44a.75.75 0 010 1.06L3.254 10.93a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zm11.314 0a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 11-1.061-1.06l1.06-1.06a.75.75 0 011.06 0z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}