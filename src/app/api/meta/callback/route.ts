import { NextRequest, NextResponse } from "next/server";
import { validateMetaOAuthState } from "@/modules/meta/actions";
import { completeMetaOAuthCallback } from "@/modules/meta/oauth-callback";
import type { DiscoverySummary } from "@/modules/meta/discovery";

function redirectToPages(
  status: "success" | "error",
  options?: { message?: string; summary?: DiscoverySummary }
) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL("/pages", base);
  url.searchParams.set("meta", status);
  if (options?.message) {
    url.searchParams.set("reason", options.message);
  }
  if (options?.summary) {
    url.searchParams.set("discovered", String(options.summary.discovered));
    url.searchParams.set("preserved", String(options.summary.preserved));
    url.searchParams.set("added", String(options.summary.newlyAdded));
    url.searchParams.set("revoked", String(options.summary.revoked));
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    if (!code || !state) {
      return redirectToPages("error", { message: "missing_oauth_parameters" });
    }

    const organizationId = await validateMetaOAuthState(state);
    const summary = await completeMetaOAuthCallback({ code, organizationId });

    return redirectToPages("success", { summary });
  } catch (error) {
    console.error("[meta/callback] OAuth callback failed:", error instanceof Error ? error.message : error);
    return redirectToPages("error", { message: "meta_callback_failed" });
  }
}
