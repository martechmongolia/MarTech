"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { buildMetaOAuthUrl, revokeMetaUserPermissions } from "@/lib/meta/client";
import { decryptSecret } from "@/lib/meta/crypto";
import { getMetaEnv } from "@/lib/env/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyMetaPageSelection } from "@/modules/meta/selection";
import { onMetaPageSelectionChanged } from "@/modules/jobs/meta-sync-placeholder";

const META_OAUTH_STATE_COOKIE = "meta_oauth_state";

function createStateToken() {
  return randomBytes(24).toString("hex");
}

export async function createMetaOAuthUrl(organizationId: string): Promise<string> {
  const state = createStateToken();
  const cookieStore = await cookies();
  cookieStore.set(
    META_OAUTH_STATE_COOKIE,
    JSON.stringify({
      state,
      organizationId,
      issuedAt: Date.now()
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600
    }
  );

  return buildMetaOAuthUrl(state);
}

export async function validateMetaOAuthState(inputState: string): Promise<string> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(META_OAUTH_STATE_COOKIE);

  if (!raw) {
    throw new Error("Missing OAuth state");
  }

  const parsed = JSON.parse(raw) as { state: string; organizationId: string; issuedAt: number };
  if (parsed.state !== inputState) {
    throw new Error("Invalid OAuth state");
  }

  const ageMs = Date.now() - parsed.issuedAt;
  if (ageMs > 10 * 60 * 1000) {
    throw new Error("OAuth state expired");
  }

  return parsed.organizationId;
}

export async function setMetaPageSelection(params: {
  organizationId: string;
  metaPageId: string;
  selected: boolean;
}) {
  await applyMetaPageSelection({
    organizationId: params.organizationId,
    metaPageRowId: params.metaPageId,
    selected: params.selected
  });

  await onMetaPageSelectionChanged({
    organizationId: params.organizationId,
    metaPageRowId: params.metaPageId,
    selected: params.selected
  });

  revalidatePath("/pages");
  revalidatePath("/dashboard");
}

export type MetaPageSelectionState = {
  error?: string;
};

export async function setMetaPageSelectionAction(
  _prev: MetaPageSelectionState,
  formData: FormData
): Promise<MetaPageSelectionState> {
  const organizationId = formData.get("organizationId");
  const metaPageId = formData.get("metaPageId");
  const selected = formData.get("selected");

  if (typeof organizationId !== "string" || typeof metaPageId !== "string" || typeof selected !== "string") {
    return { error: "Invalid selection request." };
  }

  try {
    await setMetaPageSelection({
      organizationId,
      metaPageId,
      selected: selected === "true"
    });
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update page selection." };
  }
}

export type MetaDisconnectState = {
  error?: string;
  ok?: boolean;
};

/**
 * Disconnect the org's Meta connection:
 *   1. Best-effort: revoke the grant on Meta via DELETE /me/permissions.
 *   2. Soft-revoke all of the org's meta_pages (status='revoked', token cleared).
 *   3. Soft-revoke the meta_connections row and clear encrypted tokens.
 *
 * Order matters: we revoke on Meta FIRST (while the token is still decryptable),
 * then clear local state. If the Meta revoke fails, proceed anyway — the user's
 * intent is to cut ties, and local state must reflect that regardless.
 */
export async function disconnectMetaAction(
  _prev: MetaDisconnectState,
  formData: FormData
): Promise<MetaDisconnectState> {
  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string" || organizationId.length === 0) {
    return { error: "Байгууллагын ID дутуу байна." };
  }

  const admin = getSupabaseAdminClient();

  try {
    const { data: connection, error: fetchErr } = await admin
      .from("meta_connections")
      .select("id,access_token_encrypted,status")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (connection?.access_token_encrypted && connection.status !== "revoked") {
      try {
        const { tokenEncryptionKey } = getMetaEnv();
        const token = decryptSecret(connection.access_token_encrypted, tokenEncryptionKey);
        await revokeMetaUserPermissions(token);
      } catch (err) {
        console.warn(
          "[meta/disconnect] graph revoke failed; continuing with local soft-revoke:",
          err instanceof Error ? err.message : err
        );
      }
    }

    const nowIso = new Date().toISOString();

    const { error: pagesErr } = await admin
      .from("meta_pages")
      .update({
        status: "revoked",
        is_selected: false,
        is_selectable: false,
        page_access_token_encrypted: null,
        updated_at: nowIso
      })
      .eq("organization_id", organizationId);

    if (pagesErr) throw pagesErr;

    if (connection) {
      const { error: connErr } = await admin
        .from("meta_connections")
        .update({
          status: "revoked",
          access_token_encrypted: null,
          refresh_token_encrypted: null,
          last_validated_at: nowIso,
          last_error: "disconnected_by_user"
        })
        .eq("id", connection.id);

      if (connErr) throw connErr;
    }

    revalidatePath("/pages");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Холболтыг салгаж чадсангүй."
    };
  }
}
