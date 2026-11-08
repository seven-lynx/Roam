// sentry.ts — Sentry initialisation for the Roam browser extension.
//
// The DSN is injected at build time by esbuild (from the root .env).
// If SENTRY_DSN is not set, Sentry is disabled with no error.
//
// Usage (background.ts and popup.ts):
//   import './sentry';   ← must be the very first import

import * as Sentry from '@sentry/browser';
import { isExtensionContext } from './extension-context';

declare const __SENTRY_DSN__: string;
declare const __SENTRY_RELEASE__: string;

const dsn = typeof __SENTRY_DSN__ !== 'undefined' ? __SENTRY_DSN__ : '';

// Reporting is gated on the extension context as well as the DSN. The DSN is baked
// into every non-watch build, so without this check a dist/ page opened from disk
// files production issues tagged environment=production and platform=extension-chrome
// that no installed extension can reproduce (issue #75).
if (dsn && isExtensionContext()) {
  Sentry.init({
    dsn,
    release: typeof __SENTRY_RELEASE__ !== 'undefined' ? __SENTRY_RELEASE__ : undefined,
    environment: typeof __ENVIRONMENT__ !== 'undefined' ? __ENVIRONMENT__ : 'production',

    // Low sample rate — extensions can be chatty.
    tracesSampleRate: 0.05,

    // Disable DOM integrations in the service worker context (no window/document).
    // They are safe to include in popup.ts but harmless to omit everywhere.
    integrations: [],

    debug: false,

    // Tag every event with the extension platform.
    initialScope: {
      tags: {
        platform: navigator.userAgent.includes('Firefox')
          ? 'extension-firefox'
          : 'extension-chrome',
      },
    },
  });
}

// Re-export for use in error boundaries if needed.
export { Sentry };