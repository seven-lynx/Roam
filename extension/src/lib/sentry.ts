// sentry.ts — the extension's error-reporting façade.
//
// Nothing is sent unless `initSentry()` has returned true: it needs the DSN, a
// live extension context, and the user's consent (`consent.ts` resolves that; on
// Firefox it is also the optional `technicalAndInteraction` permission). The 14
// call sites keep using `Sentry.captureException(...)` and
// `Sentry.captureMessage(...)` unchanged.
//
// Two rules this file exists to hold:
//   - Named imports only. `import * as Sentry` keeps every export, including the
//     dynamic CDN loader, which an AMO reviewer reads as remote code.
//   - `defaultIntegrations: false`. `integrations: []` does not remove the
//     defaults, so the previous module shipped `httpContext` (the page URL) and
//     breadcrumbs on Chrome.

import {
  captureException as sdkCaptureException,
  captureMessage as sdkCaptureMessage,
  close as sdkClose,
  dedupeIntegration,
  eventFiltersIntegration,
  functionToStringIntegration,
  init as sdkInit,
} from '@sentry/browser';
import type { CaptureContext, ErrorEvent, EventHint } from '@sentry/browser';
import { isExtensionContext } from './extension-context';
import { PLATFORM, SENTRY_DSN, SENTRY_ENVIRONMENT, SENTRY_RELEASE } from './sentry-config';

/** True between a successful `initSentry()` and the next `disableErrorReporting()`. */
let enabled = false;

/** Keys in `extra` and in breadcrumb data that can carry a URL, an identity or a credential. */
const SENSITIVE_KEY = /url|href|token|email|password|session|cookie|key/i;

/** Breadcrumb data keys page-navigation instrumentation adds for a move. */
const BREADCRUMB_URL_KEYS = new Set(['url', 'from', 'to']);

/**
 * Strips everything that could identify a user or a page (D4). Runs as
 * `beforeSend`, so it is the last line of defence when a call site passes
 * something it should not — and the first if a default integration is ever
 * re-enabled by mistake.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.request;

  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (SENSITIVE_KEY.test(key)) delete event.extra[key];
    }
  }

  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      if (!breadcrumb.data) continue;
      for (const key of Object.keys(breadcrumb.data)) {
        if (BREADCRUMB_URL_KEYS.has(key.toLowerCase()) || SENSITIVE_KEY.test(key)) {
          delete breadcrumb.data[key];
        }
      }
    }
  }

  return event;
}

/**
 * Turn reporting on, if it is allowed to be on. Idempotent: once the client
 * exists a second call is a no-op and still reports true.
 *
 * `granted` is the consent decision, resolved by the caller (E3 passes
 * `isErrorReportingGranted()`) because reading storage here would make the façade
 * depend on a runtime the service worker does not always have.
 */
export function initSentry(granted: boolean): boolean {
  if (enabled) return true;
  if (!granted || !SENTRY_DSN || !isExtensionContext()) return false;

  sdkInit({
    dsn: SENTRY_DSN,
    release: SENTRY_RELEASE,
    environment: SENTRY_ENVIRONMENT,

    // Also Sentry's `dist` tag: a Firefox event is distinguishable from a Chrome
    // one without trusting a user agent a service worker cannot read anyway.
    dist: PLATFORM,

    // No tracing. A transaction carries the URL that started it, and the free
    // tier is not worth that.
    tracesSampleRate: 0,

    // D3 — these three integrations and none of the defaults.
    defaultIntegrations: false,
    integrations: [dedupeIntegration(), functionToStringIntegration(), eventFiltersIntegration()],

    sendDefaultPii: false,
    debug: false,
    beforeSend: (event: ErrorEvent, _hint: EventHint) => scrubEvent(event),

    // Tag every event with the extension platform.
    initialScope: { tags: { platform: `extension-${PLATFORM}` } },
  });

  enabled = true;
  return true;
}

/**
 * Stop reporting without touching the stored preference. The user-facing path
 * (revoke the permission, then stop) lives in `consent.ts`; the entry points call
 * both.
 */
export function disableErrorReporting(): void {
  enabled = false;
  if (isExtensionContext()) void sdkClose();
}

/**
 * The shape every call site already uses. Both methods are inert until
 * `initSentry()` has returned true, so merely importing this module sends
 * nothing — which is what lets the Firefox build carry it before the consent
 * card (E4) exists.
 */
export const Sentry = {
  captureException(error: unknown, context?: CaptureContext): void {
    if (!enabled) return;
    sdkCaptureException(error, context);
  },

  captureMessage(message: string, context?: CaptureContext): void {
    if (!enabled) return;
    sdkCaptureMessage(message, context);
  },
};
