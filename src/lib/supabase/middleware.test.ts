import { describe, expect, it } from "vitest";
import { isConsentExempt, isProtectedPath, isPublicAuthPath } from "./middleware";

describe("isProtectedPath", () => {
  it.each([
    "/dashboard",
    "/dashboard/settings",
    "/setup-organization",
    "/billing",
    "/billing/checkout",
    "/settings",
    "/pages",
    "/pages/123",
    "/internal",
    "/internal/ops",
    "/admin",
    "/admin/organizations",
    "/admin/billing",
    "/admin/settings"
  ])("returns true for %s", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/login",
    "/auth/callback",
    "/pricing",
    "/privacy",
    "/terms",
    "/data-deletion",
    "/api/webhooks/qpay"
  ])("returns false for %s", (path) => {
    expect(isProtectedPath(path)).toBe(false);
  });
});

describe("isPublicAuthPath", () => {
  it.each(["/login", "/login?next=/dashboard", "/auth/callback", "/auth/callback?code=abc"])(
    "returns true for %s",
    (path) => {
      expect(isPublicAuthPath(path)).toBe(true);
    }
  );

  it.each(["/", "/dashboard", "/pricing", "/api/meta/callback"])("returns false for %s", (path) => {
    expect(isPublicAuthPath(path)).toBe(false);
  });
});

describe("isConsentExempt", () => {
  it.each([
    "/auth/consent",
    "/auth/consent?next=/dashboard",
    "/auth/callback",
    "/auth/mfa",
    "/auth/google",
    "/auth/sso",
    "/api/auth/passkey/login/start",
    "/api/auth/passkey/register/finish",
    "/login",
    "/terms",
    "/privacy",
    "/data-deletion",
    "/pricing"
  ])("returns true for %s", (path) => {
    expect(isConsentExempt(path)).toBe(true);
  });

  it.each([
    "/dashboard",
    "/settings",
    "/settings/security",
    "/billing",
    "/admin",
    "/pages"
  ])("returns false for %s", (path) => {
    expect(isConsentExempt(path)).toBe(false);
  });
});
