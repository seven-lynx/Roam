// sentry-config.ts — the build-time constants the Sentry façade needs.
//
// Both pipelines substitute these identifiers before the module runs: esbuild's
// `define` for a shipped build (build.mjs), Vitest's `define` for the suite
// (vitest.config.ts). The `typeof` guards therefore only matter for `tsc` and for
// a module loaded outside either pipeline — `define` collapses them to the literal
// at build time, which is also why a test cannot override one with `vi.stubGlobal`.
// Keeping all four here gives sentry.test.ts a single module to mock instead.

declare const __SENTRY_DSN__: string;
declare const __SENTRY_RELEASE__: string;
declare const __ENVIRONMENT__: string;
declare const __PLATFORM__: string;

/** Public ingest DSN. Empty in a build made without SENTRY_DSN, which disables reporting. */
export const SENTRY_DSN = typeof __SENTRY_DSN__ !== 'undefined' ? __SENTRY_DSN__ : '';

/** Release the source maps are uploaded under — the extension version. */
export const SENTRY_RELEASE =
  typeof __SENTRY_RELEASE__ !== 'undefined' ? __SENTRY_RELEASE__ : 'unknown';

/** Sentry environment. `production` unless the build says otherwise. */
export const SENTRY_ENVIRONMENT =
  typeof __ENVIRONMENT__ !== 'undefined' ? __ENVIRONMENT__ : 'production';

/** Build target, also used as Sentry's `dist` tag (D8). */
export const PLATFORM = typeof __PLATFORM__ !== 'undefined' ? __PLATFORM__ : 'chrome';
