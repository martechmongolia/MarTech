import type { BrowserContext, Page } from "@playwright/test";

export type VirtualAuthenticator = {
  authenticatorId: string;
  cleanup: () => Promise<void>;
};

/**
 * Attach a virtual WebAuthn authenticator to the given browser context via
 * the Chrome DevTools Protocol. `automaticPresenceSimulation` means
 * user-presence and user-verification prompts are auto-approved, which lets
 * us exercise the SimpleWebAuthn browser API end-to-end without any real
 * biometric hardware.
 */
export async function installVirtualAuthenticator(
  context: BrowserContext,
  page: Page
): Promise<VirtualAuthenticator> {
  const client = await context.newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  });

  return {
    authenticatorId,
    async cleanup() {
      try {
        await client.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
      } catch {
        // ignore — context may already be closing
      }
      try {
        await client.send("WebAuthn.disable");
      } catch {
        // ignore
      }
      await client.detach();
    }
  };
}
