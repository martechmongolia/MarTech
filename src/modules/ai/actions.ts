"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { enqueueManualRegenerateAnalysisJob } from "@/modules/ai/enqueue-analysis";
import { executeAnalysisJob } from "@/modules/ai/execute-analysis-job";
import { checkOrganizationFeatureLimit } from "@/modules/subscriptions/entitlements";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AiAnalysisActionState = {
  error?: string;
  message?: string;
};

/**
 * Regenerate AI analysis from current DB metrics (no Meta sync). Uses monthly AI quota.
 */
export async function regenerateAnalysisAction(
  _prev: AiAnalysisActionState,
  formData: FormData
): Promise<AiAnalysisActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const entitlement = await checkOrganizationFeatureLimit(user.id, "generate_ai_report");
  if (!entitlement.allowed) {
    return {
      error: `Monthly AI report limit reached (${entitlement.used}/${entitlement.limit}).`
    };
  }

  const internalPageId = formData.get("internalPageId");
  if (typeof internalPageId !== "string") {
    return { error: "Invalid request." };
  }

  const org = await getCurrentUserOrganization(user.id);
  if (!org) {
    return { error: "Organization not found." };
  }

  const organizationId = org.id;

  const supabase = await getSupabaseServerClient();
  const { data: page, error: pageErr } = await supabase
    .from("meta_pages")
    .select("id,is_selected,status")
    .eq("id", internalPageId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (pageErr || !page || !page.is_selected || page.status !== "active") {
    return { error: "Page not found or not selected." };
  }

  try {
    const jobId = await enqueueManualRegenerateAnalysisJob({
      organizationId,
      internalPageId
    });
    const result = await executeAnalysisJob(jobId);
    console.log("[ai] executeAnalysisJob result:", result);
    if (!result.ok) {
      console.error("[ai] Analysis job returned error:", result.error);
      return { error: result.error ?? "Analysis failed. Please try again." };
    }
    revalidatePath("/dashboard");
    return { message: "Analysis regenerated from saved metrics." };
  } catch (e) {
    console.error("[ai] regenerateAnalysisAction failed:", e instanceof Error ? e.message : e);
    return { error: "Analysis failed. Please try again." };
  }
}
