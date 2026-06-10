'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Crumb {
  label: string;
  href: string;
}

const PATH_MAP: Record<string, string> = {
  profile: 'Profile',
  settings: 'Settings',
  submit: 'Share a link',
  signup: 'Sign up',
  'how-it-works': 'How It Works',
  'android-beta': 'Android Beta',
  collections: 'Collections',
  u: 'Profile',
  admin: 'Admin',
};

export function Breadcrumbs() {
  const pathname = usePathname();

  // Don't render on homepage
  if (pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'Home', href: '/' }];

  segments.reduce((acc, segment) => {
    const href = `${acc}/${segment}`;
    const label = PATH_MAP[segment] ?? segment.replace(/-/g, ' ');
    crumbs.push({ label: label.charAt(0).toUpperCase() + label.slice(1), href });
    return href;
  }, '');

  // Only render for depth > 1
  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="max-w-7xl mx-auto px-6 pt-4 pb-2">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === crumbs.length - 1 ? (
              <span className="text-zinc-600 dark:text-zinc-300 font-medium" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}