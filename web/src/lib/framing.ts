/**
 * Frame eligibility for the in-OS browser.
 *
 * A page can refuse to render inside an `<iframe>` in two ways: the legacy
 * `X-Frame-Options` header, or the `frame-ancestors` directive of a Content
 * Security Policy. Most mainstream publishers send one of them, which is why the
 * ROAM browser showed a blank white screen for so many roams — the frame was
 * refused by the destination, not by us.
 *
 * These helpers are pure so the API route that probes a page and the client that
 * renders it agree on the same verdict.
 */

/** `allow` renders in the OS, `refuse` must open as a real tab, `unknown` is a failed probe. */
export type FramePolicy = 'allow' | 'refuse' | 'unknown';

/** The headers that decide whether a cross-origin page may be framed. */
export interface FrameHeaders {
  /** `x-frame-options`, verbatim. */
  xFrameOptions?: string | null;
  /** `content-security-policy`, verbatim (`frame-ancestors` is what matters). */
  contentSecurityPolicy?: string | null;
}

/** Ancestor origin assumed when the deployment has no explicit site URL. */
export const DEFAULT_ROAM_ORIGIN = 'https://roamtheweb.app';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Value of the `frame-ancestors` directive, or null when the policy omits it. */
export function frameAncestorsDirective(csp: string | null | undefined): string | null {
  if (!csp) return null;
  for (const directive of csp.split(';')) {
    const parts = directive.trim().split(/\s+/).filter(Boolean);
    const [name, ...sources] = parts;
    if (name && name.toLowerCase() === 'frame-ancestors') return sources.join(' ');
  }
  return null;
}

/**
 * Does a `frame-ancestors` source list admit us? `'self'` never does — that is the
 * framed page's own origin, and the OS is a different one.
 */
function ancestorAllows(sources: string, ourOrigin: string): boolean {
  const tokens = sources.split(/\s+/).filter(Boolean);
  // `frame-ancestors` with no sources allows nobody.
  if (tokens.length === 0) return false;

  const ours = originOf(ourOrigin);
  const ourScheme = ours ? `${new URL(ours).protocol.replace(':', '')}:` : 'https:';
  const ourHost = ours ? new URL(ours).hostname.toLowerCase() : '';

  for (const raw of tokens) {
    const token = raw.toLowerCase();
    if (token === '*') return true;
    if (token === "'none'" || token === "'self'") continue;
    // Scheme sources admit every host on that scheme.
    if (token === 'http:' || token === 'https:' || token === 'ws:' || token === 'wss:') {
      if (token === ourScheme) return true;
      continue;
    }
    const bare = token.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/\/.*$/, '');
    if (bare.startsWith('*.')) {
      if (ourHost.endsWith(bare.slice(2))) return true;
      continue;
    }
    const host = originOf(token.includes('://') ? token : `https://${token}`);
    if (host && ours && host.toLowerCase() === ours.toLowerCase()) return true;
  }
  return false;
}

/**
 * Decide whether `targetUrl` may be framed by `ourOrigin`.
 *
 * Best effort by design: an unrecognised header value yields `allow`, and an
 * unparseable URL yields `unknown`, so the browser keeps its old behaviour rather
 * than hiding pages that would have rendered.
 */
export function parseFramePolicy(
  headers: FrameHeaders,
  targetUrl: string,
  ourOrigin: string = DEFAULT_ROAM_ORIGIN,
): FramePolicy {
  const target = originOf(targetUrl);
  if (!target) return 'unknown';

  const ours = originOf(ourOrigin);
  // Mixed content: an https page cannot frame an http document at all.
  if (ours && new URL(ours).protocol === 'https:' && new URL(target).protocol === 'http:') {
    return 'refuse';
  }

  // Chrome honours `frame-ancestors` over `X-Frame-Options` when a page sends both.
  const ancestors = frameAncestorsDirective(headers.contentSecurityPolicy);
  if (ancestors !== null) {
    return ancestorAllows(ancestors, ours ?? ourOrigin) ? 'allow' : 'refuse';
  }

  const xfo = (headers.xFrameOptions ?? '').trim().toLowerCase();
  if (xfo === 'deny') return 'refuse';
  if (xfo === 'sameorigin') return target === ours ? 'allow' : 'refuse';
  // `allow-from` is ignored by modern browsers; anything else is no policy at all.
  return 'allow';
}
