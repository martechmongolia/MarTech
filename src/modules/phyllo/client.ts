/**
 * Phyllo API HTTP client.
 * Staging base URL: https://api.staging.insightiq.ai
 * Auth: Basic base64(CLIENT_ID:CLIENT_SECRET)
 */

function getPhylloEnv() {
  const clientId = process.env.PHYLLO_CLIENT_ID;
  const clientSecret = process.env.PHYLLO_CLIENT_SECRET;
  const baseUrl = process.env.PHYLLO_BASE_URL ?? "https://api.staging.insightiq.ai";

  if (!clientId || !clientSecret) {
    throw new Error("Missing required environment variables: PHYLLO_CLIENT_ID, PHYLLO_CLIENT_SECRET");
  }

  return { clientId, clientSecret, baseUrl };
}

function buildBasicAuthHeader(clientId: string, clientSecret: string): string {
  const token = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${token}`;
}

export class PhylloApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: unknown
  ) {
    super(`Phyllo API error ${status} ${statusText}`);
    this.name = "PhylloApiError";
  }
}

export async function fetchPhyllo<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { clientId, clientSecret, baseUrl } = getPhylloEnv();

  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: buildBasicAuthHeader(clientId, clientSecret),
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string> | undefined)
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new PhylloApiError(response.status, response.statusText, body);
  }

  return response.json() as Promise<T>;
}
