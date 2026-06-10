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
  error: Error | string,
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
            type: typeof error === 'string' ? 'Error' : error.name,
            value: typeof error === 'string' ? error : error.message,
          },
        ],
      },
      extra,
    };

    const envelope = `${JSON.stringify({ event_id: eventId })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(envelopeBody)}\n`;

    try {
      await fetch(
        `https://${parsed.host}/api/${parsed.projectId}/envelope/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-sentry-envelope' },
          body: envelope,
        },
      );
    } catch {
      // Sentry delivery failure must not cascade into the function failing
    }
  };
}