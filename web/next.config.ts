import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Sentry org + project (set in environment or .env.sentry-build-plugin)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps to Sentry so stack traces show original code.
  // Requires SENTRY_AUTH_TOKEN env var at build time.
  silent: true, // suppress Sentry CLI output unless there's an error

  // Disable source map upload if auth token is absent (local / CI without secret).
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Tree-shake Sentry logger statements from production bundles.
  disableLogger: true,
});
