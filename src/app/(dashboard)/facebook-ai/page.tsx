import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getCommentsWithReplies } from "@/modules/facebook-ai/data";
import { CommentsDashboard } from "./CommentsDashboard";

export default async function FacebookAIPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) redirect("/setup-organization");

  const comments = await getCommentsWithReplies(organization.id);

  return <CommentsDashboard orgId={organization.id} initialComments={comments} />;
}
