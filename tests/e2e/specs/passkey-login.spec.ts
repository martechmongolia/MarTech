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
    await loginTestUser(page, user.email);
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

    await page.waitForURL("**/dashboard", { timeout: 30_000 });

    const successEvents = await countAuthEvents(user.userId, "passkey_login_success");
    expect(successEvents).toBeGreaterThanOrEqual(1);
  });
});
