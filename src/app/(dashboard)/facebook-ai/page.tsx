import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { CommentsDashboard } from "./CommentsDashboard";

export default async function FacebookAIPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) redirect("/setup-organization");

  return <CommentsDashboard orgId={organization.id} />;
}
