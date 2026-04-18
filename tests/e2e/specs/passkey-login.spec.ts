import { expect, test } from "@playwright/test";
import {
  countAuthEvents,
  createTestUser,
  deleteTestUser,
  loginTestUser,
  type TestUser
} from "../fixtures/test-user";
import { installVirtualAuthenticator, type VirtualAuthenticator } from "../fixtures/webauthn";

test.describe.configure({ mode: "serial" });

test.describe("Passkey login", () => {
  let user: TestUser;
  let authenticator: VirtualAuthenticator | null = null;

  test.beforeAll(async () => {
    user = await createTestUser();
  });

  test.afterAll(async () => {
    if (user) {
      await deleteTestUser(user.userId);
    }
  });

  test.beforeEach(async ({ context, page }) => {
    authenticator = await installVirtualAuthenticator(context, page);
  });

  test.afterEach(async () => {
    if (authenticator) {
      await authenticator.cleanup();
      authenticator = null;
    }
  });

  test("logs in with a registered passkey", async ({ page, context }) => {
    // Step 1 — register a passkey (same browser context → authenticator holds
    // the credential for step 2).
    await loginTestUser(context, page, user);
    await page.goto("/settings/security");
    await page.getByRole("button", { name: "Passkey нэмэх" }).click();
    await expect(page.getByText("Passkey амжилттай нэмэгдлээ.")).toBeVisible({
      timeout: 15_000
    });

    // Step 2 — clear the Supabase session cookies. Keep the authenticator
    // credentials.
    const cookies = await context.cookies();
    await context.clearCookies({ name: /^sb-/ });
    expect(cookies.some((c) => c.name.startsWith("sb-"))).toBe(true);

    // Step 3 — exercise the /login → passkey path.
    await page.goto("/login");
    await page.getByLabel(/үйлчилгээний нөхцөл/i).check();
    await page.locator("#email").fill(user.email);
    await page.getByRole("button", { name: "Passkey-ээр нэвтрэх" }).click();

    // Use the authoritative DB signal instead of waiting on client-side
    // navigation: the passkey_login_success event is logged inside
    // /api/auth/passkey/login/finish the moment verifyOtp succeeds, which
    // is the real "user is authenticated" moment. Polling this avoids
    // flakiness from client router race conditions (cookies landing after
    // router.push, middleware redirect chains to /setup-organization, etc).
    await expect
      .poll(() => countAuthEvents(user.userId, "passkey_login_success"), {
        timeout: 30_000,
        intervals: [500, 1_000, 2_000]
      })
      .toBeGreaterThanOrEqual(1);
  });
});
