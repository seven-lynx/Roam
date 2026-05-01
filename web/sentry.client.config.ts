// sentry.client.config.ts — Sentry initialisation for the browser (client components).
// This file is loaded automatically by the Next.js Sentry integration.
// Set NEXT_PUBLIC_SENTRY_DSN in your .env / Vercel environment variables.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Capture 10 % of sessions for performance monitoring in production.
    // Increase to 1.0 (100 %) while debugging performance issues.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Record replays for 5 % of sessions, 100 % for sessions with errors.
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration(),
    ],

    // Suppress noisy console noise in development.
    debug: false,
  });
}
