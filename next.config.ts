import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Browsers request /favicon.ico by default; serve the app icon to avoid noisy 404s.
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
  async redirects() {
    return [
      // Legacy overview URL only — sub-routes stay under /internal/ops/* until migrated (Phase C+).
      { source: "/internal/ops", destination: "/admin", permanent: false }
    ];
  }
};

// Sentry build-time options. Source-map upload requires SENTRY_AUTH_TOKEN +
// org/project — absent locally, withSentryConfig silently skips the upload.
// If SENTRY_DSN is unset at runtime the SDK is a no-op (see instrumentation.ts).
// (We use Turbopack, so webpack-only options are omitted.)
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Widen server stack traces into readable files in production.
  widenClientFileUpload: true,
  // Tunnels client requests through /monitoring to bypass ad blockers.
  tunnelRoute: "/monitoring",
  // Hide source maps from the deployed client bundle.
  hideSourceMaps: true,
};

export default withSentryConfig(nextConfig, sentryBuildOptions);
