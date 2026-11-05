/**
 * Route registry for internal roamtheweb.app "app" routes that should render as
 * OS windows rather than chrome-less full pages. This is the single source of
 * truth used by the shell to coerce deep-links (bookmarks, direct URLs, plain
 * `<Link>`s and terminal `goto`) into real windows — so every internal route
 * gets window chrome (drag / minimize / close) and it still participates in
 * "Show Desktop".
 */

export interface WindowRouteMatch {
  href: string;
  title: string;
}

interface WindowRoute {
  path: string;
  title: string;
}

/** Static app routes, mapped to their window titles. */
const WINDOW_ROUTES: WindowRoute[] = [
  { path: '/submit', title: 'Upload URL' },
  { path: '/profile', title: 'Profile' },
  { path: '/settings', title: 'Settings' },
  { path: '/collections', title: 'Collections' },
  { path: '/badges', title: 'Badges' },
  { path: '/challenges', title: 'Challenges' },
  { path: '/leaderboard', title: 'Rankings' },
  { path: '/following', title: 'Following' },
  { path: '/people', title: 'People' },
];

/** Dynamic (parameterised) app routes, matched by prefix. */
const DYNAMIC_ROUTES: { prefix: string; title: string }[] = [
  { prefix: '/collections/', title: 'Collection' },
  { prefix: '/u/', title: 'Profile' },
];

/**
 * Whether a pathname is an internal app route that should open as a window.
 * Static and dynamic routes are matched; the desktop (`/`, `/desktop`) and
 * static/marketing/auth pages return `null`.
 */
export function matchWindowRoute(pathname: string): WindowRouteMatch | null {
  if (!pathname) return null;
  const exact = WINDOW_ROUTES.find((r) => pathname === r.path);
  if (exact) return { href: exact.path, title: exact.title };
  for (const d of DYNAMIC_ROUTES) {
    if (pathname.startsWith(d.prefix) && pathname.length > d.prefix.length) {
      return { href: pathname, title: d.title };
    }
  }
  return null;
}
