import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-16 bg-white dark:bg-zinc-950 text-center">
      <div className="text-7xl mb-4">🧭</div>
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Lost at sea</h1>
      <p className="mt-3 text-zinc-500 dark:text-zinc-400 max-w-md">
        This page drifted off the map. It may have been moved, renamed, or never existed.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Go home
        </Link>
        <Link
          href="/how-it-works"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Explore the web →
        </Link>
      </div>
      <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">
        Looking for something specific?{' '}
        <Link href="/" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">
          Start from home
        </Link>
      </p>
    </div>
  );
}