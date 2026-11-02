// POST /api/check-urls  { urls: string[] }
// Server-side HEAD probe for the web prefetch buffer. The browser can't HEAD
// arbitrary third-party origins (CORS), so the reachability check that promotes
// warm → hot URLs runs here instead, mirroring Android's tri-state semantics:
//
//   reachable  — HTTP status < 400
//   blocked    — 405/403/501 (HEAD unsupported, page almost certainly alive)
//   unreachable — anything else (timeout, DNS, 404, other 5xx)
//
// Returns { results: [{ url, status }] }.

export const runtime = 'nodejs';

type Status = 'reachable' | 'blocked' | 'unreachable';

const USER_AGENT = 'Mozilla/5.0 (compatible; RoamLinkChecker/1.0)';
const TIMEOUT_MS = 2000;

async function probe(url: string): Promise<Status> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.status < 400) return 'reachable';
    if (res.status === 405 || res.status === 403 || res.status === 501) return 'blocked';
    return 'unreachable';
  } catch {
    return 'unreachable';
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

  const results = await Promise.all(safe.map(async (url) => ({ url, status: await probe(url) })));

  return Response.json({ results });
}
