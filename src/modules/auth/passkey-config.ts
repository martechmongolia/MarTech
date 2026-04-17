/** WebAuthn relying-party config — shared between server + challenge routes. */
export function getPasskeyRpConfig(): { rpName: string; rpID: string; origin: string } {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let rpID = "localhost";
  try {
    rpID = new URL(origin).hostname;
  } catch {
    rpID = "localhost";
  }
  return {
    rpName: "MarTech",
    rpID,
    origin
  };
}

export const CHALLENGE_TTL_SECONDS = 300;
