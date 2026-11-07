// Shared Sentry reporting for Supabase Edge Functions.
// Posts to Sentry's envelope API (no SDK needed in Deno).
//
// Usage:
//   import { reportToSentry, initSentry } from '../_shared/sentry.ts';
//   const report = initSentry();
//   // ... in catch blocks:
//   report(err, 'error', { url: someUrl });

const SENTRY_DSN = Deno.env.get('SENTRY_DSN');
const SENTRY_RELEASE = Deno.env.get('SENTRY_RELEASE') || 'supabase';

function parseSentryDsn(dsn: string) {
  const match = dsn.match(
    /^https?:\/\/([a-f0-9]+)@([^/]+)\/(\d+)$/,
  );
  if (!match) return null;
  return { key: match[1], host: match[2], projectId: match[3] };
}

export type ReportFn = (
  error: unknown,
  level?: 'error' | 'warning',
  extra?: Record<string, unknown>,
) => Promise<void>;

/**
 * Initialise Sentry reporting for this function.
 * Returns a `report` function that silently no-ops if SENTRY_DSN is not set.
 * Call once at module level.
 */
export function initSentry(releaseName?: string): ReportFn {
  const dsn = SENTRY_DSN;
  const release = releaseName || SENTRY_RELEASE;
  const environment = Deno.env.get('SUPABASE_ENV') ?? 'production';

  return async (error, level = 'error', extra) => {
    if (!dsn) return;
    const parsed = parseSentryDsn(dsn);
    if (!parsed) return;

    // Normalise error from catch blocks (unknown) to a string message.
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error ?? 'Unknown error');
    const errorType = error instanceof Error
      ? error.name
      : typeof error === 'string'
        ? 'Error'
        : 'UnknownError';

    const eventId = crypto.randomUUID();
    const envelopeBody = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      level,
      platform: 'javascript',
      release,
      environment,
      exception: {
        values: [
          {
            type: errorType,
            value: errorMessage,
          },
        ],
      },
      extra,
    };

    const envelope = `${JSON.stringify({ event_id: eventId })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(envelopeBody)}\n`;

    try {
      const response = await fetch(
        `https://${parsed.host}/api/${parsed.projectId}/envelope/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-sentry-envelope',
            // Sentry rejects an envelope post that carries no auth header (401), so the
            // DSN's public key has to travel with the request.
            'X-Sentry-Auth':
              `Sentry sentry_version=7, sentry_client=roam-edge/1.0, sentry_key=${parsed.key}`,
          },
          body: envelope,
        },
      );
      // Delivery failures must never cascade into the function failing, but a silent
      // 401 here is exactly how reporting can stay dark without anyone noticing.
      if (!response.ok) {
        console.error(`[sentry] envelope rejected: ${response.status}`);
      }
    } catch {
      // Network failure: same rule as above — never break the function.
    }
  };
}