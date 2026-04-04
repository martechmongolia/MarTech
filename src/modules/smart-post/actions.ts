'use server';

/**
 * Layer: server actions for Next.js pages — smart post generation & management.
 */

import { revalidatePath } from 'next/cache';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/modules/auth/session';
import { getCurrentUserOrganization } from '@/modules/organizations/data';
import { generatePost } from './generator';
import { indexPagePosts } from './indexer';
import { getGeneratedPosts } from './data';
import type { GeneratePostInput, GeneratedPost } from './types';
import type { GeneratedPostSummary } from './data';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireOrg() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  const org = await getCurrentUserOrganization(user.id);
  if (!org) throw new Error('Organization not found');
  return { user, org };
}

// ─── Generation ───────────────────────────────────────────────────────────────

/**
 * Generate a new post using RAG.
 * Input orgId is overridden with the authenticated user's org for security.
 */
export async function generatePostAction(
  input: Omit<GeneratePostInput, 'orgId'>
): Promise<GeneratedPost> {
  const { org } = await requireOrg();

  return generatePost({
    ...input,
    orgId: org.id,
  });
}

// ─── Indexing ─────────────────────────────────────────────────────────────────

export interface IndexPagePostsResult {
  indexed: number;
  skipped: number;
  errors: number;
}

/**
 * Trigger RAG indexing for a page's posts.
 * User must own the page's organization.
 */
export async function indexPagePostsAction(
  pageId: string
): Promise<IndexPagePostsResult> {
  const { org } = await requireOrg();

  // Verify page belongs to org
  const admin = getSupabaseAdminClient();
  const { data: page, error: pageError } = await admin
    .from('meta_pages')
    .select('id')
    .eq('id', pageId)
    .eq('organization_id', org.id)
    .single();

  if (pageError || !page) {
    throw new Error('Page not found or access denied');
  }

  const result = await indexPagePosts(org.id, pageId);
  revalidatePath('/smart-post');
  return result;
}

// ─── History ──────────────────────────────────────────────────────────────────

/**
 * Get generated posts history for the current user's organization.
 */
export async function getGeneratedPostsAction(
  limit = 20
): Promise<GeneratedPostSummary[]> {
  const { org } = await requireOrg();
  return getGeneratedPosts(org.id, undefined, limit);
}

// ─── Post management ──────────────────────────────────────────────────────────

/**
 * Approve a generated post draft.
 */
export async function approvePostAction(postId: string): Promise<void> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('generated_posts')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('organization_id', org.id);

  if (error) throw new Error(`Failed to approve post: ${error.message}`);
  revalidatePath('/smart-post');
}

/**
 * Schedule an approved post for publishing.
 */
export async function schedulePostAction(
  postId: string,
  scheduledAt: string
): Promise<void> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('generated_posts')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('organization_id', org.id);

  if (error) throw new Error(`Failed to schedule post: ${error.message}`);
  revalidatePath('/smart-post');
}

/**
 * Delete a draft generated post.
 * Only draft posts can be deleted through this action.
 */
export async function deleteGeneratedPostAction(postId: string): Promise<void> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: post } = await (admin as any)
    .from('generated_posts')
    .select('status')
    .eq('id', postId)
    .eq('organization_id', org.id)
    .single();

  if (!post) throw new Error('Post not found');

  const status = (post as AnyRecord).status as string;
  if (status !== 'draft') {
    throw new Error('Only draft posts can be deleted');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('generated_posts')
    .delete()
    .eq('id', postId)
    .eq('organization_id', org.id);

  if (error) throw new Error(`Failed to delete post: ${error.message}`);
  revalidatePath('/smart-post');
}
