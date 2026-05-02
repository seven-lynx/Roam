import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-16 bg-white dark:bg-zinc-950 text-center">
      <Image src="/icon-512.png" alt="Roam" width={64} height={64} className="opacity-50" />
      <h1 className="mt-6 text-3xl font-bold text-zinc-900 dark:text-white">Page not found</h1>
      <p className="mt-3 text-zinc-500 dark:text-zinc-400 max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white hover:opacity-70 transition-opacity"
      >
        Go home →
      </Link>
    </div>
  );
}
