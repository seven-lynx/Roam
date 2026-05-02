import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-500 dark:text-zinc-400">
        <span>© {year} Roam</span>
        <nav className="flex items-center gap-5">
          <a
            href="https://github.com/seito/roam"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            GitHub
          </a>
          <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
            Privacy
          </Link>
          <a
            href="mailto:legal@roamtheweb.app"
            className="hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}
