// Next.js instrumentation hook. Runs once per server-side runtime boot.
// The Sentry.init() call inside each config file is a no-op when SENTRY_DSN
// is not set, so including the configs unconditionally is safe — the bundler
// sees them as static deps and Turbopack stays happy.

export function register(): void {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Static require keeps Turbopack's dependency graph intact. Dynamic
    // import() from instrumentation.ts fails to resolve under Turbopack.
    require("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    require("./sentry.edge.config");
  }
}

type NextRequestInfo = {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
};

type NextRouteContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
};

export async function onRequestError(
  err: unknown,
  request: NextRequestInfo,
  context: NextRouteContext,
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
}
