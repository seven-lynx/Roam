// POST /api/check-urls  { urls: string[] }
// Server-side probe for the web prefetch buffer and the in-OS browser. The
// browser can't inspect arbitrary third-party origins (CORS), so this runs here:
//
//   status   — reachable (<400), blocked (405/403/501: the page is alive, the verb
//              is not), or unreachable (timeout, DNS, 404, other 5xx)
//   framable — false when the page refuses to be framed (`X-Frame-Options` or CSP
//              `frame-ancestors`), true when it may be, null when we could not tell
//
// A single GET answers both questions. The body is cancelled the moment the
// headers are in, so a 40 MB article costs a round trip, not a download.
//
// Returns { results: [{ url, status, framable }] }.

import { parseFramePolicy } from '@/lib/framing';

export const runtime = 'nodejs';

type Status = 'reachable' | 'blocked' | 'unreachable';

const USER_AGENT = 'Mozilla/5.0 (compatible; RoamLinkChecker/1.0)';
const TIMEOUT_MS = 3000;

/** The in-OS browser runs on this origin; a page must allow it as an ancestor. */
const OUR_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://roamtheweb.app';

interface Probe {
  status: Status;
  framable: boolean | null;
}

async function probe(url: string): Promise<Probe> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*' },
    });

    // The verdict belongs to the page that actually answered, not the URL we asked for.
    const policy = parseFramePolicy(
      {
        xFrameOptions: res.headers.get('x-frame-options'),
        contentSecurityPolicy: res.headers.get('content-security-policy'),
      },
      res.url || url,
      OUR_ORIGIN,
    );
    try {
      await res.body?.cancel();
    } catch {
      /* body already drained */
    }

    const status: Status =
      res.status < 400
        ? 'reachable'
        : res.status === 405 || res.status === 403 || res.status === 501
          ? 'blocked'
          : 'unreachable';

    // A challenge or error page (403 bot wall, 503 maintenance) carries that page's
    // headers, not the article's — so only a reachable response yields a verdict.
    // Anything else stays unknown, which leaves the browser's behaviour unchanged.
    const framable = status === 'reachable' && policy !== 'unknown' ? policy === 'allow' : null;
    return { status, framable };
  } catch {
    return { status: 'unreachable', framable: null };
  }
}

export async function POST(req: Request) {
  let urls: unknown = [];
  try {
    const body = (await req.json()) as { urls?: unknown };
    urls = body?.urls;
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(urls)) {
    return Response.json({ error: 'urls must be an array' }, { status: 400 });
  }

  // Guard against abuse: cap the batch and only accept http(s) URLs.
  const safe = urls
    .filter((u): u is string => typeof u === 'string')
    .slice(0, 20)
    .filter((u) => /^https?:\/\//i.test(u));

  const results = await Promise.all(
    safe.map(async (url) => {
      const verdict = await probe(url);
      return { url, status: verdict.status, framable: verdict.framable };
    }),
  );

  return Response.json({ results });
}
