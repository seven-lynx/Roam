import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 bg-screen text-center">
      <div className="text-7xl mb-4">🧭</div>
      <h1 className="text-3xl font-bold text-ink">Lost at sea</h1>
      <p className="mt-3 text-muted max-w-md">
        This page drifted off the map. It may have been moved, renamed, or never existed.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="btn btn-primary"
        >
          Go home
        </Link>
        <Link
          href="/how-it-works"
          className="btn btn-secondary"
        >
          Explore the web →
        </Link>
      </div>
      <p className="mt-6 text-xs text-muted">
        Looking for something specific?{' '}
        <Link href="/" className="underline hover:text-ink">
          Start from home
        </Link>
      </p>
    </div>
  );
}