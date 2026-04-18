import { expect, test } from "@playwright/test";
import {
  countAuthEvents,
  countPasskeys,
  createTestUser,
  deleteTestUser,
  loginTestUser,
  type TestUser
} from "../fixtures/test-user";
import { installVirtualAuthenticator, type VirtualAuthenticator } from "../fixtures/webauthn";

test.describe.configure({ mode: "serial" });

test.describe("Passkey enrollment", () => {
  let user: TestUser;
  let authenticator: VirtualAuthenticator | null = null;

  test.beforeEach(async ({ context, page }) => {
    authenticator = await installVirtualAuthenticator(context, page);
    user = await createTestUser();
    await loginTestUser(context, page, user);
  });

  test.afterEach(async () => {
    if (authenticator) {
      await authenticator.cleanup();
      authenticator = null;
    }
    if (user) {
      await deleteTestUser(user.userId);
    }
  });

  test("registers a new passkey from /settings/security", async ({ page }) => {
    await page.goto("/settings/security");

    const beforeCount = await countPasskeys(user.userId);
    expect(beforeCount).toBe(0);

    await page.getByRole("button", { name: "Passkey нэмэх" }).click();

    await expect(page.getByText("Passkey амжилттай нэмэгдлээ.")).toBeVisible({
      timeout: 15_000
    });

    const afterCount = await countPasskeys(user.userId);
    expect(afterCount).toBe(1);

    const registeredEvents = await countAuthEvents(user.userId, "passkey_registered");
    expect(registeredEvents).toBeGreaterThanOrEqual(1);
  });
});
