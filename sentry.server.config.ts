import * as Sentry from "@sentry/nextjs";

// Called from instrumentation.ts ONLY when SENTRY_DSN is set. If this file is
// imported directly without that gate, the SDK still initialises but Sentry
// will fail open on the transport with no DSN.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  // Keep traces off by default — errors only until we actually want APM.
  tracesSampleRate: 0,
  // Don't send PII by default; enable explicitly per event if needed.
  sendDefaultPii: false,
  ignoreErrors: [
    // Next.js noise: redirects + not-found throw internally for routing.
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
  ],
});
