import * as Sentry from "@sentry/nextjs";

// Edge runtime (middleware, edge routes). Gated by SENTRY_DSN via
// instrumentation.ts — this file is only loaded when the DSN is set.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
