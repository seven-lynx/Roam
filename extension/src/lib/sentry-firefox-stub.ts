// sentry-firefox-stub.ts — No-op Sentry replacement for Firefox builds.
//
// Mozilla's add-on review flags `innerHTML` usage in third-party code (Sentry's
// rrweb DOM serialisation and ContextLines integration).  This stub replaces the
// full @sentry/browser import at build time so the bundler tree-shakes out every
// line of Sentry SDK code, eliminating the warnings.
//
// The API surface matches exactly what popup.ts and background.ts use.
// Chrome builds continue to use the real sentry.ts (and report errors to Sentry).

function noop(): void { /* Firefox — Sentry disabled */ }

export const Sentry = {
  init: noop,
  captureException: noop,
  captureMessage: noop,
} as const;