/**
 * Subscription billing lifecycle — keep `bootstrap_pending_billing` distinct from billing-activated states.
 *
 * - **Bootstrap / unpaid**: org is provisioned on a plan tier for limits, but billing has not completed
 *   (no verified payment path has moved the row to `active`).
 * - **Billing-activated**: `active` or `trialing` — post-payment (or explicit trial) states; not the same as bootstrap.
 *
 * Feature quotas may still use the **assigned** `plan_id` during bootstrap (starter limits); that is
 * “which tier is reserved,” not “billing has cleared.”
 */
import type { Database } from "@/types/database";

export type SubscriptionStatus = Database["public"]["Tables"]["subscriptions"]["Row"]["status"];

/** Explicit pre-payment state after org creation; not equivalent to paid-active. */
export function isBootstrapPendingBilling(status: SubscriptionStatus): boolean {
  return status === "bootstrap_pending_billing";
}

/** Subscription has completed the billing activation path (paid or trialing). */
export function isBillingActivatedStatus(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

/** Statuses that may use plan-based quotas from the assigned `plan_id` (includes unpaid bootstrap). */
export function statusAllowsPlanFeatureAccess(status: SubscriptionStatus): boolean {
  return isBootstrapPendingBilling(status) || isBillingActivatedStatus(status);
}

/** Trial явагдаж байгаа эсэх шалгах. */
export function isTrialing(status: SubscriptionStatus): boolean {
  return status === "trialing";
}

/** Trial хугацаа дууссан эсэх шалгах. */
export function isTrialExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) < new Date();
}
