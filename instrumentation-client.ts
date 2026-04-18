import * as Sentry from "@sentry/nextjs";

// Client-side Sentry init. The NEXT_PUBLIC_SENTRY_DSN env is exposed to the
// bundle at build time; without it the SDK becomes a no-op.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    ignoreErrors: [
      // Noisy browser internals not worth alerting on.
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
