import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getCommentCounts, getCommentsWithReplies } from "@/modules/facebook-ai/data";
import { CommentsDashboard } from "./CommentsDashboard";

const INITIAL_PAGE_SIZE = 50;

export default async function FacebookAIPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) redirect("/setup-organization");

  // Initial view is the "pending" tab — fetch just that slice, plus the
  // aggregate counts for all tabs so badge numbers don't depend on what we
  // happened to load. Everything else loads on demand from the client.
  const [comments, counts] = await Promise.all([
    getCommentsWithReplies(organization.id, "pending", INITIAL_PAGE_SIZE),
    getCommentCounts(organization.id),
  ]);

  const nextCursor =
    comments.length === INITIAL_PAGE_SIZE
      ? comments[comments.length - 1]?.received_at ?? null
      : null;

  return (
    <CommentsDashboard
      orgId={organization.id}
      initialComments={comments}
      initialCounts={counts}
      initialCursor={nextCursor}
      initialTab="pending"
      pageSize={INITIAL_PAGE_SIZE}
    />
  );
}
