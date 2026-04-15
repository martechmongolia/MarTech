'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/modules/auth/session';
import { getCurrentUserOrganization } from '@/modules/organizations/data';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  subscribePageToFeedWebhook,
  unsubscribePageFromWebhook,
} from '@/lib/meta/client';
import { getDecryptedPageToken, ensureReplySettingsForConnection } from './data';

export type CommentAiToggleState = {
  error?: string;
};

/**
 * Enable or disable Facebook Comment AI for a single meta_pages row. Enabling
 * lazily creates a default fb_reply_settings row and subscribes the page to the
 * Graph API `feed` webhook. Disabling attempts to unsubscribe the webhook but
 * leaves the settings row in place so the user can re-enable without losing
 * their configuration.
 */
export async function toggleCommentAiEnabled(params: {
  organizationId: string;
  metaPageId: string;
  enabled: boolean;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const org = await getCurrentUserOrganization(user.id);
  if (!org || org.id !== params.organizationId) {
    throw new Error('Not authorized for this organization');
  }

  const admin = getSupabaseAdminClient();

  // Load the page and confirm it belongs to the caller's org.
  const { data: page, error: pageError } = await admin
    .from('meta_pages')
    .select('id,organization_id,meta_page_id,status')
    .eq('id', params.metaPageId)
    .maybeSingle();

  if (pageError) throw pageError;
  if (!page) throw new Error('Page not found');
  if (page.organization_id !== params.organizationId) {
    throw new Error('Page does not belong to this organization');
  }
  if (page.status !== 'active') {
    throw new Error('Page is not active — reconnect required');
  }

  const pageAccessToken = await getDecryptedPageToken(params.metaPageId);

  if (params.enabled) {
    // 1. Ensure settings row exists (uses schema defaults).
    await ensureReplySettingsForConnection(params.metaPageId);

    // 2. Subscribe to Facebook webhook.
    try {
      await subscribePageToFeedWebhook(page.meta_page_id, pageAccessToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to subscribe webhook: ${msg}`);
    }

    // 3. Flip the flag on meta_pages.
    const { error: updateError } = await admin
      .from('meta_pages')
      .update({
        comment_ai_enabled: true,
        webhook_subscribed_at: new Date().toISOString(),
      })
      .eq('id', params.metaPageId);

    if (updateError) throw updateError;
  } else {
    // Best-effort unsubscribe — don't block disable on transient FB errors.
    try {
      await unsubscribePageFromWebhook(page.meta_page_id, pageAccessToken);
    } catch (err) {
      console.warn(
        `[fb-ai] Unsubscribe failed for page ${page.meta_page_id}, proceeding with local disable:`,
        err instanceof Error ? err.message : err,
      );
    }

    const { error: updateError } = await admin
      .from('meta_pages')
      .update({
        comment_ai_enabled: false,
        webhook_subscribed_at: null,
      })
      .eq('id', params.metaPageId);

    if (updateError) throw updateError;
  }

  revalidatePath('/pages');
  revalidatePath('/facebook-ai');
  revalidatePath('/facebook-ai/settings');
}

export async function toggleCommentAiEnabledAction(
  _prev: CommentAiToggleState,
  formData: FormData,
): Promise<CommentAiToggleState> {
  const organizationId = formData.get('organizationId');
  const metaPageId = formData.get('metaPageId');
  const enabled = formData.get('enabled');

  if (
    typeof organizationId !== 'string' ||
    typeof metaPageId !== 'string' ||
    typeof enabled !== 'string'
  ) {
    return { error: 'Invalid request.' };
  }

  try {
    await toggleCommentAiEnabled({
      organizationId,
      metaPageId,
      enabled: enabled === 'true',
    });
    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update AI setting.',
    };
  }
}
