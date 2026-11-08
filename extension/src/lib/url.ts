// url.ts — canonical URL normalisation for the extension.
//
// NOTE: This is the browser-extension copy of the URL normalisation logic.
// The canonical Deno version lives at:
//   supabase/functions/_shared/normalise.ts
// The Node.js (seeder) version is at:
//   scripts/lib/seed.js (see its header comment for cross-ref)
//
// ALL THREE COPIES MUST BE KEPT IN SYNC when adding new tracking params or
// normalisation rules (extension rule E.7). The extension cannot import the Deno
// module (it runs in a browser service worker), so this stand-alone
// implementation is intentional.

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.protocol = 'https:';
    u.hostname = u.hostname.toLowerCase();
    if (u.hostname.startsWith('www.')) u.hostname = u.hostname.slice(4);
    // Canonical tracking-param strip list — keep in sync with:
    // - Android: MainViewModel.normalizeUrl() (trackingKeys set)
    // - Web: web/src/lib/constants.ts (TRACKING_PARAMS export)
    const STRIP = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','fbclid','gclid','ref','source','mc_cid','mc_eid'];
    STRIP.forEach((p) => u.searchParams.delete(p));
    u.hash = '';
    if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch { return null; }
}

export function getDomain(url: string): string | null {
  try {
    const u = new URL(url);
    let domain = u.hostname.toLowerCase();
    if (domain.startsWith('www.')) domain = domain.slice(4);
    const parts = domain.split('.');
    if (parts.length >= 3) return parts.slice(-2).join('.');
    return domain;
  } catch { return null; }
}
