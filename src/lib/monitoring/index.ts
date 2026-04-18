/**
 * App-level error reporting + breadcrumbs. Thin wrapper around @sentry/nextjs
 * so we can swap providers later (Axiom, self-hosted GlitchTip, OTEL) without
 * touching call-sites.
 *
 * Fail-open: if Sentry isn't initialized (no DSN), these calls become no-ops
 * — they never throw and never break the caller's flow.
 */
import * as Sentry from "@sentry/nextjs";

export interface ErrorContext {
  /** Logical module: "facebook-ai", "auth", "billing", etc. */
  module?: string;
  /** Concrete operation inside the module: "processComment", "approveReply". */
  op?: string;
  /** Extra searchable tags — keep string|number|boolean values only. */
  tags?: Record<string, string | number | boolean>;
  /** Free-form context dumped into the "Additional Data" section. */
  extra?: Record<string, unknown>;
  /** Org the action belongs to, used to scope events. */
  orgId?: string;
  /** User who triggered the action (omit for webhook/system paths). */
  userId?: string;
}

function applyContext(scope: Sentry.Scope, ctx: ErrorContext | undefined): void {
  if (!ctx) return;
  if (ctx.module) scope.setTag("module", ctx.module);
  if (ctx.op) scope.setTag("op", ctx.op);
  if (ctx.orgId) scope.setTag("org_id", ctx.orgId);
  if (ctx.userId) scope.setUser({ id: ctx.userId });
  if (ctx.tags) {
    for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, v);
  }
  if (ctx.extra) {
    for (const [k, v] of Object.entries(ctx.extra)) scope.setExtra(k, v);
  }
}

/**
 * Report an error to Sentry with optional module/op/org/user tags. Always
 * returns the Sentry event ID (empty string when DSN is absent) so callers
 * can surface it in API responses for support tickets.
 */
export function captureError(err: unknown, ctx?: ErrorContext): string {
  try {
    let eventId = "";
    Sentry.withScope((scope) => {
      applyContext(scope, ctx);
      eventId = Sentry.captureException(err);
    });
    return eventId;
  } catch (innerErr) {
    console.warn(
      "[monitoring] captureError failed, swallowing:",
      innerErr instanceof Error ? innerErr.message : innerErr,
    );
    return "";
  }
}

/** Same but for non-exception warnings / info-level signals. */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "warning",
  ctx?: ErrorContext,
): string {
  try {
    let eventId = "";
    Sentry.withScope((scope) => {
      applyContext(scope, ctx);
      scope.setLevel(level);
      eventId = Sentry.captureMessage(message);
    });
    return eventId;
  } catch {
    return "";
  }
}

/** Leave a breadcrumb so the next captured error includes this trail. */
export function breadcrumb(params: {
  category: string;
  message: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, unknown>;
}): void {
  try {
    Sentry.addBreadcrumb({
      category: params.category,
      message: params.message,
      level: params.level ?? "info",
      data: params.data,
    });
  } catch {
    // Never throw from a breadcrumb.
  }
}
